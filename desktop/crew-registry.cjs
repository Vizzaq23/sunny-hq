const {createHash}=require('node:crypto');
const residents=require('./island-residents.json');
const CREW_ROLES=Object.freeze(require('./crew-bindings.json').map(value=>Object.freeze({...value,capabilities:Object.freeze([...value.capabilities])})));
const BY_CREW=new Map(CREW_ROLES.map(role=>[role.crewId,role])),BY_ROLE=new Map(CREW_ROLES.map(role=>[role.id,role]));
function roleDefinition(value){return BY_CREW.get(value)||BY_ROLE.get(value);}
function crewBinding(crewId,world){
 const role=BY_CREW.get(crewId);if(!role)throw Error('Choose a crew member.');
 const resident=residents.some(value=>value.id===crewId),saved=world?.residents?.find(value=>value.id===crewId),eligible=!resident||saved?.recruited===true;
 const roleRevision=createHash('sha256').update(JSON.stringify([role, resident?[saved?.role??residents.find(value=>value.id===crewId).role,saved?.district??residents.find(value=>value.id===crewId).district,eligible]:null])).digest('hex');
 return {crewId,roleId:role.id,capabilities:[...role.capabilities],access:role.access,eligible,roleRevision};
}
function assertWorkerBinding(binding){if(binding.access==='sanitized-report')throw Error('Morgans uses only the sanitized reporting route; normal specialist tools and delegation are unavailable.');if(!binding.eligible)throw Error('Recruit this resident on the island first.');return binding;}
function assertCrewBinding(binding,world){const current=assertWorkerBinding(crewBinding(binding.crewId,world));if(binding.roleId!==current.roleId||binding.access!==current.access||binding.roleRevision!==current.roleRevision||JSON.stringify(binding.capabilities)!==JSON.stringify(current.capabilities))throw Error('Crew role revision changed before launch. Review the route and launch again.');return current;}
function roleOf(value){return roleDefinition(value)?.id||value;}
function skillFitsRole(skill,value){const role=roleDefinition(value);if(!role||role.access==='sanitized-report')return false;return skill.roles.some(id=>{const required=BY_ROLE.get(id);return required&&required.capabilities.some(capability=>role.capabilities.includes(capability));});}
function canonicalAssignment(value){const role=BY_CREW.get(value?.crewId);return Boolean(role&&role.access==='specialist'&&role.id===value.roleId&&role.capabilities.includes(value.capability));}
function reviewAssignment(value){return canonicalAssignment(value)&&value.capability==='review';}
module.exports={CREW_ROLES,roleDefinition,crewBinding,assertWorkerBinding,assertCrewBinding,roleOf,skillFitsRole,canonicalAssignment,reviewAssignment};
