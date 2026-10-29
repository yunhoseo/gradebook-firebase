// Browser configuration is public at runtime; never put server credentials here.
const fields = {
 apiKey:'FIREBASE_API_KEY', authDomain:'FIREBASE_AUTH_DOMAIN', projectId:'FIREBASE_PROJECT_ID',
 storageBucket:'FIREBASE_STORAGE_BUCKET', messagingSenderId:'FIREBASE_MESSAGING_SENDER_ID', appId:'FIREBASE_APP_ID'
};
export function firebaseConfigFromEnv(env){
 const config={},missing=[];
 for(const [field,name] of Object.entries(fields)){
  const value=env[name]?.trim();
  if(!value||value.startsWith('replace-'))missing.push(name);else config[field]=value;
 }
 if(missing.length)throw new Error('Missing Firebase environment variables: '+missing.join(', ')+'. Copy .env.example to .env and configure it, or use npm run build:emulator for local tests.');
 return config;
}
export function browserFirebaseConfig(config,emulated){
 if(emulated)return {apiKey:'demo-gradebook-key',authDomain:'demo-gradebook.firebaseapp.com',projectId:'demo-gradebook',storageBucket:'demo-gradebook.appspot.com',messagingSenderId:'1234567890',appId:'1:1234567890:web:demo'};
 if(!config)throw new Error('Production Firebase config is missing. Run npm run build with .env or environment variables. Emulator builds require localhost/?emulator.');
 return config;
}
