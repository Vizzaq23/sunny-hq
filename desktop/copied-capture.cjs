const fs=require('node:fs'),path=require('node:path'),{createHash,timingSafeEqual}=require('node:crypto');
const bindings=new WeakSet(),consumedBindings=new WeakSet(),fixtures=new WeakMap();
const fail=code=>{throw Object.assign(Error(code),{code});};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function shape(value,keys){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||keys.some(key=>!Object.hasOwn(value,key)))fail('COPIED_CAPTURE_INVALID');}
function ordinary(file,max){const stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||stat.size>max)fail('COPIED_CAPTURE_INVALID');return fs.readFileSync(file);}
function directory(root){const actual=fs.realpathSync.native(root);if(actual.toLowerCase()!==path.resolve(root).toLowerCase())fail('COPIED_CAPTURE_INVALID');for(let item=actual;;item=path.dirname(item)){if(fs.lstatSync(item).isSymbolicLink())fail('COPIED_CAPTURE_INVALID');if(path.dirname(item)===item)break;}return actual;}
function member(root,name,expected){shape(expected,['bytes','sha256']);if(!Number.isSafeInteger(expected.bytes)||expected.bytes<1||expected.bytes>256*1024*1024||!/^[a-f0-9]{64}$/.test(expected.sha256))fail('COPIED_CAPTURE_INVALID');const bytes=ordinary(path.join(root,name),256*1024*1024);if(bytes.length!==expected.bytes||sha(bytes)!==expected.sha256)fail('COPIED_CAPTURE_CHANGED');return bytes;}
// This parses a native witness; only completed private capture admission below
// can turn it into authority. E is internal to this call interval, not its end.
function readArchiveEpoch(generation,nonce){
 const bytes=ordinary(path.join(generation,'control','archive-epoch.bin'),64);
 if(bytes.length!==64||!bytes.subarray(0,8).equals(Buffer.from('SUNABS2\0'))||!bytes.subarray(8,40).equals(Buffer.from(sha(nonce),'hex'))||bytes.readUInt32LE(40)!==0xc0000034||bytes.readUInt32LE(44)!==1)fail('COPIED_CAPTURE_INVALID');
 const entry=bytes.readBigUInt64LE(48),completion=bytes.readBigUInt64LE(56);if(entry===0n||completion<entry)fail('COPIED_CAPTURE_INVALID');
 return Object.freeze({method:'native-point-epoch',lookup:1,status:'0xc0000034',callEntryTicks:String(entry),callCompletionTicks:String(completion),generationSha256:sha(generation),witnessSha256:sha(bytes)});
}
function validateCopiedInput({profileDir,outputDir,manifestPath,nonce}){
 // Caller is the existing strict fixture admission, before any profile write.
 // These files are provenance only within its reviewed private native run.
 // They are not an independent authority issuer or a same-user security API.
 try{
  const generation=directory(path.dirname(profileDir)),baseline=directory(path.join(generation,'baseline')),control=directory(path.join(generation,'control'));
  if(profileDir!==path.join(generation,'working')||outputDir!==path.join(generation,'consumer-output')||manifestPath!==path.join(control,'fixture.json'))fail('COPIED_CAPTURE_INVALID');
  const consumed=path.join(control,'capture-consumed.json');if(fs.existsSync(consumed))fail('COPIED_CAPTURE_REPLAY');
  const receiptBytes=ordinary(path.join(control,'capture-receipt.json'),16384),completion=ordinary(path.join(control,'native-complete.bin'),104),receipt=JSON.parse(receiptBytes),absent=receipt.version===2;
  shape(receipt,['version','stage','nonceSha256','fidelity','fullTree','archiveStatus','database','archive','runtime',...(absent?['absence']:[])]);shape(receipt.runtime,['electron','node','sqlite']);
  if((absent?receipt.archiveStatus!=='absent-verified'||receipt.archive!==null:receipt.version!==1||receipt.archiveStatus!=='present-verified')||receipt.stage!=='logical-verified'||receipt.nonceSha256!==sha(nonce)||receipt.fidelity!=='sqlite-database'||receipt.fullTree!==false||receipt.runtime.electron!=='44.4.3'||receipt.runtime.node!=='24.21.0'||receipt.runtime.sqlite!=='3.53.4')fail('COPIED_CAPTURE_INVALID');
  const epoch=absent?readArchiveEpoch(generation,nonce):null;if(absent&&!require('node:util').isDeepStrictEqual(receipt.absence,epoch))fail('COPIED_CAPTURE_INVALID');
  const binding=Buffer.concat([Buffer.from(absent?'SUNCPY2\0':'SUNCPY1\0'),Buffer.from(sha(nonce),'hex'),Buffer.from(sha(receiptBytes),'hex'),...(absent?[Buffer.from(epoch.witnessSha256,'hex')]:[])]);if(completion.length!==binding.length||!timingSafeEqual(completion,binding))fail('COPIED_CAPTURE_INVALID');
  for(const root of [baseline,profileDir])if(JSON.stringify(fs.readdirSync(root).sort())!==JSON.stringify(absent?['sunny.sqlite']:['chatgpt-history.json','sunny.sqlite']))fail('COPIED_CAPTURE_INVALID');
  for(const [name,expected]of [['sunny.sqlite',receipt.database],...(!absent?[['chatgpt-history.json',receipt.archive]]:[])])if(!member(baseline,name,expected).equals(member(profileDir,name,expected)))fail('COPIED_CAPTURE_CHANGED');
  const archive=absent?null:require('./local-history-archive.cjs').decodeArchive(member(baseline,'chatgpt-history.json',receipt.archive));
  for(const item of [receipt.database,receipt.archive,receipt.runtime,receipt.absence])if(item)Object.freeze(item);
  const image=require('./copied-database.cjs').readDatabaseImage(path.join(baseline,'sunny.sqlite'));
  const result=Object.freeze({generation,baseline,control,consumed,profileDir,receipt:Object.freeze(receipt),archive,image});bindings.add(result);return result;
 }catch(error){if(error?.code?.startsWith('COPIED_'))throw error;fail('COPIED_CAPTURE_INVALID');}
}
function consumeCopiedInput(binding){if(!bindings.has(binding))fail('COPIED_CAPTURE_INVALID');try{fs.writeFileSync(binding.consumed,JSON.stringify({version:1,nonceSha256:binding.receipt.nonceSha256}),{flag:'wx',mode:0o600});consumedBindings.add(binding);}catch{fail('COPIED_CAPTURE_REPLAY');}}
function bindCopiedFixture(fixture,binding){require('./packaged-acceptance.cjs').assertFixtureCapability(fixture);if(fixture.scenario!=='stopped-profile-copy'||!bindings.has(binding)||fixtures.has(fixture))fail('COPIED_CAPTURE_INVALID');fixtures.set(fixture,binding);}
function copiedBinding(fixture){require('./packaged-acceptance.cjs').assertFixtureCapability(fixture);const binding=fixtures.get(fixture);if(!binding)fail('COPIED_CAPABILITY_REQUIRED');return binding;}
function copiedLocalHistory(binding){
 if(!bindings.has(binding)||!consumedBindings.has(binding))fail('COPIED_CAPTURE_INVALID');
 if(binding.archive)return require('./local-history-archive.cjs').createLocalHistory(binding.archive);
 // No synthetic archive or filesystem/provider fallback is created.
 return Object.freeze({index:()=>[],history:()=>fail('LOCAL_HISTORY_NOT_FOUND'),async page(request){require('./external-history-pages.cjs').validateExternalPageRequest(request);fail('LOCAL_HISTORY_NOT_FOUND');}});
}
module.exports={validateCopiedInput,consumeCopiedInput,bindCopiedFixture,copiedBinding,copiedLocalHistory,readArchiveEpoch};
