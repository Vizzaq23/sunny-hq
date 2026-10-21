const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
function load(name,transcript){
 const originalLoad=Module._load,extensions={...Module._extensions},react=require('react');
 Module._load=function(request,...args){if(request==='react')return {...react,useState:v=>[typeof v==='function'?v():v,()=>{}],useRef:current=>({current}),useEffect:()=>{},useMemo:fn=>fn(),useCallback:fn=>fn};if(request==='../useTaskTranscript')return {useTaskTranscript:()=>transcript};return originalLoad.call(this,request,...args);};
 const compile=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText.replaceAll('import.meta.env.BASE_URL',"''"),file);
 Module._extensions['.ts']=compile;Module._extensions['.tsx']=compile;Module._extensions['.css']=()=>{};
 try{const file=path.resolve(__dirname,'../src/views/'+name+'.tsx');delete require.cache[file];return require(file);}finally{Module._load=originalLoad;for(const key of ['.ts','.tsx','.css']){if(extensions[key])Module._extensions[key]=extensions[key];else delete Module._extensions[key];}}
}
function find(element,predicate){if(!element||typeof element!=='object')return;if(predicate(element))return element;for(const child of [].concat(element.props?.children??[]).flat(Infinity)){const result=find(child,predicate);if(result)return result;}}
const ref={kind:'reply',taskId:'t',messageId:'large',sha256:'a'.repeat(64)};
const baseTranscript={segments:[],loading:false,error:'',hasOlder:true,hasNewer:true,loadOlder(){},loadNewer(){},retry(){},reload(){}};
const task={id:'t',projectId:'p',crewId:'robin',title:'Large result',status:'finished',transcriptRevision:2,messageCount:1000};
const mission={id:'m',projectId:'p',revision:4,status:'WAITING_FOR_REVIEW',activeAttemptId:'a',attempts:[{id:'a',status:'finished',taskIds:['t']}],artifacts:[]};
test('partial reply selection sends canonical whole-message main ref and opens original task',async()=>{
 const transcript={...baseTranscript,segments:[{messageId:'large',role:'assistant',time:1,offset:200000,text:'Only a partial excerpt',totalLength:1000000,replyRef:ref}]};
 const {MissionResultSelection}=load('MissionBoard',transcript),calls=[],opened=[];
 const element=MissionResultSelection({mission,snapshot:{epoch:'e',sequence:1,tasks:[task]},busy:false,invoke:async(action,args)=>calls.push({action,args}),run:async fn=>fn(),onOpen:id=>opened.push(id)});
 const select=find(element,e=>e.props?.className?.includes('mission-select-reply'));assert.ok(select);await select.props.onClick();await new Promise(setImmediate);assert.deepEqual(calls,[{action:'mission:selectResult',args:{missionId:'m',revision:4,ref}}]);
 find(element,e=>e.type==='button'&&e.props.children==='Open full reply').props.onClick();assert.deepEqual(opened,['t']);
});
test('reply display without canonical metadata cannot manufacture a selectable result',()=>{
 const {MissionResultSelection}=load('MissionBoard',{...baseTranscript,segments:[{messageId:'large',role:'assistant',time:1,offset:0,text:'Visible text',totalLength:12}]});
 const element=MissionResultSelection({mission,snapshot:{epoch:'e',sequence:1,tasks:[task]},busy:false,invoke:async()=>{},run:async fn=>fn(),onOpen(){}});assert.equal(find(element,e=>e.props?.className?.includes('mission-select-reply')),undefined);
});
test('conversation renders huge reply segments and visible history recovery controls without touching draft focus',()=>{
 const {Conversation}=load('Workbench',baseTranscript),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const segments=[{messageId:'large',role:'assistant',time:1,offset:0,text:'First 😀',totalLength:20},{messageId:'large',role:'assistant',time:1,offset:8,text:'continued text',totalLength:20}];
 const html=renderToStaticMarkup(React.createElement(Conversation,{task,crewId:'robin',reducedMotion:true,transcript:{...baseTranscript,segments,error:'History unavailable; retry'}}));
 assert.ok(html.indexOf('First 😀')<html.indexOf('continued text'));assert.match(html,/Continued reply/);assert.match(html,/Load older history/);assert.match(html,/Load newer history/);assert.match(html,/Retry history/);assert.match(html,/role="alert"/);assert.doesNotMatch(html,/Mission opened/);
});

test('uncertain storage disables new reply selection while retaining navigation and recovery instructions',()=>{
 const {MissionResultSelection}=load('MissionBoard',{...baseTranscript,segments:[{messageId:'large',role:'assistant',time:1,offset:0,text:'excerpt',totalLength:1000000,replyRef:ref}]});
 const element=MissionResultSelection({mission,snapshot:{epoch:'e',sequence:1,tasks:[task],persistence:{state:'unsaved',uncertain:true,failures:1}},busy:false,invoke:async()=>{},run:async fn=>fn(),onOpen(){}});
 assert.equal(find(element,e=>e.props?.className?.includes('mission-select-reply')).props.disabled,true);
 assert.equal(find(element,e=>e.type==='button'&&e.props.children==='Open full reply').props.disabled,undefined);
 assert.ok(find(element,e=>e.props?.role==='status'&&typeof e.props.children==='string'&&/restart Sunny/.test(e.props.children)));
});
