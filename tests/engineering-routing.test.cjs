const {test}=require('node:test');
const assert=require('node:assert/strict');
const {routeEngineering,engineeringRoutingEnabled,guidanceForLane}=require('../desktop/engineering-routing.cjs');

const models=[
 {model:'gpt-6-luna',supportedReasoningEfforts:['low','medium','high'].map(reasoningEffort=>({reasoningEffort}))},
 {model:'gpt-6-sol',supportedReasoningEfforts:['low','medium','high'].map(reasoningEffort=>({reasoningEffort}))}
];
function response(choice){return {ok:true,body:new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode(JSON.stringify({model:'jev-1.13.0',answers:{lane:{type:'choice',choice,confidence:.91,probabilities:{NOT_ENGINEERING:choice==='NOT_ENGINEERING'?1:0,SMALL:choice==='SMALL'?1:0,MEDIUM:choice==='MEDIUM'?1:0,HIGH:choice==='HIGH'?1:0,ESCALATE:choice==='ESCALATE'?1:0}}}})));controller.close();}})};}

for(const [lane,expected] of [
 ['SMALL',{model:'gpt-6-luna',effort:'low'}],
 ['MEDIUM',{model:'gpt-6-luna',effort:'medium'}],
 ['HIGH',{model:'gpt-6-luna',effort:'high'}],
 ['ESCALATE',{model:'gpt-6-sol',effort:'high'}]
])test(`${lane} uses the pictured live-catalog lane`,async()=>{
 const result=await routeEngineering({prompt:'Build a fixture',models,apiKey:'fixture-key',fetchImpl:async()=>response(lane)});
 assert.equal(result.status,'selected');assert.equal(result.lane,lane);assert.deepEqual(result.execution,expected);
});
test('non-engineering requests keep the current execution',async()=>{
 const result=await routeEngineering({prompt:'Tell me a story',models,apiKey:'fixture-key',fetchImpl:async()=>response('NOT_ENGINEERING')});
 assert.equal(result.status,'not-engineering');assert.equal(result.execution,undefined);
});
test('unavailable catalog lane abstains instead of inventing a model',async()=>{
 const result=await routeEngineering({prompt:'Build a fixture',models:models.slice(0,1),apiKey:'fixture-key',fetchImpl:async()=>response('ESCALATE')});
 assert.equal(result.status,'fallback');assert.equal(result.reason,'CATALOG_UNAVAILABLE');
});
test('missing key does not transmit the brief',async()=>{
 const result=await routeEngineering({prompt:'Build a fixture',models,apiKey:'',fetchImpl:()=>assert.fail('network call')});
 assert.equal(result.status,'fallback');assert.equal(result.reason,'MISSING_KEY');
});
test('new routing requires the existing project allowlist and an explicit routing flag',()=>{
 const hub={state:{projects:[{id:'p'}]}},task={projectId:'p'};
 const base={SUNNY_JEV_ENABLED:'1',SUNNY_JEV_PROJECT_IDS:'p',TYPESAFE_API_KEY:'fixture-key'};
 assert.equal(engineeringRoutingEnabled(hub,task,base),false);
 assert.equal(engineeringRoutingEnabled(hub,task,{...base,SUNNY_JEV_ENGINEERING_ROUTING:'1'}),true);
 assert.equal(engineeringRoutingEnabled(hub,task,{...base,SUNNY_JEV_ENGINEERING_ROUTING:'1',SUNNY_JEV_PROJECT_IDS:'other'}),false);
});
test('a stalled remote response gives a bounded fallback',async()=>{
 const started=Date.now();
 const result=await routeEngineering({prompt:'Build a fixture',models,apiKey:'fixture-key',timeoutMs:20,fetchImpl:()=>new Promise(()=>{})});
 assert.equal(result.status,'fallback');assert.equal(result.reason,'TIMEOUT');assert.ok(Date.now()-started<1000);
});
test('high-risk guidance asks for fresh review without claiming completion',()=>{
 assert.match(guidanceForLane('ESCALATE'),/fresh Sol High review/i);
 assert.match(guidanceForLane('ESCALATE'),/before mission COMPLETE/i);
});
