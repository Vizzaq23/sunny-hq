const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),ts=require('typescript');
function harness(){
 const slots=[],effects=[];let cursor=0,pending=[];
 const react=require('react'),load=Module._load,tsx=Module._extensions['.tsx'],css=Module._extensions['.css'];
 const hooks={...react,useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return [slots[i],next=>{slots[i]=typeof next==='function'?next(slots[i]):next;}];},useRef(current){const i=cursor++;return slots[i]??(slots[i]={current});},useEffect(fn,deps){const i=cursor++;const old=effects[i];if(!old||deps.some((v,j)=>v!==old.deps[j]))pending.push(()=>{old?.cleanup?.();effects[i]={deps,cleanup:fn()};});}};
 Module._load=function(request,...args){return request==='react'?hooks:load.call(this,request,...args);};Module._extensions['.css']=()=>{};Module._extensions['.tsx']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,file);
 let Picker;try{delete require.cache[require.resolve('../src/components/SkillPicker.tsx')];Picker=require('../src/components/SkillPicker.tsx').SkillPicker;}finally{Module._load=load;if(tsx)Module._extensions['.tsx']=tsx;else delete Module._extensions['.tsx'];if(css)Module._extensions['.css']=css;else delete Module._extensions['.css'];}
 return {render(props){cursor=0;const tree=Picker(props);const queue=pending;pending=[];queue.forEach(fn=>fn());return tree;},dispose(){effects.forEach(e=>e?.cleanup?.());}};
}
function all(element,predicate,result=[]){if(!element||typeof element!=='object')return result;if(predicate(element))result.push(element);for(const child of [].concat(element.props?.children??[]))all(child,predicate,result);return result;}
const settle=()=>new Promise(resolve=>setTimeout(resolve,10));
test('suggestions require manual checkbox opt-in and retain explicit choices, limits and reconfirmation',async()=>{
 global.window={setTimeout:fn=>setTimeout(fn,0),clearTimeout};const h=harness(),changes=[],readiness=[];const skill=(id,revision='a')=>({id,name:id,revision:revision.repeat(64),purpose:'Reviewed action',category:'Engineering'});let available=[skill('security'),skill('access'),skill('testing')],suggested=available;let fail=false;
 const props={projectId:'p',brief:'Simple CLI change; no security changes',roleId:'builder',disabled:false,value:[],invoke:async()=>{if(fail)throw Error('offline');return {available,suggested};},onChange:next=>{changes.push(next);props.value=next;},onReadyChange:ready=>readiness.push(ready)};
 try{
  h.render(props);assert.equal(readiness.at(-1),false);await settle();let tree=h.render(props),boxes=()=>all(tree,e=>e.type==='input');
  assert.deepEqual(changes,[],'receiving suggested skills must not make a selection');assert.ok(boxes().every(box=>!box.props.checked));assert.ok(all(tree,e=>e.type==='small').some(e=>String(e.props.children).includes('Suggested')));
  boxes()[0].props.onChange();tree=h.render(props);assert.equal(boxes()[0].props.checked,true);assert.equal(props.value[0].id,'security');
  boxes()[0].props.onChange();tree=h.render(props);assert.equal(boxes()[0].props.checked,false);boxes()[0].props.onChange();tree=h.render(props);boxes()[1].props.onChange();tree=h.render(props);assert.equal(boxes()[2].props.disabled,true,'only two explicit selections');
  props.brief+=' revised';h.render(props);await settle();tree=h.render(props);assert.equal(props.value.length,2,'brief suggestions preserve explicit choices');
  available=[skill('security','b'),skill('access'),skill('testing')];props.brief+=' newest';h.render(props);await settle();tree=h.render(props);assert.equal(boxes()[0].props.checked,false,'stale revision requires reconfirmation');boxes()[0].props.onChange();tree=h.render(props);assert.equal(boxes()[0].props.checked,true);assert.equal(props.value[0].revision,'b'.repeat(64));
  props.projectId='other';h.render(props);tree=h.render(props);assert.deepEqual(props.value,[],'scope change clears choices');await settle();tree=h.render(props);assert.ok(boxes().every(box=>!box.props.checked));
  fail=true;props.brief+=' offline';h.render(props);assert.equal(readiness.at(-1),false);await settle();tree=h.render(props);assert.equal(readiness.at(-1),true);assert.ok(all(tree,e=>e.props?.role==='alert').length);assert.deepEqual(props.value,[]);
 }finally{h.dispose();}
});

test('persisted explicit selection stays checked when a different skill is suggested',async()=>{
 global.window={setTimeout:fn=>setTimeout(fn,0),clearTimeout};const h=harness(),changes=[];const chosen={id:'chosen',name:'chosen',revision:'c'.repeat(64),purpose:'Captain choice',category:'Engineering'},suggested={...chosen,id:'suggested',name:'suggested'};
 const props={projectId:'saved-project',brief:'Restore saved brief',roleId:'builder',disabled:false,value:[{id:chosen.id,revision:chosen.revision}],invoke:async()=>({available:[chosen,suggested],suggested:[suggested]}),onChange:next=>changes.push(next),onReadyChange(){}};
 try{h.render(props);await settle();const boxes=all(h.render(props),e=>e.type==='input');assert.equal(boxes[0].props.checked,true);assert.equal(boxes[1].props.checked,false);assert.deepEqual(changes,[]);}finally{h.dispose();}
});
