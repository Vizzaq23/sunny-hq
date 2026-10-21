'use strict';
const admitted=new WeakSet();let attempted=false;
function assertAdmission(value){if(!value||!admitted.has(value))throw Object.assign(Error('RECOVERY_LAUNCH_NOT_ADMITTED'),{code:'RECOVERY_LAUNCH_NOT_ADMITTED'});}
function denied(){process.stderr.write('RECOVERY_LAUNCH_NOT_ADMITTED\n');process.exit(74);}
function start(){
 if(attempted)return denied();attempted=true;
 const args=process.argv.slice(1);
 if(args.length!==1||args[0]!=='--recovery-reader')return denied();
 if(process.versions.electron!=='44.4.3'||process.versions.node!=='24.21.0'||process.versions.napi!=='10')return denied();
 const forbidden=['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','NODE_PATH','ELECTRON_EXTRA_LAUNCH_ARGS','ELECTRON_ENABLE_LOGGING','ELECTRON_ENABLE_STACK_DUMPING','ELECTRON_NO_ASAR','SUNNY_DEV_URL','SUNNY_DATA_DIR','SUNNY_FIXTURE_NONCE','SUNNY_PROVIDER_MISSION','SUNNY_LIVE_SMOKE'];
 if(forbidden.some(key=>process.env[key]!==undefined))return denied();
 let admission;try{const native=require('./native/recovery-admission.node');if(Object.keys(native).length!==1||typeof native.consumeRecoveryLaunch!=='function')return denied();admission=native.consumeRecoveryLaunch();if(!admission||typeof admission!=='object')return denied();admitted.add(admission);}catch{return denied();}
 // Native consumption has already bound private streams and source protection.
 try{require('./recovery-reader-main.cjs').start(admission);}catch{process.exitCode=75;require('electron').app.quit();}
}
module.exports={start,assertAdmission};
