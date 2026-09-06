import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {extname,normalize} from 'node:path';

const forbidden=Object.freeze([
  ['school Firebase project','dragonswood-9289e'],
  ['school Firebase API key','AIzaSyC918WJoGQgxRKsqcz-3bXI7iZWv_1bwYE'],
  ['school Firebase sender','1064477064695'],
  ['school Firebase app id','1:1064477064695:web:283e1016ee2303d39042f2']
]);
const textExtensions=new Set(['.cjs','.css','.html','.js','.json','.md','.mjs','.rules','.sh','.txt','.yaml','.yml']);
const exempt=new Set([normalize('tools/configure-home-firebase.mjs'),normalize('tools/home-isolation-audit.mjs')]);
const tracked=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const failures=[];

for(const file of tracked){
  const normalized=normalize(file);
  if(exempt.has(normalized)||!textExtensions.has(extname(file).toLowerCase()))continue;
  let contents;
  try{contents=readFileSync(file,'utf8')}catch{continue}
  for(const [label,value] of forbidden){
    if(contents.includes(value))failures.push(`${file}: ${label}`);
  }
}

let aliases={};
try{aliases=JSON.parse(readFileSync('.firebaserc','utf8')).projects||{}}catch{}
if(!aliases.default||String(aliases.default).includes('not-configured'))failures.push('.firebaserc: home Firebase project is not configured');
if(Object.values(aliases).some(value=>String(value).includes('dragonswood-9289e')))failures.push('.firebaserc: school Firebase project must never be a Home alias');

if(failures.length){
  console.error('Dragonswood Home is not isolated yet:');
  for(const failure of failures)console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dragonswood Home isolation passed for ${tracked.length} tracked files.`);
