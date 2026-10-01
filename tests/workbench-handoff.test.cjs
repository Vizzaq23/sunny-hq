const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
// Execute the real component event path. Browser environment imports and React scheduling
// are adapted because Node has no DOM; IPC and the navigation callback are observed directly.
function componentForNode(){
 const originalLoad=Module._load,originalTs=Module._extensions['.ts'],originalTsx=Module._extensions['.tsx'],originalCss=Module._extensions['.css'];
 const react=require('react');
 Module._load=function(request,...args){if(request==='react')return {...react,useState:initial=>[typeof initial==='function'?initial():initial,()=>{}],useRef:current=>({current}),useEffect:()=>{},useMemo:fn=>fn(),useCallback:fn=>fn};return originalLoad.call(this,request,...args);};
 const compile=(mod,filename)=>{const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText.replaceAll('import.meta.env.BASE_URL',"''");mod._compile(code,filename);};
 Module._extensions['.ts']=compile;Module._extensions['.tsx']=compile;Module._extensions['.css']=()=>{};
 try{return require('../src/views/Workbench.tsx').Workbench;}finally{Module._load=originalLoad;for(const [extension,value] of [['.ts',originalTs],['.tsx',originalTsx],['.css',originalCss]]){if(value)Module._extensions[extension]=value;else delete Module._extensions[extension];}}
}
function findElement(element,predicate){if(!element||typeof element!=='object')return; if(predicate(element))return element;for(const child of [].concat(element.props?.children??[])){const found=findElement(child,predicate);if(found)return found;}}
test('specialist handoff publishes new task ID for persisted navigation',async()=>{
 global.window={sunny:{},confirm:()=>true,location:{href:'https://fixture.invalid/'},addEventListener(){},removeEventListener(){}};global.location=window.location;global.sessionStorage={getItem:()=>null};
 const Workbench=componentForNode(),calls=[],opened=[];
 const snapshot={projects:[{id:'p',name:'Fixture project'}],tasks:[{id:'old',projectId:'p',crewId:'franky',status:'finished',messages:[]}],approvals:[],settings:{reducedMotion:true},workspace:{version:1,revision:0,context:null,drafts:[],seenAcceptanceIds:[]},world:{residents:[]}};
 const element=Workbench({snapshot,initial:{taskId:'old',projectId:'p'},invoke:async(action,args)=>{calls.push({action,args});return {id:'new',projectId:'p',crewId:'robin'};},toast(){},onClose(){},onTaskChange:id=>opened.push(id)});
 const select=findElement(element,e=>e.type==='select'&&e.props['aria-label']==='Assigned crewmate');assert.ok(select);assert.equal(select.props.disabled,false);
 select.props.onChange({target:{value:'robin'}});await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(calls.map(call=>call.action),['task:handoff']);assert.equal(calls[0].args.taskId,'old');assert.equal(calls[0].args.crewId,'robin');assert.deepEqual(opened,['new']);
});
