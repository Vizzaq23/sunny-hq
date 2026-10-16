// Private admission is held by object identity, never by renderer-supplied flags.
const held=new WeakMap();
const goal=playable=>({projectId:'journey-project',title:'Genuine finite journey',objective:'Implement and independently review the useful local counter',acceptanceCriteria:['The counter has the required useful behavior'],completionBoundary:'review',...(playable?{result:{kind:'playable',descriptorPath:'playable.json'}}:{})});
function register(manifest,hub){require('./packaged-acceptance.cjs').assertFixtureCapability(manifest);if(held.has(manifest))throw Error('Journey actions already registered');held.set(manifest,{hub,goal:false,plays:new Set(),feedback:false,accepted:false,settings:0});}
function assert(action,args,manifest){
 require('./packaged-acceptance.cjs').assertFixtureCapability(manifest);const state=held.get(manifest);if(!state)throw Error('Journey action authority missing');const {hub}=state,m=hub.state.missions[0],run=hub.state.runs[0],same=(a,b)=>require('./review-verdicts.cjs').sameSource(a,b),deny=()=>{throw Error('Private journey action denied: '+action);};
 if(['snapshot','workspace:get','app:diagnostic'].includes(action)){if(Object.keys(args).length)deny();return;}
 if(action==='goal:start'){if(manifest.phase!==1||state.goal||!same(args,goal(manifest.scenario==='journey-cue')))deny();state.goal=true;return;}
 if(action==='settings:update'){if(manifest.phase!==1||manifest.scenario==='journey-cue'||++state.settings>24)deny();const keys=Object.keys(args);if(!keys.length||keys.some(k=>!['reducedMotion','roomSoundEnabled','roomSoundVolume'].includes(k))||keys.some(k=>k==='roomSoundVolume'?typeof args[k]!=='number'||!Number.isFinite(args[k])||args[k]<0||args[k]>.65:typeof args[k]!=='boolean'))deny();if(manifest.scenario!=='journey-audio'&&(args.roomSoundEnabled===true||args.roomSoundVolume!==undefined))deny();return;}
 if(action==='workspace:update'){const c=args.context;if(!m||!c||Object.keys(args).some(k=>!['context','expectedRevision'].includes(k))||c.projectId!==run.projectId||c.runId!==run.id||c.missionId!==m.id||c.attemptId!==m.activeAttemptId||!['deck','franky','workbench'].includes(c.surface)||c.taskId&&!hub.state.tasks.some(t=>t.id===c.taskId&&t.projectId===run.projectId))deny();return;}
 if(action==='workspace:claimAcceptanceCue'){if(!m?.acceptance||Object.keys(args).length!==1||args.acceptanceId!==m.acceptance.id)deny();return;}
 if(action==='mission:resultStatus'){if(args.missionId!==m?.id||args.projectId!==run?.projectId)deny();return;}
 if(action==='transcript:page'){if(!hub.state.tasks.some(t=>t.id===args.taskId&&t.projectId===run?.projectId))deny();return;}
 if(manifest.phase!==1||!m||!run)deny();
 if(action==='mission:accept'){if(state.accepted||args.missionId!==m.id||args.resultId!==m.selectedResult?.id||args.resultSha256!==m.selectedResult?.ref.sha256||!Array.isArray(args.criteria)||!args.criteria.every(v=>v===true))deny();state.accepted=true;return;}
 if(action==='result:play'){if(manifest.scenario!=='journey-cue'||state.plays.size>=2||state.plays.has(m.activeAttemptId)||args.resultId!==m.selectedResult?.id)deny();require('./playable-launches.cjs').validateCommand(action,args);state.plays.add(m.activeAttemptId);return;}
 if(action==='result:stop'){if(manifest.scenario!=='journey-cue'||!run.playableLaunches?.some(l=>l.id===args.launchId&&l.attemptId===m.activeAttemptId))deny();require('./playable-launches.cjs').validateCommand(action,args);return;}
 if(action==='result:feedback'){if(manifest.scenario!=='journey-cue'||state.feedback||args.resultId!==m.selectedResult?.id||args.requestNewAttempt!==true||args.text!=='Increase the counter step and greet the crew again'||args.attachments?.length)deny();require('./playable-launches.cjs').validateCommand(action,args);state.feedback=true;return;}
 if(action==='run:control'){if(manifest.scenario!=='journey-audio'||args.runId!==run.id||args.projectId!==run.projectId||args.action!=='stop'||!m.acceptance)deny();require('./supervision-commands.cjs').validateSupervisionCommand(action,args);return;}
 deny();
}
module.exports={register,assert,goal};
