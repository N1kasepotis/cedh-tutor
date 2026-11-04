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
  [Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
  $adminToken = [Convert]::ToHexString($bytes).ToLowerInvariant()
  [Environment]::SetEnvironmentVariable('META_ADMIN_TOKEN', $adminToken, 'User')
}
$privateRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$staging = Join-Path $privateRoot ('cedh-monthly-deploy-' + [Guid]::NewGuid().ToString('N'))
$target = Join-Path $staging 'metaMonthly'
try {
  New-Item -ItemType Directory -Path $target | Out-Null
  Get-ChildItem -LiteralPath $source -File | Where-Object { $_.Name -ne 'runtime-secrets.json' } | Copy-Item -Destination $target
  @{ topdeckKey = $key; adminToken = $adminToken } | ConvertTo-Json -Compress | Set-Content -LiteralPath (Join-Path $target 'runtime-secrets.json') -Encoding utf8
  $result = & 'C:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat' cloud functions deploy --env $Environment --paths $target --project $Project --remote-npm-install 2>&1
  $result | ForEach-Object { Write-Output $_ }
  # The official CLI can return exit 0 with a per-function failure table.
  if ($LASTEXITCODE -ne 0 -or ($result -join "`n") -match 'fail to deploy|\[error\]|metaMonthly.*false') { throw 'DEPLOY_FAILED' }
} finally {
  # Delete only this invocation's verified, uniquely named private staging directory.
  $resolved = [IO.Path]::GetFullPath($staging)
  if ($resolved.StartsWith($privateRoot, [StringComparison]::OrdinalIgnoreCase) -and (Split-Path $resolved -Leaf).StartsWith('cedh-monthly-deploy-')) {
    if (Test-Path -LiteralPath $resolved) { Remove-Item -LiteralPath $resolved -Recurse -Force }
  }
  $key = $null; $adminToken = $null
}
