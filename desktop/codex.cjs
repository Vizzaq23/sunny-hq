const {EventEmitter}=require('node:events');
const {spawn}=require('node:child_process');
const fs=require('node:fs');const path=require('node:path');
function findCodex(home){
 const roots=[path.join(home,'AppData','Local','OpenAI','Codex','bin'),path.join(home,'.codex','bin')];
 for(const root of roots){try{if(fs.existsSync(path.join(root,'codex.exe')))return path.join(root,'codex.exe');for(const dir of fs.readdirSync(root).reverse()){const exe=path.join(root,dir,'codex.exe');if(fs.existsSync(exe))return exe;}}catch{}}
 for(const dir of (process.env.PATH||'').split(path.delimiter)){const exe=path.join(dir,'codex.exe');if(fs.existsSync(exe))return exe;}
 throw Error('Codex CLI was not found. Install Codex desktop, then reconnect.');
}
class CodexClient extends EventEmitter {
 constructor(){super();this.seq=0;this.pending=new Map();this.buffer='';this.child=null;this.connected=false;this.connecting=null;this.diagnostic='';}
 attach(child){
  this.child=child;this.buffer='';this.connected=true;
  child.stdout.setEncoding('utf8');child.stdout.on('data',data=>{if(this.child!==child||!this.connected)return;this.buffer+=data;let newline;while(this.connected&&(newline=this.buffer.indexOf('\n'))!==-1){const line=this.buffer.slice(0,newline);this.buffer=this.buffer.slice(newline+1);this.receiveLine(line,child);}});
  child.stderr.setEncoding('utf8');child.stderr.on('data',s=>{this.diagnostic=(this.diagnostic+s).slice(-5000);this.safeEmit('diagnostic',s);});
  child.on('error',e=>{if(this.child===child)this.disconnect(e.message);});child.on('exit',code=>{if(this.child===child)this.disconnect('Codex disconnected (exit '+code+'). '+this.diagnostic.slice(-500));});
  child.stdin.on('error',e=>{if(this.child===child)this.disconnect(e.message);});
 }
 receiveLine(line,child=this.child){let message;try{message=JSON.parse(line);if(!message||typeof message!=='object'||Array.isArray(message))throw Error('Invalid protocol object');}catch{this.safeEmit('diagnostic','Codex sent an unreadable protocol message. Check the connection before continuing.',{event:'provider-decode-failed'});return;}try{this.receive(message);}catch{this.handlerFailed(child);}}
 safeEmit(event,...args){for(const listener of this.rawListeners(event)){try{Promise.resolve(listener.apply(this,args)).catch(()=>{});}catch{/* Diagnostic observers cannot prevent transport cleanup. */}}}
 deliver(event,message){const child=this.child;for(const listener of this.rawListeners(event)){const result=listener.call(this,message);if(result&&typeof result.then==='function')Promise.resolve(result).catch(()=>this.handlerFailed(child));}}
 handlerFailed(child=this.child){if(this.child!==child||!this.connected)return;try{this.safeEmit('diagnostic','Sunny event handling failed. Reconnect and check task status before continuing.',{event:'provider-handler-failed'});}finally{if(this.child===child)this.disconnect('Codex disconnected after Sunny event handling failed. Check task status before continuing.');}}
 receive(message){
  if(message.method){this.deliver(message.id!==undefined?'request':'notification',message);return;}
  const entry=this.pending.get(message.id);if(!entry)return;clearTimeout(entry.timer);this.pending.delete(message.id);
  if(message.error)entry.reject(Error(message.error.message||JSON.stringify(message.error)));else entry.resolve(message.result);
 }
 send(message){if(!this.child||!this.connected)throw Error('Codex is disconnected. Reconnect from Settings.');this.child.stdin.write(JSON.stringify(message)+'\n');}
 request(method,params={},timeout=30000){return new Promise((resolve,reject)=>{const id=++this.seq;const timer=setTimeout(()=>{this.pending.delete(id);const error=Error(method+' timed out. Check the connection before retrying.');error.code='RPC_TIMEOUT';error.uncertain=true;reject(error);},timeout);this.pending.set(id,{resolve,reject,timer});try{this.send({id,method,params});}catch(e){clearTimeout(timer);this.pending.delete(id);reject(e);}});}
 respond(id,result){this.send({id,result});}
 rejectRequest(id,message){this.send({id,error:{code:-32601,message}});}
 disconnect(reason){const child=this.child;const wasConnected=this.connected;if(!wasConnected&&!child)return;this.connected=false;this.child=null;for(const entry of this.pending.values()){clearTimeout(entry.timer);const error=Error(reason.includes('disconnect')?reason:'Codex disconnected: '+reason);error.code='RPC_DISCONNECTED';error.uncertain=true;entry.reject(error);}this.pending.clear();if(child)try{child.kill();}catch{}if(wasConnected)this.safeEmit('disconnected',reason);}
 async connect(home){if(this.connecting)return this.connecting;if(this.connected)return;
  this.connecting=(async()=>{const exe=findCodex(home);const child=spawn(exe,['app-server','--stdio'],{cwd:home,windowsHide:true,env:{...process.env,USERPROFILE:home},stdio:['pipe','pipe','pipe']});this.attach(child);
   try{const info=await this.request('initialize',{clientInfo:{name:'sunny_hq',title:'Sunny HQ',version:'0.9.0'},capabilities:{experimentalApi:true}},45000);this.send({method:'initialized',params:{}});return info;}catch(e){this.close();throw e;}
  })();try{return await this.connecting;}finally{this.connecting=null;}
 }
 close(){this.disconnect('Codex disconnected by Sunny');}
}
module.exports={CodexClient,findCodex};
