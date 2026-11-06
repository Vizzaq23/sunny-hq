const {test}=require('node:test'),assert=require('node:assert/strict');
const {fitLocalSourcePreview}=require('../src/localSourcePreview.ts');
const preview={filePath:'example.ts',startLine:7,endLine:9,totalLines:9,text:'7:   first\n8:   second\n9: third',sha256:'source-hash',recordedAt:123,truncated:false};
test('smaller conversation preview preserves indentation, full lines and source identity',()=>{
 const result=fitLocalSourcePreview(preview,23);
 assert.equal(result.text,'7:   first\n8:   second');assert.equal(result.endLine,8);assert.equal(result.truncated,true);
 assert.equal(result.sha256,preview.sha256);assert.equal(result.recordedAt,123);assert.equal(preview.endLine,9);
});
test('complete excerpt remains unchanged and an oversized first line is rejected',()=>{
 assert.deepEqual(fitLocalSourcePreview(preview,100),preview);
 assert.throws(()=>fitLocalSourcePreview(preview,2),/too long/);
});
