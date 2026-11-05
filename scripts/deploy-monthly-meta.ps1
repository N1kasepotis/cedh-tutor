param(
  [string]$Project = 'C:\Users\Yukai\OneDrive - University of Maryland\Documents\xcx',
  [string]$Environment = 'cloudbase-d6gvqujh4d0efe37f',
  [string]$Cli = '',
  [int]$TimeoutSeconds = 600,
  [int]$GraceSeconds = 30
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
# A run whose window was closed cannot clean up after itself, so each run first removes what an earlier one left behind.
Get-ChildItem -LiteralPath $privateRoot -Directory -Filter 'cedh-monthly-deploy-*' | ForEach-Object { Remove-Item -LiteralPath $_.FullName -Recurse -Force }
$staging = Join-Path $privateRoot ('cedh-monthly-deploy-' + [Guid]::NewGuid().ToString('N'))
$target = Join-Path $staging 'metaMonthly'
$stdout = Join-Path $staging 'cli-out.log'
$stderr = Join-Path $staging 'cli-err.log'
function Read-CliOutput { (Get-Content -LiteralPath $stdout, $stderr -Raw -ErrorAction SilentlyContinue) -join "`n" }
try {
  New-Item -ItemType Directory -Path $target | Out-Null
  Get-ChildItem -LiteralPath $source -File | Where-Object { $_.Name -ne 'runtime-secrets.json' } | Copy-Item -Destination $target
  @{ topdeckKey = $key; adminToken = $adminToken } | ConvertTo-Json -Compress | Set-Content -LiteralPath (Join-Path $target 'runtime-secrets.json') -Encoding utf8
  # Keep this file ASCII: Windows PowerShell reads scripts without a BOM in the system code page, which would garble the install folder's name.
  if (-not $Cli) { $Cli = (Get-ChildItem -Path (Join-Path ${env:ProgramFiles(x86)} 'Tencent\*\cli.bat') | Select-Object -First 1).FullName }
  if (-not $Cli) { throw 'MISSING_DEVTOOLS_CLI' }
  Write-Host 'Deploying, usually a minute or two. Keep this window open so the temporary copy of the secrets gets removed.'
  $arguments = @('cloud', 'functions', 'deploy', '--env', $Environment, '--paths', "`"$target`"", '--project', "`"$Project`"", '--remote-npm-install')
  $process = Start-Process -FilePath $Cli -ArgumentList $arguments -NoNewWindow -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
  $null = $process.Handle  # Without this, ExitCode stays empty after the process ends.
  $started = Get-Date
  $deployedAt = $null
  $killed = $false
  while (-not $process.HasExited) {
    Start-Sleep -Seconds 2
    $elapsed = ((Get-Date) - $started).TotalSeconds
    # The CLI has been seen to finish the deployment and then never exit. That must not hold the cleanup hostage.
    if (-not $deployedAt -and (Read-CliOutput) -match 'metaMonthly\W+true') { $deployedAt = Get-Date; Write-Host 'Deployment reported success, waiting for the CLI to exit.' }
    $graceOver = $deployedAt -and ((Get-Date) - $deployedAt).TotalSeconds -ge $GraceSeconds
    if ($graceOver -or $elapsed -ge $TimeoutSeconds) {
      & taskkill.exe /T /F /PID $process.Id *> $null
      $killed = $true
      break
    }
    if ([int]$elapsed % 20 -lt 2) { Write-Host "Still deploying, $([int]$elapsed) seconds." }
  }
  if ($killed) { Start-Sleep -Seconds 1 }
  $output = Read-CliOutput
  Write-Output $output
  # The official CLI can return exit 0 with a per-function failure table.
  if ($output -match 'fail to deploy|\[error\]|metaMonthly\W+false') { throw 'DEPLOY_FAILED' }
  if ($killed) {
    if (-not $deployedAt) { throw 'DEPLOY_TIMEOUT' }
  } else {
    $process.WaitForExit()
    if ($process.ExitCode -ne 0 -or $output -notmatch 'metaMonthly\W+true') { throw 'DEPLOY_FAILED' }
  }
  Write-Host 'Deployed. New snapshots go live after the seed action runs.'
} finally {
  # Delete only this invocation's verified, uniquely named private staging directory.
  $resolved = [IO.Path]::GetFullPath($staging)
  if ($resolved.StartsWith($privateRoot, [StringComparison]::OrdinalIgnoreCase) -and (Split-Path $resolved -Leaf).StartsWith('cedh-monthly-deploy-')) {
    if (Test-Path -LiteralPath $resolved) { Remove-Item -LiteralPath $resolved -Recurse -Force }
  }
  if (Test-Path -LiteralPath $resolved) { Write-Warning "Could not remove $resolved. It holds a copy of the secrets. Delete it by hand." }
  $key = $null; $adminToken = $null
}
