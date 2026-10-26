import {queueSave} from './cloud.mjs';
import {parseScore,total,complete,summary,validateRoster,exportRows,round,addStudent,removeStudent,validateStudentImport,removeCourse,matchQuestionColumns,validateScoreImport} from './model.mjs';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)], esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KEY='gradebook-v1',uid=()=>crypto.randomUUID();
function newExam(kind,code){return {id:uid(),kind,code,max:[20,20,20,20,20],scores:{}};}
function seed(){
 const students=['김민서','이준호','박서연','최현우','정지우','강도윤','윤수빈','장예은','임시우','한지민','오유진','서하준'].map((name,i)=>({id:`2024${String(101+i).padStart(4,'0')}`,name,department:'산업공학과'}));
 const mid=newExam('중간고사','MID-01'),final=newExam('기말고사','FIN-01');
 [[18,20,17,16,19],[20,18,19,20,18],[15,17,16,18,16],[20,20,18,19,20],[17,15,19,18,17],[12,16,15,18,14],[19,18,20,17,20],[16,18,17,19,18],[20,19,20,20,18],[15,17,null,null,null]].forEach((v,i)=>mid.scores[students[i].id]=v);
 const course={id:uid(),name:'통계학개론',term:'2026학년도 2학기',section:'01분반',demo:true,students,exams:[mid,final]};
 return {version:1,courses:[course],courseId:course.id,examId:mid.id};
}
let data={version:1,courses:[],courseId:'',examId:''};
let view='scores',query='',filter='all',book=null,importResult=null,importKind='students',toastTimer;
const course=()=>data.courses.find(c=>c.id===data.courseId)||data.courses[0];
const exam=()=>course().exams.find(e=>e.id===data.examId)||course().exams[0];
const questionLabel=(e,i)=>e.labels?.[i]??`${i+1}번`;
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),4000);}
function persist(){ queueSave(data.courses);return true;}
function format(n){return n==null?'—':n.toLocaleString('ko-KR',{maximumFractionDigits:2});}
function render(){
 const hasCourses=data.courses.length>0;
 $('#course').disabled=!hasCourses;$('#delete-course').disabled=!hasCourses;$('#export').disabled=!hasCourses;
 $('.exam-row').hidden=!hasCourses;$('#stats').hidden=!hasCourses;
 if(!hasCourses){
  data.courseId='';data.examId='';
  $('#course').innerHTML='<option>등록된 과목 없음</option>';$('#course-meta').textContent='';
  $('#demo-banner').hidden=true;$('#demo-banner').style.display='none';$('#exam-tabs').innerHTML='';$('#stats').innerHTML='';
  $('#page-title').textContent='과목 관리';$('#page-subtitle').textContent='새 과목을 추가해 성적 관리를 시작하세요.';$('#breadcrumb').textContent='과목 관리';
  $$('.nav').forEach(n=>n.classList.remove('active'));
  $('#content').innerHTML='<section class="panel empty"><div class="empty-icon">▤</div><h3>등록된 과목이 없습니다</h3><p>과목을 추가한 뒤 학생 명단과 시험을 등록할 수 있습니다.</p><button id="empty-add-course" class="button primary">＋ 과목 추가</button></section>';
  $('#empty-add-course').onclick=courseDialog;return;
 }
 const c=course(),e=exam();data.courseId=c.id;data.examId=e.id;
 $('#course').innerHTML=data.courses.map(x=>`<option value="${x.id}" ${c.id===x.id?'selected':''}>${esc(x.name)}${x.demo?' · 예시':''}</option>`).join('');
 $('#course-meta').textContent=`${c.term} · ${c.section}`;
 $('#demo-banner').hidden=!c.demo;$('#demo-banner').style.display=c.demo?'flex':'none';
 const labels={scores:['성적 입력','한눈에 확인하고, 정확하게 기록하세요.'],students:['학생 명단','엑셀로 불러온 명단을 과목의 모든 시험에 함께 사용합니다.'],analytics:['성적 분석','입력된 점수에서 수업의 흐름을 확인하세요.']};
 $('#page-title').textContent=labels[view][0];$('#page-subtitle').textContent=labels[view][1];$('#breadcrumb').textContent=labels[view][0];
 $$('.nav').forEach(n=>n.classList.toggle('active',n.dataset.view===view));
 $('#exam-tabs').innerHTML=c.exams.map(x=>`<button class="exam-tab ${x.id===e.id?'active':''}" data-exam="${x.id}">${esc(x.kind)} <small>${esc(x.code)}</small></button>`).join('');
 $$('[data-exam]').forEach(b=>b.onclick=()=>{data.examId=b.dataset.exam;render();});
 renderStats();renderContent();
}
function renderStats(){
 const c=course(),e=exam(),s=summary(c.students,e),max=round(e.max.reduce((a,b)=>a+b,0));
 $('#stats').innerHTML=`<article class="stat"><div class="stat-label"><span>수강 학생</span><span>♧</span></div><div class="stat-value">${c.students.length}<small>명</small></div><div class="stat-note">${esc(c.term)} · ${esc(c.section)}</div></article><article class="stat featured"><div class="stat-label"><span>성적 입력 완료</span><span>☑</span></div><div class="stat-value">${s.complete}<small>/ ${c.students.length}명</small></div><div class="stat-note">${!c.students.length?'학생 명단을 먼저 등록해 주세요':s.pending?'아직 '+s.pending+'명의 점수가 남아 있어요':'모든 점수 입력이 완료되었어요'}</div><div class="progress"><i style="width:${c.students.length?s.complete/c.students.length*100:0}%"></i></div></article><article class="stat"><div class="stat-label"><span>평균 점수</span><span>↗</span></div><div class="stat-value">${format(s.average)}<small>점</small></div><div class="stat-note">전체 문항 입력 완료 학생 기준</div></article><article class="stat"><div class="stat-label"><span>최고 점수</span><span>⚑</span></div><div class="stat-value">${format(s.highest)}<small>/ ${format(max)}점</small></div><div class="stat-note">${esc(e.kind)} · ${e.max.length}개 문항</div></article>`;
}
function visibleStudents(){return course().students.filter(s=>(!query||[s.id,s.name,s.department].some(v=>v.toLowerCase().includes(query.toLowerCase())))&&(view==='students'||filter==='all'||(complete(exam().scores[s.id],exam().max)?'complete':'pending')===filter));}
function renderContent(){
 if(view==='analytics'){renderAnalytics();return;}
 const c=course(),e=exam(),isScores=view==='scores';
 $('#content').innerHTML=`<section class="panel"><div class="panel-heading"><div><h2>${isScores?esc(e.kind)+' 성적표':'수강 학생 명단'} <span class="muted" style="font-size:10px;margin-left:7px">${esc(isScores?e.code:c.name)}</span></h2><p>${isScores?'문항별 취득 점수를 직접 입력하세요. 변경 사항은 자동으로 저장됩니다.':'학생을 직접 추가하거나 엑셀로 등록하세요. 행 오른쪽에서 삭제할 수 있습니다.'}</p></div><div class="panel-actions">${isScores?'<button id="exam-settings" class="button">⚙ 시험 설정</button>':'<button id="template" class="button">↓ 엑셀 양식</button>'}<button id="add-student" class="button">＋ 학생 추가</button><button id="import" class="button light">↥ 학생 엑셀 가져오기</button>${isScores?'<button id="import-scores" class="button light">↥ 점수 엑셀 가져오기</button>':''}</div></div><div class="toolbar"><label class="search"><span>⌕</span><input id="search" placeholder="이름, 학번 또는 학과 검색" aria-label="학생 검색" value="${esc(query)}"></label>${isScores?`<select id="filter" class="filter" aria-label="입력 상태 필터"><option value="all">전체 학생</option><option value="pending">미완료 학생</option><option value="complete">입력 완료</option></select>`:`<span class="muted">총 ${c.students.length}명</span>`}</div><div id="rows"></div><div class="panel-bottom"><span id="row-count"></span><span>${isScores?'Tab 키로 다음 문항 이동 · Enter 키로 다음 학생 이동':'학번은 학생을 구분하는 고유 번호입니다'}</span></div></section>`;
 $('#search').oninput=ev=>{query=ev.target.value;renderRows();};
 if(isScores){$('#filter').value=filter;$('#filter').onchange=ev=>{filter=ev.target.value;renderRows();};$('#exam-settings').onclick=()=>examDialog(e);$('#import-scores').onclick=()=>pickExcel('scores');}else{$('#template').onclick=downloadTemplate;}
 $('#import').onclick=()=>pickExcel('students');$('#add-student').onclick=studentDialog;renderRows();
}
function renderRows(){
 const students=visibleStudents(),c=course(),e=exam(),isScores=view==='scores';
 $('#row-count').innerHTML=`전체 <b>${c.students.length}</b>명 중 <b>${students.length}</b>명 표시`;
 if(!students.length){$('#rows').innerHTML=`<div class="empty"><div class="empty-icon">▤</div><h3>${c.students.length?'검색 조건에 맞는 학생이 없어요':'첫 학생 명단을 불러와 주세요'}</h3><p>${c.students.length?'다른 검색어나 입력 상태를 선택해 주세요.':'엑셀 파일로 학생 정보를 등록한 뒤<br>문항별 점수를 직접 입력할 수 있습니다.'}</p>${!c.students.length?'<button id="empty-import" class="button primary">↥ 학생 엑셀 가져오기</button>':''}</div>`;if($('#empty-import'))$('#empty-import').onclick=()=>pickExcel('students');return;}
 $('#rows').innerHTML=`<div class="table-wrap"><table><thead><tr><th>No.</th><th>학번</th><th>학생</th>${isScores?e.max.map((m,i)=>`<th class="question">${esc(questionLabel(e,i))}<small>${m}점 만점</small></th>`).join(''):'<th>학과</th>'}${isScores?'<th>총점</th><th>입력 상태</th>':'<th>관리</th>'}</tr></thead><tbody>${students.map((s,i)=>{
 const scores=e.scores[s.id]||[],done=complete(scores,e.max);
 return `<tr data-student="${esc(s.id)}"><td>${String(i+1).padStart(2,'0')}</td><td>${esc(s.id)}</td><td class="student-name">${esc(s.name)}${isScores?`<small>${esc(s.department||'학과 미등록')}</small>`:''}</td>${isScores?e.max.map((m,j)=>`<td class="score-cell"><input class="score" type="number" inputmode="decimal" step="any" min="0" max="${m}" data-index="${j}" aria-label="${esc(s.name)} ${esc(questionLabel(e,j))} 점수" value="${scores[j]??''}" placeholder="—"></td>`).join(''):`<td>${esc(s.department||'—')}</td>`}${isScores?`<td class="row-total">${scores.some(x=>x!=null)?format(total(scores,e.max)):'—'}${!done&&scores.some(x=>x!=null)?'<small title="입력된 문항의 부분 합계"> *</small>':''}</td><td class="row-status"><span class="status ${done?'':'pending'}">${done?'입력 완료':'미완료'}</span></td>`:`<td><button class="delete-student" aria-label="${esc(s.name)} 삭제">삭제</button></td>`}</tr>`;
 }).join('')}</tbody></table></div>`;
 $$('.score').forEach(input=>{
  input.oninput=()=>{
   const tr=input.closest('tr'),id=tr.dataset.student,index=Number(input.dataset.index);
   try{
    const value=parseScore(input.value,e.max[index]);if(input.validity.badInput)throw new Error('숫자로 입력해 주세요.');
    if(!e.scores[id])e.scores[id]=Array(e.max.length).fill(null);e.scores[id][index]=value;
    input.classList.remove('invalid');input.removeAttribute('aria-invalid');input.setCustomValidity('');
    const done=complete(e.scores[id],e.max);tr.querySelector('.row-total').innerHTML=`${e.scores[id].some(v=>v!=null)?format(total(e.scores[id],e.max)):'—'}${!done&&e.scores[id].some(v=>v!=null)?'<small title="부분 합계"> *</small>':''}`;
    tr.querySelector('.row-status').innerHTML=`<span class="status ${done?'':'pending'}">${done?'입력 완료':'미완료'}</span>`;
    persist();renderStats();
   }catch(err){input.classList.add('invalid');input.setAttribute('aria-invalid','true');input.setCustomValidity(err.message);toast(err.message+' 수정 전 점수는 유지됩니다.');}
  };
  input.onblur=()=>{if(input.classList.contains('invalid')){input.value=e.scores[input.closest('tr').dataset.student]?.[Number(input.dataset.index)]??'';input.classList.remove('invalid');input.removeAttribute('aria-invalid');input.setCustomValidity('');}};
  input.onkeydown=ev=>{if(ev.key==='Enter'){ev.preventDefault();const next=input.closest('tr').nextElementSibling?.querySelector(`[data-index="${input.dataset.index}"]`);if(next){next.focus();next.select();}else input.blur();}};
 });
 $$('.delete-student').forEach(b=>b.onclick=()=>{const id=b.closest('tr').dataset.student,s=c.students.find(s=>s.id===id);confirmDialog('학생을 삭제할까요?',`${s.name} (${s.id})의 명단과 이 과목의 모든 시험 점수가 삭제됩니다.`,()=>{removeStudent(c,id);persist();render();toast('학생을 삭제했습니다.');});});
}
function renderAnalytics(){
 const c=course(),e=exam(),s=summary(c.students,e),max=e.max.reduce((a,b)=>a+b,0),bins=[0,0,0,0,0];
 s.totals.forEach(v=>bins[Math.min(4,Math.floor((v/max)*5))]++);
 const bar=(label,value,width)=>`<div class="bar-row"><span class="bar-label">${label}</span><div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div><span class="bar-num">${value}</span></div>`;
 $('#content').innerHTML=`<section class="panel"><div class="panel-heading"><div><h2>${esc(e.kind)} 성적 분석</h2><p>완료 학생 ${s.complete}명 · 만점 ${format(max)}점</p></div><span class="status">${esc(e.code)}</span></div>${s.complete?`<div class="charts"><div class="chart-card"><h3>점수 분포</h3><p>100점 기준 환산 점수 · 전체 문항 입력 완료 학생</p>${bins.map((n,i)=>bar(i===4?'80–100점':`${i*20}–${(i+1)*20}점 미만`,n+'명',n/Math.max(...bins,1)*100)).join('')}</div><div class="chart-card"><h3>문항별 평균 득점률</h3><p>각 문항을 입력한 학생 기준 · 배점 대비 비율</p>${e.max.map((m,i)=>{const vals=c.students.map(st=>e.scores[st.id]?.[i]).filter(v=>typeof v==='number'),rate=vals.length?vals.reduce((a,b)=>a+b,0)/vals.length/m*100:0;return bar(`${questionLabel(e,i)} · ${m}점`,vals.length?round(rate)+'%':'—',rate);}).join('')}</div></div><p class="analytics-note">미입력 점수는 0점으로 계산하지 않습니다. 문항별 평균과 전체 평균의 대상 학생 수가 다를 수 있습니다.</p>`:'<div class="empty"><div class="empty-icon">▥</div><h3>아직 분석할 성적이 없어요</h3><p>한 학생의 모든 문항을 입력하면 성적 분포가 나타납니다.</p></div>'}</section>`;
}
function dialog(title,subtitle,body,footer){$('#dialog-content').innerHTML=`<div class="dialog-head"><div><h2>${title}</h2><p>${subtitle}</p></div><button class="close" aria-label="닫기">×</button></div>${body}<div class="dialog-footer">${footer}</div>`;$('#dialog').showModal();$('.close').onclick=()=>$('#dialog').close();$$('[data-close]').forEach(b=>b.onclick=()=>$('#dialog').close());}
function confirmDialog(title,message,action){dialog(title,esc(message),'<div class="dialog-body"></div>','<button class="button" data-close>취소</button><button class="button danger" id="confirm-delete">삭제</button>');$('#confirm-delete').onclick=()=>{$('#dialog').close();action();};}
function studentDialog(){
 dialog('학생 직접 추가','현재 과목의 모든 시험에 학생이 추가됩니다. 점수는 빈칸으로 시작합니다.',`<form id="student-form" class="dialog-body"><div class="field-grid"><label class="field">학번<input name="student-id" required maxlength="50" placeholder="예: 20260001" autocomplete="off"></label><label class="field">이름<input name="student-name" required maxlength="60" placeholder="학생 이름" autocomplete="off"></label></div><label class="field">학과 (선택)<input name="student-department" maxlength="100" placeholder="예: 산업공학과"></label><p class="form-note">학번은 중복될 수 없습니다. 앞자리 0은 그대로 유지됩니다.</p><div id="student-error" role="alert"></div></form>`,'<button class="button" data-close>취소</button><button class="button primary" type="submit" form="student-form">학생 등록</button>');
 $('#student-form').onsubmit=ev=>{ev.preventDefault();const f=new FormData(ev.target);try{const student=addStudent(course(),{id:f.get('student-id'),name:f.get('student-name'),department:f.get('student-department')});persist();query='';filter='all';$('#dialog').close();render();toast(student.name+' 학생을 추가했습니다.');}catch(err){$('#student-error').innerHTML='<p class="error">'+esc(err.message)+'</p>';}};
}
function deleteCourseDialog(){
 const target=course();if(!target)return;
 dialog('과목을 삭제할까요?',`${esc(target.name)} · ${esc(target.term)} · ${esc(target.section)}`,
 `<form id="delete-course-form" class="dialog-body"><p>이 과목의 학생 <b>${target.students.length}명</b>과 시험 <b>${target.exams.length}개</b>, 모든 점수가 함께 삭제됩니다. 다른 과목은 유지됩니다.</p><p class="error">삭제 내용은 모든 교수·조교에게 적용되며 복구할 수 없습니다. 필요한 성적은 삭제 전에 엑셀로 내려받아 주세요.</p><label class="field">삭제할 과목 이름을 입력하세요<input id="delete-course-name" required autocomplete="off" placeholder="${esc(target.name)}"></label><div id="delete-course-error" role="alert"></div></form>`,
 '<button class="button" data-close>취소</button><button class="button danger" id="delete-course-submit" form="delete-course-form" type="submit" disabled>과목 삭제</button>');
 $('#delete-course-name').oninput=()=>{$('#delete-course-submit').disabled=$('#delete-course-name').value!==target.name;};
 $('#delete-course-form').onsubmit=ev=>{ev.preventDefault();try{
  removeCourse(data,target.id,$('#delete-course-name').value);query='';filter='all';view='scores';persist();$('#dialog').close();render();toast('과목 삭제를 반영하고 있습니다. 상단 저장 상태를 확인해 주세요.');
 }catch(err){$('#delete-course-error').textContent=err.message;}};
}
function courseDialog(){
 dialog('새 과목 만들기','과목별로 학생 명단과 시험 성적을 따로 관리합니다.',`<form id="course-form" class="dialog-body"><label class="field">과목명<input name="name" required maxlength="80" placeholder="예: 생산관리"></label><div class="field-grid"><label class="field">학기<input name="term" required maxlength="40" value="2026학년도 2학기"></label><label class="field">분반<input name="section" required maxlength="30" placeholder="예: 01분반"></label></div><p class="form-note">중간고사와 기말고사가 기본으로 생성됩니다. 문항 수와 배점은 시험 설정에서 변경할 수 있습니다.</p></form>`,'<button class="button" data-close>취소</button><button class="button primary" type="submit" form="course-form">과목 만들기</button>');
 $('#course-form').onsubmit=ev=>{ev.preventDefault();const f=new FormData(ev.target);const name=f.get('name').trim(),term=f.get('term').trim(),section=f.get('section').trim();if(!name||!term||!section){toast('공백 대신 과목 정보를 입력해 주세요.');return;}const c={id:uid(),name,term,section,demo:false,students:[],exams:[newExam('중간고사','MID-01'),newExam('기말고사','FIN-01')]};data.courses.push(c);data.courseId=c.id;data.examId=c.exams[0].id;query='';filter='all';view='scores';persist();$('#dialog').close();render();toast('과목을 만들었습니다. 학생 명단을 불러와 주세요.');};
}
function examDialog(existing=null){
 const e=existing||newExam('중간고사',`EXAM-${String(course().exams.length+1).padStart(2,'0')}`),hasScores=Object.values(e.scores).some(v=>v.some(x=>x!=null));
 let offset=0;
 let groups=(e.structure||e.max.map(()=>0)).map(n=>{const vals=e.max.slice(offset,offset+Math.max(1,n));offset+=Math.max(1,n);return {sub:n,values:vals};});
 dialog(existing?'시험 설정':'시험 추가','문항을 소문항으로 나누고, 각 소문항의 배점을 지정할 수 있습니다.',`<form id="exam-form" class="dialog-body"><div class="field-grid"><label class="field">시험 구분<select name="kind"><option ${e.kind==='중간고사'?'selected':''}>중간고사</option><option ${e.kind==='기말고사'?'selected':''}>기말고사</option><option ${e.kind==='기타 시험'?'selected':''}>기타 시험</option></select></label><label class="field">시험 번호<input name="code" value="${esc(e.code)}" maxlength="30" required></label></div><label class="field">대문항 수<input id="question-count" name="count" type="number" min="1" max="30" value="${groups.length}" required ${hasScores?'disabled':''}></label><p class="form-note">${hasScores?'점수가 입력된 시험은 문항 구조를 변경할 수 없습니다. 배점은 기존 취득 점수 이상으로 변경할 수 있습니다.':'각 문항의 소문항 수를 선택하세요. 소문항이 있는 문항은 소문항 배점의 합이 해당 문항의 배점이 됩니다.'}</p><div id="question-fields" class="question-groups"></div><p class="form-note" id="max-total"></p><div id="exam-error"></div></form>`,'<button class="button" data-close>취소</button><button class="button primary" form="exam-form" type="submit">설정 저장</button>');
 const capture=()=>$$('.question-group').forEach((el,i)=>groups[i].values=[...el.querySelectorAll('.max-input')].map(x=>Number(x.value)));
 const fields=()=>{
  $('#question-fields').innerHTML=groups.map((g,i)=>`<div class="question-group"><div class="group-heading"><b>${i+1}번 문항</b><label>소문항 <select class="sub-count" aria-label="${i+1}번 소문항 수" ${hasScores?'disabled':''}>${Array.from({length:11},(_,n)=>`<option value="${n}" ${g.sub===n?'selected':''}>${n===0?'없음':n+'개'}</option>`).join('')}</select></label></div><div class="question-fields">${g.values.map((m,j)=>`<label class="field">${i+1}${g.sub?'-'+(j+1):''}번 배점<input class="max-input" type="number" min="0.01" max="10000" step="any" value="${m}" required aria-label="${i+1}${g.sub?'-'+(j+1):''}번 배점"></label>`).join('')}</div><div class="group-sum"></div></div>`).join('');
  const sum=()=>{capture();$$('.group-sum').forEach((el,i)=>el.textContent=`문항 합계 ${round(groups[i].values.reduce((a,b)=>a+b,0))}점`);$('#max-total').textContent=`대문항 ${groups.length}개 · 점수 입력 칸 ${groups.reduce((a,g)=>a+g.values.length,0)}개 · 총 ${round(groups.flatMap(g=>g.values).reduce((a,b)=>a+b,0))}점`;};
  $$('.max-input').forEach(x=>x.oninput=sum);
  $$('.sub-count').forEach((el,i)=>el.onchange=()=>{capture();const n=Number(el.value);groups[i]={sub:n,values:Array.from({length:Math.max(1,n)},(_,j)=>groups[i].values[j]??5)};fields();});sum();
 };
 fields();$('#question-count').oninput=()=>{const count=Number($('#question-count').value);if(!Number.isInteger(count)||count<1||count>30)return;capture();groups=Array.from({length:count},(_,i)=>groups[i]||{sub:0,values:[20]});fields();};
 $('#exam-form').onsubmit=ev=>{ev.preventDefault();capture();const f=new FormData(ev.target),code=f.get('code').trim(),max=groups.flatMap(g=>g.values),labels=groups.flatMap((g,i)=>g.values.map((_,j)=>`${i+1}${g.sub?'-'+(j+1):''}번`));let error='';if(!code)error='시험 번호를 입력해 주세요.';else if(course().exams.some(x=>x.id!==e.id&&x.code===code))error='같은 시험 번호가 이미 있습니다.';else if(Object.values(e.scores).some(v=>v.some((s,i)=>s!=null&&s>max[i])))error='배점보다 높은 기존 점수가 있습니다. 배점을 확인해 주세요.';if(error){$('#exam-error').innerHTML=`<p class="error">${error}</p>`;return;}e.code=code;e.kind=f.get('kind');e.max=max;e.labels=labels;e.structure=groups.map(g=>g.sub);if(!existing)course().exams.push(e);data.examId=e.id;persist();$('#dialog').close();render();toast('문항과 소문항 배점을 저장했습니다.');};
}
function writeWorkbook(sheets,filename){
 if(!window.XLSX){toast('엑셀 모듈을 불러오지 못했습니다. 새로고침해 주세요.');return;}
 try{const wb=XLSX.utils.book_new();sheets.forEach(({name,rows})=>{const ws=XLSX.utils.aoa_to_sheet(rows);ws['!cols']=rows[0].map((_,i)=>({wch:i===0?18:i===2?22:16}));if(rows.length>1)ws['!autofilter']={ref:XLSX.utils.encode_range({s:{r:0,c:0},e:{r:rows.length-1,c:rows[0].length-1}})};XLSX.utils.book_append_sheet(wb,ws,name);});XLSX.writeFile(wb,filename,{bookType:'xlsx'});}catch(err){toast('엑셀 파일 생성에 실패했습니다. '+err.message);}
}
function downloadTemplate(){writeWorkbook([{name:'학생 명단',rows:[['학번','이름','학과','역할'],['20260001','홍길동','산업공학과','학생'],['20260002','김학생','산업공학과','학생']]}],'학생명단_입력양식.xlsx');toast('예시 학생을 지우고 실제 명단을 입력해 주세요. 학번은 텍스트로 보관하세요.');}
function exportAll(){
 const c=course();if(!c.students.length){toast('먼저 학생 명단을 등록해 주세요.');return;}
 const sheets=[{name:'학생 명단',rows:[['학번','이름','학과','역할'],...c.students.map(s=>[s.id,s.name,s.department,'학생'])]},...c.exams.map((e,i)=>({name:`${i+1}_${e.kind}`,rows:exportRows(c.students,e)})),{name:'시험 정보',rows:[['과목','학기','분반','시험 구분','시험 번호','문항 수','만점'],...c.exams.map(e=>[c.name,c.term,c.section,e.kind,e.code,e.max.length,round(e.max.reduce((a,b)=>a+b,0))])]}];
 writeWorkbook(sheets,`${c.name.replace(/[\\/:*?"<>|]/g,'_')}_전체성적.xlsx`);
}
function importDialog(){
 dialog('학생 명단 가져오기','역할이 학생인 행만 가져옵니다. 교수·조교 및 역할이 비어 있는 행은 제외됩니다.',`<div class="dialog-body"><label class="field">시트 선택<select id="sheet">${book.SheetNames.map((n,i)=>`<option value="${i}">${esc(n)}</option>`).join('')}</select></label><div id="mapping"></div><div id="import-preview"></div></div>`,'<button class="button" data-close>취소</button><button id="apply-import" class="button primary">학생 등록</button>');
 $('#sheet').onchange=renderMapping;renderMapping();
 $('#apply-import').onclick=()=>{if(!importResult||importResult.errors.length||!importResult.rows.length)return;course().students.push(...importResult.rows);persist();const count=importResult.rows.length;$('#dialog').close();query='';filter='all';render();toast(`${count}명의 학생을 등록했습니다. 점수를 입력해 주세요.`);book=null;};
}
function sheetRows(){return XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[Number($('#sheet').value)]],{header:1,raw:false,defval:'',blankrows:true});}
function renderMapping(){
 const rows=sheetRows(),header=rows[0]||[];
 if(!header.length){$('#mapping').innerHTML='';$('#import-preview').innerHTML='<p class="error">첫 행에 학번·이름 등의 열 제목이 필요합니다.</p>';$('#apply-import').disabled=true;importResult=null;return;}
 const options=header.map((h,i)=>`<option value="${i}">${esc(h||`열 ${i+1}`)}</option>`).join('');
 $('#mapping').innerHTML=`<div class="field-grid"><label class="field">학번 열<select id="map-id">${options}</select></label><label class="field">이름 열<select id="map-name">${options}</select></label></div><label class="field">역할 열 (필수)<select id="map-role"><option value="-1">역할 열을 선택해 주세요</option>${options}</select></label><label class="field">학과 열 (선택)<select id="map-department"><option value="-1">가져오지 않음</option>${options}</select></label>`;
 const find=(pattern,fallback)=>{const i=header.findIndex(x=>pattern.test(String(x).replace(/\s/g,'')));return i>=0?i:fallback;};
 $('#map-id').value=find(/학번|studentid|^id$/i,0);$('#map-name').value=find(/이름|성명|name/i,Math.min(1,header.length-1));$('#map-department').value=find(/학과|소속|전공|department|major/i,-1);
 $('#map-role').value=find(/^역할$|^role$/i,-1);
 ['id','name','department','role'].forEach(k=>$('#map-'+k).onchange=previewImport);previewImport();
}
function previewImport(){
 const map=Object.fromEntries(['id','name','department','role'].map(k=>[k,Number($('#map-'+k).value)]));
 const result=validateStudentImport(sheetRows().slice(1),map,course().students);const selected=Object.values(map).filter(v=>v>=0);if(new Set(selected).size!==selected.length)result.errors.unshift('학번, 이름, 학과, 역할은 서로 다른 열을 선택해 주세요.');if(!result.rows.length&&!result.errors.length)result.errors.push('가져올 학생이 없습니다.');
 importResult=result;$('#apply-import').disabled=!!result.errors.length;$('#apply-import').textContent=`${result.rows.length}명 등록`;
 $('#import-preview').innerHTML=`${result.errors.length?`<p class="error">${result.errors.slice(0,8).map(esc).join('\n')}${result.errors.length>8?'\n외 '+(result.errors.length-8)+'개 오류':''}\n파일을 수정해 다시 가져오거나 열 연결을 확인해 주세요. 오류가 있으면 어떤 학생도 등록되지 않습니다.</p>`:''}<p class="import-count">가져오기 미리보기 · 학생 ${result.rows.length}명 · 학생 외 ${result.excluded}명 제외</p><div class="preview-table"><table><thead><tr><th>학번</th><th>이름</th><th>학과</th></tr></thead><tbody>${result.rows.slice(0,30).map(s=>`<tr><td>${esc(s.id)}</td><td>${esc(s.name)}</td><td>${esc(s.department)}</td></tr>`).join('')}</tbody></table></div><p class="form-note">${result.rows.length>30?'앞 30명만 미리보기로 표시합니다. ':''}기존 학생은 유지되며, 중복 학번은 등록할 수 없습니다. 학번의 앞자리 0은 엑셀에서 텍스트로 저장해 주세요.</p>`;
}
function scoreImportDialog(){
 const e=exam();
 dialog(`${esc(e.kind)} 점수 가져오기`,'첫 행의 열 제목(1번, 11-1번 등)으로 문항을, 학번으로 학생을 찾습니다. 빈칸은 기존 점수를 유지합니다.',`<div class="dialog-body"><div class="field-grid"><label class="field">시트 선택<select id="sheet">${book.SheetNames.map((n,i)=>`<option value="${i}">${esc(n)}</option>`).join('')}</select></label><label class="field">학번 열<select id="map-id"></select></label></div><div id="import-preview"></div></div>`,'<button class="button" data-close>취소</button><button id="apply-import" class="button primary">점수 반영</button>');
 const header=()=>sheetRows()[0]||[];
 const mapId=()=>{const h=header(),i=h.findIndex(x=>/학번|studentid|^id$/i.test(String(x).replace(/\s/g,'')));$('#map-id').innerHTML=h.map((x,j)=>`<option value="${j}">${esc(x||`열 ${j+1}`)}</option>`).join('');$('#map-id').value=Math.max(0,i);previewScoreImport(e);};
 $('#sheet').onchange=mapId;$('#map-id').onchange=()=>previewScoreImport(e);mapId();
 $('#apply-import').onclick=()=>{if(!importResult||importResult.errors.length||!importResult.filled)return;Object.assign(e.scores,importResult.updates);persist();const n=Object.keys(importResult.updates).length,cells=importResult.filled;$('#dialog').close();query='';filter='all';render();toast(`${n}명의 점수 ${cells}칸을 반영했습니다. 저장 상태를 확인해 주세요.`);book=null;};
}
function previewScoreImport(e){
 const rows=sheetRows(),c=course(),questions=matchQuestionColumns(rows[0]||[],e);
 const result=validateScoreImport(rows.slice(1),{id:Number($('#map-id').value),questions},c.students,e);
 if(!result.errors.length&&!result.filled)result.errors.push('새로 반영할 점수가 없습니다. 모두 빈칸이거나 기존 점수와 같습니다.');
 importResult=result;const ids=Object.keys(result.updates),missing=e.max.map((_,i)=>questions[i]<0?questionLabel(e,i):null).filter(Boolean);
 $('#apply-import').disabled=!!result.errors.length;$('#apply-import').textContent=`${ids.length}명 점수 반영`;
 $('#import-preview').innerHTML=`${result.errors.length?`<p class="error">${result.errors.slice(0,8).map(esc).join('\n')}${result.errors.length>8?'\n외 '+(result.errors.length-8)+'개 오류':''}\n파일을 수정해 다시 가져와 주세요. 오류가 있으면 어떤 점수도 반영되지 않습니다.</p>`:''}<p class="import-count">찾은 문항 ${e.max.length-missing.length}/${e.max.length}개 · 학생 ${ids.length}명 · 반영 ${result.filled}칸${result.overwritten?` · <b>기존 점수 덮어쓰기 ${result.overwritten}칸</b>`:''}</p>${missing.length?`<p class="form-note">찾지 못한 문항(기존 점수 유지): ${missing.map(esc).join(', ')}</p>`:''}<div class="preview-table"><table><thead><tr><th>학번</th><th>이름</th><th>반영 후 총점</th></tr></thead><tbody>${ids.slice(0,30).map(id=>{const s=c.students.find(x=>x.id===id),v=result.updates[id];return `<tr><td>${esc(id)}</td><td>${esc(s.name)}</td><td>${format(total(v,e.max))}${complete(v,e.max)?'':' *'}</td></tr>`;}).join('')}</tbody></table></div><p class="form-note">${ids.length>30?'앞 30명만 미리보기로 표시합니다. ':''}* 표시는 아직 빈 문항이 있는 부분 합계입니다. '전체 성적 다운로드' 파일에 점수를 채워 그대로 가져올 수 있습니다.</p>`;
}
function pickExcel(kind){importKind=kind;$('#excel-file').click();}
$('#excel-file').onchange=async ev=>{const file=ev.target.files[0];ev.target.value='';if(!file)return;if(file.size>10*1024*1024){toast('10MB 이하의 엑셀 파일을 선택해 주세요.');return;}try{book=XLSX.read(await file.arrayBuffer(),{type:'array'});if(!book.SheetNames.length)throw new Error('시트가 없습니다.');importKind==='scores'?scoreImportDialog():importDialog();}catch{toast('엑셀 파일을 읽을 수 없습니다. 올바른 .xlsx 또는 .xls 파일을 선택해 주세요.');}};
$$('[data-view]').forEach(b=>b.onclick=()=>{view=b.dataset.view;query='';filter='all';render();});
$('#course').onchange=ev=>{data.courseId=ev.target.value;data.examId=course().exams[0].id;query='';filter='all';render();};
$('#delete-course').onclick=deleteCourseDialog;$('#add-course').onclick=courseDialog;$('#start-course').onclick=courseDialog;$('#add-exam').onclick=()=>examDialog();$('#export').onclick=exportAll;$('#template-side').onclick=downloadTemplate;
$('#dialog').addEventListener('click',ev=>{if(ev.target===$('#dialog')){const r=$('#dialog').getBoundingClientRect();if(ev.clientX<r.left||ev.clientX>r.right||ev.clientY<r.top||ev.clientY>r.bottom)$('#dialog').close();}});
export function setCourses(courses){
 data.courses=structuredClone(courses);
 if(!data.courses.length){data.courses=[{id:uid(),name:'첫 과목',term:'2026학년도 2학기',section:'01분반',demo:false,students:[],exams:[newExam('중간고사','MID-01'),newExam('기말고사','FIN-01')]}];}
 render();
}
export function currentCourses(){return data.courses;}
