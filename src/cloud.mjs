import {initializeApp} from 'firebase/app';
import {getAuth,GoogleAuthProvider,signInWithPopup,signInWithCredential,onAuthStateChanged,signOut,setPersistence,browserSessionPersistence,connectAuthEmulator} from 'firebase/auth';
import {getFirestore,doc,getDoc,setDoc,deleteDoc,collection,getDocs,onSnapshot,runTransaction,serverTimestamp,connectFirestoreEmulator} from 'firebase/firestore';
import {setCourses,currentCourses} from './app.mjs';
import {prepareWrite} from './sync.mjs';
const config={apiKey:'AIzaSyBe-bUHTqVWN2D9-aOaRvai28KwSLU1Y0w',authDomain:'tjdwj-7a047.firebaseapp.com',projectId:'tjdwj-7a047',storageBucket:'tjdwj-7a047.firebasestorage.app',messagingSenderId:'288376783838',appId:'1:288376783838:web:9afb1749bc230dca07134f'};
const local=location.hostname==='127.0.0.1'||location.hostname==='localhost';
const emulated=local&&new URLSearchParams(location.search).has('emulator');
const app=initializeApp(emulated?{...config,projectId:'demo-gradebook'}:config),auth=getAuth(app),db=getFirestore(app);
if(emulated){connectAuthEmulator(auth,'http://127.0.0.1:9099');connectFirestoreEmulator(db,'127.0.0.1',8080);}
const OWNER='yunho.seo@kyonggi.ac.kr',ref=doc(db,'gradebooks','shared');
const $=s=>document.querySelector(s),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let revision=0,pending=null,saving=false,blocked=false,timer,unsubscribe,remote=null,loaded=false;
const status=s=>$('.storage-chip').textContent=s;
function alertMessage(message){$('#cloud-alert').hidden=false;$('#cloud-alert').innerHTML=`${esc(message)} <button id="backup-cloud" class="button">미저장 내용 백업</button> <button id="reload-cloud" class="button">최신 내용 다시 불러오기</button>`;$('#backup-cloud').onclick=backup;$('#reload-cloud').onclick=()=>{if(confirm('미저장 변경 사항을 버리고 서버의 최신 내용을 불러올까요? 필요한 경우 먼저 백업해 주세요.'))location.reload();};}
function backup(){const b=new Blob([JSON.stringify({version:1,courses:currentCourses()},null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='성적관리_미저장백업.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
export function queueSave(courses){pending=structuredClone(courses);status(blocked?'저장 중지 · 안내 확인':'저장 대기 중');clearTimeout(timer);if(!blocked)timer=setTimeout(flush,700);}
async function flush(){
 if(!pending||saving||blocked||!auth.currentUser)return;
 saving=true;const snapshot=pending;pending=null;status('서버에 저장 중…');
 try{
  const next=await runTransaction(db,async tx=>{const old=await tx.get(ref);const write=prepareWrite(old.exists()?old.data():null,revision,snapshot);tx.set(ref,{...write,updatedBy:auth.currentUser.uid,updatedAt:serverTimestamp()});return write.revision;});
  revision=next;status(pending?'저장 대기 중':'클라우드에 저장됨');
 }catch(error){pending=pending||snapshot;blocked=true;status('저장 실패 · 미저장 변경 있음');const msg=error.message==='CONFLICT'?'다른 사용자가 먼저 저장했습니다. 현재 수정 내용을 백업한 뒤 최신 내용을 불러와 다시 반영해 주세요.':error.message==='SIZE'?'공유 성적부의 저장 한도(750KB)를 초과했습니다. 엑셀과 백업 파일을 내려받아 주세요.':'저장하지 못했습니다. 연결 또는 접근 권한을 확인하고 현재 변경 내용을 백업해 주세요.';alertMessage(msg);}
 finally{saving=false;if(pending&&!blocked)timer=setTimeout(flush,200);else reconcile();}
}
function reconcile(){
 if(!remote||pending||saving||blocked)return;
 if(loaded&&remote.revision<=revision)return;
 if(loaded&&(document.activeElement?.matches('input,select,textarea')||$('#dialog').open)){status('다른 사용자의 변경 도착 · 입력 종료 후 반영');return;}
 try{setCourses(JSON.parse(remote.payload));revision=remote.revision;loaded=true;status('클라우드에 저장됨');}catch{blocked=true;alertMessage('서버 데이터를 읽을 수 없습니다. 관리자에게 문의해 주세요.');}
}
document.addEventListener('focusout',()=>setTimeout(reconcile,100));$('#dialog').addEventListener('close',reconcile);
window.addEventListener('beforeunload',e=>{if(pending||saving){e.preventDefault();e.returnValue='';}});
$('#login').onclick=async()=>{try{await setPersistence(auth,browserSessionPersistence);await signInWithPopup(auth,new GoogleAuthProvider());}catch(e){$('#auth-message').textContent='로그인하지 못했습니다: '+e.code;}};
$('#logout').onclick=async()=>{if((pending||saving)&&!confirm('아직 저장하지 못한 변경 사항이 있습니다. 로그아웃할까요?'))return;await signOut(auth);location.reload();};
onAuthStateChanged(auth,async user=>{
 unsubscribe?.();loaded=false;
 if(!user){$('.shell').hidden=true;$('#auth-panel').hidden=false;return;}
 $('#auth-message').textContent='접근 권한을 확인하고 있습니다…';
 try{
  const email=user.email?.toLowerCase();
  if(email!==OWNER){const member=await getDoc(doc(db,'members',email));if(!member.exists()||member.data().active!==true)throw new Error('접근이 허용되지 않은 계정입니다. 관리자에게 이메일 등록을 요청하세요.');}
  $('.shell').hidden=false;$('#auth-panel').hidden=true;$('#members').hidden=email!==OWNER;
  unsubscribe=onSnapshot(ref,snap=>{remote=snap.exists()?snap.data():{payload:'[]',revision:0};reconcile();},error=>{blocked=true;$('.shell').hidden=true;$('#auth-panel').hidden=false;$('#auth-message').textContent='데이터 접근이 차단되었습니다. Firestore 설정과 계정 권한을 확인해 주세요. ('+error.code+')';});
 }catch(e){$('#auth-message').textContent=e.message;$('.shell').hidden=true;$('#auth-panel').hidden=false;}
});
$('#members').onclick=async()=>{
 try{const members=await getDocs(collection(db,'members'));$('#dialog-content').innerHTML=`<div class="dialog-header"><h2>접근 관리</h2><p>관리자: ${OWNER}</p></div><div class="dialog-body"><p>등록된 계정은 모든 과목의 성적을 조회·편집·다운로드할 수 있습니다.</p><form id="member-form"><label class="field">교수·조교 Google 계정 이메일<input id="member-email" type="email" required></label><button class="button primary">접근 허용</button></form><div>${members.docs.map(d=>`<div class="member-row"><span>${esc(d.id)}</span><button class="button" data-remove="${esc(d.id)}">권한 삭제</button></div>`).join('')}</div><p id="member-error" role="alert"></p></div><div class="dialog-footer"><button id="close-members" class="button">닫기</button></div>`;if(!$('#dialog').open)$('#dialog').showModal();$('#close-members').onclick=()=>$('#dialog').close();$('#member-form').onsubmit=async e=>{e.preventDefault();const email=$('#member-email').value.trim().toLowerCase();if(email===OWNER)return;try{await setDoc(doc(db,'members',email),{active:true});$('#members').click();}catch(err){$('#member-error').textContent='등록 실패: '+err.code;}};document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=async()=>{if(!confirm(b.dataset.remove+' 계정의 접근 권한을 삭제할까요?'))return;try{await deleteDoc(doc(db,'members',b.dataset.remove));$('#members').click();}catch(e){$('#member-error').textContent='삭제 실패: '+e.code;}});
 }catch(e){alertMessage('접근 관리 화면을 열지 못했습니다. '+e.code);}
};

if(emulated){const button=document.createElement('button');button.className='button';button.textContent='에뮬레이터 테스트 관리자 로그인';$('#auth-panel>div').append(button);button.onclick=async()=>{await signInWithCredential(auth,GoogleAuthProvider.credential(JSON.stringify({sub:'emulator-owner',email:OWNER,email_verified:true,name:'테스트 관리자'})));};}
