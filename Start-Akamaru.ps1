$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCommand) {
  $portableRuntime = Join-Path $env:TEMP 'akamaru-node/node-v22.14.0-win-x64'
  if (Test-Path (Join-Path $portableRuntime 'node.exe')) {
    $env:PATH = "$portableRuntime;$env:PATH"
  } else {
    throw 'Install Node.js 20 or newer, then run this script again.'
  }
}
if (-not (Test-Path 'node_modules')) {
  & npm.cmd install
  if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
}
& npm.cmd run dev
