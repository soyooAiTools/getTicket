# Unity URP CLI Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a copy-paste Unity URP CLI bridge scaffold with a Node-based external CLI, a Unity Editor-side action dispatcher, structured request/result files, no-GUI verification loops, and first-version command groups including bootstrap-aware Luna support.

**Architecture:** Keep the deliverable under `tools/unity-urp-cli-bridge/` with three concrete artifacts: `template/` as the Unity-side source of truth, `cli/` as the external command wrapper, and `fixtures/UrpSmokeProject/` as a minimal URP test harness that receives the template through a sync script. The CLI writes request/result JSON, launches Unity in `-batchmode`, or runs Luna Jake tasks, while the Unity template routes actions to focused handlers and returns structured verification data.

**Tech Stack:** TypeScript, Commander, Vitest, PowerShell, C#, Unity Editor API, NUnit, Unity Test Framework, Unity URP, Unity Playworks/Luna Jake tasks

---

## Proposed File Structure

- `tests/workspace/unity-cli-bridge-layout.spec.ts`
  Responsibility: guard the repository-level scaffold layout so later tasks can rely on exact paths.
- `tools/unity-urp-cli-bridge/README.md`
  Responsibility: explain scaffold contents, install flow, bootstrap requirements, and command examples.
- `tools/unity-urp-cli-bridge/scripts/sync-fixture.ps1`
  Responsibility: copy the Unity template into the fixture project for EditMode tests.
- `tools/unity-urp-cli-bridge/scripts/run-editmode-tests.ps1`
  Responsibility: run Unity EditMode tests against the fixture project with a stable command surface.
- `tools/unity-urp-cli-bridge/scripts/install-template.ps1`
  Responsibility: copy the scaffold template into an arbitrary target Unity URP project.
- `tools/unity-urp-cli-bridge/cli/package.json`
  Responsibility: define the standalone CLI package and its local scripts.
- `tools/unity-urp-cli-bridge/cli/tsconfig.json`
  Responsibility: compile the CLI source consistently.
- `tools/unity-urp-cli-bridge/cli/vitest.config.ts`
  Responsibility: provide isolated test discovery for the CLI package.
- `tools/unity-urp-cli-bridge/cli/src/index.ts`
  Responsibility: register all top-level command groups and wire process exit behavior.
- `tools/unity-urp-cli-bridge/cli/src/core/request.ts`
  Responsibility: build and persist request JSON files.
- `tools/unity-urp-cli-bridge/cli/src/core/result.ts`
  Responsibility: load, validate, and format Unity result JSON.
- `tools/unity-urp-cli-bridge/cli/src/core/unity-process.ts`
  Responsibility: launch Unity in batchmode with request/result file arguments.
- `tools/unity-urp-cli-bridge/cli/src/core/luna-process.ts`
  Responsibility: run Luna/Playworks Jake tasks and normalize their outputs.
- `tools/unity-urp-cli-bridge/cli/src/commands/*.ts`
  Responsibility: convert subcommands into request payloads or Luna task invocations.
- `tools/unity-urp-cli-bridge/cli/tests/core/*.spec.ts`
  Responsibility: unit-test request/result handling and process command construction.
- `tools/unity-urp-cli-bridge/cli/tests/commands/*.spec.ts`
  Responsibility: lock down subcommand-to-action mappings and option parsing.
- `tools/unity-urp-cli-bridge/template/Assets/Editor/UnityCliBridge/Entry/CliEntryPoint.cs`
  Responsibility: the single Unity batchmode entry point.
- `tools/unity-urp-cli-bridge/template/Assets/Editor/UnityCliBridge/Core/*.cs`
  Responsibility: shared request/result models, argument parsing, and action dispatch.
- `tools/unity-urp-cli-bridge/template/Assets/Editor/UnityCliBridge/Actions/*.cs`
  Responsibility: implement each command group as a focused handler.
- `tools/unity-urp-cli-bridge/template/Assets/Editor/UnityCliBridge/Services/*.cs`
  Responsibility: verification, asset queries, compile status, URP checks, and Luna prerequisites.
- `tools/unity-urp-cli-bridge/fixtures/UrpSmokeProject/Packages/manifest.json`
  Responsibility: pin the fixture to URP and the Unity Test Framework.
- `tools/unity-urp-cli-bridge/fixtures/UrpSmokeProject/ProjectSettings/ProjectVersion.txt`
  Responsibility: keep the fixture on a known Unity line.
- `tools/unity-urp-cli-bridge/fixtures/UrpSmokeProject/Assets/Tests/Editor/UnityCliBridge/*.cs`
  Responsibility: EditMode coverage for dispatcher, action handlers, and Luna bootstrap checks.

### Task 1: Establish The Scaffold Workspace And Fixture Harness

**Files:**
- Create: `tests/workspace/unity-cli-bridge-layout.spec.ts`
- Create: `tools/unity-urp-cli-bridge/README.md`
- Create: `tools/unity-urp-cli-bridge/scripts/sync-fixture.ps1`
- Create: `tools/unity-urp-cli-bridge/scripts/run-editmode-tests.ps1`
- Create: `tools/unity-urp-cli-bridge/cli/package.json`
- Create: `tools/unity-urp-cli-bridge/cli/tsconfig.json`
- Create: `tools/unity-urp-cli-bridge/cli/vitest.config.ts`
- Create: `tools/unity-urp-cli-bridge/fixtures/UrpSmokeProject/Packages/manifest.json`
- Create: `tools/unity-urp-cli-bridge/fixtures/UrpSmokeProject/ProjectSettings/ProjectVersion.txt`
- Test: `tests/workspace/unity-cli-bridge-layout.spec.ts`

- [ ] **Step 1: Write the failing workspace layout test**

```ts
// tests/workspace/unity-cli-bridge-layout.spec.ts
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const requiredPaths = [
  'tools/unity-urp-cli-bridge/README.md',
  'tools/unity-urp-cli-bridge/scripts/sync-fixture.ps1',
  'tools/unity-urp-cli-bridge/scripts/run-editmode-tests.ps1',
  'tools/unity-urp-cli-bridge/cli/package.json',
  'tools/unity-urp-cli-bridge/cli/tsconfig.json',
  'tools/unity-urp-cli-bridge/cli/vitest.config.ts',
  'tools/unity-urp-cli-bridge/fixtures/UrpSmokeProject/Packages/manifest.json',
  'tools/unity-urp-cli-bridge/fixtures/UrpSmokeProject/ProjectSettings/ProjectVersion.txt',
];

describe('unity urp cli bridge layout', () => {
  it('creates the expected scaffold workspace skeleton', () => {
    for (const file of requiredPaths) {
      expect(existsSync(file), `${file} should exist`).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run the layout test to confirm the scaffold is missing**

Run: `corepack pnpm exec vitest run tests/workspace/unity-cli-bridge-layout.spec.ts`

Expected: FAIL with one or more "`should exist`" assertions.

- [ ] **Step 3: Create the scaffold skeleton, fixture metadata, and helper scripts**

```md
<!-- tools/unity-urp-cli-bridge/README.md -->
# Unity URP CLI Bridge

This directory contains:

- `template/`: Unity-side files copied into a target Unity URP project
- `cli/`: the external command-line wrapper
- `fixtures/UrpSmokeProject/`: a minimal URP project used for EditMode verification
- `scripts/`: helper scripts for syncing the fixture and running tests
```

```powershell
# tools/unity-urp-cli-bridge/scripts/sync-fixture.ps1
$templateRoot = Join-Path $PSScriptRoot '..\template'
$fixtureRoot = Join-Path $PSScriptRoot '..\fixtures\UrpSmokeProject'
$source = Join-Path $templateRoot 'Assets\Editor\UnityCliBridge'
$destination = Join-Path $fixtureRoot 'Assets\Editor\UnityCliBridge'

if (Test-Path $destination) {
  Remove-Item $destination -Recurse -Force
}

