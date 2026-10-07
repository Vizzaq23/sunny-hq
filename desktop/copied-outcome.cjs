const reasons=new Set(['passed','private-sink-unavailable','source-protection-unavailable','source-readonly-unavailable','absence-unproven','capture-failed','copied-recovery-failed','cleanup-unconfirmed']);
function publicCopiedOutcome(value){
 const keys=['version','scope','fullTree','archiveStatus','outcome','sourceUnchanged','databaseEqual','historyEqual','consumerEqual','cleanup'];
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||keys.some(key=>!Object.hasOwn(value,key))||value.version!==1||value.scope!=='sqlite-database-and-imported-history'||value.fullTree!==false||!['present-verified','absence-unproven','unreadable','invalid','unsupported','acquisition-failed'].includes(value.archiveStatus)||!reasons.has(value.outcome)||!['observed-empty','unconfirmed'].includes(value.cleanup)||['sourceUnchanged','databaseEqual','historyEqual','consumerEqual'].some(key=>typeof value[key]!=='boolean'))throw Error('INVALID_PUBLIC_COPIED_OUTCOME');
 if(value.outcome==='passed'&&(value.archiveStatus!=='present-verified'||value.cleanup!=='observed-empty'||!value.sourceUnchanged||!value.databaseEqual||!value.historyEqual||!value.consumerEqual))throw Error('INVALID_PUBLIC_COPIED_OUTCOME');
 return Object.freeze(Object.fromEntries(keys.map(key=>[key,value[key]])));
}
module.exports={publicCopiedOutcome};
