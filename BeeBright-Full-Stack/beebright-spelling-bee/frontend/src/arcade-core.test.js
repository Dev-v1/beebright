import test from 'node:test';
import assert from 'node:assert/strict';
import {availableGames,breakAfter,secondsLeft,normalizeScores,DASH_LEVELS} from './arcade-core.js';
import {mount2D} from './games-2d.js';
test('break checkpoints respect full sets and never interrupt challenges',()=>{
 assert.equal(breakAfter(49,150),null);assert.equal(breakAfter(51,150),null);
 assert.deepEqual(breakAfter(50,150),{minutes:10,after:'practice',completed:50});
 assert.equal(breakAfter(100,150).minutes,10);assert.equal(breakAfter(150,150).minutes,25);
 assert.equal(breakAfter(150,150).after,'results');assert.equal(breakAfter(50,150,true),null);
 assert.equal(secondsLeft(70000,10000),60);assert.equal(secondsLeft(70000,80000),0);
 assert.equal(availableGames(false).length,5);assert.equal(availableGames(true).length,8);
 assert.equal(DASH_LEVELS.length,5);assert.equal(normalizeScores({sky:-3,bowling:Infinity}).sky,0);
});
function harness(id){let callback,finished,status,cancelled=false;global.requestAnimationFrame=fn=>(callback=fn,1);global.cancelAnimationFrame=()=>{cancelled=true;};const gradient={addColorStop(){}};const finite=(...args)=>{for(const n of args.slice(0,2))assert.ok(Number.isFinite(n),'Game coordinates must stay finite');};const context=new Proxy({arc:finite,roundRect:finite,translate:finite,createLinearGradient:()=>gradient},{get:(v,k)=>v[k]||(()=>{}),set:(v,k,x)=>(v[k]=x,true)});const input={};const engine=mount2D({getContext:()=>context},{id,input,onFinish:r=>finished=r,onStatus:s=>status=s});let now=0;return {input,engine,get finished(){return finished;},get status(){return status;},step(n){for(let i=0;i<n;i++){now+=1000/60;callback(now);}},get cancelled(){return cancelled;}};}
test('bowling completes five frames with bounded pin scoring; pause stops simulation',()=>{
 const h=harness('bowling');h.engine.pause(true);h.step(300);assert.equal(h.finished,undefined);h.engine.pause(false);
 for(let i=0;i<1800&&!h.finished;i++){h.input.action=i%2===0;h.step(1);}
 assert.equal(h.finished.won,true);assert.ok(h.finished.score>0&&h.finished.score<=50);
 h.engine.dispose();assert.equal(h.cancelled,true);
});
test('gravity collision ends a run and produces a score; each 2D game mounts and cleans up',()=>{
 const h=harness('gravity');h.step(600);assert.equal(h.finished.won,false);assert.ok(h.finished.score>0);h.engine.dispose();
 for(const id of ['sky','sheep','rally','dash']){const g=harness(id);g.step(20);assert.equal(typeof g.status,'string');g.engine.dispose();assert.equal(g.cancelled,true);}
});
