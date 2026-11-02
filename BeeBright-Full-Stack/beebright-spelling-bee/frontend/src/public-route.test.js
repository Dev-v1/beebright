import test from 'node:test';
import assert from 'node:assert/strict';
import {publicRoute} from './public-route.js';
test('marketing home is only for guests; signed-in home stays the practice app',()=>{
  assert.equal(publicRoute('/',false),'home');
  assert.equal(publicRoute('/',true),null);
});
test('arcade is public for guests and signed-in users without opening private routes',()=>{
  for(const signedIn of [false,true]){
    assert.equal(publicRoute('/games',signedIn),'games');
    for(const path of ['/admin','/settings','/classrooms','/sign-in','/sign-up','/practice'])assert.equal(publicRoute(path,signedIn),null);
  }
});
