param(
  [string]$Project = 'C:\Users\Yukai\OneDrive - University of Maryland\Documents\xcx',
  [string]$Environment = 'cloudbase-d6gvqujh4d0efe37f'
)
$ErrorActionPreference = 'Stop'
$source = Join-Path $PSScriptRoot '..\cloudfunctions\metaMonthly'
$key = [Environment]::GetEnvironmentVariable('TOPDECK_API_KEY', 'User')
if ([string]::IsNullOrWhiteSpace($key)) { throw 'MISSING_TOPDECK_KEY' }
$adminToken = [Environment]::GetEnvironmentVariable('META_ADMIN_TOKEN', 'User')
if ([string]::IsNullOrWhiteSpace($adminToken) -or $adminToken.Length -lt 32) {
  $bytes = New-Object byte[] 32
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $adminToken = -join ($bytes | ForEach-Object { $_.ToString('x2') })
  [Environment]::SetEnvironmentVariable('META_ADMIN_TOKEN', $adminToken, 'User')
}
$privateRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$staging = Join-Path $privateRoot ('cedh-monthly-deploy-' + [Guid]::NewGuid().ToString('N'))
$target = Join-Path $staging 'metaMonthly'
try {
  New-Item -ItemType Directory -Path $target | Out-Null
  Get-ChildItem -LiteralPath $source -File | Where-Object { $_.Name -ne 'runtime-secrets.json' } | Copy-Item -Destination $target
  @{ topdeckKey = $key; adminToken = $adminToken } | ConvertTo-Json -Compress | Set-Content -LiteralPath (Join-Path $target 'runtime-secrets.json') -Encoding utf8
  # Keep this file ASCII: Windows PowerShell reads scripts without a BOM in the system code page, which would garble the install folder's name.
  $cli = (Get-ChildItem -Path (Join-Path ${env:ProgramFiles(x86)} 'Tencent\*\cli.bat') | Select-Object -First 1).FullName
  if (-not $cli) { throw 'MISSING_DEVTOOLS_CLI' }
  # The CLI writes progress to stderr. Under Stop, Windows PowerShell treats the first such line as a fatal error.
  $ErrorActionPreference = 'Continue'
  $result = & $cli cloud functions deploy --env $Environment --paths $target --project $Project --remote-npm-install 2>&1
  $deployExit = $LASTEXITCODE
  $ErrorActionPreference = 'Stop'
  $result | ForEach-Object { Write-Output "$_" }
  # The official CLI can return exit 0 with a per-function failure table.
  if ($deployExit -ne 0 -or ($result -join "`n") -match 'fail to deploy|\[error\]|metaMonthly.*false') { throw 'DEPLOY_FAILED' }
} finally {
  # Delete only this invocation's verified, uniquely named private staging directory.
  $resolved = [IO.Path]::GetFullPath($staging)
  if ($resolved.StartsWith($privateRoot, [StringComparison]::OrdinalIgnoreCase) -and (Split-Path $resolved -Leaf).StartsWith('cedh-monthly-deploy-')) {
    if (Test-Path -LiteralPath $resolved) { Remove-Item -LiteralPath $resolved -Recurse -Force }
  }
  $key = $null; $adminToken = $null
}
