const {test}=require('node:test');const assert=require('node:assert/strict');
const {shipLogEntries,filterShipLog}=require('../src/shipLog.ts');
const base=()=>({tasks:[],missions:[],projects:[],localCrew:{councils:[]}});
test('log preserves exact attempt and check evidence without inventing acceptance',()=>{
 const snapshot=base();snapshot.missions=[{id:'m',projectId:'p',title:'Build',events:[{id:'e',time:1,type:'ATTEMPT_STARTED',sequence:1}],reviewDecisions:[{id:'r',time:3,decision:'changes-requested',attemptId:'old',reviewedRevision:2,note:'Fix it'}],artifacts:[{id:'a',projectId:'p',attemptId:'old',recordedAt:2,kind:'check',status:'failed',command:'npm test',exitCode:1},{id:'wrong',projectId:'elsewhere',recordedAt:5,kind:'check'}]}];
 const rows=shipLogEntries(snapshot);assert.equal(rows.length,3);assert.equal(rows[0].attemptId,'old');assert.equal(rows[0].label,'Captain requested changes');assert.equal(rows[1].label,'Check · failed');assert.match(rows[1].detail,/Exit code 1/);assert.ok(!rows.some(r=>r.label.includes('accepted')));
});
test('log scopes project, record kind and every search word',()=>{
 const rows=[{projectId:'p',kind:'check',crewId:'usopp',title:'Build',label:'Check failed',detail:'npm test'},{projectId:'q',kind:'work',crewId:'usopp',title:'Build',label:'Ready',detail:'reply'}];const names=new Map([['usopp','Usopp']]);assert.equal(filterShipLog(rows,'usopp failed','p','check',names).length,1);assert.equal(filterShipLog(rows,'usopp passed','p','check',names).length,0);assert.equal(filterShipLog(rows,'','q','check',names).length,0);
});
test('external history is excluded and mutable conversation time is labelled honestly',()=>{
 const snapshot=base();snapshot.tasks=[{id:'t',projectId:'p',crewId:'franky',title:'Draft',status:'finished',updatedAt:20,lastAssistantPreview:'Proposal'},{id:'external',external:true}];const rows=shipLogEntries(snapshot);assert.equal(rows.length,1);assert.equal(rows[0].timeLabel,'Latest conversation update');assert.equal(rows[0].taskId,'t');assert.equal(rows[0].detail,'Proposal');
});
