import {normalizeScores} from "./arcade-core.js";
export const practiceSetSize = (wordListId) => wordListId === 'study-2027' ? 150 : 100;

export const FEATURES = [
  ['daily','Daily challenge','The same 10 words for everyone today.'],
  ['review','Review missed words','Practice your most recent mistakes.'],
  ['compete','Mock spelling bee','One missed spelling ends your run.'],
  ['doctor','Readiness check','Check the local installation and audio.'],
  ['stats','Progress dashboard','Accuracy, levels and difficult words.'],
  ['profile','Local players','Separate practice for people sharing a laptop.'],
  ['backup','Progress backup','Download a portable copy of saved practice.'],
  ['restore','Restore a backup','Recover progress from a backup file.'],
  ['sprint','Two-minute sprint','Spell as many words as you can in two minutes.'],
  ['lists','Study lists','Word counts and completion by level.'],
  ['practice','Custom practice','Choose your list, mode and session length.'],
  ['audio','Pronunciation settings','Choose speech speed and test your voice.'],
  ['origins','Word origins','Explore and practice by source language.'],
  ['pairs','Confusing word pairs','Learn spellings with different meanings.'],
  ['favorites','Favorite words','Build a collection of words to practice.'],
  ['worksheet','Printable worksheet','Blank sentences with a separate answer key.'],
  ['remind','Practice reminder','Set a daily local practice notification.'],
  ['achievements','Achievements','Collect milestones as your spelling improves.'],
  ['duel','Head-to-head','Two players alternate turns on the same device.'],
  ['changelog','Release notes','See what changed in BeeBright.'],
];
export function freshStudio() { return {events:[], favorites:[], games:normalizeScores(), audio:{version:2,rate:1, volume:1, voice:''}}; }
export function normalizeStudio(value) {
  const empty=freshStudio();
  if(!value || typeof value!=='object') return empty;
  const rate=!value.audio?.version&&value.audio?.rate===.72?1:Number(value.audio?.rate)||1;
  return {...empty, games:normalizeScores(value.games), events:Array.isArray(value.events)?value.events.filter(e=>e && typeof e.word==='string' && typeof e.correct==='boolean').slice(-5000).map(e=>({...e,at:Number.isFinite(e.at)&&Math.abs(e.at)<8640000000000000?e.at:0})):[], favorites:Array.isArray(value.favorites)?[...new Set(value.favorites.filter(w=>typeof w==='string'))].slice(0,5000):[], audio:{...empty.audio,...value.audio,version:2,rate:Math.min(1.5,Math.max(.3,rate)),volume:Number.isFinite(Number(value.audio?.volume))?Math.min(1,Math.max(0,Number(value.audio.volume))):1}};
}
export function shuffle(words, seed=String(Math.random())) {
  let state=2166136261;
  for(const c of seed) state=Math.imul(state^c.charCodeAt(0),16777619)>>>0;
  const result=[...words];
  for(let i=result.length-1;i>0;i--){state=(Math.imul(state,1664525)+1013904223)>>>0;const j=Math.floor(state/4294967296*(i+1));[result[i],result[j]]=[result[j],result[i]];}
  return result;
}
export function dailyWords(words, date=new Date().toISOString().slice(0,10)) { return shuffle([...words].sort((a,b)=>a.word<b.word?-1:a.word>b.word?1:0),'daily:'+date).slice(0,10); }
export function missedWords(events) {
  const latest=new Map(); for(const e of events) latest.set(e.word,e);
  return [...latest.values()].filter(e=>!e.correct).sort((a,b)=>(b.at||0)-(a.at||0)).map(e=>e.word);
}
export function summary(events) {
  const right=events.filter(e=>e.correct).length;
  const distinct=new Set(events.filter(e=>e.correct).map(e=>e.word));
  let streak=0,best=0; for(const e of events){streak=e.correct?streak+1:0;best=Math.max(best,streak);}
  return {answers:events.length,accuracy:events.length?Math.round(100*right/events.length):0,mastered:distinct.size,best,missed:missedWords(events)};
}
export function achievements(events) {
  const s=summary(events);const days=new Set(events.map(e=>new Date(e.at).toISOString().slice(0,10))).size;
  return [['First spelling',s.answers>=1],['Ten in a row',s.best>=10],['100 correct words',s.mastered>=100],['450 correct words',s.mastered>=450],['Seven practice days',days>=7],['Accurate speller',s.answers>=100&&s.accuracy>=90]].map(([name,earned])=>({name,earned}));
}
export const LANGUAGES=['Greek','Latin','French','German','Italian','Spanish','Arabic','Japanese','Old English','Old Norse'];
export function originMatches(hint, language) { return (hint?.origin||'').toLowerCase().includes(language.toLowerCase()); }
export const PAIRS = [
 ['compliment','A remark expressing praise.','She gave her friend a ___ about his drawing.','complement','Something that completes or improves another thing.','The bright scarf was a perfect ___ to her coat.'],
 ['accept','To receive or agree to something.','I will ___ your invitation.','except','Not including.','Everyone came ___ Sam.'],
 ['principal','The person in charge of a school.','The ___ welcomed the new students.','principle','A basic rule or belief.','Honesty is an important ___.'],
 ['stationary','Not moving.','The parked car remained ___.','stationery','Writing paper and related supplies.','She bought ___ for her letters.'],
 ['desert','A very dry region.','The camel crossed the sandy ___.','dessert','A sweet food eaten after a meal.','We had fruit for ___.'],
 ['peace','Freedom from fighting or disturbance.','The treaty brought ___.','piece','A part of something.','He cut a ___ of cake.'],
 ['their','Belonging to them.','The children packed ___ bags.','there','In that place.','Put the basket over ___.'],
 ['weather','Conditions of the air at a time and place.','The rainy ___ delayed the game.','whether','Used to express a choice between possibilities.','I wonder ___ it will rain.'],
];
export function pairWords() { return PAIRS.flatMap(p=>[0,3].map(i=>({word:p[i],hint:{word:p[i],definition:p[i+1],sentence:p[i+2],origin:'See a dictionary reference for the history of this word.',source:'BeeBright original word-pair lesson'},level:'pairs',source:'Confusing word pairs'}))); }

