const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
// Execute the real component event path. Browser environment imports and React scheduling
// are adapted because Node has no DOM; IPC and the navigation callback are observed directly.
function componentForNode(adapter){
 const originalLoad=Module._load,originalTs=Module._extensions['.ts'],originalTsx=Module._extensions['.tsx'],originalCss=Module._extensions['.css'];
 const react=require('react');
 Module._load=function(request,...args){if(request==='react')return {...react,useState:initial=>{const value=typeof initial==='function'?initial():initial;return [adapter?adapter.state(value):value,()=>{}]},useRef:current=>({current}),useEffect:fn=>adapter?.effect(fn),useMemo:fn=>fn(),useCallback:fn=>fn};return originalLoad.call(this,request,...args);};
 const compile=(mod,filename)=>{const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText.replaceAll('import.meta.env.BASE_URL',"''");mod._compile(code,filename);};
 Module._extensions['.ts']=compile;Module._extensions['.tsx']=compile;Module._extensions['.css']=()=>{};
 try{if(adapter){delete require.cache[require.resolve('../src/views/Workbench.tsx')];delete require.cache[require.resolve('../src/components/GitPane.tsx')];}return require('../src/views/Workbench.tsx').Workbench;}finally{Module._load=originalLoad;for(const [extension,value] of [['.ts',originalTs],['.tsx',originalTsx],['.css',originalCss]]){if(value)Module._extensions[extension]=value;else delete Module._extensions[extension];}}
}
function findElement(element,predicate){if(Array.isArray(element)){for(const child of element){const found=findElement(child,predicate);if(found)return found;}return;}if(!element||typeof element!=='object')return; if(predicate(element))return element;for(const child of [].concat(element.props?.children??[])){const found=findElement(child,predicate);if(found)return found;}}
test('specialist handoff publishes new task ID for persisted navigation',async()=>{
 global.window={sunny:{},confirm:()=>true,location:{href:'https://fixture.invalid/'},addEventListener(){},removeEventListener(){}};global.location=window.location;global.sessionStorage={getItem:()=>null};
 const Workbench=componentForNode(),calls=[],opened=[];
 const snapshot={projects:[{id:'p',name:'Fixture project'}],tasks:[{id:'old',projectId:'p',crewId:'franky',status:'finished',transcriptRevision:1,messageCount:0}],approvals:[],settings:{reducedMotion:true},workspace:{version:1,revision:0,context:null,drafts:[],seenAcceptanceIds:[]},world:{residents:[]}};
 const element=Workbench({snapshot,initial:{taskId:'old',projectId:'p'},invoke:async(action,args)=>{calls.push({action,args});return {id:'new',projectId:'p',crewId:'robin'};},toast(){},onClose(){},onTaskChange:id=>opened.push(id)});
 const select=findElement(element,e=>e.type==='select'&&e.props['aria-label']==='Assigned crewmate');assert.ok(select);assert.equal(select.props.disabled,false);
 select.props.onChange({target:{value:'robin'}});await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(calls.map(call=>call.action),['task:handoff']);assert.equal(calls[0].args.taskId,'old');assert.equal(calls[0].args.crewId,'robin');assert.deepEqual(opened,['new']);
});

test('existing task never seeds its follow-up from a submitted conversation template',()=>{
 global.window={sunny:{},confirm:()=>true,location:{href:'https://fixture.invalid/'},addEventListener(){},removeEventListener(){}};global.location=window.location;let saved=null;global.sessionStorage={getItem:()=>saved};
 const Workbench=componentForNode();
 const snapshot={projects:[{id:'p',name:'Fixture project'}],tasks:[{id:'started',projectId:'p',crewId:'robin',status:'working',transcriptRevision:1,messageCount:0}],approvals:[],settings:{reducedMotion:true},workspace:{version:1,revision:0,context:null,drafts:[],seenAcceptanceIds:[]},world:{residents:[]}};
 const props={snapshot,initial:{taskId:'started',projectId:'p',prompt:'Submitted template'},invoke:async()=>{},toast(){},onClose(){}};
 const composer=()=>findElement(Workbench(props),e=>e.type==='textarea');
 assert.equal(composer().props.value,'');
 saved='My unsent follow-up';assert.equal(composer().props.value,saved,'saved task draft takes precedence');
});

test('Workbench passes selected summary identity to paged conversation and leaves saved composer draft intact',()=>{
 global.window={sunny:{},confirm:()=>true,location:{href:'https://fixture.invalid/'},addEventListener(){},removeEventListener(){}};global.location=window.location;global.sessionStorage={getItem:()=> 'Keep the unsent draft'};
 const Workbench=componentForNode(),snapshot={protocolVersion:2,epoch:'e',sequence:4,projects:[{id:'p',name:'Fixture'}],tasks:[{id:'selected',projectId:'p',crewId:'robin',status:'finished',transcriptRevision:3,messageCount:120}],approvals:[],settings:{reducedMotion:true},workspace:{version:1,revision:0,context:null,drafts:[],seenAcceptanceIds:[]},world:{residents:[]}};
 const element=Workbench({snapshot,initial:{taskId:'selected',projectId:'p'},invoke:async()=>{},toast(){},onClose(){}});
 const conversation=findElement(element,e=>typeof e.type==='function'&&e.type.name==='Conversation');assert.ok(conversation);assert.equal(conversation.props.transcript.loading,true);assert.deepEqual(conversation.props.transcript.segments,[]);assert.equal(conversation.props.task.messageCount,120);
 assert.equal(findElement(element,e=>e.type==='textarea').props.value,'Keep the unsent draft');
});

