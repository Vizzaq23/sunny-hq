// Fixed private adapter. Importing this module has no application side effects.
async function runPackagedControl(admission){
 require('./packaged-acceptance.cjs').assertFixtureCapability(admission);
 if(admission.scenario!=='ordered-control'||admission.phase!==1||![1,10,30].includes(admission.mib))throw Error('Invalid ordered control admission');
 return require('../scripts/ordered-control-check.cjs').runAdmittedControl(admission);
}
module.exports={runPackagedControl};
