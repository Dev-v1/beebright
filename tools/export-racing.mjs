import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';import {execFileSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),target=path.resolve(process.argv[2]||path.join(root,'racing-beta/export')),frontend=path.join(root,'BeeBright-Full-Stack/beebright-spelling-bee/frontend');
fs.mkdirSync(path.join(target,'src'),{recursive:true});
const names=['game-mechanics.js','track-geometry.js','games-3d.js','game-renderer.js','games-rally.js','racing-mechanics.js','racing-mechanics.test.js','rally-car.js','rally-terrain.js','rally-babylon.js'];
const hash=crypto.createHash('sha256');
function copy(from,to){const data=fs.readFileSync(from);hash.update(to);hash.update(data);fs.mkdirSync(path.dirname(path.join(target,to)),{recursive:true});fs.writeFileSync(path.join(target,to),data);}
for(const name of names)copy(path.join(frontend,'src',name),'src/'+name);
for(const name of ['index.html','main.js','style.css','vite.config.js'])copy(path.join(root,'racing-beta/web',name),name);
for(const name of ['package.json','package-lock.json','launcher.py','README.md'])copy(path.join(root,'racing-beta',name),name);
copy(path.join(root,'LICENSE'),'LICENSE');
fs.writeFileSync(path.join(target,'source.json'),JSON.stringify({canonical:'Dev-v1/beebright',commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),racingHash:hash.digest('hex'),version:JSON.parse(fs.readFileSync(path.join(root,'local/release.json'),'utf8')).version},null,2)+'\n');
console.log('Exported shared racing source to',target);
