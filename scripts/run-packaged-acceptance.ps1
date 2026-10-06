[CmdletBinding()]
param(
 [Parameter(Mandatory)][string]$Exe,
 [Parameter(Mandatory)][string]$Asar,
 [Parameter(Mandatory)][string]$Profile,
 [Parameter(Mandatory)][string]$Out,
 [ValidateSet('playable','run-ui','startup','renderer-crash','main-restart','worker-loss','write-failure','lost-ack','pending-approval','pending-check','normal-quit')][string]$Scenario='startup',
 [ValidateSet(1,10,30)][int]$MiB=1,
 [ValidateRange(10000,300000)][int]$TimeoutMs=120000,
 [switch]$ContainedJob
)
$ErrorActionPreference='Stop'
if(-not $ContainedJob){throw 'Use scripts/packaged-supervisor.cjs; direct uncontained fixture launches are disabled.'}
$deadline=[Diagnostics.Stopwatch]::StartNew()
function Assert-Deadline {if($deadline.ElapsedMilliseconds -ge $TimeoutMs){throw 'Owned packaged process timed out.'}}
function Write-DriverStage([string]$Stage,[int]$Phase){
 if($Stage -notin @('manifest-ready','launch-enter','launch-return','root-registered','scan-enter','scan-exit','process-exit','receipt-verified')){throw 'Unknown fixture driver stage'}
 if($script:stageCount -ge 96){return};$script:stageCount++
 [IO.File]::AppendAllText((Join-Path $Out 'driver-stages.jsonl'),((@{version=1;phase=$Phase;stage=$Stage;utc=[DateTime]::UtcNow.ToString('o');elapsedMs=$deadline.ElapsedMilliseconds}|ConvertTo-Json -Compress)+[Environment]::NewLine),[Text.UTF8Encoding]::new($false))
}
function Assert-Canonical([string]$Path,[bool]$Directory){
 if(-not [IO.Path]::IsPathFullyQualified($Path)){throw 'All fixture paths must be absolute.'}
 $item=Get-Item -LiteralPath $Path
 if($item.PSIsContainer -ne $Directory){throw 'Fixture path type mismatch.'}
 if($item.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Fixture aliases/junctions are forbidden.'}
 $ancestor=if($item.PSIsContainer){$item.Parent}else{$item.Directory}
 for($entry=$ancestor;$null -ne $entry;$entry=$entry.Parent){if($entry.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Fixture aliases/junctions are forbidden.'}}
 $resolved=[IO.Path]::GetFullPath($Path)
 if($resolved -ine $item.FullName){throw 'Fixture paths must be canonical.'}
 return $resolved
}
function Is-Inside([string]$Parent,[string]$Child){return $Child -ieq $Parent -or $Child.StartsWith($Parent.TrimEnd('\')+'\',[StringComparison]::OrdinalIgnoreCase)}
function Write-PrivateManifest([string]$ManifestFile,[string]$Content){
 $identity=[Security.Principal.WindowsIdentity]::GetCurrent().User
 if(-not (Test-Path -LiteralPath $ManifestFile)){
  $empty=[IO.File]::Open($ManifestFile,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
  $empty.Dispose()
  # Protect the new empty file before it contains the nonce. Do not reapply ACLs on restart.
  $privateAcl=[Security.AccessControl.FileSecurity]::new()
  $privateAcl.SetAccessRuleProtection($true,$false)
  $privateAcl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($identity,'FullControl','Allow'))
  $privateAcl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new('S-1-5-18'),'FullControl','Allow'))
  Set-Acl -LiteralPath $ManifestFile -AclObject $privateAcl
 }
 $file=Get-Item -LiteralPath $ManifestFile
 if($file.PSIsContainer -or ($file.Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'Private manifest must be a regular file.'}
 $actualAcl=Get-Acl -LiteralPath $ManifestFile
 $rules=@($actualAcl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]))
 if(-not $actualAcl.AreAccessRulesProtected -or $actualAcl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $identity.Value -or $rules.Count -ne 2){throw 'Private manifest ownership or ACL changed.'}
 $allowed=@($identity.Value,'S-1-5-18')
 foreach($rule in $rules){
  if($rule.IsInherited -or $rule.AccessControlType -ne 'Allow' -or $rule.FileSystemRights -ne [Security.AccessControl.FileSystemRights]::FullControl -or $rule.IdentityReference.Value -notin $allowed){throw 'Private manifest ACL changed.'}
 }
 if(@($rules.IdentityReference.Value|Select-Object -Unique).Count -ne 2){throw 'Private manifest ACL identities changed.'}
 [IO.File]::WriteAllText($ManifestFile,$Content,[Text.UTF8Encoding]::new($false))
}
$Exe=Assert-Canonical $Exe $false
$Asar=Assert-Canonical $Asar $false
$Profile=Assert-Canonical $Profile $true
$Out=Assert-Canonical $Out $true
if($Asar -ine (Join-Path (Split-Path $Exe) 'resources\app.asar')){throw 'ASAR must belong to the exact executable package.'}
$live=Join-Path $env:USERPROFILE 'AppData\Local\Sunny HQ'
if((Is-Inside $live $Profile) -or (Is-Inside $Profile $live) -or (Is-Inside $Profile $Out) -or (Is-Inside $Out $Profile)){throw 'Fixture directories must be isolated from the live profile and each other.'}
if((Get-ChildItem -LiteralPath $Profile -Force).Count -or (Get-ChildItem -LiteralPath $Out -Force).Count){throw 'Profile and evidence directories must be empty.'}
foreach($key in @('ELECTRON_RUN_AS_NODE','SUNNY_DEV_URL','SUNNY_PROVIDER_MISSION','SUNNY_LIVE_MISSION','SUNNY_DATA_DIR')){if([Environment]::GetEnvironmentVariable($key)){throw "Fixture driver refuses inherited $key"}}
$exeHash=(Get-FileHash -LiteralPath $Exe -Algorithm SHA256).Hash.ToLowerInvariant()
$asarHash=(Get-FileHash -LiteralPath $Asar -Algorithm SHA256).Hash.ToLowerInvariant()
$nonce=[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLowerInvariant()
$manifestPath=Join-Path (Split-Path $Out) ('.sunny-fixture-'+[guid]::NewGuid().ToString('N')+'.json')
$nonceHash=[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($nonce))).ToLowerInvariant()
[IO.File]::WriteAllText((Join-Path $Out '.sunny-packaged-output.json'),(@{version=1;nonceSha256=$nonceHash}|ConvertTo-Json -Compress),[Text.UTF8Encoding]::new($false))
$priorNonce=$env:SUNNY_FIXTURE_NONCE
$owned=$null
$ownedRecords=@{}
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class SunnyFixtureArgv {
 [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool IsProcessInJob(IntPtr process,IntPtr job,out bool answer);
 [DllImport("shell32.dll",SetLastError=true)] static extern IntPtr CommandLineToArgvW([MarshalAs(UnmanagedType.LPWStr)] string value,out int count);
 [DllImport("kernel32.dll")] static extern IntPtr LocalFree(IntPtr memory);
 public static string[] Parse(string value){int count;IntPtr memory=CommandLineToArgvW(value,out count);if(memory==IntPtr.Zero)throw new InvalidOperationException("Invalid fixture process arguments");try{if(count<1||count>16)throw new InvalidOperationException("Invalid fixture process argument count");var result=new string[count];for(int i=0;i<count;i++)result[i]=Marshal.PtrToStringUni(Marshal.ReadIntPtr(memory,i*IntPtr.Size));return result;}finally{LocalFree(memory);}}
 public static bool Contained(){bool answer;return IsProcessInJob(GetCurrentProcess(),IntPtr.Zero,out answer)&&answer;}
}
'@
if(-not [SunnyFixtureArgv]::Contained()){throw 'Fixture driver requires a contained helper process.'}
function Read-RootIdentity([Diagnostics.Process]$Process,[string]$Manifest){
 Assert-Deadline
 $observed=Get-CimInstance Win32_Process -Filter ('ProcessId = '+$Process.Id) -OperationTimeoutSec 2
 Assert-Deadline
 $arguments=[SunnyFixtureArgv]::Parse($observed.CommandLine)
 if($observed.ExecutablePath -ine $Exe -or $observed.ParentProcessId -ne $PID -or $arguments.Count -ne 2 -or $arguments[0] -ine $Exe -or $arguments[1] -cne ('--packaged-fixture='+$Manifest) -or $Process.Path -ine $Exe){throw 'Root process manifest or parent identity mismatch'}
 $parent=Get-Process -Id $PID
 return @{pid=$Process.Id;creation=$Process.StartTime.ToUniversalTime().ToFileTimeUtc().ToString();executable=$Exe;manifest=$Manifest;parentPid=$PID;parentCreation=$parent.StartTime.ToUniversalTime().ToFileTimeUtc().ToString()}
}
function Find-OwnedDescendants([int]$RootId,[datetime]$RootStart){
 $name=(Split-Path $Exe -Leaf).Replace("'","''")
 $nodeOwner=$null
 $nodeOwnerFile=Join-Path $Out 'owned-node.json'
 if($Scenario -eq 'playable' -and (Test-Path -LiteralPath $nodeOwnerFile)){$nodeOwner=Get-Content -LiteralPath $nodeOwnerFile -Raw|ConvertFrom-Json;if($nodeOwner.executable -ine 'C:\Program Files\nodejs\node.exe' -or $nodeOwner.sha256 -ne '9a4eb5f1c29c6a2e93852ead46b999e284a6a5ca8bab4d4e241d587d025a52de' -or -not (Is-Inside (Join-Path $Profile 'playable-builds') $nodeOwner.runnerPath)){throw 'Unapproved fixture Node ownership record'};if((Get-FileHash -LiteralPath $nodeOwner.executable -Algorithm SHA256).Hash.ToLowerInvariant() -ne $nodeOwner.sha256){throw 'Owned Node executable changed'}}
 Assert-Deadline
 $candidates=@(Get-CimInstance Win32_Process -Filter ("Name = '"+$name+"'") -OperationTimeoutSec 2 | Where-Object {$_.ExecutablePath -ieq $Exe -and $_.CreationDate -ge $RootStart})
 Assert-Deadline
 if($null -ne $nodeOwner){$nodeCandidate=Get-CimInstance Win32_Process -Filter ('ProcessId = '+[int]$nodeOwner.pid) -OperationTimeoutSec 2;Assert-Deadline;if($null -ne $nodeCandidate){$nodeArguments=[SunnyFixtureArgv]::Parse($nodeCandidate.CommandLine);if($nodeCandidate.ExecutablePath -ieq $nodeOwner.executable -and $nodeCandidate.ParentProcessId -eq $RootId -and $nodeCandidate.CreationDate -ge $RootStart -and $nodeArguments.Count -ge 2 -and $nodeArguments[0] -ieq $nodeOwner.executable -and $nodeArguments[1] -ceq $nodeOwner.runnerPath){$candidates+=,$nodeCandidate}}}
 for($pass=0;$pass -lt 4;$pass++){
  foreach($candidate in $candidates){
   if($candidate.ParentProcessId -ne $RootId -and -not $ownedRecords.ContainsKey([int]$candidate.ParentProcessId)){continue}
   $pidValue=[int]$candidate.ProcessId
   if($pidValue -eq $RootId -or $ownedRecords.ContainsKey($pidValue)){continue}
   $parentRecord=$ownedRecords[[int]$candidate.ParentProcessId]
   $parentCurrent=Get-Process -Id $candidate.ParentProcessId -ErrorAction SilentlyContinue
   if($null -ne $parentCurrent){if($parentCurrent.StartTime -ne $parentRecord.start -or $parentCurrent.Path -ine $parentRecord.path){continue};$parentRecord.lastSeen=[datetime]::Now}
   elseif($candidate.CreationDate -gt $parentRecord.lastSeen){throw 'Owned descendant identity is unresolved after its parent exited.'}
   $current=Get-Process -Id $pidValue -ErrorAction SilentlyContinue
   if($null -ne $current -and ($current.Path -ieq $Exe -or ($null -ne $nodeOwner -and $pidValue -eq $nodeOwner.pid -and $current.Path -ieq $nodeOwner.executable)) -and $current.StartTime -ge $RootStart){$ownedRecords[$pidValue]=@{start=$current.StartTime;path=$current.Path;lastSeen=[datetime]::Now}}
  }
 }
}
function Get-OwnedRunning {
 $running=@()
 foreach($pidValue in @($ownedRecords.Keys)){
  $current=Get-Process -Id $pidValue -ErrorAction SilentlyContinue
  $record=$ownedRecords[$pidValue]
  if($null -ne $current -and $current.StartTime -eq $record.start -and $current.Path -ieq $record.path){$running+=,$current}
 }
 return $running
}
try{
 $env:SUNNY_FIXTURE_NONCE=$nonce
 $phases=if($Scenario -in @('main-restart','run-ui','playable')){@(1,2)}else{@(1)}
 $receipts=@()
 foreach($phase in $phases){
  if((Get-FileHash -LiteralPath $Exe -Algorithm SHA256).Hash.ToLowerInvariant() -ne $exeHash -or (Get-FileHash -LiteralPath $Asar -Algorithm SHA256).Hash.ToLowerInvariant() -ne $asarHash){throw 'Package bytes changed before launch.'}
  $manifest=@{version=1;nonce=$nonce;profileDir=$Profile;outputDir=$Out;scenario=$Scenario;phase=$phase;mib=$MiB}|ConvertTo-Json -Compress
  Write-PrivateManifest $manifestPath $manifest
  Write-DriverStage 'manifest-ready' $phase
  Assert-Deadline
  Write-DriverStage 'launch-enter' $phase
  $owned=Start-Process -FilePath $Exe -ArgumentList @(('"--packaged-fixture='+$manifestPath+'"')) -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $Out "phase-$phase.stdout.log") -RedirectStandardError (Join-Path $Out "phase-$phase.stderr.log")
  Write-DriverStage 'launch-return' $phase
  Assert-Deadline
  $ownedStart=$owned.StartTime
  $rootIdentity=Read-RootIdentity $owned $manifestPath
  [IO.File]::WriteAllText((Join-Path $Out "root-registration-$phase.json"),($rootIdentity|ConvertTo-Json -Compress),[Text.UTF8Encoding]::new($false))
  Write-DriverStage 'root-registered' $phase
  $ownedRecords=@{}
  $ownedRecords[$owned.Id]=@{start=$ownedStart;path=$Exe;lastSeen=[datetime]::Now}
  $nextScan=0
  while(-not $owned.WaitForExit(100)){
   Assert-Deadline
   if($deadline.ElapsedMilliseconds -ge $nextScan){Write-DriverStage 'scan-enter' $phase;Find-OwnedDescendants $owned.Id $ownedStart;Write-DriverStage 'scan-exit' $phase;Assert-Deadline;$nextScan=$deadline.ElapsedMilliseconds+2000}
  }
  Write-DriverStage 'process-exit' $phase
  Assert-Deadline
  Find-OwnedDescendants $owned.Id $ownedStart
  for($cleanupPass=0;$cleanupPass -lt 50 -and @(Get-OwnedRunning).Count;$cleanupPass++){Start-Sleep -Milliseconds 100}
  if(@(Get-OwnedRunning).Count){throw 'Owned package descendants did not exit after the main process.'}
  $owned.Refresh()
  $expectedExit=if($Scenario -in @('main-restart','run-ui','playable') -and $phase -eq 1){73}else{0}
  if($owned.ExitCode -ne $expectedExit){throw "Packaged phase $phase exited $($owned.ExitCode); expected $expectedExit."}
  $receipt=Get-Content -LiteralPath (Join-Path $Out "phase-$phase.json") -Raw|ConvertFrom-Json
  if($receipt.pid -ne $owned.Id -or $receipt.executableSha256 -ne $exeHash -or $receipt.asarSha256 -ne $asarHash -or $receipt.phase -ne $phase -or $receipt.scenario -ne $Scenario){throw 'Exact process/package identity mismatch.'}
  $identities=@($ownedRecords.Keys|ForEach-Object {@{pid=$_;creationDate=$ownedRecords[$_].start.ToUniversalTime().ToString('o');path=$ownedRecords[$_].path}})
  $receipt|Add-Member -NotePropertyName ownedProcesses -NotePropertyValue $identities
  $receipt|Add-Member -NotePropertyName ownedRoot -NotePropertyValue $rootIdentity
  Write-DriverStage 'receipt-verified' $phase
  $receipts+=,$receipt
  $owned=$null
 }
 $result=@{version=1;scenario=$Scenario;exeSha256=$exeHash;asarSha256=$asarHash;mainProcessRestart=$false;phases=$receipts;ownedProcessesExited=$true}
 if($Scenario -in @('main-restart','run-ui','playable')){
  if($receipts[0].pid -eq $receipts[1].pid){throw 'Restart did not produce a distinct main process.'}
  $before=$receipts[0].identity|ConvertTo-Json -Compress -Depth 10
  $after=$receipts[1].identity|ConvertTo-Json -Compress -Depth 10
  if($Scenario -eq 'main-restart' -and ($before -ne $after -or -not $receipts[1].identity.uncertainReservation -or $receipts[1].identity.uncertainStatus -ne 'unknown')){throw 'Restart lost durable draft/result identity or uncertain reservation.'}
  if($Scenario -eq 'run-ui' -and (-not $receipts[1].runUI.restartDedup -or $receipts[0].runUI.requestId -ne $receipts[1].runUI.requestId)){throw 'Run UI restart lost the exact unresolved call receipt.'}
  if($Scenario -eq 'playable' -and (-not $receipts[1].playable.restartIdentity -or $receipts[0].playable.launch.id -ne $receipts[1].playable.launch.id -or @($receipts[0].ownedProcesses|Where-Object {$_.path -ieq 'C:\Program Files\nodejs\node.exe'}).Count -ne 1)){throw 'Playable restart or owned Node proof missing'}
  $result.mainProcessRestart=$true
 }
 if((Get-FileHash -LiteralPath $Exe -Algorithm SHA256).Hash.ToLowerInvariant() -ne $exeHash -or (Get-FileHash -LiteralPath $Asar -Algorithm SHA256).Hash.ToLowerInvariant() -ne $asarHash){throw 'Package bytes changed after launch.'}
 [IO.File]::WriteAllText((Join-Path $Out 'evidence.json'),($result|ConvertTo-Json -Depth 20),[Text.UTF8Encoding]::new($false))
 Write-Output (Join-Path $Out 'evidence.json')
}finally{
 # Cleanup belongs to the externally owned private job. Never recover kill
 # authority from a PID, executable name or a late observation here.
 if(Test-Path -LiteralPath $manifestPath){Remove-Item -LiteralPath $manifestPath -Force}
 $env:SUNNY_FIXTURE_NONCE=$priorNonce
}
