export function prepareWrite(remote, expectedRevision, courses){
 const revision=remote?.revision??0;
 if(revision!==expectedRevision)throw new Error('CONFLICT');
 const payload=JSON.stringify(courses);
 if(new TextEncoder().encode(payload).length>750000)throw new Error('SIZE');
 return {payload,revision:revision+1};
}
