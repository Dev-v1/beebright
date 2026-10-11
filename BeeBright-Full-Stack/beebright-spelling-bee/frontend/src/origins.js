// Show only attested language names, never historical word forms or cognates.
const names=['Proto-Indo-European','Proto-West Germanic','Proto-Germanic','Proto-Italic','Proto-Hellenic','Ancient Greek','Medieval Latin','Late Latin','Old Latin','Latin','Middle English','Old English','English','Anglo-Norman','Old French','Middle French','French','Old High German','Middle High German','Low German','German','Old Norse','Norwegian Bokmål','Norwegian Nynorsk','Norwegian','Middle Dutch','Dutch','Old Irish','Irish','Italian','Spanish','Portuguese','Arabic','Persian','Sanskrit','Hindi','Urdu','Japanese','Chinese','Korean','Nahuatl','Taino','Taíno','Turkish','Russian','Scots','Scottish Gaelic','Welsh','Swedish','Danish','Icelandic','Finnish','Hebrew','Yiddish','Amharic','Krio','Afrikaans','Malay','Javanese','Frankish','Gothic','New Latin','Modern Latin','Modern Greek','Greek'];
const pattern=new RegExp(`(?<![\\p{L}-])(?:${[...names].sort((a,b)=>b.length-a.length).join('|')})(?![\\p{L}-])`,'giu');
export function languageOrigin(raw,word=''){
 if(!raw)return 'A documented language history is not yet available.';
 let text=String(raw).normalize('NFC');
 const labels=`(?:${[...names].sort((a,b)=>b.length-a.length).join('|')})`;
 if(new RegExp(`^(?:Possible path: )?${labels}(?: → ${labels})+\\.$`,'iu').test(text)||new RegExp(`^Language elements: ${labels}(?: \\+ ${labels})+ → English\\. The source does not establish one borrowing sequence\\.$`,'iu').test(text))return word?text.replace(new RegExp(`(?<![\\p{L}\\p{N}_])${word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?![\\p{L}\\p{N}_])`,'giu'),'[language withheld]'):text;
 // A generated etymology tree can list branches and cognates, not a single route.
 const prose=text.split('\n').find(line=>/^(?:From |Borrowed |Inherited |Derived |The .+?derived |The name |Formed |Named |Coined )/i.test(line));
 if(prose)text=prose;
 while(/\([^()]*\)|\[[^\[\]]*\]/u.test(text))text=text.replace(/\([^()]*\)|\[[^\[\]]*\]/gu,group=>/^\(\s*from\s/iu.test(group)?group.slice(1,-1):'');
 text=text.split(/\b(?:Cognates?|Compare|Displaced|Doublet|See also|Related to)\b/i)[0].split(/(?<=[.!?])\s+(?=[A-Z])/)[0];
 const matches=[...text.matchAll(pattern)],languages=[...new Set(matches.map(m=>names.find(n=>n.toLowerCase()===m[0].toLowerCase())))];
 const historical=languages.filter(l=>l!=='English');
 let result;
 if(!historical.length)result=/English|shortened|shortening|clipping|compound|suffix|prefix|onomatop|exclamation/i.test(text)?'Formed in English.':'Earlier language history is uncertain.';
 else if(/(?<!\p{L})(?:or|and)(?!\p{L})|compound|combines|blend|formation|formed|coined/iu.test(text)&&historical.length>1)result=`Language elements: ${historical.join(' + ')} → English. The source does not establish one borrowing sequence.`;
 else{
  const forward=/\b(?:through|via)\b/i.test(text)&&matches.length>1&&/\bfrom\b/i.test(text.slice(0,matches[0].index));
  const route=forward?historical:[...historical].reverse();
  result=`${/possibly|perhaps|probably|uncertain|unclear/i.test(text)?'Possible path: ':''}${[...route,'English'].join(' → ')}.`;
 }
 if(word){const escaped=word.normalize('NFC').replace(/[.*+?^${}()|[\]\\]/g,'\\$&');result=result.replace(new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`,'giu'),'[language withheld]');}
 return result;
}
