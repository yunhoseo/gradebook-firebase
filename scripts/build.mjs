import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {firebaseConfigFromEnv} from '../src/firebase-config.mjs';
const emulator=process.argv.includes('--emulator');
let config=null;
if(!emulator){
 // A complete CI/shell configuration does not need to read a local file.
 try{config=firebaseConfigFromEnv(process.env);}
 catch{
  let fileEnv={};
  try{fileEnv=parseEnv(await readFile(new URL('../.env',import.meta.url),'utf8'));}
  catch(error){if(error.code!=='ENOENT')throw error;}
  // CI/shell environment takes precedence over the local .env file.
  config=firebaseConfigFromEnv({...fileEnv,...process.env});
 }
}
await build({entryPoints:['src/cloud.mjs'],outfile:'public/cloud.js',bundle:true,minify:true,format:'esm',target:['es2022'],define:{__FIREBASE_CONFIG__:JSON.stringify(config)}});
