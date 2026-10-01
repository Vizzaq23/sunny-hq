const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const Module=require('node:module');const ts=require('typescript');
Module._extensions['.ts']=(mod,filename)=>mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,filename);
function loadComponent(name){const filename=path.resolve(__dirname,'../src/components/'+name+'.tsx');if(!fs.existsSync(filename))return {};const mod=new Module(filename,module);mod.filename=filename;mod.paths=module.paths;const original=Module._extensions['.css'];Module._extensions['.css']=()=>{};try{mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,filename);return mod.exports;}finally{if(original)Module._extensions['.css']=original;else delete Module._extensions['.css'];}}

function renderGoal(objective){
 const {CaptainLog}=loadComponent('CaptainLog'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const mission={id:'m',title:'Goal fixture',objective,projectId:'p',status:'WAITING_FOR_REVIEW',activeAttemptId:'a',attempts:[{id:'a',taskIds:['t'],workflow:{stages:[{id:'review',status:'working',taskId:'t'}]}}],acceptanceCriteria:['Exact criterion'],events:[],taskIds:['t'],updatedAt:2};
 const snapshot={projects:[{id:'p',name:'Project'}],missions:[mission],tasks:[{id:'t',title:'Inspect work',crewId:'zoro',projectId:'p',status:'working',transcriptRevision:1,messageCount:0,updatedAt:1}],workspace:{drafts:[]}};
 return {objective:mission.objective,html:renderToStaticMarkup(React.createElement(CaptainLog,{snapshot,context:{projectId:'p',missionId:'m',attemptId:'a',surface:'deck',returnTo:{view:'ship'}},onContext(){},onOpenResult(){},onRequestChanges(){},invoke:async()=>{}}))};
}
test('50k goal is a compact preview with closed native disclosure and exact full text after workflow status',()=>{
 const objective='Meaningful first line'+String.fromCharCode(10)+'x'.repeat(50000)+String.fromCharCode(10)+'Exact final boundary',rendered=renderGoal(objective),html=rendered.html;
 assert.match(html,/<details class="captain-goal-details"><summary>Read full goal<\/summary>/);
 const preview=html.match(/<p class="captain-goal-preview">([^]*?)<\/p>/)?.[1];assert.ok(preview);assert.ok(preview.length<=301);assert.ok(preview.startsWith('Meaningful first line'));
 assert.ok(html.includes('<p class="captain-goal-full">'+objective+'</p>'),'expanded content retains all exact objective characters');
 assert.ok(html.indexOf('captain-log-status')<html.indexOf('captain-goal-preview'));assert.ok(html.indexOf('Linked mission stages')<html.indexOf('captain-goal-preview'));
 assert.equal(rendered.objective,objective);assert.match(html,/Exact criterion/);assert.match(html,/captain-review-mission/);assert.match(html,/captain-request-changes/);
});
test('short goals remain fully visible without an unnecessary full-goal disclosure',()=>{
 const {html}=renderGoal('Fix the CLI argument and verify its help output.');assert.match(html,/<p class="captain-goal">Fix the CLI argument and verify its help output\.<\/p>/);assert.doesNotMatch(html,/captain-goal-details/);
});

test('a multi-line goal keeps the first three lines in preview and all lines in disclosure',()=>{
 const objective=['First line','Second line','Third line','Fourth line'].join(String.fromCharCode(10)),{html}=renderGoal(objective);assert.ok(html.includes('<p class="captain-goal-preview">'+objective.split(String.fromCharCode(10)).slice(0,3).join(String.fromCharCode(10))+'…</p>'));assert.ok(html.includes('<p class="captain-goal-full">'+objective+'</p>'));
});
