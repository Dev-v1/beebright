"""Public, ephemeral five-car races hosted by the API process."""
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
                    time=max(0, now-self.started) if self.started else 0, cars=self.cars)

    async def broadcast(self):
        data = json.dumps(self.state())
        async def send(member):
            try:
                await asyncio.wait_for(member['ws'].send_text(data), .3)
            except Exception:
                pass
        await asyncio.gather(*(send(m) for m in list(self.members.values())))

    def step(self, dt, elapsed):
        track = TRACKS[self.track]
        length, width = track['length'], track['width']
        finish = length*self.laps
        for car in self.cars:
            if car['finished']:
                continue
            member = self.members.get(car['slot'])
            keys = member['input'] if member and time.monotonic()-member['last']<1 else {}
            bend = track['bends'][int(car['distance']%length/length*len(track['bends']))%len(track['bends'])]
            if car['bot']:
                target = max(12, 34-abs(bend)*240)+(car['slot']%2)
                car['speed'] += max(-12*dt, min(8*dt, target-car['speed']))
                lane = math.sin(elapsed*.35+car['slot'])*width*.18
                car['steer'] = max(-1, min(1, (lane-car['lane'])*.6))
            else:
                car['steer'] = int(bool(keys.get('right')))-int(bool(keys.get('left')))
                car['speed'] += ((10 if keys.get('up') else 0)-(16 if keys.get('down') and car['speed']>0 else 6 if keys.get('down') else 0))*dt
                if not keys.get('up') and not keys.get('down'):
                    car['speed'] *= math.exp(-.35*dt)
                car['speed'] = max(-7, min(38, car['speed']))
                if abs(car['lane'])>width/2:
                    car['speed'] *= math.exp(-.55*dt)
            if car['bot']:
                car['lane'] = max(-width, min(width, car['lane']+car['steer']*max(3, abs(car['speed']))*.28*dt))
                advance=car['speed']*dt
            else:
                car['headingError'] += car['steer']*dt*2*max(-1,min(1,car['speed']/9))/(1+abs(car['speed'])*.022)
                advance=car['speed']*math.cos(car['headingError'])*dt
                car['headingError'] -= bend*advance
                car['headingError'] = math.atan2(math.sin(car['headingError']),math.cos(car['headingError']))
                car['lane'] = max(-width, min(width, car['lane']+car['speed']*math.sin(car['headingError'])*dt))
            car['distance'] = max(0, min(finish, car['distance']+advance))
            if car['distance'] >= finish:
                car.update(finished=True, finishTime=round(elapsed, 3), speed=0.)
        for i, a in enumerate(self.cars):
            for b in self.cars[i+1:]:
                if not a['finished'] and not b['finished'] and abs(a['distance']-b['distance'])<3 and abs(a['lane']-b['lane'])<1.7:
                    if a['distance']>=b['distance']:
                        b['speed'] = min(b['speed'], a['speed'])
                    else:
                        a['speed'] = min(a['speed'], b['speed'])

    async def run(self):
        previous = time.monotonic()
        try:
            while self.members:
                now = time.monotonic()
                dt = min(.1, now-previous)
                previous = now
                if now>=self.started:
                    self.phase = 'racing'
                    self.step(dt, now-self.started)
                    if all(c['finished'] for c in self.cars) or now-self.started>=600:
                        self.phase = 'finished'
                await self.broadcast()
                if self.phase=='finished':
                    return
                await asyncio.sleep(.05)
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
            if len(raw)>1024:
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