export function choicesFor(word, supplied=[]) {
 const lower=word.normalize('NFC').toLocaleLowerCase(),wrong=new Set(),groups=[[],[],[]];
 const rules=[['tion','sion'],['sion','tion'],['ph','f'],['f','ph'],['ie','ei'],['ei','ie'],['ea','ee'],['ee','ea'],['ance','ence'],['ence','ance'],['ant','ent'],['ent','ant'],['able','ible'],['ible','able'],['er','or'],['or','er'],['ous','us'],['ck','k'],['qu','kw']];
 for(const [from,to] of rules)for(let i=lower.indexOf(from);i>=0;i=lower.indexOf(from,i+1))groups[0].push(lower.slice(0,i)+to+lower.slice(i+from.length));
 for(let i=1;i<lower.length-1;i++){const c=lower[i];if(/[bcdfghjklmnpqrstvwxyz]/.test(c)){groups[1].push(lower.slice(0,i)+c+lower.slice(i));if(c===lower[i+1])groups[1].push(lower.slice(0,i)+lower.slice(i+1));}if(/[aeiou]/.test(c))groups[2].push(lower.slice(0,i)+({a:'e',e:'i',i:'e',o:'a',u:'o'})[c]+lower.slice(i+1));}
 function caseLike(value){if(word===word.toLocaleUpperCase())return value.toLocaleUpperCase();const template=word.split(' ');return value.split(' ').map((part,i)=>template[i]?.[0]!==template[i]?.[0]?.toLocaleLowerCase()?part[0]?.toLocaleUpperCase()+part.slice(1):part).join(' ');}
 function add(value){if(typeof value!=='string')return;value=value.normalize('NFC').toLocaleLowerCase();if(value===lower||!value||value.split(' ').length!==lower.split(' ').length||![...value].every(c=>/[\p{L} '-]/u.test(c)))return;wrong.add(caseLike(value));}
 // One nearby phonetic, consonant and vowel error before less useful fallbacks.
 const shuffled=groups.map(group=>shuffle(group));for(const group of shuffled)if(group.length)add(group[0]);
 for(const value of shuffled.flat())if(wrong.size<3)add(value);
 for(const value of supplied)if(wrong.size<3)add(value);
 for(const value of [lower.replace(/([aeiou])/,'$1$1'),lower+lower.slice(-1),lower+'e',lower+'h',lower+'a'])if(wrong.size<3)add(value);
 return shuffle([word,...[...wrong].slice(0,3)]);
}
export function prepareChoiceWords(words,seed=String(Math.random())){
 let slots=[];
 return words.map((item,i)=>{if(i%4===0)slots=shuffle([0,1,2,3],`${seed}:${i}`);const wrong=choicesFor(item.word,item.options||[]).filter(w=>w!==item.word);wrong.splice(slots[i%4],0,item.word);return {...item,options:wrong};});
}
