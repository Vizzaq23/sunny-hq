const {test}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {EventEmitter}=require('node:events');
const {requestOllama}=require('../desktop/local-crew.cjs');
function transport(t,respond){
 const calls=[];
 t.mock.method(http,'request',(options,onResponse)=>{
  const request=new EventEmitter(),response=new EventEmitter(),call={options};calls.push(call);
  response.statusCode=200;response.destroy=error=>response.emit('error',error);
  request.setTimeout=(ms,expire)=>{call.timeoutMs=ms;call.expire=expire;};request.destroy=error=>request.emit('error',error);
  request.end=payload=>{call.payload=payload;queueMicrotask(()=>respond({request,response,onResponse,call}));};return request;
 });return calls;
}
const send=(response,value)=>{response.emit('data',Buffer.from(value));response.emit('end');};
test('HTTP transport stays on fixed loopback, passes cancellation and counts UTF-8 payload bytes',async t=>{
 const calls=transport(t,({response,onResponse})=>{onResponse(response);send(response,'{"done":true}');});const controller=new AbortController();
 assert.deepEqual(await requestOllama('chat',{model:'fixture',messages:[{content:'船'}]},controller.signal),{done:true});
 const {options,payload,timeoutMs}=calls[0];assert.equal(options.hostname,'127.0.0.1');assert.equal(options.port,11434);assert.equal(options.path,'/api/chat');assert.equal(options.method,'POST');assert.equal(options.signal,controller.signal);assert.equal(options.headers['Content-Length'],Buffer.byteLength(payload));assert.equal(timeoutMs,120000);assert.equal(calls.length,1);
});
test('HTTP catalog uses GET without a body',async t=>{
 const calls=transport(t,({response,onResponse})=>{onResponse(response);send(response,'{"models":[]}');});await requestOllama('tags');assert.equal(calls[0].options.method,'GET');assert.equal(calls[0].payload,undefined);
});
test('HTTP redirects and error bodies cannot trigger a second request or leak response text',async t=>{
 const calls=transport(t,({response,onResponse})=>{response.statusCode=302;response.headers={location:'https://example.com/private'};onResponse(response);send(response,'sensitive server error text');});await assert.rejects(requestOllama('tags'),error=>/HTTP 302/.test(error.message)&&!error.message.includes('sensitive'));assert.equal(calls.length,1);
});
test('invalid JSON and oversized HTTP responses are rejected',async t=>{
 let oversized=false;transport(t,({response,onResponse})=>{onResponse(response);send(response,oversized?'x'.repeat(1024*1024+1):'not JSON');});await assert.rejects(requestOllama('tags'),/invalid JSON/);oversized=true;await assert.rejects(requestOllama('tags'),/exceeds 1 MB/);
});
test('socket errors and timeouts settle the request without retry',async t=>{
 let timeout=false;const calls=transport(t,({request,call})=>{if(timeout)call.expire();else request.emit('error',Object.assign(Error('connect failed'),{code:'ECONNREFUSED'}));});await assert.rejects(requestOllama('tags'),/Ollama is unavailable/);timeout=true;await assert.rejects(requestOllama('tags'),/timed out/);assert.equal(calls.length,2);
});
