const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {validCommand}=require('../scripts/probe-live-approvals.cjs');
test('live probe permits only its intact fixture under a known local shell',t=>{
 const root=fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()),'sunny-probe-guard-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const file=path.join(root,'fixture-action.cjs'),action="require('node:fs').appendFileSync(require('node:path').join(__dirname,'effects.txt'),'x');\n";fs.writeFileSync(file,action);
 const shell=(process.env.PATH||'').split(path.delimiter).map(dir=>path.join(dir,'pwsh.exe')).find(file=>fs.existsSync(file));assert.ok(shell);
 const approval={method:'item/commandExecution/requestApproval',params:{cwd:root,command:'"'+shell+'" -Command \'node fixture-action.cjs\'',commandActions:[{type:'unknown',command:'node fixture-action.cjs'}]}};
 assert.equal(validCommand(approval,root),true);
 for(const params of [{cwd:path.dirname(root)},{command:approval.params.command+'; another-command'},{commandActions:[{type:'unknown',command:'another-command'}]}])assert.equal(validCommand({...approval,params:{...approval.params,...params}},root),false);
 assert.equal(validCommand({...approval,method:'item/fileChange/requestApproval'},root),false);fs.appendFileSync(file,'different');assert.equal(validCommand(approval,root),false);
});