test('every task-capable crew room resolves only its admitted illustration',()=>{
 global.window={sunny:{},confirm:()=>true,location:{href:'https://fixture.invalid/'},addEventListener(){},removeEventListener(){}};global.location=window.location;global.sessionStorage={getItem:()=>null};
 global.document={hidden:false};global.matchMedia=()=>({matches:true});
 const Workbench=componentForNode(),{renderToStaticMarkup}=require('react-dom/server');
 const art={luffy:'luffy-captains-den.png',zoro:'zoro-dojo-room.png',nami:'nami-chart-room.png',usopp:'usopp-inventors-workshop.png',sanji:'sanji-galley-room.png',chopper:'chopper-infirmary-room.png',robin:'robin-ship-library.png',franky:'franky-shipwright-room.png',brook:'brook-music-room.png',jinbe:'jinbe-helm-room.png'};
 for(const id of [...Object.keys(art),'law','ace','vivi','perona']){
  const snapshot={projects:[{id:'p',name:'Fixture'}],tasks:[{id:'t',projectId:'p',crewId:id,status:'finished',updatedAt:1,transcriptRevision:1,messageCount:1}],approvals:[],settings:{reducedMotion:true},workspace:{version:1,revision:0,context:null,drafts:[],seenAcceptanceIds:[]},world:{residents:['law','ace','vivi','perona'].map(crewId=>({id:crewId,recruited:true}))}};
  const tree=Workbench({snapshot,initial:{taskId:'t',projectId:'p',crewId:id},invoke:async()=>{},toast(){},onClose(){},embedded:true});
  assert.equal(tree.props['data-crew-id'],id);
  assert.ok(findElement(tree,e=>e.type==='button'&&e.props['aria-label']==='Back to workspace'));
  assert.ok(findElement(tree,e=>e.type==='textarea'&&e.props['aria-label']==='Message the crew'));
  const conversation=findElement(tree,e=>typeof e.type==='function'&&e.type.name==='Conversation');
  assert.ok(conversation,id+' conversation');
  const html=renderToStaticMarkup(conversation.type(conversation.props));
  assert.doesNotMatch(html,/assets\/undefined/);
  const room=findElement(tree,e=>typeof e.type==='function'&&e.type.name==='RoomStation');
  const chat=findElement(tree,e=>e.type==='main'&&e.props.className==='chat-pane');
  assert.ok(chat,id+' direct conversation controls remain available');
  assert.equal(findElement(chat,e=>typeof e.type==='function'&&e.type.name==='RoomStation'),undefined,'room illustration stays outside chat');
  assert.doesNotMatch(html,/conversation-room-art/,'conversation does not cover room art');
  if(art[id]){
   assert.ok(room,id+' has a separate room panel');
   const roomHtml=renderToStaticMarkup(room);
   assert.ok(roomHtml.includes('src="'+new URL('assets/'+art[id],window.location.href).href+'"'),id+' admitted room image');
   assert.match(roomHtml,/alt="[^" ]+[^"]*room aboard the Sunny"/,id+' readable illustration alternative');
   assert.ok(roomHtml.includes('data-room-layout="'+id+'"'),id+' dedicated station composition');
  }else assert.equal(room,undefined,id+' has no unmeasured room art');
 }
});

test('actual managed Git pane sends workspace IDs for status diff and commit',async()=>{
 global.window={sunny:{},confirm:()=>true,location:{href:'https://fixture.invalid/'},addEventListener(){},removeEventListener(){}};global.location=window.location;global.sessionStorage={getItem:()=>null};let index=0,gitIndex=0,mode='workbench';const effects=[],calls=[];
 const Workbench=componentForNode({state(value){if(mode==='workbench'){const n=index++;return n===4?true:n===5?'git':value;}const state=[{branch:'worker',files:[{path:'result.md',status:' M'}],diff:'worker changes'},['result.md'],'worker changes','','Worker commit',false,'',false,'',false];return state[gitIndex++];},effect(fn){if(mode==='git')effects.push(fn);}});
 const snapshot={projects:[{id:'p',name:'Fixture',path:'original'}],tasks:[{id:'worker',projectId:'p',crewId:'franky',runId:'run',workspaceId:'copy',status:'finished',transcriptRevision:1,messageCount:0}],approvals:[],settings:{reducedMotion:true},workspace:{version:1,revision:0,context:null,drafts:[],seenAcceptanceIds:[]},world:{residents:[]}};
 const element=Workbench({snapshot,initial:{taskId:'worker'},invoke:async(action,args)=>{calls.push({action,args});return action==='git:status'?{branch:'worker',files:[],diff:''}:'worker diff';},toast(){},onClose(){}}),pane=findElement(element,e=>typeof e.type==='function'&&e.type.name==='GitPane');assert.ok(pane,'real rendered Git pane');mode='git';const git=pane.type(pane.props);for(const effect of effects)effect();findElement(git,e=>e.type==='button'&&e.props.children?.[0]?.type==='span')?.props.onClick();findElement(git,e=>e.type==='button'&&e.props.className==='commit-button').props.onClick();await new Promise(resolve=>setImmediate(resolve));
 for(const action of ['git:status','git:diff','git:commit']){const call=calls.find(c=>c.action===action);assert.ok(call,action+' actual pane callback');assert.equal(call.args.taskId,'worker');assert.equal(call.args.runId,'run');assert.equal(call.args.workspaceId,'copy');assert.equal(call.args.projectId,'p');}
});
