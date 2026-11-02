"""Public five-car room coordinator. Physics runs on the host browser."""
import asyncio
import json
import math
import secrets
import time
from collections import defaultdict, deque
from pathlib import Path
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.config import get_settings

router = APIRouter()
ROOMS = {}
CONNECTIONS = defaultdict(int)
ATTEMPTS = {}
TRACKS = json.loads((Path(__file__).parent/'rally_tracks.json').read_text())

class Room:
    def __init__(self, track, laps):
        self.code = secrets.token_hex(4).upper()
        self.track, self.laps = track, laps
        self.created = time.monotonic()
        self.members = {}
        self.host = None
        self.phase = 'lobby'
        self.started = 0
        self.task = None
        self.elapsed = 0.
        self.last_snapshot = time.monotonic()
        self.host_timeout = 30
        self.cars = [dict(slot=i, name='Bot '+str(i+1), bot=True, distance=0., lane=(i-2)*2.8, speed=0., steer=0., headingError=0., finished=False, finishTime=None, ready=True) for i in range(5)]

    def join(self, ws, name):
        if self.phase != 'lobby':
            raise ValueError('This race already started. Create another room.')
        slot = next((i for i in range(5) if i not in self.members), None)
        if slot is None:
            raise ValueError('This room already has five players.')
        self.members[slot] = dict(ws=ws, input={}, last=time.monotonic(), ready=False)
        self.cars[slot].update(name=name, bot=False, ready=False)
        if self.host is None:
            self.host = slot
        return slot

    def leave(self, slot):
        self.members.pop(slot, None)
        self.cars[slot].update(bot=True, ready=True, name='Bot '+str(slot+1))
        if self.host == slot:
            self.host = next(iter(self.members), None)
            self.last_snapshot = time.monotonic()
            self.host_timeout = 30

    def start(self, slot):
        if slot != self.host:
            raise ValueError('Only the host can start the race.')
        if self.phase != 'lobby':
            return
        if not all(m.get('ready') for m in self.members.values()):
            raise ValueError('Players are still loading graphics. Wait until everyone is ready.')
        self.phase = 'countdown'
        self.started = time.monotonic()+3
        self.task = asyncio.create_task(self.run())

    def state(self):
        now = time.monotonic()
        return dict(type='state', code=self.code, host=self.host, track=self.track, laps=self.laps,
                    phase=self.phase, countdown=max(0, math.ceil(self.started-now)) if self.phase=='countdown' else 0,
                    time=self.elapsed, cars=self.cars, inputs={str(i):m['input'] if now-m['last']<1 else {} for i,m in self.members.items()})

    async def broadcast(self):
        state = self.state()
        async def send(member):
            try:
                payload={**state}
                if member is not self.members.get(self.host):
                    payload.pop('inputs',None)
                await asyncio.wait_for(member['ws'].send_json(payload), .3)
            except Exception:
                pass
        await asyncio.gather(*(send(m) for m in list(self.members.values())))

    def accept_snapshot(self, slot, payload):
        if slot != self.host:
            raise ValueError('Only the host can send race positions.')
        if self.phase != 'racing':
            return
        elapsed=payload.get('time')
        if type(elapsed) not in (int,float) or not math.isfinite(elapsed) or not self.elapsed-.001<=elapsed<=601:
            raise ValueError('Invalid race time.')
        cars=payload.get('cars')
        if not isinstance(cars,list) or len(cars)!=5:
            raise ValueError('A race must have five cars.')
        fields=('x','y','z','heading','speed','distance','lane','gates','previous','grade','crossGrade','gear','rpm','shift','travel')
        required=('x','y','z','heading','speed','distance')
        updates=[]
        for i,raw in enumerate(cars):
            if not isinstance(raw,dict) or type(raw.get('slot'))!=int or raw['slot']!=i:
                raise ValueError('Invalid racer slot.')
            pose={}
            for key in fields:
                if key in raw:
                    value=raw[key]
                    if type(value) not in (int,float) or not math.isfinite(value) or abs(value)>1000000:
                        raise ValueError('Invalid car position.')
                    pose[key]=value
            if any(key not in pose for key in required) or abs(pose['speed'])>150:
                raise ValueError('Invalid car position.')
            finished=raw.get('finished') is True
            finish_time=raw.get('finishTime')
            if finished:
                if type(finish_time) not in (int,float) or not math.isfinite(finish_time) or not 0<=finish_time<=elapsed+.05:
                    raise ValueError('Invalid finish time.')
            pose.update(finished=finished,finishTime=finish_time if finished else None)
            updates.append(pose)
        for car,pose in zip(self.cars,updates):
            car.update(pose)
        self.elapsed=max(self.elapsed,elapsed)
        self.last_snapshot=time.monotonic()
        self.host_timeout=10
        if all(c['finished'] for c in self.cars):
            self.phase='finished'

    async def run(self):
        try:
            while self.members and self.phase!='finished':
                now=time.monotonic()
                changed=False
                if self.phase=='countdown':
                    if now>=self.started:
                        self.phase='racing'
                        self.last_snapshot=now
                    changed=True
                elif self.phase=='racing':
                    if now-self.started>=600:
                        self.phase='finished'
                        changed=True
                    elif now-self.last_snapshot>self.host_timeout:
                        successor=next((i for i,m in self.members.items() if i!=self.host and m['ready']),None)
                        if successor is not None:
                            self.host=successor
                            self.last_snapshot=now
                            self.host_timeout=30
                            changed=True
                if changed:
                    await self.broadcast()
                await asyncio.sleep(.1)
        except asyncio.CancelledError:
            pass