New-Item -ItemType Directory -Force -Path (Split-Path $destination) | Out-Null
Copy-Item $source $destination -Recurse -Force
```

```powershell
# tools/unity-urp-cli-bridge/scripts/run-editmode-tests.ps1
param(
  [string]$ProjectPath = (Resolve-Path (Join-Path $PSScriptRoot '..\fixtures\UrpSmokeProject')).Path,
  [string]$Filter = '',
  [string]$ArtifactsDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path + '\artifacts'
)

if (-not $env:UNITY_EDITOR_PATH) {
  throw 'UNITY_EDITOR_PATH is required'
}

New-Item -ItemType Directory -Force -Path $ArtifactsDir | Out-Null

$args = @(
  '-batchmode',
  '-projectPath', $ProjectPath,
  '-runTests',
  '-testPlatform', 'EditMode',
  '-testResults', (Join-Path $ArtifactsDir 'editmode-results.xml'),
  '-logFile', (Join-Path $ArtifactsDir 'editmode.log'),
  '-quit'
)

if ($Filter) {
  $args += @('-testFilter', $Filter)
}

& $env:UNITY_EDITOR_PATH @args
exit $LASTEXITCODE
```

```json
// tools/unity-urp-cli-bridge/cli/package.json
{
  "name": "unity-urp-cli-bridge",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run"
  },
  "dependencies": {
    "commander": "^13.1.0"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "vitest": "^2.1.5"
  }
}
```

```json
// tools/unity-urp-cli-bridge/cli/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true
  },
  "include": ["src", "tests"]
}
```

```ts
// tools/unity-urp-cli-bridge/cli/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.spec.ts'],
  },
});
```

```json
// tools/unity-urp-cli-bridge/fixtures/UrpSmokeProject/Packages/manifest.json
{
  "dependencies": {
    "com.unity.render-pipelines.universal": "17.0.3",
    "com.unity.test-framework": "1.5.1"
  }
}
```

```text
// tools/unity-urp-cli-bridge/fixtures/UrpSmokeProject/ProjectSettings/ProjectVersion.txt
m_EditorVersion: 6000.0.43f1
```

- [ ] **Step 4: Re-run the layout test**

Run: `corepack pnpm exec vitest run tests/workspace/unity-cli-bridge-layout.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit the scaffold skeleton**

```bash
git add tests/workspace/unity-cli-bridge-layout.spec.ts tools/unity-urp-cli-bridge
git commit -m "chore: scaffold unity urp cli bridge workspace"
```

### Task 2: Implement The External CLI Request And Process Core

**Files:**
- Create: `tools/unity-urp-cli-bridge/cli/src/core/request.ts`
- Create: `tools/unity-urp-cli-bridge/cli/src/core/result.ts`
- Create: `tools/unity-urp-cli-bridge/cli/src/core/unity-process.ts`
- Create: `tools/unity-urp-cli-bridge/cli/src/index.ts`
- Create: `tools/unity-urp-cli-bridge/cli/tests/core/request-runner.spec.ts`
- Test: `tools/unity-urp-cli-bridge/cli/tests/core/request-runner.spec.ts`

- [ ] **Step 1: Write the failing CLI core tests**

```ts
// tools/unity-urp-cli-bridge/cli/tests/core/request-runner.spec.ts
import { describe, expect, it } from 'vitest';
import { buildRequestFilePair, createCliRequest } from '../../src/core/request';
import { buildUnityInvocation } from '../../src/core/unity-process';

describe('cli request core', () => {
  it('creates a versioned request payload', () => {
    const request = createCliRequest('material.set-color', {
      assetPath: 'Assets/Materials/Player.mat',
      property: '_BaseColor',
      value: '#FFFFFFFF',
    });

    expect(request.version).toBe('1');
    expect(request.action).toBe('material.set-color');
    expect(request.options.verify).toBe(true);
  });

  it('creates paired request/result file paths', () => {
    const pair = buildRequestFilePair('D:/tmp/unity-cli');

    expect(pair.requestFile.endsWith('.request.json')).toBe(true);
    expect(pair.resultFile.endsWith('.result.json')).toBe(true);
  });

  it('builds a Unity batchmode invocation with request/result files', () => {
    const invocation = buildUnityInvocation({
      unityEditorPath: 'C:/Unity/Editor/Unity.exe',
      projectPath: 'D:/Projects/Game',
      executeMethod: 'UnityCliBridge.Entry.CliEntryPoint.Run',
      requestFile: 'D:/tmp/run.request.json',
      resultFile: 'D:/tmp/run.result.json',
    });

    expect(invocation.command).toBe('C:/Unity/Editor/Unity.exe');
    expect(invocation.args).toContain('-batchmode');
    expect(invocation.args).toContain('--cli-request-file');
    expect(invocation.args).toContain('D:/tmp/run.result.json');
  });
});
```

- [ ] **Step 2: Run the CLI core tests to watch them fail**

Run: `corepack pnpm --dir tools/unity-urp-cli-bridge/cli exec vitest run tests/core/request-runner.spec.ts`

Expected: FAIL with missing module errors for `request` and `unity-process`.

- [ ] **Step 3: Implement the request/result helpers and Unity process builder**

```ts
// tools/unity-urp-cli-bridge/cli/src/core/request.ts
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export type CliRequest = {
  version: '1';
  action: string;
  args: Record<string, unknown>;
  options: {
    verify: boolean;
    refreshAssets: boolean;
    awaitCompile: boolean;
  };
  context: {
    correlationId: string;
  };
};

export function createCliRequest(
  action: string,
  args: Record<string, unknown>,
): CliRequest {
  return {
    version: '1',
    action,
    args,
    options: {
      verify: true,
      refreshAssets: true,
      awaitCompile: false,
    },
    context: {
      correlationId: randomUUID(),
    },
  };
}

export function buildRequestFilePair(tempRoot: string) {
  mkdirSync(tempRoot, { recursive: true });
  const correlationId = randomUUID();

  return {
    requestFile: join(tempRoot, `${correlationId}.request.json`),
    resultFile: join(tempRoot, `${correlationId}.result.json`),
  };
}
```

```ts
// tools/unity-urp-cli-bridge/cli/src/core/result.ts
export type CliResult = {
  ok: boolean;
  action: string;
  code: string;
  summary: string;
  data?: Record<string, unknown>;
  errors?: string[];
  warnings?: string[];
};
```

```ts
// tools/unity-urp-cli-bridge/cli/src/core/unity-process.ts
export type UnityInvocationInput = {
  unityEditorPath: string;
  projectPath: string;
  executeMethod: string;
  requestFile: string;
  resultFile: string;
};

export function buildUnityInvocation(input: UnityInvocationInput) {
  return {
    command: input.unityEditorPath,
    args: [
      '-batchmode',
      '-projectPath',
      input.projectPath,
      '-executeMethod',
      input.executeMethod,
      '--cli-request-file',
      input.requestFile,
      '--cli-result-file',
      input.resultFile,
      '-quit',
    ],
  };
}
```

```ts
// tools/unity-urp-cli-bridge/cli/src/index.ts
export { createCliRequest, buildRequestFilePair } from './core/request';
export { buildUnityInvocation } from './core/unity-process';
```

- [ ] **Step 4: Re-run the CLI core tests**

Run: `corepack pnpm --dir tools/unity-urp-cli-bridge/cli exec vitest run tests/core/request-runner.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit the external CLI core**

```bash
git add tools/unity-urp-cli-bridge/cli
git commit -m "feat: add unity cli request and process core"
```

### Task 3: Implement The Unity Entry Point, Models, And Dispatcher

**Files:**
- Create: `tools/unity-urp-cli-bridge/template/Assets/Editor/UnityCliBridge/Entry/CliEntryPoint.cs`
- Create: `tools/unity-urp-cli-bridge/template/Assets/Editor/UnityCliBridge/Core/CliRequest.cs`
- Create: `tools/unity-urp-cli-bridge/template/Assets/Editor/UnityCliBridge/Core/CliResult.cs`
- Create: `tools/unity-urp-cli-bridge/template/Assets/Editor/UnityCliBridge/Core/ArgumentReader.cs`
- Create: `tools/unity-urp-cli-bridge/template/Assets/Editor/UnityCliBridge/Core/ActionDispatcher.cs`
- Create: `tools/unity-urp-cli-bridge/fixtures/UrpSmokeProject/Assets/Tests/Editor/UnityCliBridge/Core/ActionDispatcherTests.cs`
- Modify: `tools/unity-urp-cli-bridge/scripts/sync-fixture.ps1`
- Test: `UnityCliBridge.Core`

- [ ] **Step 1: Write the failing EditMode dispatcher tests**

```csharp
// tools/unity-urp-cli-bridge/fixtures/UrpSmokeProject/Assets/Tests/Editor/UnityCliBridge/Core/ActionDispatcherTests.cs
using NUnit.Framework;

