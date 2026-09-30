const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {News,initialNews}=require('../desktop/news.cjs');
const {scanMorgansInbox}=require('../desktop/morgans-inbox.cjs');

const story={title:'Useful release',url:'https://example.com/release',source:'X',category:'projects',summary:'A source claim.',why:'Useful for Sunny.',nextStep:'Review the source.'};
function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sunny-morgans-inbox-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const hub={state:{news:initialNews(),projects:[]},changed(){}};
 return {dir,news:new News(hub),hub,seen:new Map(),now:Date.now()};
}
function write(dir,name,items=[story],origin='ChatGPT — partial X For you and primary-source briefing'){
 const file=path.join(dir,name);fs.writeFileSync(file,JSON.stringify({origin,items}));
 const old=new Date(Date.now()-10000);fs.utimesSync(file,old,old);return file;
}

test('imports a completed ChatGPT file once through News validation',t=>{
 const x=fixture(t);write(x.dir,'morgans-briefing-2026-09-29.json');
 const first=scanMorgansInbox(x);assert.equal(first.added,1);assert.equal(x.hub.state.news.items[0].verification,'source claim — not independently verified');
 const id=x.hub.state.news.items[0].id;const capturedAt=x.hub.state.news.lastCaptureAt;
 assert.equal(scanMorgansInbox(x).added,0);assert.equal(x.hub.state.news.items[0].id,id);assert.equal(x.hub.state.news.lastCaptureAt,capturedAt);
 assert.equal(scanMorgansInbox({...x,seen:new Map()}).added,0);
});

test('ignores unrelated, unsourced, symlinked and still-written files',t=>{
 const x=fixture(t);write(x.dir,'other.json');write(x.dir,'morgans-briefing-2026-09-29.json',[story],'Manual import');
 const recent=path.join(x.dir,'morgans-weekly-2026-09-29.json');fs.writeFileSync(recent,JSON.stringify({origin:'ChatGPT weekly',items:[{...story,url:'https://example.com/new'}]}));
 const linked=path.join(x.dir,'morgans-briefing-2026-09-30.json');
 try{fs.symlinkSync(recent,linked);}catch{}
 assert.equal(scanMorgansInbox(x).added,0);assert.equal(x.hub.state.news.items.length,0);
});

test('malformed and oversized files report once without blocking another briefing',t=>{
 const x=fixture(t);const bad=write(x.dir,'morgans-briefing-2026-09-28.json');fs.writeFileSync(bad,'{bad json');
 const old=new Date(Date.now()-10000);fs.utimesSync(bad,old,old);
 write(x.dir,'morgans-briefing-2026-09-29.json');
 write(x.dir,'morgans-briefing-2026-09-30.json',[{...story,url:'javascript:bad'}]);
 const huge=write(x.dir,'morgans-briefing-2026-10-01.json');fs.writeFileSync(huge,'x'.repeat(512*1024+1));fs.utimesSync(huge,old,old);
 const result=scanMorgansInbox(x);assert.equal(result.added,1);assert.equal(result.errors.length,3);
 assert.equal(scanMorgansInbox(x).errors.length,0);
});

test('rotates through more than 100 briefing files without starving older captures',t=>{
 const x=fixture(t);for(let index=0;index<101;index++)write(x.dir,`morgans-fixture-${String(index).padStart(3,'0')}-2026-09-30.json`,[{...story,url:`https://example.com/rotation/${index}`}]);
 let opened=0;const original=fs.openSync;t.mock.method(fs,'openSync',(...args)=>{opened++;return original(...args);});
 assert.equal(scanMorgansInbox(x).added,100);assert.equal(opened,100);opened=0;
 assert.equal(scanMorgansInbox(x).added,1);assert.ok(opened<=100);assert.equal(x.news.data.items.length,101);
});
test('rotation notices changes to an already seen file after later batches',t=>{
 const x=fixture(t);for(let index=0;index<101;index++)write(x.dir,`morgans-fixture-${String(index).padStart(3,'0')}-2026-09-30.json`,[{...story,url:`https://example.com/change/${index}`}]);
 scanMorgansInbox(x);scanMorgansInbox(x);write(x.dir,'morgans-fixture-001-2026-09-30.json',[{...story,url:'https://example.com/changed-after-scan'}]);
 assert.equal(scanMorgansInbox(x).added,1);assert.equal(x.news.data.items.length,102);
});
test('rotation survives deletion of its last inspected name and insertion of new files',t=>{
 const x=fixture(t);for(let index=0;index<101;index++)write(x.dir,`morgans-fixture-${String(index).padStart(3,'0')}-2026-09-30.json`,[{...story,url:`https://example.com/deletion/${index}`}]);
 scanMorgansInbox(x);fs.unlinkSync(path.join(x.dir,'morgans-fixture-001-2026-09-30.json'));write(x.dir,'morgans-fixture-999-2026-09-30.json',[{...story,url:'https://example.com/new-name'}]);
 assert.equal(scanMorgansInbox(x).added,2);assert.equal(x.news.data.items.length,102);
});
test('a full malformed batch reports once and cannot starve a valid older file',t=>{
 const x=fixture(t);write(x.dir,'morgans-fixture-000-2026-09-30.json');for(let index=1;index<=100;index++){const file=write(x.dir,`morgans-fixture-${String(index).padStart(3,'0')}-2026-09-30.json`);fs.writeFileSync(file,'invalid json');fs.utimesSync(file,new Date(0),new Date(0));}
 assert.equal(scanMorgansInbox(x).errors.length,100);const next=scanMorgansInbox(x);assert.equal(next.errors.length,0);assert.equal(next.added,1);
});
