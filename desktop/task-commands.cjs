const schemas={
 'task:start':{required:['projectId','crewId','prompt'],optional:['title','model','effort','selectionReason']},
 'task:send':{required:['taskId','prompt'],optional:[]},
 'task:handoff':{required:['taskId','crewId','prompt'],optional:[]},
 'task:interrupt':{required:['taskId'],optional:[]},
 'task:checkStatus':{required:['taskId'],optional:[]},
};
const limits={prompt:100000,title:500,selectionReason:2000,taskId:200,projectId:200,crewId:100,model:200,effort:40};
function validateTaskCommand(action,args){
 const schema=schemas[action];if(!schema)return args;
 if(!args||typeof args!=='object'||Array.isArray(args)||![Object.prototype,null].includes(Object.getPrototypeOf(args)))throw Error('Invalid task arguments.');
 const keys=[...schema.required,...schema.optional];
 if(Object.keys(args).some(key=>!keys.includes(key)))throw Error('Unknown task argument.');
 for(const key of keys){
  const value=args[key];if(!schema.required.includes(key)&&(value===undefined||value===''))continue;
  if(typeof value!=='string'||!value.trim()||value.length>limits[key]||value.includes('\0'))throw Error('Invalid '+key+'.');
 }
 return args;
}
module.exports={validateTaskCommand};
