const {createHash}=require('node:crypto');
function importConversations(input){
 if(!Array.isArray(input))throw Error('Choose conversations.json from a ChatGPT data export.');
 return input.slice(0,20000).map(conversation=>{
  if(!conversation||typeof conversation!=='object')return null;
  const mapping=conversation.mapping||{},chain=[],seen=new Set();let id=conversation.current_node;
  while(id&&mapping[id]&&!seen.has(id)){seen.add(id);chain.push(mapping[id]);id=mapping[id].parent;}
  const nodes=chain.length?chain.reverse():Object.values(mapping);
  const messages=nodes.map(node=>node?.message).filter(message=>message&&['user','assistant'].includes(message.author?.role)).map(message=>({id:String(message.id||''),role:message.author.role,text:(message.content?.parts||[]).filter(part=>typeof part==='string').join('\n')})).filter(m=>m.text);
  if(!messages.length)return null;
  return {id:'chatgpt:'+createHash('sha256').update(String(conversation.id||conversation.conversation_id||JSON.stringify(messages))).digest('hex').slice(0,24),title:String(conversation.title||'Imported conversation'),projectName:'ChatGPT import',external:true,status:'read only',messages};
 }).filter(Boolean);
}
module.exports={importConversations};