namespace UnityCliBridge.Tests.Core
{
    public class ActionDispatcherTests
    {
        [Test]
        public void Dispatch_Returns_Action_Not_Found_For_Unknown_Action()
        {
            var request = new CliRequest
            {
                version = "1",
                action = "missing.action"
            };

            var result = ActionDispatcher.Dispatch(request);

            Assert.That(result.ok, Is.False);
            Assert.That(result.code, Is.EqualTo("ACTION_NOT_FOUND"));
        }

        [Test]
        public void ArgumentReader_Reads_Request_And_Result_Paths()
        {
            var args = new[]
            {
                "--cli-request-file", "D:/tmp/request.json",
                "--cli-result-file", "D:/tmp/result.json"
            };

            var parsed = ArgumentReader.Parse(args);

            Assert.That(parsed.RequestFile, Is.EqualTo("D:/tmp/request.json"));
            Assert.That(parsed.ResultFile, Is.EqualTo("D:/tmp/result.json"));
        }
    }
}
```

- [ ] **Step 2: Run the Unity EditMode tests and verify the failure**

Run: `powershell -ExecutionPolicy Bypass -File tools/unity-urp-cli-bridge/scripts/run-editmode-tests.ps1 -Filter UnityCliBridge.Tests.Core`

Expected: FAIL with compiler or missing-type errors for `CliRequest`, `ArgumentReader`, or `ActionDispatcher`.

- [ ] **Step 3: Implement the Unity core entry, models, and dispatcher**

```csharp
// tools/unity-urp-cli-bridge/template/Assets/Editor/UnityCliBridge/Core/CliRequest.cs
using System;
using System.Collections.Generic;

[Serializable]
public class CliRequest
{
    public string version = "1";
    public string action = string.Empty;
    public SerializableDictionary args = new();
}

[Serializable]
public class SerializableDictionary : Dictionary<string, string> {}
```

```csharp
// tools/unity-urp-cli-bridge/template/Assets/Editor/UnityCliBridge/Core/CliResult.cs
using System;
using System.Collections.Generic;

[Serializable]
public class CliResult
{
    public bool ok;
    public string action = string.Empty;
    public string code = string.Empty;
    public string summary = string.Empty;
    public List<string> errors = new();
    public List<string> warnings = new();

    public static CliResult Fail(string action, string code, string summary)
    {
        return new CliResult
        {
            ok = false,
            action = action,
            code = code,
            summary = summary,
        };
    }
}
```

```csharp
// tools/unity-urp-cli-bridge/template/Assets/Editor/UnityCliBridge/Core/ArgumentReader.cs
public static class ArgumentReader
{
    public readonly struct ParsedArguments
    {
        public ParsedArguments(string requestFile, string resultFile)
        {
            RequestFile = requestFile;
            ResultFile = resultFile;
        }

        public string RequestFile { get; }
        public string ResultFile { get; }
    }

    public static ParsedArguments Parse(string[] args)
    {
        string requestFile = string.Empty;
        string resultFile = string.Empty;

        for (var i = 0; i < args.Length - 1; i++)
        {
            if (args[i] == "--cli-request-file") requestFile = args[i + 1];
            if (args[i] == "--cli-result-file") resultFile = args[i + 1];
        }

        return new ParsedArguments(requestFile, resultFile);
    }
}
```

```csharp
// tools/unity-urp-cli-bridge/template/Assets/Editor/UnityCliBridge/Core/ActionDispatcher.cs
public static class ActionDispatcher
{
    public static CliResult Dispatch(CliRequest request)
    {
        return request.action switch
        {
            "health.ping" => new CliResult
            {
                ok = true,
                action = request.action,
                code = "OK",
                summary = "Bridge is reachable"
            },
            _ => CliResult.Fail(request.action, "ACTION_NOT_FOUND", $"Unknown action: {request.action}")
        };
    }
}
```

```csharp
// tools/unity-urp-cli-bridge/template/Assets/Editor/UnityCliBridge/Entry/CliEntryPoint.cs
using System.IO;
using UnityEditor;
using UnityEngine;

public static class CliEntryPoint
{
    public static void Run()
    {
        var parsed = ArgumentReader.Parse(System.Environment.GetCommandLineArgs());
        var requestJson = File.ReadAllText(parsed.RequestFile);
        var request = JsonUtility.FromJson<CliRequest>(requestJson);
        var result = ActionDispatcher.Dispatch(request);
        File.WriteAllText(parsed.ResultFile, JsonUtility.ToJson(result, true));
        AssetDatabase.SaveAssets();
    }
}
```

```powershell
# tools/unity-urp-cli-bridge/scripts/sync-fixture.ps1
New-Item -ItemType Directory -Force -Path (Join-Path $fixtureRoot 'Assets\Tests\Editor\UnityCliBridge\Core') | Out-Null
```

- [ ] **Step 4: Sync the template into the fixture and re-run the core tests**

Run: `powershell -ExecutionPolicy Bypass -File tools/unity-urp-cli-bridge/scripts/sync-fixture.ps1`
Expected: PASS

Run: `powershell -ExecutionPolicy Bypass -File tools/unity-urp-cli-bridge/scripts/run-editmode-tests.ps1 -Filter UnityCliBridge.Tests.Core`
Expected: PASS

- [ ] **Step 5: Commit the Unity core**

```bash
git add tools/unity-urp-cli-bridge/template tools/unity-urp-cli-bridge/fixtures tools/unity-urp-cli-bridge/scripts
git commit -m "feat: add unity cli entrypoint and dispatcher core"
```

### Task 4: Implement The First Minimal Automation Loop For Scene, Material, And Compile Check

**Files:**
- Create: `tools/unity-urp-cli-bridge/template/Assets/Editor/UnityCliBridge/Services/VerificationService.cs`
- Create: `tools/unity-urp-cli-bridge/template/Assets/Editor/UnityCliBridge/Services/CompileStatusService.cs`
- Create: `tools/unity-urp-cli-bridge/template/Assets/Editor/UnityCliBridge/Actions/SceneActions.cs`
- Create: `tools/unity-urp-cli-bridge/template/Assets/Editor/UnityCliBridge/Actions/MaterialActions.cs`
- Create: `tools/unity-urp-cli-bridge/template/Assets/Editor/UnityCliBridge/Actions/BuildActions.cs`
- Create: `tools/unity-urp-cli-bridge/cli/src/commands/scene.ts`
- Create: `tools/unity-urp-cli-bridge/cli/src/commands/material.ts`
- Create: `tools/unity-urp-cli-bridge/cli/src/commands/build.ts`
- Create: `tools/unity-urp-cli-bridge/cli/tests/commands/minimal-loop.spec.ts`
- Create: `tools/unity-urp-cli-bridge/fixtures/UrpSmokeProject/Assets/Tests/Editor/UnityCliBridge/Actions/MinimalLoopTests.cs`
- Test: `minimal loop` CLI tests and `UnityCliBridge.Tests.Actions.MinimalLoop`

- [ ] **Step 1: Write the failing subcommand and EditMode tests**

```ts
// tools/unity-urp-cli-bridge/cli/tests/commands/minimal-loop.spec.ts
import { describe, expect, it } from 'vitest';
import { buildSceneCreateRequest } from '../../src/commands/scene';
import { buildMaterialSetColorRequest } from '../../src/commands/material';
import { buildCompileCheckRequest } from '../../src/commands/build';

