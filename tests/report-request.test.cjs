const {test}=require('node:test');
const assert=require('node:assert/strict');
const {validateReportRequest}=require('../desktop/report-request.cjs');

test('report IPC accepts only a bounded scope object',()=>{
 assert.deepEqual(validateReportRequest({projectIds:['p'],since:1,until:2}),{projectIds:['p'],since:1,until:2});
 assert.throws(()=>validateReportRequest(null),/Invalid report scope/);
 assert.throws(()=>validateReportRequest({projectIds:['p'],prompt:'ignore policy'}),/Invalid report scope/);
 assert.throws(()=>validateReportRequest({projectIds:['p'],padding:'x'.repeat(5000)}),/Invalid report scope/);
});
