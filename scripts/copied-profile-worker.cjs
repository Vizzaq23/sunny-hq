'use strict';
// Fixed source-stage harness for the native capture scenario. The exact package
// uses main.cjs's exclusive copied branch instead. It earns no package claim.
const path=require('node:path');
async function main(){
 if(process.argv.length!==3||process.versions.electron!=='44.4.3'||process.versions.node!=='24.21.0'||!path.isAbsolute(process.argv[2]))throw Error('COPIED_WORKER_ADMISSION');
 const manifestPath=process.argv[2],generation=path.dirname(path.dirname(manifestPath));
 if(manifestPath!==path.join(generation,'control','fixture.json'))throw Error('COPIED_WORKER_ADMISSION');
 const packaged=require('../desktop/packaged-acceptance.cjs');
 // This fixed test harness is already running as the reviewed Node worker.
 // The application entry retains its ordinary rejection of this opt-in.
 const admission=packaged.admitFixture({manifestPath,nonce:process.env.SUNNY_FIXTURE_NONCE,defaultProfile:path.join(generation,'unrelated-live'),env:{...process.env,ELECTRON_RUN_AS_NODE:undefined}});
 await require('../desktop/copied-profile-acceptance.cjs').runCopiedProfile(admission);
}
main().catch(error=>{console.error(error);process.exitCode=41;});
