import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareWrite} from '../src/sync.mjs';
test('first save and subsequent revision',()=>{assert.deepEqual(prepareWrite(null,0,[]),{payload:'[]',revision:1});assert.equal(prepareWrite({revision:3},3,[]).revision,4);});
test('stale editor cannot overwrite another staff member',()=>{assert.throws(()=>prepareWrite({revision:4},3,[{name:'local'}]),/CONFLICT/);});
test('deleted remote document cannot silently replace existing work',()=>{assert.throws(()=>prepareWrite(null,4,[]),/CONFLICT/);});
test('UTF8 size limit handles Korean names',()=>{assert.throws(()=>prepareWrite(null,0,['가'.repeat(260000)]),/SIZE/);});