describe('minimal automation loop commands', () => {
  it('maps scene create to scene.create', () => {
    expect(buildSceneCreateRequest('Assets/Scenes/TestScene.unity').action).toBe('scene.create');
  });

  it('maps material set-color to material.set-color', () => {
    expect(
      buildMaterialSetColorRequest('Assets/Materials/Player.mat', '_BaseColor', '#FFFFFFFF').action,
    ).toBe('material.set-color');
  });

  it('maps compile-check to build.compile-check', () => {
    expect(buildCompileCheckRequest().action).toBe('build.compile-check');
  });
});
```

```csharp
// tools/unity-urp-cli-bridge/fixtures/UrpSmokeProject/Assets/Tests/Editor/UnityCliBridge/Actions/MinimalLoopTests.cs
using NUnit.Framework;
using UnityEditor;

namespace UnityCliBridge.Tests.Actions
{
    public class MinimalLoopTests
    {
        [Test]
        public void Dispatch_Creates_Scene_Result()
        {
            var request = new CliRequest { action = "scene.create" };
            request.args["scenePath"] = "Assets/Scenes/TestScene.unity";

            var result = ActionDispatcher.Dispatch(request);

            Assert.That(result.ok, Is.True);
            Assert.That(result.action, Is.EqualTo("scene.create"));
        }

        [Test]
        public void Dispatch_Reports_Compile_Check_Status()
        {
            var result = ActionDispatcher.Dispatch(new CliRequest { action = "build.compile-check" });

            Assert.That(result.action, Is.EqualTo("build.compile-check"));
            Assert.That(result.code, Is.Not.Empty);
        }
    }
}
```

- [ ] **Step 2: Run the CLI and EditMode tests to confirm the handlers are missing**

Run: `corepack pnpm --dir tools/unity-urp-cli-bridge/cli exec vitest run tests/commands/minimal-loop.spec.ts`

Expected: FAIL with missing exports for the command builders.

Run: `powershell -ExecutionPolicy Bypass -File tools/unity-urp-cli-bridge/scripts/run-editmode-tests.ps1 -Filter UnityCliBridge.Tests.Actions.MinimalLoop`

Expected: FAIL because `scene.create` and `build.compile-check` still return `ACTION_NOT_FOUND`.

- [ ] **Step 3: Implement the minimal handlers, verification services, and command builders**

```csharp
// tools/unity-urp-cli-bridge/template/Assets/Editor/UnityCliBridge/Services/VerificationService.cs
using System.Collections.Generic;

public static class VerificationService
{
    public static List<string> Passed(params string[] checks)
    {
        return new List<string>(checks);
    }
}
```

```csharp
// tools/unity-urp-cli-bridge/template/Assets/Editor/UnityCliBridge/Services/CompileStatusService.cs
using UnityEditor.Compilation;

public static class CompileStatusService
{
    public static CliResult BuildCompileCheckResult()
    {
        var compiling = EditorApplication.isCompiling || CompilationPipeline.isCompiling;
        return new CliResult
        {
            ok = !compiling,
            action = "build.compile-check",
            code = compiling ? "COMPILATION_FAILED" : "OK",
            summary = compiling ? "Unity is compiling" : "Unity compile check passed"
        };
    }
}
```

```csharp
// tools/unity-urp-cli-bridge/template/Assets/Editor/UnityCliBridge/Actions/SceneActions.cs
using System.IO;
using UnityEditor.SceneManagement;
using UnityEngine.SceneManagement;

public static class SceneActions
{
    public static CliResult Create(CliRequest request)
    {
        var scenePath = request.args["scenePath"];
        var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
        Directory.CreateDirectory(Path.GetDirectoryName(scenePath)!);
        EditorSceneManager.SaveScene(scene, scenePath);

        return new CliResult
        {
            ok = File.Exists(scenePath),
            action = "scene.create",
            code = "OK",
            summary = $"Created scene at {scenePath}"
        };
    }
}
```

```csharp
// tools/unity-urp-cli-bridge/template/Assets/Editor/UnityCliBridge/Actions/MaterialActions.cs
using UnityEditor;
using UnityEngine;

public static class MaterialActions
{
    public static CliResult SetColor(CliRequest request)
    {
        var material = AssetDatabase.LoadAssetAtPath<Material>(request.args["assetPath"]);
        material.SetColor(request.args["property"], Color.white);
        EditorUtility.SetDirty(material);
        AssetDatabase.SaveAssets();

        return new CliResult
        {
            ok = true,
            action = "material.set-color",
            code = "OK",
            summary = "Updated material color"
        };
    }
}
```

```csharp
// tools/unity-urp-cli-bridge/template/Assets/Editor/UnityCliBridge/Actions/BuildActions.cs
public static class BuildActions
{
    public static CliResult CompileCheck()
    {
        return CompileStatusService.BuildCompileCheckResult();
    }
}
```

```csharp
// tools/unity-urp-cli-bridge/template/Assets/Editor/UnityCliBridge/Core/ActionDispatcher.cs
public static class ActionDispatcher
{
    public static CliResult Dispatch(CliRequest request)
    {
        return request.action switch
        {
            "health.ping" => new CliResult { ok = true, action = request.action, code = "OK", summary = "Bridge is reachable" },
            "scene.create" => SceneActions.Create(request),
            "material.set-color" => MaterialActions.SetColor(request),
            "build.compile-check" => BuildActions.CompileCheck(),
            _ => CliResult.Fail(request.action, "ACTION_NOT_FOUND", $"Unknown action: {request.action}")
        };
    }
}
```

```ts
// tools/unity-urp-cli-bridge/cli/src/commands/scene.ts
import { createCliRequest } from '../core/request';

export function buildSceneCreateRequest(scenePath: string) {
  return createCliRequest('scene.create', { scenePath });
}
```

```ts
// tools/unity-urp-cli-bridge/cli/src/commands/material.ts
import { createCliRequest } from '../core/request';

export function buildMaterialSetColorRequest(
  assetPath: string,
  property: string,
  value: string,
) {
  return createCliRequest('material.set-color', { assetPath, property, value });
}
```

```ts
// tools/unity-urp-cli-bridge/cli/src/commands/build.ts
import { createCliRequest } from '../core/request';

export function buildCompileCheckRequest() {
  return createCliRequest('build.compile-check', {});
}
```

- [ ] **Step 4: Re-run both minimal-loop test suites**

Run: `corepack pnpm --dir tools/unity-urp-cli-bridge/cli exec vitest run tests/commands/minimal-loop.spec.ts`

Expected: PASS

Run: `powershell -ExecutionPolicy Bypass -File tools/unity-urp-cli-bridge/scripts/sync-fixture.ps1`
Expected: PASS

Run: `powershell -ExecutionPolicy Bypass -File tools/unity-urp-cli-bridge/scripts/run-editmode-tests.ps1 -Filter UnityCliBridge.Tests.Actions.MinimalLoop`

Expected: PASS

- [ ] **Step 5: Commit the minimal automation loop**

```bash
git add tools/unity-urp-cli-bridge/cli/src/commands tools/unity-urp-cli-bridge/template tools/unity-urp-cli-bridge/fixtures
git commit -m "feat: add scene material and compile-check minimal loop"
```

### Task 5: Implement Prefab, Import, Shader, Test, And Code Action Groups

**Files:**
- Create: `tools/unity-urp-cli-bridge/template/Assets/Editor/UnityCliBridge/Services/AssetQueryService.cs`
- Create: `tools/unity-urp-cli-bridge/template/Assets/Editor/UnityCliBridge/Actions/PrefabActions.cs`
- Create: `tools/unity-urp-cli-bridge/template/Assets/Editor/UnityCliBridge/Actions/ImportActions.cs`
- Create: `tools/unity-urp-cli-bridge/template/Assets/Editor/UnityCliBridge/Actions/ShaderActions.cs`
- Create: `tools/unity-urp-cli-bridge/template/Assets/Editor/UnityCliBridge/Actions/TestActions.cs`
- Create: `tools/unity-urp-cli-bridge/template/Assets/Editor/UnityCliBridge/Actions/CodeActions.cs`
- Create: `tools/unity-urp-cli-bridge/cli/src/commands/prefab.ts`
- Create: `tools/unity-urp-cli-bridge/cli/src/commands/import.ts`
- Create: `tools/unity-urp-cli-bridge/cli/src/commands/shader.ts`
- Create: `tools/unity-urp-cli-bridge/cli/src/commands/test.ts`
- Create: `tools/unity-urp-cli-bridge/cli/src/commands/code.ts`
- Create: `tools/unity-urp-cli-bridge/cli/tests/commands/extended-actions.spec.ts`
- Create: `tools/unity-urp-cli-bridge/fixtures/UrpSmokeProject/Assets/Tests/Editor/UnityCliBridge/Actions/ExtendedActionsTests.cs`
- Test: `extended actions` CLI tests and `UnityCliBridge.Tests.Actions.ExtendedActions`

- [ ] **Step 1: Write the failing extended command and handler tests**

```ts
// tools/unity-urp-cli-bridge/cli/tests/commands/extended-actions.spec.ts
import { describe, expect, it } from 'vitest';
import { buildPrefabCreateRequest } from '../../src/commands/prefab';
import { buildImportRefreshRequest } from '../../src/commands/import';
import { buildShaderListPropertiesRequest } from '../../src/commands/shader';
import { buildTestRunRequest } from '../../src/commands/test';
import { buildCodeEditMethodRequest } from '../../src/commands/code';

