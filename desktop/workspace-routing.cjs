const {resolveExecutionRoot,verifyWorkspace}=require('./execution-workspaces.cjs');
const selections=['projectId','taskId','workspaceId','runId'];
const actions={'files:list':['path'],'files:read':['path'],'files:write':['path','text','hash'],'files:search':['query'],'git:status':[],'git:diff':['path'],'git:branches':[],'git:commit':['paths','message'],'git:stage':['paths'],'terminal:create':[],'github:prs':[]};
function validateWorkspaceRoute(action,args){if(!actions[action])return;if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).some(k=>![...selections,...actions[action]].includes(k)))throw Error('Invalid workspace operation arguments.');}
async function routeWorkspace(selection,state,operation){
 const held=resolveExecutionRoot(selection,state),project=state.projects.find(p=>p.id===held.projectId);
 const validate=async()=>{await verifyWorkspace(held,project);if(JSON.stringify(resolveExecutionRoot(selection,state))!==JSON.stringify(held))throw Error('Workspace selection changed across an asynchronous operation.');};
 await validate();const result=await operation(held,validate);await validate();return result;
}
module.exports={routeWorkspace,validateWorkspaceRoute};
