param(
  [switch]$Json
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'local-stack.common.ps1')

Ensure-LocalStackDirectories
$status = Get-LocalStackStatusObject

if ($Json) {
  $status | ConvertTo-Json -Depth 8
  exit 0
}

Write-Host 'Local stack status'
Write-Host ('  Repo   ' + $status.RepoRoot)
Write-Host ('  State  ' + $status.StateRoot)
Write-Host ('  Logs   ' + $status.LogsRoot)
Write-Host ('  Env    ' + $status.EnvFile)
Write-Host ('  Docker ' + ($(if ($status.DockerReachable) { 'ready' } elseif ($status.DockerAvailable) { 'installed but not reachable' } else { 'missing' })))
Write-Host ''

foreach ($service in $status.Services) {
  $summary = if ($service.Healthy) {
    'healthy'
  }
  elseif ($service.PortListening) {
    'listening but unhealthy'
  }
  else {
    'stopped'
  }

  Write-Host ("  - {0}: {1}" -f $service.Name, $summary)
  Write-Host ("      port: {0}" -f $service.Port)
  Write-Host ("      pid:  {0}" -f $(if ($service.Pid) { $service.Pid } else { 'n/a' }))
  Write-Host ("      url:  {0}" -f $service.HealthUrl)

  if ($service.StdoutPath) {
    Write-Host ("      out:  {0}" -f $service.StdoutPath)
  }

  if ($service.StderrPath) {
    Write-Host ("      err:  {0}" -f $service.StderrPath)
  }
}
