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
    expect(
      existsSync(
        'docs/superpowers/guides/2026-04-18-load-testing-saas-operator-guide.md',
      ),
    ).toBe(true);
    expect(existsSync('apps/api/package.json')).toBe(true);
    expect(
      existsSync(
        'apps/api/prisma/migrations/20260420162419_init_local/migration.sql',
      ),
    ).toBe(true);
    expect(existsSync('apps/load-control/package.json')).toBe(true);
    expect(existsSync('apps/load-control/prisma/schema.prisma')).toBe(true);
    expect(existsSync('apps/admin/package.json')).toBe(true);
    expect(existsSync('apps/miniapp/package.json')).toBe(false);
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
        postinstall: expect.stringContaining('pnpm --filter load-control prisma:generate'),
        'dev:api': expect.stringContaining('pnpm --filter api dev'),
        'dev:load-control': expect.stringContaining('pnpm --filter load-control dev'),
        'dev:admin': expect.stringContaining('pnpm --filter admin dev'),
        lint: expect.stringContaining('eslint tests'),
      }),
    );
    expect(rootPackage.scripts).not.toHaveProperty('dev:miniapp');
    expect(rootPackage.scripts?.postinstall).toContain('pnpm --filter api prisma:generate');
    expect(rootPackage.scripts?.test).toContain('pnpm --filter load-control test');
    expect(rootPackage.scripts?.test).toContain('pnpm --filter load-control test:e2e');
    expect(rootPackage.scripts?.test).toContain('pnpm --filter admin test');
    expect(rootPackage.scripts?.test).toContain('pnpm --filter api prisma:generate');
    expect(rootPackage.scripts?.test).toContain(
      'pnpm --filter load-control prisma:generate',
    );
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
      'prisma:generate': 'prisma generate --schema prisma/schema.prisma',
      'prisma:migrate': 'prisma migrate dev --schema prisma/schema.prisma',
      lint: 'eslint src test --ext .ts',
    });
    expect(
      readJson<{ dependencies: Record<string, string> }>('apps/load-control/package.json').dependencies,
    ).toEqual(
      expect.objectContaining({
        ioredis: expect.any(String),
      }),
    );

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

    expect(readJson<{ scripts: Record<string, string> }>('packages/contracts/package.json').scripts).toEqual({
      test: 'vitest run',
      lint: 'eslint src --ext .ts',
    });

    const workspace = readFileSync('pnpm-workspace.yaml', 'utf8');
    expect(workspace).toContain('apps/*');
    expect(workspace).toContain('packages/*');
    expect(workspace).toContain('tests/*');

    const apiInitLocalMigration = readFileSync(
      'apps/api/prisma/migrations/20260420162419_init_local/migration.sql',
      'utf8',
    );
    expect(apiInitLocalMigration).toContain('CREATE TABLE "CustomerAccount"');
    expect(apiInitLocalMigration).toContain('"wechatOpenId" TEXT NOT NULL');
    expect(apiInitLocalMigration).toContain('CREATE TABLE "CustomerSession"');
    expect(apiInitLocalMigration).toContain('ALTER TABLE "Event"');
    expect(apiInitLocalMigration).toContain('ADD COLUMN "published"');
    expect(apiInitLocalMigration).toContain('ADD COLUMN "refundEntryEnabled"');
  });
});
