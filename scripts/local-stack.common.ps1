Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-LocalStackRepoRoot {
  return (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}

function Get-LocalStackStateRoot {
  return (Join-Path (Get-LocalStackRepoRoot) '.codex-temp\local-stack')
}

function Get-LocalStackLogsRoot {
  return (Join-Path (Get-LocalStackStateRoot) 'logs')
}

function Get-LocalStackPidFile {
  return (Join-Path (Get-LocalStackStateRoot) 'services.json')
}

function Get-LocalStackSeedFile {
  return (Join-Path (Get-LocalStackRepoRoot) 'scripts\sql\seed-load-control-local.sql')
}

function Get-LocalStackComposeFile {
  return (Join-Path (Get-LocalStackRepoRoot) 'docker-compose.yml')
}

function Get-LocalStackEnvFile {
  return (Join-Path (Get-LocalStackRepoRoot) '.env')
}

function Get-LocalStackEnvExampleFile {
  return (Join-Path (Get-LocalStackRepoRoot) '.env.example')
}

function Ensure-LocalStackDirectories {
  New-Item -ItemType Directory -Force -Path (Get-LocalStackStateRoot) | Out-Null
  New-Item -ItemType Directory -Force -Path (Get-LocalStackLogsRoot) | Out-Null
}

function Ensure-LocalStackEnvFile {
  $envFile = Get-LocalStackEnvFile

  if (Test-Path $envFile) {
    return $envFile
  }

  $exampleFile = Get-LocalStackEnvExampleFile

  if (-not (Test-Path $exampleFile)) {
    throw "Missing .env.example at $exampleFile"
  }

  Copy-Item $exampleFile $envFile -Force
  return $envFile
}

function Import-LocalStackEnv {
  param(
    [string]$EnvFile = (Get-LocalStackEnvFile)
  )

  if (-not (Test-Path $EnvFile)) {
    throw "Missing environment file: $EnvFile"
  }

  Get-Content $EnvFile | ForEach-Object {
    if ($_ -match '^\s*([^#=]+)=(.*)$') {
      [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
    }
  }
}

function Ensure-DockerPath {
  $dockerCommand = Get-Command docker -ErrorAction SilentlyContinue

  if ($dockerCommand) {
    return
  }

  $dockerBin = 'D:\DockerDesktop\App\resources\bin'

  if (Test-Path (Join-Path $dockerBin 'docker.exe')) {
    $env:PATH = "$dockerBin;$env:PATH"
  }
}

function Assert-CommandAvailable {
  param(
    [Parameter(Mandatory = $true)]
    [string]$CommandName
  )

  if (-not (Get-Command $CommandName -ErrorAction SilentlyContinue)) {
    throw "Required command not found: $CommandName"
  }
}

function Invoke-LocalStackCommand {
  param(
    [Parameter(Mandatory = $true)]
    [string]$WorkingDirectory,

    [Parameter(Mandatory = $true)]
    [string]$Command
  )

  Push-Location $WorkingDirectory

  try {
    Invoke-Expression $Command
  }
  finally {
    Pop-Location
  }
}

function Get-LocalStackServiceDefinitions {
  $repoRoot = Get-LocalStackRepoRoot

  return @(
    [pscustomobject]@{
      Name = 'api'
      WorkingDirectory = (Join-Path $repoRoot 'apps\api')
      Command = 'corepack pnpm exec ts-node --transpile-only --prefer-ts-exts src/main.ts'
      HealthUrl = 'http://localhost:3000/api/health'
      Port = 3000
    },
    [pscustomobject]@{
      Name = 'load-control'
      WorkingDirectory = (Join-Path $repoRoot 'apps\load-control')
      Command = 'corepack pnpm exec ts-node --transpile-only --prefer-ts-exts src/main.ts'
      HealthUrl = 'http://localhost:3001/control/health'
      Port = 3001
    },
    [pscustomobject]@{
      Name = 'admin'
      WorkingDirectory = (Join-Path $repoRoot 'apps\admin')
      Command = 'corepack pnpm exec vite --host 0.0.0.0 --port 5173'
      HealthUrl = 'http://localhost:5173/overview'
      Port = 5173
    }
  )
}

function Quote-LocalStackArgument {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Value
  )

  return '"' + ($Value -replace '"', '\"') + '"'
}

function Read-LocalStackState {
  $pidFile = Get-LocalStackPidFile

  if (-not (Test-Path $pidFile)) {
    return @()
  }

  $raw = Get-Content $pidFile -Raw

  if ([string]::IsNullOrWhiteSpace($raw)) {
    return @()
  }

  $parsed = ConvertFrom-Json $raw

  if ($parsed -is [System.Array]) {
    return @($parsed)
  }

  return @($parsed)
}

function Write-LocalStackState {
  param(
    [Parameter(Mandatory = $true)]
    [object[]]$Services
  )

  $pidFile = Get-LocalStackPidFile
  $Services | ConvertTo-Json -Depth 8 | Set-Content -Path $pidFile -Encoding UTF8
}

function Remove-LocalStackState {
  $pidFile = Get-LocalStackPidFile

  if (Test-Path $pidFile) {
    Remove-Item $pidFile -Force
  }
}

function Test-LocalStackPidRunning {
  param(
    [int]$PidValue
  )

  return $null -ne (Get-Process -Id $PidValue -ErrorAction SilentlyContinue)
}

function Get-LocalStackProtectedProcessIds {
  $protectedIds = [System.Collections.Generic.HashSet[int]]::new()
  $nextPid = $PID

  while ($nextPid -gt 0 -and -not $protectedIds.Contains($nextPid)) {
    $protectedIds.Add($nextPid) | Out-Null

    $processInfo = Get-CimInstance Win32_Process -Filter ("ProcessId = " + $nextPid) -ErrorAction SilentlyContinue

    if (-not $processInfo) {
      break
    }

    $nextPid = [int]$processInfo.ParentProcessId
  }

  return @($protectedIds)
}

function Get-ManagedLocalStackProcesses {
  $servicePorts = (Get-LocalStackServiceDefinitions).Port
  $protectedPids = Get-LocalStackProtectedProcessIds

  $portProcesses = @()

  foreach ($port in $servicePorts) {
    $listeners = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue

    foreach ($listener in $listeners) {
      $portProcesses += $listener.OwningProcess
    }
  }

  $portProcesses = $portProcesses | Sort-Object -Unique

  $matchedProcesses = @()

  foreach ($processInfo in (Get-CimInstance Win32_Process | Where-Object {
      -not ($protectedPids -contains $_.ProcessId) -and
      $_.Name -in @('node.exe', 'powershell.exe', 'cmd.exe')
    })) {
    $commandLine = $processInfo.CommandLine

    if (-not $commandLine) {
      continue
    }

    $matchesRunner = $commandLine -like '*run-local-service.ps1*'
    $matchesPortProcess = $portProcesses -contains $processInfo.ProcessId

    if ($matchesRunner -or $matchesPortProcess) {
      $matchedProcesses += [pscustomobject]@{
        ProcessId = $processInfo.ProcessId
        Name = $processInfo.Name
        CommandLine = $commandLine
      }
    }
  }

  return $matchedProcesses | Sort-Object ProcessId -Unique
}

function Stop-LocalStackProcesses {
  $stateServices = Read-LocalStackState
  $allPids = @()

  foreach ($service in $stateServices) {
    if ($service.PSObject.Properties.Match('Pid').Count -gt 0) {
      $allPids += [int]$service.Pid
    }
  }

  foreach ($managedProcess in (Get-ManagedLocalStackProcesses)) {
    $allPids += [int]$managedProcess.ProcessId
  }

  $allPids = $allPids | Sort-Object -Unique

  foreach ($pidValue in $allPids) {
    try {
      Stop-Process -Id $pidValue -Force -ErrorAction Stop
    }
    catch {
      continue
    }
  }

  Remove-LocalStackState
}

function Test-LocalStackPortAvailable {
  param(
    [int]$Port
  )

  $listeners = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
  return -not $listeners
}

function Wait-LocalStackHttpReady {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Url,

    [int]$TimeoutSeconds = 60
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5

      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        return $true
      }
    }
    catch {
      Start-Sleep -Milliseconds 750
      continue
    }

    Start-Sleep -Milliseconds 750
  }

  return $false
}