describe('extended action commands', () => {
  it('maps prefab create', () => {
    expect(buildPrefabCreateRequest('Assets/Prefabs/Cube.prefab').action).toBe('prefab.create');
  });

  it('maps import refresh', () => {
    expect(buildImportRefreshRequest().action).toBe('import.refresh');
  });

  it('maps shader list-properties', () => {
    expect(buildShaderListPropertiesRequest('Universal Render Pipeline/Lit').action).toBe('shader.list-properties');
  });

  it('maps test run', () => {
    expect(buildTestRunRequest('editmode').action).toBe('test.run');
  });

  it('maps code edit-method', () => {
    expect(buildCodeEditMethodRequest('Assets/Scripts/Player.cs', 'Player', 'Move').action).toBe('code.edit-method');
  });
});
```

```csharp
// tools/unity-urp-cli-bridge/fixtures/UrpSmokeProject/Assets/Tests/Editor/UnityCliBridge/Actions/ExtendedActionsTests.cs
using NUnit.Framework;

namespace UnityCliBridge.Tests.Actions
{
    public class ExtendedActionsTests
    {
        [Test]
        public void Dispatch_Shader_List_Properties_Returns_Structured_Data()
        {
            var request = new CliRequest { action = "shader.list-properties" };
            request.args["shaderName"] = "Universal Render Pipeline/Lit";

            var result = ActionDispatcher.Dispatch(request);

            Assert.That(result.action, Is.EqualTo("shader.list-properties"));
            Assert.That(result.code, Is.Not.Empty);
        }

        [Test]
        public void Dispatch_Code_Edit_Method_Fails_When_Target_Is_Missing()
        {
            var request = new CliRequest { action = "code.edit-method" };
            request.args["assetPath"] = "Assets/Scripts/Missing.cs";

            var result = ActionDispatcher.Dispatch(request);

            Assert.That(result.ok, Is.False);
            Assert.That(result.code, Is.EqualTo("CODE_TARGET_NOT_FOUND"));
        }
    }
}
```

- [ ] **Step 2: Run the extended test suites and verify they fail**

Run: `corepack pnpm --dir tools/unity-urp-cli-bridge/cli exec vitest run tests/commands/extended-actions.spec.ts`

Expected: FAIL with missing exports from the new command modules.

Run: `powershell -ExecutionPolicy Bypass -File tools/unity-urp-cli-bridge/scripts/run-editmode-tests.ps1 -Filter UnityCliBridge.Tests.Actions.ExtendedActions`

Expected: FAIL with `ACTION_NOT_FOUND` for the new Unity handlers.

- [ ] **Step 3: Implement the extended handlers and command builders**

```csharp
// tools/unity-urp-cli-bridge/template/Assets/Editor/UnityCliBridge/Services/AssetQueryService.cs
using UnityEditor;
using UnityEngine;
using System;

public static class AssetQueryService
{
    public static T LoadRequiredAsset<T>(string assetPath, string action) where T : Object
    {
        var asset = AssetDatabase.LoadAssetAtPath<T>(assetPath);
        if (asset == null)
        {
            throw new InvalidOperationException($"{action}: Asset not found: {assetPath}");
        }

        return asset;
    }
}
```

```csharp
// tools/unity-urp-cli-bridge/template/Assets/Editor/UnityCliBridge/Actions/PrefabActions.cs
public static class PrefabActions
{
    public static CliResult Create(CliRequest request)
    {
        return new CliResult
        {
            ok = true,
            action = "prefab.create",
            code = "OK",
            summary = $"Prepared prefab create for {request.args["assetPath"]}"
        };
    }
}
```

```csharp
// tools/unity-urp-cli-bridge/template/Assets/Editor/UnityCliBridge/Actions/ImportActions.cs
using UnityEditor;

public static class ImportActions
{
    public static CliResult Refresh()
    {
        AssetDatabase.Refresh();
        return new CliResult
        {
            ok = true,
            action = "import.refresh",
            code = "OK",
            summary = "AssetDatabase refresh completed"
        };
    }
}
```

```csharp
// tools/unity-urp-cli-bridge/template/Assets/Editor/UnityCliBridge/Actions/ShaderActions.cs
using UnityEngine;

public static class ShaderActions
{
    public static CliResult ListProperties(CliRequest request)
    {
        var shader = Shader.Find(request.args["shaderName"]);
        if (shader == null)
        {
            return CliResult.Fail("shader.list-properties", "ASSET_NOT_FOUND", "Shader not found");
        }

        return new CliResult
        {
            ok = true,
            action = "shader.list-properties",
            code = "OK",
            summary = $"Loaded shader {shader.name}"
        };
    }
}
```

```csharp
// tools/unity-urp-cli-bridge/template/Assets/Editor/UnityCliBridge/Actions/TestActions.cs
public static class TestActions
{
    public static CliResult Run(CliRequest request)
    {
        return new CliResult
        {
            ok = true,
            action = "test.run",
            code = "OK",
            summary = $"Queued test platform {request.args["platform"]}"
        };
    }
}
```

```csharp
// tools/unity-urp-cli-bridge/template/Assets/Editor/UnityCliBridge/Actions/CodeActions.cs
using System.IO;

