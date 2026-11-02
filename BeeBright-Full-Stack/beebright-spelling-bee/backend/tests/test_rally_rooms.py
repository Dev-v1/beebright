import asyncio
import time
import unittest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect
from app.rally_rooms import Room, ROOMS, CONNECTIONS, router

app=FastAPI()
app.include_router(router)
HEADERS={'origin':'https://www.beebright.app'}

def receive(ws, kind='state'):
    for _ in range(100):
        value=ws.receive_json()
        if value['type']==kind:return value
    raise AssertionError('Expected '+kind)

class RoomTests(unittest.TestCase):
    def tearDown(self):
        self.assertFalse(ROOMS)
        self.assertFalse(CONNECTIONS)

    def test_guest_room_fills_empty_slots_and_rejects_guest_start(self):
        with TestClient(app) as client, client.websocket_connect('/api/rally/ws',headers=HEADERS) as host:
            host.send_json(dict(type='create',name='Host',track=0,laps=1))
            self.assertEqual(receive(host,'welcome')['slot'],0)
            room=receive(host)
            self.assertEqual(len(room['cars']),5)
            self.assertEqual(sum(c['bot'] for c in room['cars']),4)
            with client.websocket_connect('/api/rally/ws',headers=HEADERS) as guest:
                guest.send_json(dict(type='join',name='Guest',code=room['code'].lower()))
                self.assertEqual(receive(guest,'welcome')['slot'],1)
                joined=receive(guest)
                self.assertEqual(sum(c['bot'] for c in joined['cars']),3)
                guest.send_json(dict(type='start'))
                self.assertIn('Only the host',receive(guest,'error')['message'])
                host.send_json(dict(type='start'))
                self.assertIn('loading graphics',receive(host,'error')['message'])
                host.send_json(dict(type='ready'));guest.send_json(dict(type='ready'))
                while not all(c['bot'] or c['ready'] for c in receive(host)['cars']):pass
                host.send_json(dict(type='start'))
                while receive(host)['phase']=='lobby':pass
                guest.send_json(dict(type='input',up=True,distance=999999))
                self.assertLess(ROOMS[room['code']].cars[1]['distance'],1)
            self.assertTrue(ROOMS[room['code']].cars[1]['bot'])

    def test_full_room_and_host_transfer(self):
        from contextlib import ExitStack
        with TestClient(app) as client, ExitStack() as stack:
            host=stack.enter_context(client.websocket_connect('/api/rally/ws',headers=HEADERS))
            host.send_json(dict(type='create'))
            receive(host,'welcome');room=receive(host)
            for i in range(4):
                guest=stack.enter_context(client.websocket_connect('/api/rally/ws',headers=HEADERS))
                guest.send_json(dict(type='join',code=room['code'],name=str(i)))
                receive(guest,'welcome');state=receive(guest)
            self.assertEqual(sum(c['bot'] for c in state['cars']),0)
            with client.websocket_connect('/api/rally/ws',headers=HEADERS) as extra:
                extra.send_json(dict(type='join',code=room['code']))
                self.assertIn('five players',receive(extra,'error')['message'])
            host.close()
            # Host migration is also checked without network scheduling races.
            r=Room(0,1);r.join(None,'A');r.join(None,'B');r.leave(0)
            self.assertEqual(r.host,1)

    def test_invalid_origin_options_and_missing_room(self):
        with TestClient(app) as client:
            with self.assertRaises(WebSocketDisconnect):
                with client.websocket_connect('/api/rally/ws',headers={'origin':'https://evil.example'}):pass
            for payload in [dict(type='create',laps=0),dict(type='create',track=99),dict(type='join',code='XXXXXXXX')]:
                with client.websocket_connect('/api/rally/ws',headers=HEADERS) as ws:
                    ws.send_json(payload)
                    self.assertTrue(receive(ws,'error')['message'])

    def test_simulation_is_finite_and_bots_finish_all_tracks(self):
        from app.rally_rooms import TRACKS
        import math
        for track in range(len(TRACKS)):
            r=Room(track,1)
            for tick in range(20000):
                r.step(.05,tick*.05)
                if all(c['finished'] for c in r.cars):break
            self.assertTrue(all(c['finished'] for c in r.cars))
            self.assertTrue(all(math.isfinite(c['distance']) and c['finishTime']>=0 for c in r.cars))

    def test_human_controls_and_stale_input_release(self):
        r=Room(0,1);r.join(None,'Driver')
        r.members[0]['input']={'up':True,'right':True}
        r.step(.05,1)
        self.assertGreater(r.cars[0]['speed'],0)
        self.assertGreater(r.cars[0]['steer'],0)
        r.members[0]['last']=time.monotonic()-2
        previous=r.cars[0]['speed'];r.step(.05,2)
        self.assertLess(r.cars[0]['speed'],previous)

if __name__=='__main__':unittest.main()
