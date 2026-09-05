import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {extname,resolve} from 'node:path';

const input=process.argv[2];
if(!input){
  console.error('Usage: npm run home:configure:firebase -- <path-to-firebase-config.json>');
  process.exit(2);
}

let supplied;
try{supplied=JSON.parse(readFileSync(resolve(input),'utf8'))}catch(error){
  console.error(`Could not read Firebase config: ${error.message}`);
  process.exit(2);
}
const config=supplied.firebaseConfig||supplied;
const required=['apiKey','authDomain','projectId','storageBucket','messagingSenderId','appId'];
for(const key of required){
  if(!String(config[key]||'').trim()||String(config[key]).includes('PASTE_')||String(config[key]).includes('YOUR_HOME_PROJECT')){
    console.error(`Firebase config is missing ${key}.`);
    process.exit(2);
  }
}
if(config.projectId==='dragonswood-9289e'||config.authDomain.includes('dragonswood-9289e')){
  console.error('Refusing to configure Dragonswood Home with the school Firebase project.');
  process.exit(2);
}

const replacements=Object.freeze([
  ['1:1064477064695:web:283e1016ee2303d39042f2',String(config.appId)],
  ['1:000000000001:web:home-not-configured',String(config.appId)],
  ['dragonswood-9289e.firebasestorage.app',String(config.storageBucket)],
  ['home-storage-not-configured.invalid',String(config.storageBucket)],
  ['dragonswood-9289e.firebaseapp.com',String(config.authDomain)],
  ['home-auth-not-configured.invalid',String(config.authDomain)],
  ['AIzaSyC918WJoGQgxRKsqcz-3bXI7iZWv_1bwYE',String(config.apiKey)],
  ['HOME_FIREBASE_NOT_CONFIGURED',String(config.apiKey)],
  ['G-LPRLDGVBD2',String(config.measurementId||'')],
  ['1064477064695',String(config.messagingSenderId)],
  ['000000000001',String(config.messagingSenderId)],
  ['dragonswood-9289e',String(config.projectId)],
  ['dragonswood-home-not-configured',String(config.projectId)]
]);
const textExtensions=new Set(['.cjs','.css','.html','.js','.json','.md','.mjs','.rules','.sh','.txt','.yaml','.yml']);
const self='tools/configure-home-firebase.mjs';
const tracked=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const changed=[];

for(const file of tracked){
  if(file===self||!textExtensions.has(extname(file).toLowerCase()))continue;
  let before;
  try{before=readFileSync(file,'utf8')}catch{continue}
  let after=before;
  for(const [from,to] of replacements)after=after.split(from).join(to);
  if(after!==before){writeFileSync(file,after,'utf8');changed.push(file)}
}

const aliases={projects:{default:String(config.projectId),home:String(config.projectId)}};
writeFileSync('.firebaserc',`${JSON.stringify(aliases,null,2)}\n`,'utf8');
console.log(`Configured ${changed.length} files for Firebase project ${config.projectId}.`);
console.log('Run npm run home:isolation:audit before committing or publishing.');
