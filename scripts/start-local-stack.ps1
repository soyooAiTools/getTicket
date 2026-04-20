param(
  [switch]$NoBrowser,
  [switch]$ForceRestart
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'local-stack.common.ps1')

Ensure-LocalStackDirectories
Ensure-DockerPath
Assert-CommandAvailable -CommandName 'corepack'
Assert-CommandAvailable -CommandName 'docker'

$statusBeforeStart = Get-LocalStackStatusObject
$allHealthy = @($statusBeforeStart.Services).Count -gt 0 -and @($statusBeforeStart.Services | Where-Object { -not $_.Healthy }).Count -eq 0

if ($allHealthy -and -not $ForceRestart) {
  Write-Host 'Local stack is already running.'

  if (-not $NoBrowser) {
    Start-Process 'http://localhost:5173/overview' | Out-Null
  }

  exit 0
}

if ($ForceRestart -or @($statusBeforeStart.Services | Where-Object { $_.PortListening -or $_.PidRunning }).Count -gt 0) {
  . (Join-Path $PSScriptRoot 'stop-local-stack.ps1') -KeepContainers
}

$envFile = Ensure-LocalStackEnvFile
Import-LocalStackEnv -EnvFile $envFile

if (-not $statusBeforeStart.DockerReachable) {
  docker info | Out-Null
}

Invoke-LocalStackCommand -WorkingDirectory (Get-LocalStackRepoRoot) -Command ('docker compose -f "' + (Get-LocalStackComposeFile) + '" up -d')
Ensure-LocalStackDependencies
Ensure-LocalStackDatabase

$runningServices = @()

foreach ($definition in (Get-LocalStackServiceDefinitions)) {
  if (-not (Test-LocalStackPortAvailable -Port $definition.Port)) {
    throw "Port $($definition.Port) is already in use before starting $($definition.Name)."
  }

  $runningServices += Start-LocalStackManagedService -Definition $definition
}

Write-LocalStackState -Services $runningServices

foreach ($service in $runningServices) {
  $ready = Wait-LocalStackHttpReady -Url $service.HealthUrl -TimeoutSeconds 60

  if (-not $ready) {
    throw "Service $($service.Name) failed to become healthy. See logs at $($service.StdoutPath) and $($service.StderrPath)."
  }
}

$finalStatus = Get-LocalStackStatusObject

Write-Host ''
Write-Host 'Local stack is ready.'
Write-Host '  Console     http://localhost:5173/overview'
Write-Host '  API         http://localhost:3000/api/health'
Write-Host '  Control     http://localhost:3001/control/health'
Write-Host ('  Logs        ' + (Get-LocalStackLogsRoot))
Write-Host ''

foreach ($service in $finalStatus.Services) {
  $healthLabel = if ($service.Healthy) { 'healthy' } else { 'unhealthy' }
  Write-Host ("  - {0}: port {1}, pid {2}, {3}" -f $service.Name, $service.Port, $service.Pid, $healthLabel)
}

if (-not $NoBrowser) {
  Start-Process 'http://localhost:5173/overview' | Out-Null
}
