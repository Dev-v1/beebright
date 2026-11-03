import asyncio
import unittest
from app.security import SecurityMiddleware


class BoundaryTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.calls=[]
        async def app(scope,receive,send):
            body=b''
            if scope['method']=='POST':body=(await receive()).get('body',b'')
            self.calls.append(body)
            await send({'type':'http.response.start','status':200,'headers':[]})
            await send({'type':'http.response.body','body':body})
        self.guard=SecurityMiddleware(app,body_limit=16,upload_limit=64,public_limit=2,body_timeout=.01)

    async def request(self,path='/api/account/studio',parts=(),headers=(),method='POST',receive=None):
        messages=[];chunks=list(parts)
        async def reader():
            part=chunks.pop(0) if chunks else b''
            return {'type':'http.request','body':part,'more_body':bool(chunks)}
        await self.guard({'type':'http','method':method,'path':path,'headers':headers,'client':('test',1)},receive or reader,self.sender(messages))
        return messages

    def sender(self,messages):
        async def send(message):messages.append(message)
        return send

    async def test_declared_size_rejected_before_reading_or_parsing(self):
        async def forbidden():raise AssertionError('Oversized request was read')
        result=await self.request(headers=[(b'content-length',b'99999999')],receive=forbidden)
        self.assertEqual(result[0]['status'],413);self.assertEqual(self.calls,[])

    async def test_chunked_and_dishonest_size_cannot_bypass_the_limit(self):
        for headers in [[],[(b'content-length',b'1')]]:
            result=await self.request(parts=[b'a'*10,b'b'*10],headers=headers)
            self.assertEqual(result[0]['status'],413)
        self.assertEqual(self.calls,[]);self.assertEqual(self.guard.active_bodies,0)

    async def test_normal_json_and_pdf_envelopes_remain_usable(self):
        result=await self.request(parts=[b'{"ok":',b'true}'])
        self.assertEqual(result[0]['status'],200);self.assertEqual(self.calls[-1],b'{"ok":true}')
        result=await self.request('/api/admin/word-lists/import',parts=[b'x'*32])
        self.assertEqual(result[0]['status'],200);self.assertEqual(self.guard.active_uploads,0)

    async def test_slow_or_disconnected_body_releases_capacity(self):
        async def slow():await asyncio.sleep(.1)
        result=await self.request(receive=slow)
        self.assertEqual(result[0]['status'],408);self.assertEqual(self.guard.active_bodies,0)
        async def disconnected():return {'type':'http.disconnect'}
        self.assertEqual(await self.request(receive=disconnected),[])
        self.assertEqual(self.guard.active_bodies,0)

    async def test_invalid_lengths_and_saturated_uploads_are_rejected(self):
        for length in [b'-1',b'garbage']:
            self.assertEqual((await self.request(headers=[(b'content-length',length)]))[0]['status'],400)
        self.guard.active_uploads=2
        self.assertEqual((await self.request('/api/import-pdf'))[0]['status'],429)
        self.assertEqual(self.calls,[])

    async def test_dictionary_audio_share_a_bounded_rate_budget(self):
        for path in ['/api/dictionary/bee','/api/pronunciation/bee']:
            self.assertEqual((await self.request(path,method='GET'))[0]['status'],200)
        result=await self.request('/api/pronunciation/sky',method='GET')
        self.assertEqual(result[0]['status'],429)
        self.assertIn(b'retry-after',dict(result[0]['headers']))
        self.assertEqual((await self.request('/api/health',method='GET'))[0]['status'],200)

    async def test_private_responses_are_not_cacheable_and_have_safe_content_types(self):
        result=await self.request(parts=[b'{}'])
        headers=dict(result[0]['headers'])
        self.assertEqual(headers[b'cache-control'],b'no-store')
        self.assertEqual(headers[b'x-content-type-options'],b'nosniff')
        result=await self.request('/api/word-lists',method='GET',headers=[(b'authorization',b'Bearer test')])
        self.assertEqual(dict(result[0]['headers'])[b'cache-control'],b'no-store')

    async def test_websocket_scope_is_forwarded_unchanged(self):
        calls=[]
        async def app(scope,receive,send):calls.append(scope)
        scope={'type':'websocket','path':'/api/rally/ws'}
        await SecurityMiddleware(app)(scope,None,None)
        self.assertEqual(calls,[scope])
