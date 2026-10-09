import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = path.join(root, 'BeeBright-Full-Stack/beebright-spelling-bee');
const backend = path.join(app, 'backend');
const local = path.join(root, 'local');
const destination = path.join(app, 'frontend/public/local');
const readJson = (name) => JSON.parse(fs.readFileSync(path.join(backend, 'data', name), 'utf8'));
const hints = {...readJson('word_hints.json'), ...readJson('study_2027_hints.json')};
const lists = [{id:'champions-2024',title:'2024 Words of the Champions',...readJson('words.json')},
               readJson('word_lists/study-2027.json')];
const frontend = path.join(app,'frontend');
fs.writeFileSync(path.join(frontend,'public/study-catalog.json'),JSON.stringify({lists,hints,distractors:readJson('distractors.json')}));
fs.copyFileSync(path.join(local,'CHANGELOG.md'),path.join(frontend,'public/local-changelog.md'));

// Compile the exact website components/CSS with an offline-only desktop entry point.
execFileSync(process.execPath,[path.join(frontend,'node_modules/vite/bin/vite.js'),'build','--mode','desktop'],{cwd:frontend,stdio:'inherit'});
const files = new Map();
function walk(dir, prefix='') {
  for (const item of fs.readdirSync(dir, {withFileTypes:true})) {
    if (['__pycache__','data','shared','ui','ui-source','.git'].includes(item.name)) continue;
    const name = path.posix.join(prefix,item.name);
    if (item.isDirectory()) walk(path.join(dir,item.name), name);
    else if (!item.name.endsWith('.pyc')) files.set(name,fs.readFileSync(path.join(dir,item.name)));
  }
}
walk(local);
function collect(dir,prefix) {
  for (const entry of fs.readdirSync(dir,{withFileTypes:true})) {
    const file=path.join(dir,entry.name), name=path.posix.join(prefix,entry.name);
    if (entry.isDirectory()) collect(file,name); else files.set(name,fs.readFileSync(file));
  }
}
collect(path.join(frontend,'dist-local'),'beebright_local/ui');
files.set('beebright_local/ui/CHANGELOG.md',fs.readFileSync(path.join(local,'CHANGELOG.md')));
files.set('beebright_local/ui/bee.svg',fs.readFileSync(path.join(frontend,'public/bee.svg')));
for(const name of ['App.jsx','api.js','hints.js','local-api.js','local-main.jsx','styles.css','fonts.css','studio.jsx','studio-core.js']) {
  let source=fs.readFileSync(path.join(frontend,'src',name));
  if(name==='App.jsx') source=Buffer.from(source.toString().replace('../../../../local/release.json','../../release.json'));
  files.set('ui-source/src/'+name,source);
}
for(const name of ['package.json','package-lock.json','vite.config.js','local.html']) {
  files.set('ui-source/'+name,fs.readFileSync(path.join(frontend,name)));
}
files.set('LICENSE',fs.readFileSync(path.join(root,'LICENSE')));
for (const [name, data] of Object.entries({hints,lists,distractors:readJson('distractors.json')})) {
  files.set(`beebright_local/data/${name}.json`,Buffer.from(JSON.stringify(data)));
}
files.set('beebright_local/shared/__init__.py',Buffer.from(''));
for (const name of ['practice_core.py','distractors.py']) {
  files.set(`beebright_local/shared/${name}`,fs.readFileSync(path.join(backend,'app/services',name)));
}
let version = process.env.VERCEL_GIT_COMMIT_SHA;
if (!version) version = execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
files.set('version.json',Buffer.from(JSON.stringify({version})));

// Standard ZIP, deterministic bytes, no external zip program or dependencies.
function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit=0;bit<8;bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
let offset=0;
const bodies=[], directory=[];
for (const [name, content] of [...files].sort(([a],[b])=>a.localeCompare(b))) {
  const filename=Buffer.from(name), compressed=zlib.deflateRawSync(content), crc=crc32(content);
  const header=Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20,4);
  header.writeUInt16LE(0x800,6); header.writeUInt16LE(8,8);
  header.writeUInt16LE(0x21,12); header.writeUInt32LE(crc,14);
  header.writeUInt32LE(compressed.length,18); header.writeUInt32LE(content.length,22); header.writeUInt16LE(filename.length,26);
  bodies.push(header,filename,compressed);
  const central=Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20,4); central.writeUInt16LE(20,6);
  central.writeUInt16LE(0x800,8); central.writeUInt16LE(8,10); central.writeUInt16LE(0x21,14);
  central.writeUInt32LE(crc,16); central.writeUInt32LE(compressed.length,20); central.writeUInt32LE(content.length,24);
  central.writeUInt16LE(filename.length,28); central.writeUInt32LE(offset,42);
  directory.push(central,filename); offset += header.length+filename.length+compressed.length;
}
const central=Buffer.concat(directory), end=Buffer.alloc(22);
end.writeUInt32LE(0x06054b50); end.writeUInt16LE(files.size,8); end.writeUInt16LE(files.size,10);
end.writeUInt32LE(central.length,12); end.writeUInt32LE(offset,16);
const archive=Buffer.concat([...bodies,central,end]);
fs.mkdirSync(destination,{recursive:true});
fs.writeFileSync(path.join(destination,'beebright-local.zip'),archive);
fs.writeFileSync(path.join(destination,'manifest.json'),JSON.stringify({version,
  url:'https://beebright.vercel.app/local/beebright-local.zip',
  sha256:crypto.createHash('sha256').update(archive).digest('hex')},null,2));
fs.copyFileSync(path.join(local,'bootstrap.ps1'),path.join(destination,'bootstrap.ps1'));
fs.copyFileSync(path.join(local,'install.sh'),path.join(app,'frontend/public/install.sh'));
fs.copyFileSync(path.join(local,'bootstrap.py'),path.join(destination,'bootstrap.py'));
fs.copyFileSync(path.join(local,'install.ps1'),path.join(app,'frontend/public/install.ps1'));
// A local developer can run the desktop edition from this same generated package.
if (process.argv.includes('--materialize')) {
  for (const [name,data] of files) {
    const dest=path.join(local,name); fs.mkdirSync(path.dirname(dest),{recursive:true}); fs.writeFileSync(dest,data);
  }
}
console.log(`Bundled BeeBright local: ${files.size} files, ${archive.length} bytes, ${version.slice(0,12)}`);
