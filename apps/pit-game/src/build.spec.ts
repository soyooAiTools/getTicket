import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ts from 'typescript';
import { expect, it } from 'vitest';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const configPath = join(appRoot, 'tsconfig.json');
const viteConfigPath = join(appRoot, 'vite.config.ts');

it('type-checks the pit-game app and Vite config', () => {
  const parsed = ts.getParsedCommandLineOfConfigFile(
    configPath,
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: diagnostic => {
        throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
      },
    },
  );

  expect(parsed).not.toBeUndefined();
  if (!parsed) {
    return;
  }

  const program = ts.createProgram({
    rootNames: [...parsed.fileNames, viteConfigPath],
    options: parsed.options,
  });

  const diagnostics = ts.getPreEmitDiagnostics(program);
  const formattedDiagnostics = diagnostics.map(diagnostic =>
    ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
  );

  expect(formattedDiagnostics).toEqual([]);
});
