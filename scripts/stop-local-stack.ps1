param(
  [switch]$KeepContainers
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'local-stack.common.ps1')

Ensure-LocalStackDirectories
Ensure-DockerPath

Stop-LocalStackProcesses

if (-not $KeepContainers -and (Get-Command docker -ErrorAction SilentlyContinue)) {
  try {
    Invoke-LocalStackCommand -WorkingDirectory (Get-LocalStackRepoRoot) -Command ('docker compose -f "' + (Get-LocalStackComposeFile) + '" down')
  }
  catch {
    Write-Warning ('Failed to stop docker compose services cleanly: ' + $_.Exception.Message)
  }
}

Write-Host 'Local stack processes stopped.'

if ($KeepContainers) {
  Write-Host 'Postgres and Redis containers were left running.'
}
else {
  Write-Host 'Postgres and Redis containers were stopped.'
}
