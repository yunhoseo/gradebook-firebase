import {readFile} from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import {firebaseConfigFromEnv,browserFirebaseConfig} from '../src/firebase-config.mjs';
const env={FIREBASE_API_KEY:'dummy-browser-key',FIREBASE_AUTH_DOMAIN:'example.firebaseapp.com',FIREBASE_PROJECT_ID:'example',FIREBASE_STORAGE_BUCKET:'example.appspot.com',FIREBASE_MESSAGING_SENDER_ID:'123',FIREBASE_APP_ID:'1:123:web:example'};
test('Firebase config maps only explicit public browser environment variables',()=>{
 const config=firebaseConfigFromEnv({...env,FIREBASE_PRIVATE_KEY:'must-not-be-included'});
 assert.deepEqual(config,{apiKey:'dummy-browser-key',authDomain:'example.firebaseapp.com',projectId:'example',storageBucket:'example.appspot.com',messagingSenderId:'123',appId:'1:123:web:example'});
});
test('missing or placeholder config fails without revealing configured values',()=>{
 for(const value of ['', '   ', undefined, 'replace-with-your-firebase-web-api-key']){
  assert.throws(()=>firebaseConfigFromEnv({...env,FIREBASE_API_KEY:value}),/Missing Firebase environment variables: FIREBASE_API_KEY/);
 }
 assert.throws(()=>firebaseConfigFromEnv({...env,FIREBASE_PROJECT_ID:''}),error=>{
  assert.match(error.message,/FIREBASE_PROJECT_ID/);assert.ok(!error.message.includes(env.FIREBASE_API_KEY));return true;
 });
});
test('production uses provided config and refuses emulator-only builds',()=>{
 const config=firebaseConfigFromEnv(env);
 assert.equal(browserFirebaseConfig(config,false),config);
 assert.throws(()=>browserFirebaseConfig(null,false),/Production Firebase config is missing/);
});
test('emulator ignores production configuration and needs no real credentials',()=>{
 const config=browserFirebaseConfig(null,true);
 assert.equal(config.projectId,'demo-gradebook');assert.equal(config.apiKey,'demo-gradebook-key');
 assert.deepEqual(browserFirebaseConfig(firebaseConfigFromEnv(env),true),config);
});

test('Hosting supplies origin-only cross-origin referrers for restricted Firebase browser keys',async()=>{
 const {hosting}=JSON.parse(await readFile(new URL('../firebase.json',import.meta.url),'utf8'));
 const headers=hosting.headers.find(entry=>entry.source==='**')?.headers;
 assert.ok(headers,'global Hosting headers must be present');
 assert.equal(headers.find(header=>header.key.toLowerCase()==='referrer-policy')?.value,'strict-origin-when-cross-origin');
});