def clean_name(value):
    return ''.join(c for c in str(value or 'Guest').strip()[:24] if c.isprintable()) or 'Guest'

def allow_attempt(ip):
    now=time.monotonic()
    for key in list(ATTEMPTS):
        if not ATTEMPTS[key] or ATTEMPTS[key][-1]<now-600:
            ATTEMPTS.pop(key,None)
    if ip not in ATTEMPTS and len(ATTEMPTS)>=10000:
        return False
    attempts=ATTEMPTS.setdefault(ip,deque())
    while attempts and attempts[0]<now-600:
        attempts.popleft()
    if len(attempts)>=120:
        return False
    attempts.append(now)
    return True

@router.websocket('/api/rally/ws')
async def rally_socket(ws: WebSocket):
    allowed = set(get_settings().frontend_origins)|{'https://beebright.app','https://www.beebright.app','https://beebright.vercel.app','http://localhost:5173','http://127.0.0.1:5173'}
    ip = ws.client.host if ws.client else 'unknown'
    if ws.headers.get('origin') not in allowed or CONNECTIONS.get(ip,0)>=16 or sum(CONNECTIONS.values())>=160 or not allow_attempt(ip):
        await ws.close(code=1008)
        return
    CONNECTIONS[ip] += 1
    room = None
    slot = None
    try:
        await ws.accept()
        first = await asyncio.wait_for(ws.receive_text(), 20)
        if len(first)>1024:
            raise ValueError('Request too large.')
        data = json.loads(first)
        if data.get('protocol')!=2:
            raise ValueError('Please refresh the games page to use laptop-hosted races.')
        for key, old in list(ROOMS.items()):
            if not old.members or time.monotonic()-old.created>3600:
                if old.task:
                    old.task.cancel()
                ROOMS.pop(key, None)
        if data.get('type')=='create':
            if len(ROOMS)>=32:
                raise ValueError('Rooms are busy. Try again later.')
            track, laps = data.get('track',0), data.get('laps',2)
            if type(track)!=int or not 0<=track<len(TRACKS) or type(laps)!=int or not 1<=laps<=10:
                raise ValueError('Invalid track or lap count.')
            room = Room(track,laps)
            while room.code in ROOMS:
                room.code = secrets.token_hex(4).upper()
            ROOMS[room.code] = room
        elif data.get('type')=='join':
            room = ROOMS.get(str(data.get('code','')).strip().upper())
            if not room:
                raise ValueError('Room not found or expired.')
        else:
            raise ValueError('Choose create or join.')
        slot = room.join(ws,clean_name(data.get('name')))
        await ws.send_json(dict(type='welcome',slot=slot))
        await room.broadcast()
        window, count = time.monotonic(), 0
        while time.monotonic()-room.created<3600:
            raw = await asyncio.wait_for(ws.receive_text(), 35)
            if len(raw)>8192:
                raise ValueError('Request too large.')
            now = time.monotonic()
            if now-window>1:
                window,count = now,0
            count += 1
            if count>60:
                raise ValueError('Too many messages.')
            data = json.loads(raw)
            if data.get('type')=='input':
                room.members[slot]['input'] = {k:data.get(k) is True for k in ('up','down','left','right')}
                room.members[slot]['last'] = now
                owner=room.members.get(room.host)
                if owner:
                    try:
                        await asyncio.wait_for(owner['ws'].send_json(dict(type='controls',slot=slot,keys=room.members[slot]['input'])),.3)
                    except Exception:
                        pass
            elif data.get('type')=='host_snapshot':
                try:
                    room.accept_snapshot(slot,data)
                    await room.broadcast()
                except ValueError as exc:
                    await ws.send_json(dict(type='error',message=str(exc)))
            elif data.get('type')=='ready':
                room.members[slot]['ready'] = True
                room.cars[slot]['ready'] = True
                await room.broadcast()
            elif data.get('type')=='start':
                try:
                    room.start(slot)
                except ValueError as exc:
                    await ws.send_json(dict(type='error',message=str(exc)))
                await room.broadcast()
            elif data.get('type')=='ping':
                await ws.send_json(dict(type='pong'))
    except (ValueError,TypeError,AttributeError,asyncio.TimeoutError) as exc:
        try:
            await ws.send_json(dict(type='error',message=str(exc) or 'Room connection expired.'))
        except Exception:
            pass
    except (WebSocketDisconnect,RuntimeError):
        pass
    finally:
        CONNECTIONS[ip] -= 1
        if not CONNECTIONS[ip]:
            CONNECTIONS.pop(ip,None)
        if room is not None and slot is not None:
            room.leave(slot)
            if room.members:
                await room.broadcast()
            else:
                ROOMS.pop(room.code,None)
                if room.task:
                    room.task.cancel()
        try:
            await ws.close()
        except Exception:
            pass
