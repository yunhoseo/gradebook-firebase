import test from 'node:test';
import assert from 'node:assert/strict';
import {parseScore, summary, validateRoster, exportRows} from '../src/model.mjs';
test('blank is missing; zero is a valid score; out-of-range and nonnumeric rejected',()=>{
 assert.equal(parseScore('',20),null); assert.equal(parseScore('0',20),0); assert.equal(parseScore('12.5',20),12.5);
 for(const s of ['-1','21','hello','Infinity']) assert.throws(()=>parseScore(s,20));
});
test('statistics use only fully entered students, including genuine zero totals',()=>{
 const s=summary([{id:'1'},{id:'2'},{id:'3'}],{max:[20,20],scores:{'1':[0,0],'2':[10,null],'3':[20,20]}});
 assert.equal(s.complete,2);assert.equal(s.average,20);assert.equal(s.highest,40);assert.equal(s.pending,1);
});
test('roster rejects duplicate IDs and missing names while preserving zero-prefixed IDs',()=>{
 const result=validateRoster([['001','가','산공'],['001','나',''],['002','',''],['old','다','']],{id:0,name:1,department:2},[{id:'old'}]);
 assert.equal(result.rows[0].id,'001');assert.equal(result.errors.length,3);
});
test('export retains blank marks separately from zero; incomplete total stays blank',()=>{
 const out=exportRows([{id:'001',name:'=literal',department:'공학'}],{max:[20,20],scores:{'001':[0,null]}});
 assert.equal(out[1][0],'001');assert.equal(out[1][1],'=literal');assert.equal(out[1][3],0);assert.equal(out[1][4],null);assert.equal(out[1][5],null);
});
test('subquestion labels and separate maxima are preserved in exported columns',()=>{
 const out=exportRows([{id:'1',name:'학생',department:''}],{max:[5,10,20],labels:['1-1번','1-2번','2번'],scores:{'1':[4,8,18]}});
 assert.deepEqual(out[0].slice(3,6),['1-1번 (5점)','1-2번 (10점)','2번 (20점)']);assert.equal(out[1][6],30);assert.equal(out[1][7],35);
});
test('manual addition trims identity, preserves leading zeros, rejects duplicates atomically',async()=>{
 const {addStudent}=await import('../src/model.mjs');const c={students:[],exams:[]};
 addStudent(c,{id:' 001 ',name:' 새학생 ',department:' 공학 '});assert.deepEqual(c.students,[{id:'001',name:'새학생',department:'공학'}]);
 assert.throws(()=>addStudent(c,{id:'001',name:'중복',department:''}));assert.equal(c.students.length,1);
 assert.throws(()=>addStudent(c,{id:'002',name:' ',department:''}));assert.equal(c.students.length,1);
});
test('student removal removes every exam score but leaves other students intact',async()=>{
 const {removeStudent}=await import('../src/model.mjs');const c={students:[{id:'001'},{id:'002'}],exams:[{scores:{'001':[3],'002':[5]}},{scores:{'001':[9],'002':[8]}}]};
 removeStudent(c,'001');assert.deepEqual(c.students,[{id:'002'}]);assert.deepEqual(c.exams.map(e=>e.scores),[{'002':[5]},{'002':[8]}]);
});
test('Excel import accepts only exact student role after trimming, with original row errors',async()=>{
 const {validateStudentImport}=await import('../src/model.mjs');
 const raw=[['T','교수','','교수'],['001','학생A','',' 학생 '],['TA','조교','','조교'],['002','학생B','','학생'],['003','청강','','청강생'],['004','빈역할','',''],['005','','','학생']];
 const r=validateStudentImport(raw,{id:0,name:1,department:2,role:3});
 assert.deepEqual(r.rows.map(s=>s.id),['001','002']);assert.equal(r.excluded,4);assert.match(r.errors[0],/^8행:/);
});
test('Excel import refuses missing role mapping and does not validate excluded staff',async()=>{
 const {validateStudentImport}=await import('../src/model.mjs');
 assert.equal(validateStudentImport([['001','학생']],{id:0,name:1,role:-1}).rows.length,0);
 assert.ok(validateStudentImport([['001','학생']],{id:0,name:1,role:-1}).errors.length);
 const r=validateStudentImport([['','','조교'],['001','학생','학생']],{id:0,name:1,role:2},[]);
 assert.equal(r.errors.length,0);assert.equal(r.rows.length,1);
});

import * as model from '../src/model.mjs';
const courseFixture=()=>({courses:[{id:'a',name:'통계학',students:[{id:'1'}],exams:[{id:'mid-a',scores:{'1':[9]}}]},{id:'b',name:'생산관리',students:[{id:'2'}],exams:[{id:'mid-b',scores:{'2':[7]}}]}],courseId:'a',examId:'mid-a'});
test('course deletion removes only target and selects remaining course exam',()=>{
 const state=courseFixture(),other=structuredClone(state.courses[1]);
 assert.equal(typeof model.removeCourse,'function');
 model.removeCourse(state,'a','통계학');
 assert.deepEqual(state.courses,[other]);assert.equal(state.courseId,'b');assert.equal(state.examId,'mid-b');
});
test('wrong confirmation or missing course cannot delete anything',()=>{
 const state=courseFixture(),before=structuredClone(state);
 assert.equal(typeof model.removeCourse,'function');
 assert.throws(()=>model.removeCourse(state,'a','다른과목'));assert.deepEqual(state,before);
 assert.throws(()=>model.removeCourse(state,'missing','통계학'));assert.deepEqual(state,before);
});
test('last course deletion leaves genuinely empty saved workspace',()=>{
 const state=courseFixture();state.courses.pop();
 assert.equal(typeof model.removeCourse,'function');
 model.removeCourse(state,'a','통계학');
 assert.deepEqual(state,{courses:[],courseId:'',examId:''});
});
test('score import matches question headers, keeps blanks, counts overwrites',()=>{
 const e={max:[2,5,5],labels:['1번','11-1번','11-2번'],scores:{'001':[1,null,3]}},students=[{id:'001'},{id:'002'}];
 const questions=model.matchQuestionColumns(['학번','1번 (2점)','11-1','총점'],e);assert.deepEqual(questions,[1,2,-1]);
 const r=model.validateScoreImport([['001','2','',''],['002','0','4.5','']],{id:0,questions},students,e);
 assert.deepEqual(r.errors,[]);assert.deepEqual(r.updates,{'001':[2,null,3],'002':[0,4.5,null]});assert.equal(r.filled,3);assert.equal(r.overwritten,1);
 assert.deepEqual(e.scores,{'001':[1,null,3]});
});
test('score import reports unknown, duplicate IDs and out-of-range scores with sheet rows',()=>{
 const e={max:[2],scores:{}},r=model.validateScoreImport([['999','1'],['001','3'],['001','1'],['001','1']],{id:0,questions:[1]},[{id:'001'}],e);
 assert.match(r.errors[0],/^2행: 명단에 없는/);assert.match(r.errors[1],/^3행 1번:/);assert.match(r.errors[2],/^4행: 중복/);assert.match(r.errors[3],/^5행: 중복/);
 assert.ok(model.validateScoreImport([['001','1']],{id:0,questions:[-1]},[{id:'001'}],e).errors.length);
});