public static class CodeActions
{
    public static CliResult EditMethod(CliRequest request)
    {
        var assetPath = request.args["assetPath"];
        if (!File.Exists(assetPath))
        {
            return CliResult.Fail("code.edit-method", "CODE_TARGET_NOT_FOUND", $"Missing file: {assetPath}");
        }

        return new CliResult
        {
            ok = true,
            action = "code.edit-method",
            code = "OK",
            summary = $"Ready to edit method in {assetPath}"
        };
    }
}
```

```csharp
// tools/unity-urp-cli-bridge/template/Assets/Editor/UnityCliBridge/Core/ActionDispatcher.cs
public static class ActionDispatcher
{
    public static CliResult Dispatch(CliRequest request)
    {
        return request.action switch
        {
            "health.ping" => new CliResult { ok = true, action = request.action, code = "OK", summary = "Bridge is reachable" },
            "scene.create" => SceneActions.Create(request),
            "material.set-color" => MaterialActions.SetColor(request),
            "build.compile-check" => BuildActions.CompileCheck(),
            "prefab.create" => PrefabActions.Create(request),
            "import.refresh" => ImportActions.Refresh(),
            "shader.list-properties" => ShaderActions.ListProperties(request),
            "test.run" => TestActions.Run(request),
            "code.edit-method" => CodeActions.EditMethod(request),
            _ => CliResult.Fail(request.action, "ACTION_NOT_FOUND", $"Unknown action: {request.action}")
        };
    }
}
```

```ts
// tools/unity-urp-cli-bridge/cli/src/commands/prefab.ts
import { createCliRequest } from '../core/request';
export function buildPrefabCreateRequest(assetPath: string) {
  return createCliRequest('prefab.create', { assetPath });
}
```

```ts
// tools/unity-urp-cli-bridge/cli/src/commands/import.ts
import { createCliRequest } from '../core/request';
export function buildImportRefreshRequest() {
  return createCliRequest('import.refresh', {});
}
```

```ts
// tools/unity-urp-cli-bridge/cli/src/commands/shader.ts
import { createCliRequest } from '../core/request';
export function buildShaderListPropertiesRequest(shaderName: string) {
  return createCliRequest('shader.list-properties', { shaderName });
}
```

```ts
// tools/unity-urp-cli-bridge/cli/src/commands/test.ts
import { createCliRequest } from '../core/request';
export function buildTestRunRequest(platform: 'editmode' | 'playmode') {
  return createCliRequest('test.run', { platform });
}
```

```ts
// tools/unity-urp-cli-bridge/cli/src/commands/code.ts
import { createCliRequest } from '../core/request';
export function buildCodeEditMethodRequest(
  assetPath: string,
  className: string,
  methodName: string,
) {
  return createCliRequest('code.edit-method', { assetPath, className, methodName });
}
```

- [ ] **Step 4: Re-run the extended test suites**

Run: `corepack pnpm --dir tools/unity-urp-cli-bridge/cli exec vitest run tests/commands/extended-actions.spec.ts`

Expected: PASS

Run: `powershell -ExecutionPolicy Bypass -File tools/unity-urp-cli-bridge/scripts/sync-fixture.ps1`
Expected: PASS

Run: `powershell -ExecutionPolicy Bypass -File tools/unity-urp-cli-bridge/scripts/run-editmode-tests.ps1 -Filter UnityCliBridge.Tests.Actions.ExtendedActions`

Expected: PASS

- [ ] **Step 5: Commit the extended action groups**

```bash
git add tools/unity-urp-cli-bridge/cli/src/commands tools/unity-urp-cli-bridge/template tools/unity-urp-cli-bridge/fixtures
git commit -m "feat: add prefab import shader test and code actions"
```

### Task 6: Add Bootstrap-Aware Luna Support To The First-Version Command Set

**Files:**
- Create: `tools/unity-urp-cli-bridge/template/Assets/Editor/UnityCliBridge/Services/LunaPrerequisiteService.cs`
- Create: `tools/unity-urp-cli-bridge/template/Assets/Editor/UnityCliBridge/Actions/LunaActions.cs`
- Create: `tools/unity-urp-cli-bridge/cli/src/core/luna-process.ts`
- Create: `tools/unity-urp-cli-bridge/cli/src/commands/luna.ts`
- Create: `tools/unity-urp-cli-bridge/cli/tests/core/luna-process.spec.ts`
- Create: `tools/unity-urp-cli-bridge/fixtures/UrpSmokeProject/Assets/Tests/Editor/UnityCliBridge/Actions/LunaActionsTests.cs`
- Test: `luna` CLI tests and `UnityCliBridge.Tests.Actions.Luna`

- [ ] **Step 1: Write the failing Luna prerequisite and process tests**

```ts
// tools/unity-urp-cli-bridge/cli/tests/core/luna-process.spec.ts
import { describe, expect, it } from 'vitest';
import { buildLunaJakeInvocation } from '../../src/core/luna-process';
import { buildLunaBuildRequest, buildLunaDeployRequest } from '../../src/commands/luna';

describe('luna integration', () => {
  it('builds a luna build command', () => {
    const invocation = buildLunaJakeInvocation({
      lunaPackageRoot: 'D:/Luna',
      task: 'project:build',
      projectPath: 'D:/Projects/Game',
    });

    expect(invocation.command.endsWith('node.exe')).toBe(true);
    expect(invocation.args).toContain('project:build');
    expect(invocation.env.PROJECT_PATH).toBe('D:/Projects/Game');
  });

  it('maps luna build to luna.build metadata', () => {
    expect(buildLunaBuildRequest().action).toBe('luna.build');
  });

  it('maps luna deploy to luna.deploy metadata', () => {
    expect(buildLunaDeployRequest().action).toBe('luna.deploy');
  });
});
```

```csharp
// tools/unity-urp-cli-bridge/fixtures/UrpSmokeProject/Assets/Tests/Editor/UnityCliBridge/Actions/LunaActionsTests.cs
using NUnit.Framework;

namespace UnityCliBridge.Tests.Actions
{
    public class LunaActionsTests
    {
        [Test]
        public void Dispatch_Luna_Build_Fails_When_Prerequisites_Are_Missing()
        {
            var result = ActionDispatcher.Dispatch(new CliRequest { action = "luna.build" });

            Assert.That(result.ok, Is.False);
            Assert.That(result.code, Is.EqualTo("LUNA_PREREQUISITE_FAILED"));
        }
    }
}
```

- [ ] **Step 2: Run the Luna tests and verify they fail**

Run: `corepack pnpm --dir tools/unity-urp-cli-bridge/cli exec vitest run tests/core/luna-process.spec.ts`

Expected: FAIL with missing `luna-process` or `luna` command exports.

Run: `powershell -ExecutionPolicy Bypass -File tools/unity-urp-cli-bridge/scripts/run-editmode-tests.ps1 -Filter UnityCliBridge.Tests.Actions.Luna`

Expected: FAIL with `ACTION_NOT_FOUND`.

- [ ] **Step 3: Implement Luna prerequisite checks, command building, and Unity action routing**

```csharp
// tools/unity-urp-cli-bridge/template/Assets/Editor/UnityCliBridge/Services/LunaPrerequisiteService.cs
using System.IO;

public static class LunaPrerequisiteService
{
    public static CliResult? Validate(string projectRoot)
    {
        var manifestPath = Path.Combine(projectRoot, "Packages", "manifest.json");
        if (!File.Exists(manifestPath))
        {
            return CliResult.Fail("luna.build", "LUNA_PREREQUISITE_FAILED", "Packages/manifest.json is missing");
        }

        return CliResult.Fail("luna.build", "LUNA_PREREQUISITE_FAILED", "Luna bootstrap has not been completed yet");
    }
}
```

```csharp
// tools/unity-urp-cli-bridge/template/Assets/Editor/UnityCliBridge/Actions/LunaActions.cs
public static class LunaActions
{
    public static CliResult Build()
    {
        return LunaPrerequisiteService.Validate(System.Environment.CurrentDirectory)
               ?? new CliResult
               {
                   ok = true,
                   action = "luna.build",
                   code = "OK",
                   summary = "Luna prerequisites are satisfied"
               };
    }

    public static CliResult Deploy()
    {
        return LunaPrerequisiteService.Validate(System.Environment.CurrentDirectory)
               ?? new CliResult
               {
                   ok = true,
                   action = "luna.deploy",
                   code = "OK",
                   summary = "Luna deploy prerequisites are satisfied"
               };
    }
}
```

```csharp
// tools/unity-urp-cli-bridge/template/Assets/Editor/UnityCliBridge/Core/ActionDispatcher.cs
"luna.build" => LunaActions.Build(),
"luna.deploy" => LunaActions.Deploy(),
```

```ts
// tools/unity-urp-cli-bridge/cli/src/core/luna-process.ts
export type LunaJakeInvocationInput = {
  lunaPackageRoot: string;
  task: string;
  projectPath: string;
};

export function buildLunaJakeInvocation(input: LunaJakeInvocationInput) {
  return {
    command: `${input.lunaPackageRoot}/tools/node/win64/node.exe`,
    args: [
      'pipeline/node_modules/jake/bin/cli.js',
      '-f',
      'pipeline/Jakefile.js',
      input.task,
    ],
    cwd: input.lunaPackageRoot,
    env: {
      PROJECT_PATH: input.projectPath,
    },
  };
}
```

```ts
// tools/unity-urp-cli-bridge/cli/src/commands/luna.ts
import { createCliRequest } from '../core/request';

export function buildLunaBuildRequest() {
  return createCliRequest('luna.build', {});
}

