const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');

test('playable driver expects phase-one restart and enforces restart and owned Node evidence',()=>{
 const driver=path.resolve(__dirname,'../scripts/run-packaged-acceptance.ps1');
 const pwsh=(process.env.PATH||'').split(path.delimiter).map(dir=>path.join(dir,'pwsh.exe')).find(file=>fs.existsSync(file));
 assert.ok(pwsh,'PowerShell 7 runtime must be available on PATH');
 const script=`$ErrorActionPreference='Stop'
$errors=$null;$tokens=$null
$ast=[System.Management.Automation.Language.Parser]::ParseFile('${driver.replaceAll("'","''")}',[ref]$tokens,[ref]$errors)
if($errors.Count){throw 'Driver syntax errors'}
$exitAssignment=$ast.Find({param($node) $node -is [System.Management.Automation.Language.AssignmentStatementAst] -and $node.Left.Extent.Text -eq '$expectedExit'},$true)
$restartCheck=$ast.Find({param($node) $node -is [System.Management.Automation.Language.IfStatementAst] -and $node.Extent.Text.Contains("throw 'Restart did not produce a distinct main process.'")},$true)
if($null -eq $exitAssignment -or $null -eq $restartCheck){throw 'Driver phase checks missing'}
$Scenario='playable';$phase=1
. ([scriptblock]::Create($exitAssignment.Extent.Text))
if($expectedExit -ne 73){throw 'Playable phase one must expect restart exit 73'}
$phase=2
. ([scriptblock]::Create($exitAssignment.Extent.Text))
if($expectedExit -ne 0){throw 'Playable phase two must expect successful exit 0'}
function Verify-Restart([int]$secondPid,[bool]$retained,[string]$secondLaunch,[bool]$ownedNode){
 $result=@{mainProcessRestart=$false}
 $nodes=if($ownedNode){@(@{path='C:\\Program Files\\nodejs\\node.exe'})}else{@()}
 $receipts=@(@{pid=101;identity=@{};playable=@{launch=@{id='exact-launch'}};ownedProcesses=$nodes},@{pid=$secondPid;identity=@{};playable=@{launch=@{id=$secondLaunch};restartIdentity=$retained}})
 . ([scriptblock]::Create($restartCheck.Extent.Text))
 if(-not $result.mainProcessRestart){throw 'Playable restart validation was skipped'}
}
Verify-Restart 102 $true 'exact-launch' $true
foreach($case in @(@(101,$true,'exact-launch',$true),@(102,$false,'exact-launch',$true),@(102,$true,'foreign-launch',$true),@(102,$true,'exact-launch',$false))){
 $rejected=$false
 try{Verify-Restart $case[0] $case[1] $case[2] $case[3]}catch{if($_.Exception.Message -notmatch 'Restart did not produce|Playable restart or owned Node proof missing'){throw};$rejected=$true}
 if(-not $rejected){throw 'Invalid playable restart evidence was accepted'}
}
'PLAYABLE_DRIVER_PHASES_VERIFIED'`;
 const result=cp.spawnSync(pwsh,['-NoLogo','-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{windowsHide:true,encoding:'utf8',timeout:15000});
 assert.equal(result.status,0,result.stderr||result.error?.message);
 assert.match(result.stdout,/PLAYABLE_DRIVER_PHASES_VERIFIED/);
});
