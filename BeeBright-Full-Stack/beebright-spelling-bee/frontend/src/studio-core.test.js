import test from 'node:test';
import assert from 'node:assert/strict';
import {FEATURES, dailyWords, missedWords, summary, normalizeStudio, achievements, pairWords, originMatches, choicesFor} from './studio-core.js';
import {sentenceHint} from './hints.js';
test('twenty features and stable daily challenge independent of catalog order',()=>{
 assert.equal(FEATURES.length,20); assert.equal(new Set(FEATURES.map(f=>f[0])).size,20);
 const words=Array.from({length:150},(_,i)=>({word:'word'+i}));
 assert.deepEqual(dailyWords(words,'2026-10-09'),dailyWords([...words].reverse(),'2026-10-09'));
 assert.equal(new Set(dailyWords(words,'2026-10-09').map(w=>w.word)).size,10);
 assert.notDeepEqual(dailyWords(words,'2026-10-09'),dailyWords(words,'2026-10-10'));
});
test('review tracks latest result, stats and achievements use recorded answers',()=>{
 const events=[{word:'sky',correct:false,at:1},{word:'bronze',correct:false,at:2},{word:'sky',correct:true,at:3}];
 assert.deepEqual(missedWords(events),['bronze']);assert.equal(summary(events).accuracy,33);
 assert.equal(summary(events).mastered,1);assert.equal(achievements(events)[0].earned,true);
});
test('pair lessons are real sentences with exactly one blank',()=>{
 for(const w of pairWords()){ assert.equal(sentenceHint(w.hint.sentence,w.word).split('___').length-1,1);assert.ok(w.hint.definition); }
 assert.ok(originMatches({origin:'From Latin through French.'},'French'));
 assert.ok(!originMatches({origin:'From Latin.'},'Greek'));
});
test('restored values are normalized and bounded',()=>{
 const s=normalizeStudio({events:[null,{word:'sky',correct:true}],favorites:['sky','sky',false],audio:{rate:100,volume:-1}});
 assert.equal(s.events.length,1);assert.deepEqual(s.favorites,['sky']);assert.equal(s.audio.rate,1.5);assert.equal(s.audio.volume,0);
});

test('custom choice sessions always include one correct option and three unique alternatives',()=>{for(const word of ['sky','piñata','a cappella','i','bronze']){const options=choicesFor(word);assert.equal(options.length,4);assert.equal(new Set(options).size,4);assert.equal(options.filter(w=>w===word).length,1);}});