function Test-LocalStackHttpReady {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Url
  )

  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  }
  catch {
    return $false
  }
}

function Ensure-LocalStackDependencies {
  $repoRoot = Get-LocalStackRepoRoot

  if (-not (Test-Path (Join-Path $repoRoot 'node_modules'))) {
    Invoke-LocalStackCommand -WorkingDirectory $repoRoot -Command 'corepack pnpm install --frozen-lockfile'
  }
}

function Ensure-LocalStackDatabase {
  $repoRoot = Get-LocalStackRepoRoot

  Invoke-LocalStackCommand -WorkingDirectory $repoRoot -Command 'corepack pnpm --filter api prisma:generate'
  Invoke-LocalStackCommand -WorkingDirectory $repoRoot -Command 'corepack pnpm --filter load-control prisma:generate'
  Invoke-LocalStackCommand -WorkingDirectory $repoRoot -Command 'corepack pnpm --filter api prisma:migrate'
  Invoke-LocalStackCommand -WorkingDirectory $repoRoot -Command 'corepack pnpm --filter load-control prisma:migrate'
  Invoke-LocalStackCommand -WorkingDirectory (Join-Path $repoRoot 'apps\load-control') -Command ('corepack pnpm exec prisma db execute --schema prisma/schema.prisma --file "' + (Get-LocalStackSeedFile) + '"')
}

