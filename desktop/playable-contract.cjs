const {digest}=require('./mission-context.cjs');
const {readBinary,LIMITS,relative}=require('./playable-results.cjs');
const same=(a,b)=>require('./review-verdicts.cjs').sameSource(a,b);
const fail=()=>Object.assign(Error('Playable contract changed or is invalid'),{code:'PLAYABLE_CONTRACT_CHANGED'});
function keys(value,expected){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!==[...expected].sort().join(','))throw fail();}
function request(value){keys(value,['kind','descriptorPath']);if(value.kind!=='playable')throw fail();relative(value.descriptorPath);return value;}
function descriptor(value){
 keys(value,['version','runtime','buildScript','outputDir','entrypoint','assets','limitations']);
 if(value.version!==1||value.runtime!=='node-http'||value.buildScript!=='build')throw fail();
 for(const key of ['outputDir','entrypoint'])relative(value[key]);
 if(value.outputDir.toLowerCase().split('/')[0]==='.sunny-results')throw fail();
 if(!Array.isArray(value.assets)||!value.assets.length||value.assets.length>LIMITS.count||value.assets.some(v=>typeof v!=='string')||new Set(value.assets.map(v=>v.toLowerCase())).size!==value.assets.length||value.assets.filter(v=>v===value.entrypoint).length!==1)throw fail();
 value.assets.forEach(relative);
 if(!Array.isArray(value.limitations)||value.limitations.length>32||new Set(value.limitations).size!==value.limitations.length||value.limitations.some(v=>typeof v!=='string'||!v.trim()||v.length>2000||/[\0\r\n]/.test(v)))throw fail();
 return structuredClone(value);
}
function runtimePlan(criteria){const entries=criteria.flatMap(c=>['startup','interaction'].map(kind=>({id:'runtime-'+digest([c.id,kind]),criterionId:c.id,kind})));const plan={version:1,runtime:'node-http',entries};return {...plan,digest:digest(plan)};}
function validate(value,plan,criteria){keys(value,['version','kind','descriptorPath','descriptorSha256','descriptor']);request({kind:value.kind,descriptorPath:value.descriptorPath});if(value.version!==1||!/^[a-f0-9]{64}$/.test(value.descriptorSha256))throw fail();descriptor(value.descriptor);if(!same(plan,runtimePlan(criteria))||criteria.some(c=>c.kind!=='playable'))throw fail();}
function assertCurrent(root,value){const actual=readBinary(root,value.descriptorPath,LIMITS.manifest);if(actual.sha256!==value.descriptorSha256)throw fail();let decoded;try{decoded=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(actual.content));}catch{throw fail();}if(!same(descriptor(decoded),value.descriptor))throw fail();return actual;}
async function enroll(hub,project,input){
 request(input);const before=await hub.evidence.gitState(project.path);if(before.dirty)throw fail();
 const bytes=readBinary(project.path,input.descriptorPath,LIMITS.manifest);let value;try{value=descriptor(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes.content)));}catch{throw fail();}
 const tracked=(await hub.evidence.command(project.path,['ls-files','-z','--',input.descriptorPath])).split('\0').filter(Boolean);if(tracked.length!==1||tracked[0]!==input.descriptorPath)throw fail();
 for(const name of [value.outputDir+'/', '.sunny-results/']){if((await hub.evidence.command(project.path,['ls-files','-z','--',name])).length)throw fail();const ignored=(await hub.evidence.command(project.path,['check-ignore','--',name])).trim();if(ignored!==name)throw fail();}
 const result={version:1,kind:'playable',descriptorPath:input.descriptorPath,descriptorSha256:bytes.sha256,descriptor:value};assertCurrent(project.path,result);const after=await hub.evidence.gitState(project.path);if(after.dirty||before.commit!==after.commit||before.fingerprint!==after.fingerprint)throw fail();return result;
}
module.exports={request,descriptor,runtimePlan,validate,assertCurrent,enroll};