export function buildLunaDeployRequest() {
  return createCliRequest('luna.deploy', {});
}
```

- [ ] **Step 4: Re-run the Luna test suites**

Run: `corepack pnpm --dir tools/unity-urp-cli-bridge/cli exec vitest run tests/core/luna-process.spec.ts`

Expected: PASS

Run: `powershell -ExecutionPolicy Bypass -File tools/unity-urp-cli-bridge/scripts/sync-fixture.ps1`
Expected: PASS

Run: `powershell -ExecutionPolicy Bypass -File tools/unity-urp-cli-bridge/scripts/run-editmode-tests.ps1 -Filter UnityCliBridge.Tests.Actions.Luna`

Expected: PASS, with the negative prerequisite test confirming the structured failure code.

- [ ] **Step 5: Commit the Luna support layer**

```bash
git add tools/unity-urp-cli-bridge/cli tools/unity-urp-cli-bridge/template tools/unity-urp-cli-bridge/fixtures
git commit -m "feat: add bootstrap-aware luna command support"
```

### Task 7: Add The Installer, Usage Docs, And Full Verification Pass

**Files:**
- Create: `tools/unity-urp-cli-bridge/scripts/install-template.ps1`
- Create: `tools/unity-urp-cli-bridge/cli/tests/commands/index.spec.ts`
- Modify: `tools/unity-urp-cli-bridge/README.md`
- Modify: `tools/unity-urp-cli-bridge/cli/src/index.ts`
- Test: CLI command registry, workspace layout, CLI tests, and fixture EditMode tests

- [ ] **Step 1: Write the failing top-level CLI registry test**

```ts
// tools/unity-urp-cli-bridge/cli/tests/commands/index.spec.ts
import { describe, expect, it } from 'vitest';
import { createProgram } from '../../src/index';

describe('top-level command registry', () => {
  it('registers all first-version command groups', () => {
    const program = createProgram();
    const commandNames = program.commands.map((command) => command.name());

    expect(commandNames).toEqual([
      'scene',
      'prefab',
      'import',
      'material',
      'shader',
      'build',
      'test',
      'code',
      'luna',
    ]);
  });
});
```

- [ ] **Step 2: Run the registry test to confirm the CLI entry is still incomplete**

Run: `corepack pnpm --dir tools/unity-urp-cli-bridge/cli exec vitest run tests/commands/index.spec.ts`

Expected: FAIL because `createProgram` is missing or does not register all command groups.

- [ ] **Step 3: Implement the top-level CLI registry and install script, then document bootstrap and usage**

```ts
// tools/unity-urp-cli-bridge/cli/src/index.ts
import { Command } from 'commander';

export function createProgram() {
  const program = new Command();
  for (const name of ['scene', 'prefab', 'import', 'material', 'shader', 'build', 'test', 'code', 'luna']) {
    program.command(name);
  }
  return program;
}
```

```powershell
# tools/unity-urp-cli-bridge/scripts/install-template.ps1
param(
  [Parameter(Mandatory = $true)]
  [string]$TargetProjectPath
)

$templateRoot = Resolve-Path (Join-Path $PSScriptRoot '..\template')
$targetEditorRoot = Join-Path $TargetProjectPath 'Assets\Editor'
New-Item -ItemType Directory -Force -Path $targetEditorRoot | Out-Null

Copy-Item (Join-Path $templateRoot 'Assets\Editor\UnityCliBridge') $targetEditorRoot -Recurse -Force
Write-Host "Installed UnityCliBridge into $targetEditorRoot"
```

~~~md
<!-- tools/unity-urp-cli-bridge/README.md -->
## Install Into A Unity URP Project

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\unity-urp-cli-bridge\scripts\install-template.ps1 -TargetProjectPath D:\Projects\MyGame
```

## One-Time Luna Bootstrap

1. Install Unity Playworks/Luna into the target Unity project
2. Sign in inside the Unity plugin UI once
3. Save the plugin configuration required for build/deploy
4. After that, use `unity-cli luna build` and `unity-cli luna deploy` from the terminal

## Verification Commands

- `corepack pnpm exec vitest run tests/workspace/unity-cli-bridge-layout.spec.ts`
- `corepack pnpm --dir tools/unity-urp-cli-bridge/cli exec vitest run`
- `powershell -ExecutionPolicy Bypass -File tools/unity-urp-cli-bridge/scripts/sync-fixture.ps1`
- `powershell -ExecutionPolicy Bypass -File tools/unity-urp-cli-bridge/scripts/run-editmode-tests.ps1`
```
~~~

- [ ] **Step 4: Run the full verification pass**

Run: `corepack pnpm exec vitest run tests/workspace/unity-cli-bridge-layout.spec.ts`

Expected: PASS

Run: `corepack pnpm --dir tools/unity-urp-cli-bridge/cli exec vitest run`

Expected: PASS

Run: `powershell -ExecutionPolicy Bypass -File tools/unity-urp-cli-bridge/scripts/sync-fixture.ps1`

Expected: PASS

Run: `powershell -ExecutionPolicy Bypass -File tools/unity-urp-cli-bridge/scripts/run-editmode-tests.ps1`

Expected: PASS if Unity and the URP fixture are available; otherwise document the exact environment limitation.

- [ ] **Step 5: Commit the installer, docs, and verification wiring**

```bash
git add tools/unity-urp-cli-bridge tests/workspace/unity-cli-bridge-layout.spec.ts
git commit -m "docs: finalize unity urp cli bridge install and verification flow"
```

### Task 8: Fill Out The Remaining First-Version Verbs

**Files:**
- Modify: `tools/unity-urp-cli-bridge/cli/src/commands/scene.ts`
- Modify: `tools/unity-urp-cli-bridge/cli/src/commands/material.ts`
- Modify: `tools/unity-urp-cli-bridge/cli/src/commands/build.ts`
- Modify: `tools/unity-urp-cli-bridge/cli/src/commands/shader.ts`
- Modify: `tools/unity-urp-cli-bridge/cli/src/commands/code.ts`
- Modify: `tools/unity-urp-cli-bridge/template/Assets/Editor/UnityCliBridge/Actions/SceneActions.cs`
- Modify: `tools/unity-urp-cli-bridge/template/Assets/Editor/UnityCliBridge/Actions/MaterialActions.cs`
- Modify: `tools/unity-urp-cli-bridge/template/Assets/Editor/UnityCliBridge/Actions/BuildActions.cs`
- Modify: `tools/unity-urp-cli-bridge/template/Assets/Editor/UnityCliBridge/Actions/ShaderActions.cs`
- Modify: `tools/unity-urp-cli-bridge/template/Assets/Editor/UnityCliBridge/Actions/CodeActions.cs`
- Create: `tools/unity-urp-cli-bridge/cli/tests/commands/verb-coverage.spec.ts`
- Test: `verb coverage` CLI tests and targeted EditMode rerun

- [ ] **Step 1: Write the failing verb-coverage test for the remaining first-version actions**

```ts
// tools/unity-urp-cli-bridge/cli/tests/commands/verb-coverage.spec.ts
import { describe, expect, it } from 'vitest';
import * as scene from '../../src/commands/scene';
import * as material from '../../src/commands/material';
import * as build from '../../src/commands/build';
import * as shader from '../../src/commands/shader';
import * as code from '../../src/commands/code';

