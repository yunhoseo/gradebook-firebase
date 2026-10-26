export function parseScore(value,max){
 if(String(value).trim()==='')return null;
 const n=Number(value);if(!Number.isFinite(n)||n<0||n>max)throw new Error(`0~${max}점 사이로 입력해 주세요.`);
 return n;
}
export const round=n=>Math.round((n+Number.EPSILON)*100)/100;
export function total(scores,max){return round(max.reduce((a,_,i)=>a+(scores?.[i]??0),0));}
export function complete(scores,max){return max.every((_,i)=>typeof scores?.[i]==='number');}
export function summary(students,exam){
 const totals=students.filter(s=>complete(exam.scores[s.id],exam.max)).map(s=>total(exam.scores[s.id],exam.max));
 return {complete:totals.length,pending:students.length-totals.length,average:totals.length?round(totals.reduce((a,b)=>a+b,0)/totals.length):null,highest:totals.length?Math.max(...totals):null,totals};
}
export function validateRoster(raw,map,existing=[]){
 const seen=new Set(existing.map(s=>s.id)),rows=[],errors=[];
 raw.forEach((r,i)=>{
  if(r.every(v=>v==null||String(v).trim()===''))return;
  const id=String(r[map.id]??'').trim(),name=String(r[map.name]??'').trim(),department=String(r[map.department]??'').trim();
  if(!id||!name){errors.push(`${i+2}행: 학번과 이름은 필수입니다.`);return;}
  if(seen.has(id)){errors.push(`${i+2}행: 중복 학번 ${id}`);return;}
  seen.add(id);rows.push({id,name,department});
 });return {rows,errors};
}
export function exportRows(students,exam){
 return [['학번','이름','학과',...exam.max.map((m,i)=>`${exam.labels?.[i]??`${i+1}번`} (${m}점)`),'총점','만점','입력 상태'],...students.map(s=>{
 const scores=exam.scores[s.id]||[],done=complete(scores,exam.max);
 return [s.id,s.name,s.department,...exam.max.map((_,i)=>scores[i]??null),done?total(scores,exam.max):null,round(exam.max.reduce((a,b)=>a+b,0)),done?'입력 완료':'미입력 포함'];
 })];
}
export function addStudent(course,student){
 const result=validateRoster([[student.id,student.name,student.department]],{id:0,name:1,department:2},course.students);
 if(result.errors.length||!result.rows.length)throw new Error(result.errors[0]?.replace(/^2행: /,'')||'학번과 이름은 필수입니다.');
 course.students.push(result.rows[0]);return result.rows[0];
}
export function removeStudent(course,id){
 course.students=course.students.filter(s=>s.id!==id);
 course.exams.forEach(e=>delete e.scores[id]);
}
export function validateStudentImport(raw,map,existing=[]){
 if(!Number.isInteger(map.role)||map.role<0)return {rows:[],errors:['역할 열을 선택해 주세요. 역할이 학생인 행만 등록할 수 있습니다.'],excluded:0};
 let excluded=0;
 const filtered=raw.map(row=>{if(row.every(v=>v==null||String(v).trim()===''))return [];if(String(row[map.role]??'').trim()==='학생')return row;excluded++;return [];});
 return {...validateRoster(filtered,map,existing),excluded};
}
export function removeCourse(state,id,confirmation){
 const target=state.courses.find(c=>c.id===id);
 if(!target)throw new Error('삭제할 과목을 찾을 수 없습니다.');
 if(confirmation!==target.name)throw new Error('과목 이름을 정확하게 입력해 주세요.');
 state.courses=state.courses.filter(c=>c.id!==id);
 if(state.courseId===id||!state.courses.some(c=>c.id===state.courseId)){
  state.courseId=state.courses[0]?.id??'';
  state.examId=state.courses[0]?.exams[0]?.id??'';
 }
}
const questionKey=s=>String(s??'').replace(/\s/g,'').replace(/\(.*\)$/,'').replace(/^(Q|문항)/i,'').replace(/번$/,'');
export function matchQuestionColumns(header,exam){
 const keys=header.map(questionKey);
 return exam.max.map((_,i)=>keys.indexOf(questionKey(exam.labels?.[i]??`${i+1}번`)));
}
export function validateScoreImport(raw,map,students,exam){
 const known=new Set(students.map(s=>s.id)),seen=new Set(),updates={},errors=[];let filled=0,overwritten=0;
 if(!map.questions.some(j=>j>=0))return {updates,errors:['문항 열을 찾지 못했습니다. 첫 행의 열 제목을 1번, 11-1번처럼 시험 설정의 문항 이름과 같게 맞춰 주세요.'],filled,overwritten};
 raw.forEach((r,i)=>{
  if(r.every(v=>v==null||String(v).trim()===''))return;
  const id=String(r[map.id]??'').trim();
  if(!id){errors.push(`${i+2}행: 학번이 비어 있습니다.`);return;}
  if(!known.has(id)){errors.push(`${i+2}행: 명단에 없는 학번 ${id}`);return;}
  if(seen.has(id)){errors.push(`${i+2}행: 중복 학번 ${id}`);return;}
  seen.add(id);
  const next=exam.max.map((_,q)=>exam.scores[id]?.[q]??null);let changed=false;
  map.questions.forEach((j,q)=>{
   if(j<0)return;
   let v;try{v=parseScore(r[j]??'',exam.max[q]);}catch(err){errors.push(`${i+2}행 ${exam.labels?.[q]??`${q+1}번`}: ${err.message}`);return;}
   if(v==null||v===next[q])return; // ponytail: blank cell keeps the existing score
   if(next[q]!=null)overwritten++;filled++;next[q]=v;changed=true;
  });
  if(changed)updates[id]=next;
 });
 return {updates,errors,filled,overwritten};
}
