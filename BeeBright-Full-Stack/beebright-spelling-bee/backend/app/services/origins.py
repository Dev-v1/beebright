"""Language-only practice hints. Never emit historical spellings or cognates."""
from __future__ import annotations
import re
import unicodedata

LANGUAGES = ('Proto-Indo-European','Proto-West Germanic','Proto-Germanic','Proto-Italic','Proto-Hellenic','Ancient Greek','Medieval Latin','Late Latin','Old Latin','Latin','Middle English','Old English','English','Anglo-Norman','Old French','Middle French','French','Old High German','Middle High German','Low German','German','Old Norse','Norwegian Bokmål','Norwegian Nynorsk','Norwegian','Middle Dutch','Dutch','Old Irish','Irish','Italian','Spanish','Portuguese','Arabic','Persian','Sanskrit','Hindi','Urdu','Japanese','Chinese','Korean','Nahuatl','Taino','Taíno','Turkish','Russian','Scots','Scottish Gaelic','Welsh','Swedish','Danish','Icelandic','Finnish','Hebrew','Yiddish','Amharic','Krio','Afrikaans','Malay','Javanese','Frankish','Gothic','New Latin','Modern Latin','Modern Greek','Greek')
PATTERN = re.compile(r'(?<![\w-])(?:'+'|'.join(map(re.escape,sorted(LANGUAGES,key=len,reverse=True)))+r')(?![\w-])', re.I)

def language_origin(raw: str, word: str = '') -> str:
    if not raw:
        return 'A documented language history is not yet available.'
    text = unicodedata.normalize('NFC', str(raw))
    prose = next((line for line in text.splitlines() if re.match(r'^(?:From |Borrowed |Inherited |Derived |The .+?derived |The name |Formed |Named |Coined )',line,re.I)), None)
    if prose:
        text = prose
    while re.search(r'\([^()]*\)|\[[^\[\]]*\]',text):
        text = re.sub(r'\([^()]*\)|\[[^\[\]]*\]',lambda m:m[0][1:-1] if re.match(r'\(\s*from\s',m[0],re.I) else '',text)
    text = re.split(r'\b(?:Cognates?|Compare|Displaced|Doublet|See also|Related to)\b',text,flags=re.I)[0]
    text = re.split(r'(?<=[.!?])\s+(?=[A-Z])',text)[0]
    matches = list(PATTERN.finditer(text))
    languages = list(dict.fromkeys(next(n for n in LANGUAGES if n.casefold()==m[0].casefold()) for m in matches))
    historical = [name for name in languages if name != 'English']
    if not historical:
        result = 'Formed in English.' if re.search(r'English|shortened|shortening|clipping|compound|suffix|prefix|onomatop|exclamation',text,re.I) else 'Earlier language history is uncertain.'
    elif re.search(r'\bor\b|\band\b|compound|combines|blend|formation|formed|coined',text,re.I) and len(historical)>1:
        result = 'Language elements: '+' + '.join(historical)+' → English. The source does not establish one borrowing sequence.'
    else:
        forward = bool(re.search(r'\b(?:through|via)\b',text,re.I)) and len(matches)>1 and bool(re.search(r'\bfrom\b',text[:matches[0].start()],re.I))
        route = historical if forward else list(reversed(historical))
        result = ('Possible path: ' if re.search(r'possibly|perhaps|probably|uncertain|unclear',text,re.I) else '')+' → '.join([*route,'English'])+'.'
    if word:
        result = re.sub(r'(?<!\w)'+re.escape(unicodedata.normalize('NFC',word))+r'(?!\w)','[language withheld]',result,flags=re.I)
    return result
