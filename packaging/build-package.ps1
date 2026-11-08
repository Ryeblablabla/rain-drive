param([string]$Destination)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not $Destination) { $Destination = Join-Path $projectRoot ('release\AfterRain-' + (Get-Date -Format 'yyyyMMdd-HHmmss')) }
$releaseRoot = [System.IO.Path]::GetFullPath($Destination)
if (Test-Path -LiteralPath $releaseRoot) { throw 'Destination already exists. Choose a new output folder.' }
Push-Location -LiteralPath $projectRoot
try {
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw 'TypeScript or Vite build failed.' }
  $compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
  if (-not (Test-Path -LiteralPath $compiler)) { $compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe' }
  New-Item -ItemType Directory -Path $releaseRoot -Force | Out-Null
  & $compiler /nologo /target:winexe /optimize+ /reference:System.Windows.Forms.dll ('/out:' + (Join-Path $releaseRoot '雨夜高架.exe')) 'packaging\Launcher.cs'
  if ($LASTEXITCODE -ne 0) { throw 'Windows launcher compilation failed.' }
  Copy-Item -LiteralPath 'README.md','ASSET-SOURCES.md','THIRD-PARTY-LICENSES.txt','REFERENCE-TECHNIQUES.md' -Destination $releaseRoot
  Copy-Item -LiteralPath 'dist' -Destination $releaseRoot -Recurse
  foreach ($optional in @('验收报告.md','preview.png','build-info.json')) {
    if (Test-Path -LiteralPath $optional) { Copy-Item -LiteralPath $optional -Destination $releaseRoot }
  }
  Write-Output ('Portable game created: ' + $releaseRoot)
} finally { Pop-Location }
