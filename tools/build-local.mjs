// Compatibility links for older launchers; local source is owned by beebright-local.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'BeeBright-Full-Stack/beebright-spelling-bee/frontend/public');
const backend=path.join(root,'BeeBright-Full-Stack/beebright-spelling-bee/backend/data');
const readJson=async name=>JSON.parse(await fs.readFile(path.join(backend,name),'utf8'));
const hints={...await readJson('word_hints.json'),...await readJson('study_2027_hints.json')};
const lists=[{id:'champions-2024',title:'2024 Words of the Champions',...await readJson('words.json')},await readJson('word_lists/study-2027.json')];
await fs.writeFile(path.join(output,'study-catalog.json'),JSON.stringify({lists,hints,distractors:await readJson('distractors.json')}));
const repository='https://raw.githubusercontent.com/Dev-v1/beebright-local/main/';
async function read(url){const response=await fetch(url);if(!response.ok)throw new Error('Local release download failed: '+response.status);return response.text();}
let manifest;
try{manifest=JSON.parse(await read('https://github.com/Dev-v1/beebright-local/releases/latest/download/update-manifest.json'));}
catch{manifest=JSON.parse(await read(repository+'update-manifest.json'));}
if(!/^[a-f0-9]{40}$/.test(manifest.version)||!/^[a-f0-9]{64}$/.test(manifest.sha256)||!/^https:\/\/github\.com\/Dev-v1\/beebright-local\/releases\/download\/desktop-[a-f0-9]{12}\/beebright-local-source\.zip$/.test(manifest.url))throw new Error('Invalid local release manifest.');
await fs.mkdir(path.join(output,'local'),{recursive:true});
await fs.writeFile(path.join(output,'local/manifest.json'),JSON.stringify(manifest));
// Display metadata and notes come from the exact published local revision.
const published='https://raw.githubusercontent.com/Dev-v1/beebright-local/'+manifest.version+'/';
const release=JSON.parse(await read(published+'release.json'));
await fs.writeFile(path.join(output,'local-release.json'),JSON.stringify({name:'BeeBright Local '+release.version,version:release.version}));
await fs.writeFile(path.join(output,'local-changelog.md'),await read(published+'CHANGELOG.md'));
for(const name of ['install.ps1','install.sh','bootstrap.ps1','bootstrap.py']){
 const target=name.startsWith('bootstrap')?'local/'+name:name;
 await fs.writeFile(path.join(output,target),await read(repository+name));
}
console.log('Download links point to the independently published BeeBright Local release.');