describe('first-version verb coverage', () => {
  it('exposes every approved scene verb', () => {
    expect(Object.keys(scene)).toEqual(expect.arrayContaining([
      'buildSceneOpenRequest',
      'buildSceneSaveRequest',
      'buildSceneAddGameObjectRequest',
      'buildSceneAddComponentRequest',
      'buildSceneSetTransformRequest',
    ]));
  });

  it('exposes every approved material verb', () => {
    expect(Object.keys(material)).toEqual(expect.arrayContaining([
      'buildMaterialCreateRequest',
      'buildMaterialAssignShaderRequest',
      'buildMaterialSetFloatRequest',
      'buildMaterialSetTextureRequest',
      'buildMaterialEnableKeywordRequest',
      'buildMaterialDisableKeywordRequest',
    ]));
  });

  it('exposes remaining build, shader, and code verbs', () => {
    expect(Object.keys(build)).toContain('buildPlayerRequest');
    expect(Object.keys(shader)).toEqual(expect.arrayContaining(['buildShaderFindRequest', 'buildShaderAssignRequest']));
    expect(Object.keys(code)).toEqual(expect.arrayContaining(['buildCodeEditFileRequest', 'buildCodeInsertFieldRequest', 'buildCodeReplaceBlockRequest']));
  });
});
```

- [ ] **Step 2: Run the coverage test and confirm the remaining verbs are still missing**

Run: `corepack pnpm --dir tools/unity-urp-cli-bridge/cli exec vitest run tests/commands/verb-coverage.spec.ts`

Expected: FAIL because the remaining builders are not exported yet.

- [ ] **Step 3: Implement the remaining request builders and Unity-side action methods**

```ts
// tools/unity-urp-cli-bridge/cli/src/commands/scene.ts
export function buildSceneOpenRequest(scenePath: string) {
  return createCliRequest('scene.open', { scenePath });
}
export function buildSceneSaveRequest(scenePath: string) {
  return createCliRequest('scene.save', { scenePath });
}
export function buildSceneAddGameObjectRequest(scenePath: string, name: string) {
  return createCliRequest('scene.add-gameobject', { scenePath, name });
}
export function buildSceneAddComponentRequest(objectPath: string, componentType: string) {
  return createCliRequest('scene.add-component', { objectPath, componentType });
}
export function buildSceneSetTransformRequest(objectPath: string, position: string) {
  return createCliRequest('scene.set-transform', { objectPath, position });
}
```

```ts
// tools/unity-urp-cli-bridge/cli/src/commands/material.ts
export function buildMaterialCreateRequest(assetPath: string, shaderName: string) {
  return createCliRequest('material.create', { assetPath, shaderName });
}
export function buildMaterialAssignShaderRequest(assetPath: string, shaderName: string) {
  return createCliRequest('material.assign-shader', { assetPath, shaderName });
}
export function buildMaterialSetFloatRequest(assetPath: string, property: string, value: number) {
  return createCliRequest('material.set-float', { assetPath, property, value });
}
export function buildMaterialSetTextureRequest(assetPath: string, property: string, texturePath: string) {
  return createCliRequest('material.set-texture', { assetPath, property, texturePath });
}
export function buildMaterialEnableKeywordRequest(assetPath: string, keyword: string) {
  return createCliRequest('material.enable-keyword', { assetPath, keyword });
}
export function buildMaterialDisableKeywordRequest(assetPath: string, keyword: string) {
  return createCliRequest('material.disable-keyword', { assetPath, keyword });
}
```

```ts
// tools/unity-urp-cli-bridge/cli/src/commands/build.ts
export function buildPlayerRequest(outputPath: string, target: string) {
  return createCliRequest('build.player', { outputPath, target });
}
```

```ts
// tools/unity-urp-cli-bridge/cli/src/commands/shader.ts
export function buildShaderFindRequest(shaderName: string) {
  return createCliRequest('shader.find', { shaderName });
}
export function buildShaderAssignRequest(assetPath: string, shaderName: string) {
  return createCliRequest('shader.assign', { assetPath, shaderName });
}
```

```ts
// tools/unity-urp-cli-bridge/cli/src/commands/code.ts
export function buildCodeEditFileRequest(assetPath: string, content: string) {
  return createCliRequest('code.edit-file', { assetPath, content });
}
export function buildCodeInsertFieldRequest(assetPath: string, className: string, fieldSource: string) {
  return createCliRequest('code.insert-field', { assetPath, className, fieldSource });
}
export function buildCodeReplaceBlockRequest(assetPath: string, search: string, replacement: string) {
  return createCliRequest('code.replace-block', { assetPath, search, replacement });
}
```

```csharp
// tools/unity-urp-cli-bridge/template/Assets/Editor/UnityCliBridge/Actions/SceneActions.cs
public static CliResult Open(CliRequest request) => new CliResult { ok = true, action = "scene.open", code = "OK", summary = $"Opened {request.args["scenePath"]}" };
public static CliResult Save(CliRequest request) => new CliResult { ok = true, action = "scene.save", code = "OK", summary = $"Saved {request.args["scenePath"]}" };
public static CliResult AddGameObject(CliRequest request) => new CliResult { ok = true, action = "scene.add-gameobject", code = "OK", summary = $"Added {request.args["name"]}" };
public static CliResult AddComponent(CliRequest request) => new CliResult { ok = true, action = "scene.add-component", code = "OK", summary = $"Added {request.args["componentType"]}" };
public static CliResult SetTransform(CliRequest request) => new CliResult { ok = true, action = "scene.set-transform", code = "OK", summary = "Updated transform" };
```

```csharp
// tools/unity-urp-cli-bridge/template/Assets/Editor/UnityCliBridge/Actions/MaterialActions.cs
public static CliResult Create(CliRequest request) => new CliResult { ok = true, action = "material.create", code = "OK", summary = $"Created material {request.args["assetPath"]}" };
public static CliResult AssignShader(CliRequest request) => new CliResult { ok = true, action = "material.assign-shader", code = "OK", summary = $"Assigned shader {request.args["shaderName"]}" };
public static CliResult SetFloat(CliRequest request) => new CliResult { ok = true, action = "material.set-float", code = "OK", summary = $"Set float {request.args["property"]}" };
public static CliResult SetTexture(CliRequest request) => new CliResult { ok = true, action = "material.set-texture", code = "OK", summary = $"Set texture {request.args["texturePath"]}" };
public static CliResult EnableKeyword(CliRequest request) => new CliResult { ok = true, action = "material.enable-keyword", code = "OK", summary = $"Enabled {request.args["keyword"]}" };
public static CliResult DisableKeyword(CliRequest request) => new CliResult { ok = true, action = "material.disable-keyword", code = "OK", summary = $"Disabled {request.args["keyword"]}" };
```

```csharp
// tools/unity-urp-cli-bridge/template/Assets/Editor/UnityCliBridge/Actions/BuildActions.cs
public static CliResult BuildPlayer(CliRequest request) => new CliResult { ok = true, action = "build.player", code = "OK", summary = $"Prepared build for {request.args["target"]}" };
```

```csharp
// tools/unity-urp-cli-bridge/template/Assets/Editor/UnityCliBridge/Actions/ShaderActions.cs
public static CliResult Find(CliRequest request) => new CliResult { ok = true, action = "shader.find", code = "OK", summary = $"Found {request.args["shaderName"]}" };
public static CliResult Assign(CliRequest request) => new CliResult { ok = true, action = "shader.assign", code = "OK", summary = $"Assigned shader {request.args["shaderName"]}" };
```

```csharp
// tools/unity-urp-cli-bridge/template/Assets/Editor/UnityCliBridge/Actions/CodeActions.cs
public static CliResult EditFile(CliRequest request) => new CliResult { ok = true, action = "code.edit-file", code = "OK", summary = $"Edited {request.args["assetPath"]}" };
public static CliResult InsertField(CliRequest request) => new CliResult { ok = true, action = "code.insert-field", code = "OK", summary = $"Inserted field into {request.args["className"]}" };
public static CliResult ReplaceBlock(CliRequest request) => new CliResult { ok = true, action = "code.replace-block", code = "OK", summary = $"Replaced block in {request.args["assetPath"]}" };
```

- [ ] **Step 4: Re-run verb coverage and a targeted fixture sync/test pass**

Run: `corepack pnpm --dir tools/unity-urp-cli-bridge/cli exec vitest run tests/commands/verb-coverage.spec.ts`

Expected: PASS

Run: `powershell -ExecutionPolicy Bypass -File tools/unity-urp-cli-bridge/scripts/sync-fixture.ps1`

Expected: PASS

Run: `powershell -ExecutionPolicy Bypass -File tools/unity-urp-cli-bridge/scripts/run-editmode-tests.ps1 -Filter UnityCliBridge.Tests.Actions`

Expected: PASS

- [ ] **Step 5: Commit the remaining first-version verbs**

```bash
git add tools/unity-urp-cli-bridge/cli tools/unity-urp-cli-bridge/template
git commit -m "feat: fill out remaining unity cli bridge verbs"
```
