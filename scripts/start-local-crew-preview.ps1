param(
    [Parameter(Mandatory = $true)][string]$RuntimePath,
    [Parameter(Mandatory = $true)][string]$ModelStore,
    [Parameter(Mandatory = $true)][string]$Model,
    [switch]$Check
)
$ErrorActionPreference = 'Stop'
if ($Model -notmatch '^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$' -or $Model -match 'cloud') { throw 'Choose a downloaded local model name.' }
$repoRoot = Split-Path -Parent $PSScriptRoot
$runtime = (Resolve-Path -LiteralPath $RuntimePath).Path
$models = (Resolve-Path -LiteralPath $ModelStore).Path
$electron = Join-Path $repoRoot 'node_modules/electron/dist/electron.exe'
if (-not (Test-Path -LiteralPath $electron)) { throw 'Install the pinned project dependencies before opening this preview.' }
if (-not (Test-Path -LiteralPath (Join-Path $repoRoot 'dist/index.html'))) { throw 'Run npm run build before opening this preview.' }
$ownedServer = $null
$previous = @{}
foreach ($key in @('OLLAMA_HOST','OLLAMA_MODELS','OLLAMA_NO_CLOUD','ELECTRON_RUN_AS_NODE')) { $previous[$key] = [Environment]::GetEnvironmentVariable($key, 'Process') }
try {
    $env:OLLAMA_HOST = '127.0.0.1:11434'
    $env:OLLAMA_MODELS = $models
    $env:OLLAMA_NO_CLOUD = '1'
    $env:ELECTRON_RUN_AS_NODE = $null
    $connected = $false
    try { $version = Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/version' -TimeoutSec 2; $connected = [bool]$version.version } catch { }
    if (-not $connected) {
        $logDir = Join-Path $repoRoot ('.sunny-dev/local-crew-runtime/' + [Guid]::NewGuid().ToString())
        New-Item -ItemType Directory -Path $logDir -Force | Out-Null
        $ownedServer = Start-Process -FilePath $runtime -ArgumentList 'serve' -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDir 'stdout.log') -RedirectStandardError (Join-Path $logDir 'stderr.log')
        for ($attempt = 0; $attempt -lt 40; $attempt++) {
            if ($ownedServer.HasExited) { throw ('The local runtime exited. Inspect ' + $logDir) }
            try { $version = Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/version' -TimeoutSec 1; if ($version.version) { $connected = $true; break } } catch { }
            Start-Sleep -Milliseconds 250
        }
        if (-not $connected) { throw 'The local runtime did not become ready on port 11434.' }
    }
    Write-Host 'Opening the separate local developer preview. No model downloads or cloud fallback.'
    # This window is explicitly requested by running the preview launcher.
    $previewArgs = @('desktop/local-crew-preview.cjs','--model',$Model)
    if ($Check) { $previewArgs += '--preview-check' }
    $launch = @{FilePath=$electron;WorkingDirectory=$repoRoot;ArgumentList=$previewArgs;PassThru=$true;Wait=$true}
    if ($Check) { $launch.WindowStyle = 'Hidden' }
    $preview = Start-Process @launch
    if ($preview.ExitCode -ne 0) { throw 'The local preview failed. Check that the selected model is already downloaded in the running server.' }
} finally {
    if ($ownedServer -and -not $ownedServer.HasExited) { Stop-Process -InputObject $ownedServer }
    foreach ($key in $previous.Keys) { [Environment]::SetEnvironmentVariable($key, $previous[$key], 'Process') }
}
