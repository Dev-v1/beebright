export function preferredVoice(voices,selected='',offline=false){
 const available=offline?voices.filter(v=>v.localService===true):voices;
 const chosen=available.find(v=>v.voiceURI===selected);if(chosen)return chosen;
 if(selected&&offline)return null;
 const english=available.filter(v=>/^en(?:[-_]|$)/i.test(v.lang));
 const score=v=>(/natural|neural|enhanced|premium/i.test(v.name)?100:0)+(/google|samantha|ava|aria|jenny|guy/i.test(v.name)?35:0)+(/^en[-_]US$/i.test(v.lang)?20:0)+(v.default?5:0);
 return [...english].sort((a,b)=>score(b)-score(a))[0]||(!offline?available.find(v=>v.default):null)||null;
}
export function speakBrowser(text,settings={},offline=false){
 if(!('speechSynthesis' in window))return false;
 const voice=preferredVoice(window.speechSynthesis.getVoices(),settings.voice,offline);
 if(offline&&!voice)return false;
 window.speechSynthesis.cancel();window.speechSynthesis.resume();
 const utterance=new SpeechSynthesisUtterance(text);utterance.lang=voice?.lang||'en-US';utterance.voice=voice;utterance.rate=settings.rate||1;utterance.pitch=1;utterance.volume=settings.volume??1;
 window.speechSynthesis.speak(utterance);return true;
}
