"""Bound request costs before FastAPI parses JSON or multipart uploads."""
import asyncio
import json
import time
from collections import deque


class SecurityMiddleware:
    def __init__(self, app, body_limit=4*1024*1024, upload_limit=16*1024*1024,
                 body_timeout=30, public_limit=240, window=60):
        self.app=app
        self.body_limit,self.upload_limit=body_limit,upload_limit
        self.body_timeout,self.public_limit,self.window=body_timeout,public_limit,window
        self.attempts={}
        self.active_bodies=self.active_uploads=self.active_dictionary=0

    async def __call__(self, scope, receive, send):
        if scope['type']!='http':
            return await self.app(scope,receive,send)
        path=scope.get('path','')
        headers=dict(scope.get('headers',[]))
        private=bool(headers.get(b'authorization')) or path.startswith(('/api/account','/api/classrooms','/api/admin','/api/devices','/api/progress'))
        async def secure_send(message):
            if message['type']=='http.response.start':
                values=[(k,v) for k,v in message.get('headers',[]) if k.lower()!=b'x-content-type-options' and not(private and k.lower()==b'cache-control')]
                values.append((b'x-content-type-options',b'nosniff'))
                if private:values.append((b'cache-control',b'no-store'))
                message={**message,'headers':values}
            await send(message)
        async def reject(status,detail):
            body=json.dumps({'detail':detail}).encode()
            response_headers=[(b'content-type',b'application/json'),(b'content-length',str(len(body)).encode())]
            if status==429:response_headers.append((b'retry-after',str(self.window).encode()))
            await secure_send({'type':'http.response.start','status':status,'headers':response_headers})
            await secure_send({'type':'http.response.body','body':body})
        dictionary=path.startswith(('/api/dictionary/','/api/pronunciation/'))
        if dictionary:
            now=time.monotonic()
            for key in list(self.attempts):
                if not self.attempts[key] or now-self.attempts[key][-1]>=self.window:del self.attempts[key]
            client=scope.get('client') or ('unknown',0)
            key=client[0]
            if key not in self.attempts and len(self.attempts)>=4096:
                return await reject(429,'Dictionary requests are busy. Try again shortly.')
            attempts=self.attempts.setdefault(key,deque())
            while attempts and now-attempts[0]>=self.window:attempts.popleft()
            if len(attempts)>=self.public_limit or self.active_dictionary>=8:
                return await reject(429,'Too many dictionary requests. Try again shortly.')
            attempts.append(now)
        upload=path in ('/api/admin/word-lists/import','/api/import-pdf')
        limit=self.upload_limit if upload else self.body_limit
        try:
            length=int(headers.get(b'content-length',b'0'))
            if length<0:raise ValueError()
        except ValueError:
            return await reject(400,'Invalid request size.')
        if length>limit:return await reject(413,'Request body is too large.')
        has_body=path.startswith('/api/') and scope.get('method') not in ('GET','HEAD','OPTIONS')
        if has_body and (self.active_bodies>=8 or upload and self.active_uploads>=2):
            return await reject(429,'Too many requests are being processed. Try again shortly.')
        if dictionary:self.active_dictionary+=1
        if has_body:
            self.active_bodies+=1
            if upload:self.active_uploads+=1
        try:
            if has_body:
                parts=[];size=0;deadline=time.monotonic()+self.body_timeout
                while True:
                    try:message=await asyncio.wait_for(receive(),max(0,deadline-time.monotonic()))
                    except asyncio.TimeoutError:return await reject(408,'Request body took too long to arrive.')
                    if message['type']=='http.disconnect':return
                    part=message.get('body',b'');size+=len(part)
                    if size>limit:return await reject(413,'Request body is too large.')
                    parts.append(part)
                    if not message.get('more_body',False):break
                body=b''.join(parts);del parts
                delivered=False
                async def bounded_receive():
                    nonlocal delivered
                    if not delivered:
                        delivered=True
                        return {'type':'http.request','body':body,'more_body':False}
                    return await receive()
                await self.app(scope,bounded_receive,secure_send)
            else:
                await self.app(scope,receive,secure_send)
        finally:
            if dictionary:self.active_dictionary-=1
            if has_body:
                self.active_bodies-=1
                if upload:self.active_uploads-=1
