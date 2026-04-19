import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

describe('repo layout', () => {
  it('declares the monorepo workspace and package scripts', () => {
    expect(existsSync('package.json')).toBe(true);
    expect(existsSync('pnpm-workspace.yaml')).toBe(true);
    expect(existsSync('tsconfig.base.json')).toBe(true);
    expect(existsSync('.gitignore')).toBe(true);
    expect(existsSync('.env.example')).toBe(true);
    expect(existsSync('docker-compose.yml')).toBe(true);
    expect(existsSync('apps/api/package.json')).toBe(true);
    expect(existsSync('apps/load-control/package.json')).toBe(true);
    expect(existsSync('apps/admin/package.json')).toBe(true);
    expect(existsSync('apps/miniapp/package.json')).toBe(true);
    expect(existsSync('apps/pit-game/package.json')).toBe(true);
    expect(existsSync('packages/contracts/package.json')).toBe(true);

    const rootPackage = readJson<{
      name: string;
      packageManager: string;
      scripts?: Record<string, string>;
    }>('package.json');

    expect(rootPackage.name).toBe('authorized-ticketing-platform');
    expect(rootPackage.packageManager).toMatch(/^pnpm@\d+\.\d+\.\d+$/);
    expect(rootPackage.scripts).toEqual(
      expect.objectContaining({
        'dev:api': expect.stringContaining('pnpm --filter api dev'),
        'dev:load-control': expect.stringContaining('pnpm --filter load-control dev'),
        'dev:admin': expect.stringContaining('pnpm --filter admin dev'),
        'dev:miniapp': expect.stringContaining('pnpm --filter miniapp dev:weapp'),
        'dev:pit-game': expect.stringContaining('pnpm --filter pit-game dev'),
        lint: expect.stringContaining('eslint tests'),
      }),
    );
    expect(rootPackage.scripts?.test).toContain('pnpm --filter load-control test');
    expect(rootPackage.scripts?.test).toContain('pnpm --filter load-control test:e2e');
    expect(rootPackage.scripts?.test).toContain('pnpm --filter pit-game test');
    expect(rootPackage.scripts?.test).toContain(
      'pnpm exec vitest run tests/perf/load-testing-fixtures.spec.ts',
    );
    expect(rootPackage.scripts?.test).toContain('@ticketing/contracts');
    expect(rootPackage.scripts?.test).toContain('tests/workspace/repo-layout.spec.ts');

    expect(readJson<{ scripts: Record<string, string> }>('apps/load-control/package.json').scripts).toEqual({
      dev: 'nest start --watch',
      'dev:agent': 'ts-node src/agent/main.ts',
      test: 'jest',
      'test:e2e': 'jest --config test/jest-e2e.json',
      lint: 'eslint src test --ext .ts',
    });

    const tsconfig = readJson<{
      compilerOptions: {
        target: string;
        module: string;
        moduleResolution: string;
        strict: boolean;
        skipLibCheck: boolean;
        resolveJsonModule: boolean;
        esModuleInterop: boolean;
        forceConsistentCasingInFileNames: boolean;
        baseUrl: string;
      };
    }>('tsconfig.base.json');

    expect(tsconfig.compilerOptions).toEqual({
      target: 'ES2022',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      strict: true,
      skipLibCheck: true,
      resolveJsonModule: true,
      esModuleInterop: true,
      forceConsistentCasingInFileNames: true,
      baseUrl: '.',
    });

    expect(readJson<{ scripts: Record<string, string> }>('apps/api/package.json').scripts).toEqual({
      dev: 'nest start --watch',
      test: 'jest',
      'test:e2e': 'jest --config test/jest-e2e.json',
      'prisma:generate': 'prisma generate',
      'prisma:migrate': 'prisma migrate dev',
      lint: 'eslint src --ext .ts',
    });

    expect(readJson<{ scripts: Record<string, string> }>('apps/admin/package.json').scripts).toEqual({
      dev: 'vite',
      build: 'tsc -b && vite build',
      test: 'vitest run',
      lint: 'eslint src --ext .ts,.tsx',
    });

    expect(readJson<{ scripts: Record<string, string> }>('apps/pit-game/package.json').scripts).toEqual({
      dev: 'vite',
      build: 'tsc -b && vite build',
      test: 'vitest run',
      lint: 'eslint src --ext .ts,.tsx',
    });

    expect(readJson<{ scripts: Record<string, string> }>('apps/miniapp/package.json').scripts).toEqual({
      'dev:weapp': 'taro build --type weapp --watch',
      'build:weapp': 'taro build --type weapp',
      test: 'vitest run',
      lint: 'eslint src --ext .ts,.tsx',
    });

    expect(readJson<{ scripts: Record<string, string> }>('packages/contracts/package.json').scripts).toEqual({
      test: 'vitest run',
      lint: 'eslint src --ext .ts',
    });

    const workspace = readFileSync('pnpm-workspace.yaml', 'utf8');
    expect(workspace).toContain('apps/*');
    expect(workspace).toContain('packages/*');
    expect(workspace).toContain('tests/*');
  });
});
