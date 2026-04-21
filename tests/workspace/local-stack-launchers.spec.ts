import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';

describe('local stack launchers', () => {
  it('provides double-click launchers and matching PowerShell scripts', () => {
    expect(existsSync('start-local-stack.cmd')).toBe(true);
    expect(existsSync('stop-local-stack.cmd')).toBe(true);
    expect(existsSync('status-local-stack.cmd')).toBe(true);

    expect(existsSync('scripts/start-local-stack.ps1')).toBe(true);
    expect(existsSync('scripts/stop-local-stack.ps1')).toBe(true);
    expect(existsSync('scripts/status-local-stack.ps1')).toBe(true);
  });

  it('documents the local stack launcher workflow in the operator guide', () => {
    const guidePath =
      'docs/superpowers/guides/2026-04-18-load-testing-saas-operator-guide.md';

    expect(existsSync(guidePath)).toBe(true);

    const guide = readFileSync(guidePath, 'utf8');

    expect(guide).toContain('start-local-stack.cmd');
    expect(guide).toContain('stop-local-stack.cmd');
    expect(guide).toContain('status-local-stack.cmd');
    expect(guide).toContain('.codex-temp/local-stack');
  });

  it('clears load-control redis cache after reseeding the local stack database', () => {
    const scriptPath = 'scripts/local-stack.common.ps1';
    const script = readFileSync(scriptPath, 'utf8');
    const ensureDatabaseIndex = script.indexOf('function Ensure-LocalStackDatabase');
    const nextFunctionIndex = script.indexOf(
      'function Start-LocalStackManagedService',
    );
    const ensureDatabaseBlock = script.slice(
      ensureDatabaseIndex,
      nextFunctionIndex,
    );

    expect(script).toContain('function Clear-LocalStackRedisCache');
    expect(script).toContain('load-control:*');
    expect(ensureDatabaseBlock).toContain('Clear-LocalStackRedisCache');
  });

  it('resets load-control runtime tables before reseeding the local demo run', () => {
    const seedScript = readFileSync(
      'scripts/sql/seed-load-control-local.sql',
      'utf8',
    );

    expect(seedScript).toContain('TRUNCATE TABLE');
    expect(seedScript).toContain('load_control."LoadControlTelemetrySample"');
    expect(seedScript).toContain('load_control."LoadControlSummary"');
    expect(seedScript).toContain('load_control."LoadControlAssignment"');
    expect(seedScript).toContain('load_control."LoadControlNode"');
    expect(seedScript).toContain('load_control."LoadControlRun"');
  });

  it('seeds API demo data for local end-to-end probes', () => {
    expect(existsSync('scripts/sql/seed-api-local.sql')).toBe(true);

    const script = readFileSync('scripts/local-stack.common.ps1', 'utf8');
    const ensureDatabaseIndex = script.indexOf('function Ensure-LocalStackDatabase');
    const nextFunctionIndex = script.indexOf(
      'function Start-LocalStackManagedService',
    );
    const ensureDatabaseBlock = script.slice(
      ensureDatabaseIndex,
      nextFunctionIndex,
    );
    const apiSeedScript = readFileSync('scripts/sql/seed-api-local.sql', 'utf8');

    expect(script).toContain('function Get-LocalStackApiSeedFile');
    expect(ensureDatabaseBlock).toContain('Get-LocalStackApiSeedFile');
    expect(apiSeedScript).toContain('INSERT INTO "Event"');
    expect(apiSeedScript).toContain('"published"');
    expect(apiSeedScript).toContain('INSERT INTO "TicketTier"');
  });

  it('uses non-interactive Prisma deploy commands in the local stack bootstrap', () => {
    const script = readFileSync('scripts/local-stack.common.ps1', 'utf8');
    const ensureDatabaseIndex = script.indexOf('function Ensure-LocalStackDatabase');
    const nextFunctionIndex = script.indexOf(
      'function Start-LocalStackManagedService',
    );
    const ensureDatabaseBlock = script.slice(
      ensureDatabaseIndex,
      nextFunctionIndex,
    );

    expect(ensureDatabaseBlock).toContain('prisma migrate deploy');
    expect(ensureDatabaseBlock).not.toContain('prisma:migrate');
  });

  it('waits for postgres and redis before bootstrapping the local database', () => {
    const commonScript = readFileSync('scripts/local-stack.common.ps1', 'utf8');
    const startScript = readFileSync('scripts/start-local-stack.ps1', 'utf8');
    const waitCallIndex = startScript.indexOf('Wait-LocalStackInfrastructureReady');
    const ensureDatabaseIndex = startScript.indexOf('Ensure-LocalStackDatabase');

    expect(commonScript).toContain('function Wait-LocalStackInfrastructureReady');
    expect(commonScript).toContain('pg_isready -U postgres -d ticketing');
    expect(commonScript).toContain('redis-cli PING');
    expect(waitCallIndex).toBeGreaterThanOrEqual(0);
    expect(ensureDatabaseIndex).toBeGreaterThan(waitCallIndex);
  });

  it('backfills missing local stack env keys from .env.example', () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'local-stack-env-'));
    const scriptsDir = join(tempRoot, 'scripts');
    const copiedScriptPath = join(scriptsDir, 'local-stack.common.ps1');

    mkdirSync(scriptsDir, { recursive: true });
    copyFileSync('scripts/local-stack.common.ps1', copiedScriptPath);
    writeFileSync(join(tempRoot, '.env.example'), 'FOO=from-example\nBAR=from-example\n');
    writeFileSync(join(tempRoot, '.env'), 'FOO=from-env\n');

    try {
      const result = spawnSync(
        'powershell.exe',
        [
          '-NoProfile',
          '-ExecutionPolicy',
          'Bypass',
          '-Command',
          `& { . '${copiedScriptPath}'; $path = Ensure-LocalStackEnvFile; Get-Content $path -Raw }`,
        ],
        {
          cwd: process.cwd(),
          encoding: 'utf8',
        },
      );

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('FOO=from-env');
      expect(result.stdout).toContain('BAR=from-example');
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('fails fast when a local stack bootstrap command exits non-zero', () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'local-stack-command-'));
    const scriptsDir = join(tempRoot, 'scripts');
    const copiedScriptPath = join(scriptsDir, 'local-stack.common.ps1');

    mkdirSync(scriptsDir, { recursive: true });
    copyFileSync('scripts/local-stack.common.ps1', copiedScriptPath);
    writeFileSync(join(tempRoot, '.env.example'), 'FOO=from-example\n');
    writeFileSync(join(tempRoot, '.env'), 'FOO=from-env\n');

    try {
      const result = spawnSync(
        'powershell.exe',
        [
          '-NoProfile',
          '-ExecutionPolicy',
          'Bypass',
          '-Command',
          `& { . '${copiedScriptPath}'; try { Invoke-LocalStackCommand -WorkingDirectory '${tempRoot}' -Command 'cmd.exe /c exit 7'; Write-Output 'unexpected success'; exit 0 } catch { Write-Output $_.Exception.Message; exit 7 } }`,
        ],
        {
          cwd: process.cwd(),
          encoding: 'utf8',
        },
      );

      expect(result.status).toBe(7);
      expect(result.stdout).toContain('Command failed with exit code 7');
      expect(result.stdout).toContain('cmd.exe /c exit 7');
      expect(result.stdout).not.toContain('unexpected success');
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('lets the stop launcher exit cleanly when invoked through cmd', () => {
    const result = spawnSync('cmd.exe', ['/c', 'stop-local-stack.cmd'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Local stack processes stopped.');
    expect(result.stderr).not.toContain('ERROR:');
    expect(result.stderr).not.toContain('is not recognized');
  });
});
