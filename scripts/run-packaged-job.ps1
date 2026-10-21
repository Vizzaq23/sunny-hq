[CmdletBinding()]
param([Parameter(Mandatory)][string]$Request)
$ErrorActionPreference='Stop'
# Private harness entry only. No caller-selected command, executable, script or policy.
$item=Get-Item -LiteralPath $Request
if($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $item.Length -gt 8192){throw 'Invalid private supervisor request'}
$config=Get-Content -LiteralPath $Request -Raw|ConvertFrom-Json
$keys=@('exe','asar','profile','out','scenario','mib','timeoutMs','deadlineUnixMs')
if(@($config.PSObject.Properties).Count -ne $keys.Count -or @($config.PSObject.Properties.Name|Where-Object {$_ -notin $keys}).Count){throw 'Unknown supervisor request field'}
$driver=Join-Path $PSScriptRoot 'run-packaged-acceptance.ps1'
$runtime=Join-Path $PSHOME 'pwsh.exe'
if(-not (Test-Path -LiteralPath $runtime)){throw 'PowerShell 7 runtime unavailable'}
if([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() -ge [long]$config.deadlineUnixMs){throw 'Supervisor deadline expired before compilation'}
Add-Type -Path (Join-Path $PSScriptRoot 'packaged-job.cs')
$arguments=@('-NoLogo','-NoProfile','-NonInteractive','-File',$driver,'-Exe',[string]$config.exe,'-Asar',[string]$config.asar,'-Profile',[string]$config.profile,'-Out',[string]$config.out,'-Scenario',[string]$config.scenario,'-MiB',[string]$config.mib,'-TimeoutMs',[string]$config.timeoutMs,'-ContainedJob')
$result=[SunnyFixtureJob]::Run($runtime,$arguments,[long]$config.deadlineUnixMs)
[IO.File]::WriteAllText((Join-Path $item.DirectoryName 'job-report.json'),($result|ConvertTo-Json -Compress),[Text.UTF8Encoding]::new($false))
if($result.exitCode -ne 0 -or -not $result.cleanupObserved -or $result.timedOut){exit 1}
exit 0
