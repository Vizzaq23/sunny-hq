[CmdletBinding()]
param(
 [Parameter(Mandatory)][string]$Exe,
 [Parameter(Mandatory)][string]$Asar,
 [Parameter(Mandatory)][string]$Profile,
 [Parameter(Mandatory)][string]$Out,
 [ValidateSet('run-ui','startup','renderer-crash','main-restart','worker-loss','write-failure','lost-ack','pending-approval','pending-check','normal-quit')][string]$Scenario='startup',
 [ValidateSet(1,10,30)][int]$MiB=1,
 [ValidateRange(10000,300000)][int]$TimeoutMs=120000
)
$ErrorActionPreference='Stop'
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
function Find-OwnedDescendants([int]$RootId,[datetime]$RootStart){
 $name=(Split-Path $Exe -Leaf).Replace("'","''")
 $candidates=@(Get-CimInstance Win32_Process -Filter ("Name = '"+$name+"'") | Where-Object {$_.ExecutablePath -ieq $Exe -and $_.CreationDate -ge $RootStart})
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
   if($null -ne $current -and $current.Path -ieq $Exe -and $current.StartTime -ge $RootStart){$ownedRecords[$pidValue]=@{start=$current.StartTime;path=$current.Path;lastSeen=[datetime]::Now}}
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
 $phases=if($Scenario -in @('main-restart','run-ui')){@(1,2)}else{@(1)}
 $receipts=@()
 foreach($phase in $phases){
  if((Get-FileHash -LiteralPath $Exe -Algorithm SHA256).Hash.ToLowerInvariant() -ne $exeHash -or (Get-FileHash -LiteralPath $Asar -Algorithm SHA256).Hash.ToLowerInvariant() -ne $asarHash){throw 'Package bytes changed before launch.'}
  $manifest=@{version=1;nonce=$nonce;profileDir=$Profile;outputDir=$Out;scenario=$Scenario;phase=$phase;mib=$MiB}|ConvertTo-Json -Compress
  Write-PrivateManifest $manifestPath $manifest
  $owned=Start-Process -FilePath $Exe -ArgumentList @(('"--packaged-fixture='+$manifestPath+'"')) -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $Out "phase-$phase.stdout.log") -RedirectStandardError (Join-Path $Out "phase-$phase.stderr.log")
  $ownedStart=$owned.StartTime
  $ownedRecords=@{}
  $ownedRecords[$owned.Id]=@{start=$ownedStart;path=$Exe;lastSeen=[datetime]::Now}
  $deadline=[Diagnostics.Stopwatch]::StartNew()
  while(-not $owned.WaitForExit(100)){
   Find-OwnedDescendants $owned.Id $ownedStart
   if($deadline.ElapsedMilliseconds -ge $TimeoutMs){throw 'Owned packaged process timed out.'}
  }
  Find-OwnedDescendants $owned.Id $ownedStart
  for($cleanupPass=0;$cleanupPass -lt 50 -and @(Get-OwnedRunning).Count;$cleanupPass++){Start-Sleep -Milliseconds 100}
  if(@(Get-OwnedRunning).Count){throw 'Owned package descendants did not exit after the main process.'}
  $owned.Refresh()
  $expectedExit=if($Scenario -eq 'main-restart' -and $phase -eq 1){73}else{0}
  if($owned.ExitCode -ne $expectedExit){throw "Packaged phase $phase exited $($owned.ExitCode); expected $expectedExit."}
  $receipt=Get-Content -LiteralPath (Join-Path $Out "phase-$phase.json") -Raw|ConvertFrom-Json
  if($receipt.pid -ne $owned.Id -or $receipt.executableSha256 -ne $exeHash -or $receipt.asarSha256 -ne $asarHash -or $receipt.phase -ne $phase -or $receipt.scenario -ne $Scenario){throw 'Exact process/package identity mismatch.'}
  $identities=@($ownedRecords.Keys|ForEach-Object {@{pid=$_;creationDate=$ownedRecords[$_].start.ToUniversalTime().ToString('o');path=$ownedRecords[$_].path}})
  $receipt|Add-Member -NotePropertyName ownedProcesses -NotePropertyValue $identities
  $receipts+=,$receipt
  $owned=$null
 }
 $result=@{version=1;scenario=$Scenario;exeSha256=$exeHash;asarSha256=$asarHash;mainProcessRestart=$false;phases=$receipts;ownedProcessesExited=$true}
 if($Scenario -eq 'main-restart'){
  if($receipts[0].pid -eq $receipts[1].pid){throw 'Restart did not produce a distinct main process.'}
  $before=$receipts[0].identity|ConvertTo-Json -Compress -Depth 10
  $after=$receipts[1].identity|ConvertTo-Json -Compress -Depth 10
  if($Scenario -eq 'main-restart' -and ($before -ne $after -or -not $receipts[1].identity.uncertainReservation -or $receipts[1].identity.uncertainStatus -ne 'unknown')){throw 'Restart lost durable draft/result identity or uncertain reservation.'}
  if($Scenario -eq 'run-ui' -and (-not $receipts[1].runUI.restartDedup -or $receipts[0].runUI.requestId -ne $receipts[1].runUI.requestId)){throw 'Run UI restart lost the exact unresolved call receipt.'}
  $result.mainProcessRestart=$true
 }
 if((Get-FileHash -LiteralPath $Exe -Algorithm SHA256).Hash.ToLowerInvariant() -ne $exeHash -or (Get-FileHash -LiteralPath $Asar -Algorithm SHA256).Hash.ToLowerInvariant() -ne $asarHash){throw 'Package bytes changed after launch.'}
 [IO.File]::WriteAllText((Join-Path $Out 'evidence.json'),($result|ConvertTo-Json -Depth 20),[Text.UTF8Encoding]::new($false))
 Write-Output (Join-Path $Out 'evidence.json')
}finally{
 foreach($current in @(Get-OwnedRunning)){Stop-Process -InputObject $current -Force -ErrorAction SilentlyContinue; $null=$current.WaitForExit(10000)}
 if(@(Get-OwnedRunning).Count){Write-Error 'Owned process cleanup is incomplete.' -ErrorAction Continue}
 if(Test-Path -LiteralPath $manifestPath){Remove-Item -LiteralPath $manifestPath -Force}
 $env:SUNNY_FIXTURE_NONCE=$priorNonce
}
