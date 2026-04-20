param(
  [Parameter(Mandatory = $true)]
  [string]$RepoRoot,

  [Parameter(Mandatory = $true)]
  [string]$EnvFile,

  [Parameter(Mandatory = $true)]
  [string]$ServiceName
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $RepoRoot 'scripts\local-stack.common.ps1')

Get-Content $EnvFile | ForEach-Object {
  if ($_ -match '^\s*([^#=]+)=(.*)$') {
    [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
  }
}

[Environment]::SetEnvironmentVariable('LOCAL_STACK_REPO_ROOT', $RepoRoot, 'Process')
[Environment]::SetEnvironmentVariable('LOCAL_STACK_SERVICE_NAME', $ServiceName, 'Process')

$definition = Get-LocalStackServiceDefinitions | Where-Object {
  $_.Name -eq $ServiceName
} | Select-Object -First 1

if (-not $definition) {
  throw "Unknown local stack service: $ServiceName"
}

Push-Location $definition.WorkingDirectory

try {
  Invoke-Expression $definition.Command
}
finally {
  Pop-Location
}
