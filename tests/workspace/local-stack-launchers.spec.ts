import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
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
