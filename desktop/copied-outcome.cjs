const reasons=new Set(['passed','private-sink-unavailable','source-protection-unavailable','source-readonly-unavailable','absence-unproven','capture-failed','copied-recovery-failed','cleanup-unconfirmed']);
function publicCopiedOutcome(value){
 const absence=value?.version===2,keys=['version','scope','fullTree','archiveStatus','outcome','sourceUnchanged','databaseEqual','historyEqual','consumerEqual','cleanup',...(absence?['absenceMethod']:[])];
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||keys.some(key=>!Object.hasOwn(value,key))||(absence?value.archiveStatus!=='absent-verified'||value.absenceMethod!=='native-point-epoch':value.version!==1||!['present-verified','absence-unproven','unreadable','invalid','unsupported','acquisition-failed'].includes(value.archiveStatus))||value.scope!=='sqlite-database-and-imported-history'||value.fullTree!==false||!reasons.has(value.outcome)||!['observed-empty','unconfirmed'].includes(value.cleanup)||['sourceUnchanged','databaseEqual','historyEqual','consumerEqual'].some(key=>typeof value[key]!=='boolean'))throw Error('INVALID_PUBLIC_COPIED_OUTCOME');
 if(value.outcome==='passed'&&((!absence&&value.archiveStatus!=='present-verified')||value.cleanup!=='observed-empty'||!value.sourceUnchanged||!value.databaseEqual||!value.historyEqual||!value.consumerEqual))throw Error('INVALID_PUBLIC_COPIED_OUTCOME');
 return Object.freeze(Object.fromEntries(keys.map(key=>[key,value[key]])));
}
module.exports={publicCopiedOutcome};