function Start-LocalStackManagedService {
  param(
    [Parameter(Mandatory = $true)]
    [pscustomobject]$Definition
  )

  $repoRoot = Get-LocalStackRepoRoot
  $logsRoot = Get-LocalStackLogsRoot
  $stdoutPath = Join-Path $logsRoot ($Definition.Name + '.out.log')
  $stderrPath = Join-Path $logsRoot ($Definition.Name + '.err.log')
  $runnerScript = Join-Path $repoRoot 'scripts\run-local-service.ps1'

  Remove-Item $stdoutPath, $stderrPath -Force -ErrorAction SilentlyContinue

  $argumentList = @(
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    (Quote-LocalStackArgument -Value $runnerScript),
    '-RepoRoot',
    (Quote-LocalStackArgument -Value $repoRoot),
    '-EnvFile',
    (Quote-LocalStackArgument -Value (Get-LocalStackEnvFile)),
    '-ServiceName',
    (Quote-LocalStackArgument -Value $Definition.Name)
  )

  $process = Start-Process `
    -FilePath 'powershell.exe' `
    -ArgumentList ($argumentList -join ' ') `
    -RedirectStandardOutput $stdoutPath `
    -RedirectStandardError $stderrPath `
    -PassThru

  return [pscustomobject]@{
    Name = $Definition.Name
    Pid = $process.Id
    Port = $Definition.Port
    HealthUrl = $Definition.HealthUrl
    StdoutPath = $stdoutPath
    StderrPath = $stderrPath
    WorkingDirectory = $Definition.WorkingDirectory
    Command = $Definition.Command
    StartedAt = (Get-Date).ToString('o')
  }
}

function Get-LocalStackStatusObject {
  Ensure-DockerPath
  $repoRoot = Get-LocalStackRepoRoot
  $stateServices = @{}

  foreach ($service in (Read-LocalStackState)) {
    $stateServices[$service.Name] = $service
  }

  $serviceStatuses = foreach ($definition in (Get-LocalStackServiceDefinitions)) {
    $state = $null

    if ($stateServices.ContainsKey($definition.Name)) {
      $state = $stateServices[$definition.Name]
    }

    [pscustomobject]@{
      Name = $definition.Name
      Port = $definition.Port
      HealthUrl = $definition.HealthUrl
      PortListening = (-not (Test-LocalStackPortAvailable -Port $definition.Port))
      Healthy = (Test-LocalStackHttpReady -Url $definition.HealthUrl)
      Pid = if ($state) { $state.Pid } else { $null }
      PidRunning = if ($state) { Test-LocalStackPidRunning -PidValue ([int]$state.Pid) } else { $false }
      StdoutPath = if ($state) { $state.StdoutPath } else { $null }
      StderrPath = if ($state) { $state.StderrPath } else { $null }
    }
  }

  $dockerAvailable = $null -ne (Get-Command docker -ErrorAction SilentlyContinue)
  $dockerReachable = $false

  if ($dockerAvailable) {
    try {
      docker info | Out-Null
      $dockerReachable = $true
    }
    catch {
      $dockerReachable = $false
    }
  }

  return [pscustomobject]@{
    RepoRoot = $repoRoot
    StateRoot = (Get-LocalStackStateRoot)
    LogsRoot = (Get-LocalStackLogsRoot)
    EnvFile = (Get-LocalStackEnvFile)
    DockerAvailable = $dockerAvailable
    DockerReachable = $dockerReachable
    Services = $serviceStatuses
  }
}
