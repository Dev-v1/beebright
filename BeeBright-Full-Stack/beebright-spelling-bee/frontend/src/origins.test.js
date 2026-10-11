import test from 'node:test';import assert from 'node:assert/strict';
import {languageOrigin} from './origins.js';
import {preferredVoice} from './speech.js';
test('origins describe attested routes in chronological order without historical spellings',()=>{
 const route=languageOrigin('Borrowed from French, which took it from Italian bronzo.','bronze');assert.equal(route,'Italian → French → English.');assert.equal(languageOrigin(route,'bronze'),route);
 assert.equal(languageOrigin('From Greek through Latin and French.'),'Language elements: Greek + Latin + French → English. The source does not establish one borrowing sequence.');
 assert.equal(languageOrigin('From Greek via Latin.'),'Greek → Latin → English.');
 assert.equal(languageOrigin('Through Middle English from Latin custodia.'),'Latin → Middle English → English.');
 assert.equal(languageOrigin('From Middle English sky, from Old Norse ský (whence Old English scēo), from Proto-Germanic *skiwją. Cognates include German.' ,'sky'),'Proto-Germanic → Old Norse → Middle English → English.');
 assert.ok(!languageOrigin('Borrowed from Japanese.', 'Japanese').includes('Japanese'));
 assert.ok(languageOrigin('From Dutch or Low German.').includes('does not establish one borrowing sequence'));
});
test('natural English voices are preferred and offline speech cannot select a cloud voice',()=>{
 const voices=[{name:'System',lang:'en-US',voiceURI:'system',localService:true,default:true},{name:'Natural',lang:'en-US',voiceURI:'cloud',localService:false},{name:'Enhanced',lang:'en-US',voiceURI:'enhanced',localService:true}];
 assert.equal(preferredVoice(voices).voiceURI,'cloud');assert.equal(preferredVoice(voices,'',true).voiceURI,'enhanced');assert.equal(preferredVoice(voices,'system').voiceURI,'system');assert.equal(preferredVoice(voices,'cloud',true),null);
});
