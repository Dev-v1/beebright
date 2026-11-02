import time
import unittest
from contextlib import ExitStack
from fastapi import FastAPI
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect
from app.rally_rooms import Room,ROOMS,CONNECTIONS,router,TRACKS
app=FastAPI();app.include_router(router)
HEADERS={'origin':'https://www.beebright.app'}
def receive(ws,kind='state'):
    for _ in range(100):
        value=ws.receive_json()
        if value['type']==kind:return value
    raise AssertionError('Expected '+kind)
def hello(ws,**data):ws.send_json({'protocol':2,**data})
def pose_packet(elapsed=1):
    return dict(type='host_snapshot',time=elapsed,cars=[dict(slot=i,x=i*8.,y=0.,z=0.,heading=0.,distance=10.,speed=9.,finished=False) for i in range(5)])

class RoomTests(unittest.TestCase):
    def tearDown(self):
        self.assertFalse(ROOMS);self.assertFalse(CONNECTIONS)
    def test_host_controls_and_guest_packets(self):
        with TestClient(app) as client,client.websocket_connect('/api/rally/ws',headers=HEADERS) as host:
            hello(host,type='create',name='Host',track=0,laps=1)
            receive(host,'welcome');state=receive(host)
            self.assertEqual(sum(c['bot'] for c in state['cars']),4)
            with client.websocket_connect('/api/rally/ws',headers=HEADERS) as guest:
                hello(guest,type='join',name='Guest',code=state['code'].lower())
                receive(guest,'welcome');joined=receive(guest)
                self.assertEqual(sum(c['bot'] for c in joined['cars']),3)
                guest.send_json(dict(type='start'));self.assertIn('Only the host',receive(guest,'error')['message'])
                host.send_json(dict(type='start'));self.assertIn('loading graphics',receive(host,'error')['message'])
                host.send_json(dict(type='ready'));guest.send_json(dict(type='ready'))
                while not all(c['bot'] or c['ready'] for c in receive(host)['cars']):pass
                host.send_json(dict(type='start'))
                ROOMS[state['code']].started=time.monotonic()-.1
                while receive(host)['phase']!='racing':pass
                guest.send_json(dict(type='input',up=True,x=999999))
                control=receive(host,'controls');self.assertEqual(control['slot'],1);self.assertTrue(control['keys']['up'])
                self.assertEqual(ROOMS[state['code']].cars[1]['distance'],0)
                guest.send_json(pose_packet());self.assertIn('Only the host',receive(guest,'error')['message'])
                host.send_json(pose_packet());moved=receive(guest)
                self.assertEqual(moved['cars'][1]['x'],8);self.assertNotIn('inputs',moved)
            self.assertTrue(ROOMS[state['code']].cars[1]['bot'])
    def test_full_room_and_handoff(self):
        with TestClient(app) as client,ExitStack() as stack:
            host=stack.enter_context(client.websocket_connect('/api/rally/ws',headers=HEADERS))
            hello(host,type='create');receive(host,'welcome');state=receive(host)
            for i in range(4):
                guest=stack.enter_context(client.websocket_connect('/api/rally/ws',headers=HEADERS))
                hello(guest,type='join',code=state['code']);receive(guest,'welcome');joined=receive(guest)
            self.assertEqual(sum(c['bot'] for c in joined['cars']),0)
            with client.websocket_connect('/api/rally/ws',headers=HEADERS) as extra:
                hello(extra,type='join',code=state['code']);self.assertIn('five players',receive(extra,'error')['message'])
        r=Room(0,1);r.join(None,'A');r.join(None,'B');r.phase='racing';r.accept_snapshot(0,pose_packet())
        r.leave(0);self.assertEqual(r.host,1);self.assertEqual(r.cars[1]['x'],8);self.assertEqual(r.elapsed,1)
    def test_invalid_origin_version_options_and_missing_room(self):
        with TestClient(app) as client:
            with self.assertRaises(WebSocketDisconnect):
                with client.websocket_connect('/api/rally/ws',headers={'origin':'https://evil.example'}):pass
            for payload in [dict(type='create'),dict(protocol=2,type='create',laps=0),dict(protocol=2,type='create',track=99),dict(protocol=2,type='join',code='XXXXXXXX')]:
                with client.websocket_connect('/api/rally/ws',headers=HEADERS) as ws:
                    ws.send_json(payload);self.assertTrue(receive(ws,'error')['message'])
    def test_snapshot_validation_and_membership(self):
        r=Room(11,1);r.join(None,'Real name');r.phase='racing'
        invalid=pose_packet();invalid['cars'][4]['x']=float('nan')
        with self.assertRaises(ValueError):r.accept_snapshot(0,invalid)
        self.assertEqual(r.cars[0]['distance'],0)
        packet=pose_packet();packet['cars'][0].update(name='Spoof',bot=True,ready=False)
        r.accept_snapshot(0,packet)
        self.assertEqual(r.cars[0]['name'],'Real name');self.assertFalse(r.cars[0]['bot'])
        with self.assertRaises(ValueError):r.accept_snapshot(0,pose_packet(.5))
        self.assertEqual(len(TRACKS),12);self.assertFalse(hasattr(r,'step'))
    def test_finish(self):
        r=Room(0,1);r.join(None,'Host');r.phase='racing'
        packet=pose_packet(20)
        for c in packet['cars']:c.update(finished=True,finishTime=19.)
        r.accept_snapshot(0,packet);self.assertEqual(r.phase,'finished')
if __name__=='__main__':unittest.main()
