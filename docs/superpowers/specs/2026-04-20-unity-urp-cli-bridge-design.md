# Unity URP 无 GUI CLI Bridge 设计

## 背景

目标是做一个**可拷贝到任意 Unity URP 项目**中的通用 scaffold，让外部命令行可以稳定驱动 Unity 的常见工程化能力，而不要求人工打开 Unity Editor 窗口进行操作。

当前已明确的真实诉求不是“给 Unity 加一个零散脚本入口”，而是构建一套可以长期扩展、适合 AI Agent 和自动化系统调用的命令桥接层，覆盖以下能力方向：

1. 场景与 Prefab 的基础编辑
2. 资源导入与刷新
3. URP 材质与 Shader 的常见修改
4. 构建、测试、编译校验
5. 定向 C# 代码修改

本设计强调两个前提：

1. **Unity 官方入口优先**
   所有实际执行都基于 `-batchmode -projectPath -executeMethod`，不依赖私有进程协议。
2. **无 GUI 硬约束**
   首版能力必须可以在不打开 Unity Editor 窗口的前提下完成，并且能在命令执行后做结构化验证。

## 已确认决策

以下决策已由需求方确认，应视为本设计的固定输入：

1. `目标项目类型`
   首版以 `URP` 为唯一优先渲染管线。
2. `交付形态`
   做成可拷贝到任意 Unity URP 项目的通用 scaffold，而不是绑定当前仓库。
3. `能力优先级`
   首版优先做工程自动化能力，而不是纯美术交互能力。
4. `代码修改策略`
   首版只支持**定向代码修改**，不支持自然语言自动找代码并修改。
5. `命令结构`
   采用“两层结构”：外部是友好的子命令，Unity 内部统一落到动作分发器。
6. `运行约束`
   把“无 GUI”当作硬约束来设计，不把“尽量少开 Editor”视为足够目标。
7. `Shader Graph 边界`
   首版不支持 Shader Graph 节点级编辑，只支持引用、替换和材质侧参数写入。
8. `Luna 集成定位`
   Luna / Unity Playworks 需要纳入总体设计，并作为首版基础能力之一交付，但其可用性依赖一次性人工 bootstrap 前置条件。

## 目标

本设计需要达到以下结果：

1. 让任意 Unity URP 项目可以快速接入一套稳定的命令行桥接能力。
2. 让命令行能够完成常见工程自动化任务，而不依赖 Unity GUI。
3. 让所有写操作都具备结构化结果和可重复验证闭环。
4. 让材质、Shader、构建、测试和代码修改成为首版一等能力。
5. 为后续继续扩展命令组保留清晰的内部协议和目录边界。
6. 让 Luna / Unity Playworks 在完成一次性登录和配置后，成为首版正式支持的基础命令组。

## 非目标

本设计当前明确不做以下内容：

1. Shader Graph 节点级编辑
2. Animator Controller 的复杂图形化状态机编排
3. Timeline 深度编辑
4. VFX Graph 深度编辑
5. 强依赖自定义 Inspector 或 EditorWindow 的第三方插件操作
6. 自然语言自动修改 C# 代码
7. 常驻 Unity 后台服务
8. 依赖截图或人工视觉确认才能判断成功的操作
9. 把 Luna / Unity Playworks 当成首版零前置、纯 headless 基础能力

## 方案结论

推荐方案为：**双层桥接型 CLI 架构**

它由三层组成：

1. `外部 CLI 壳层`
   面向用户和 Agent 暴露子命令接口，负责参数校验、输出格式、进程启动和退出码。
2. `Unity 单入口`
   所有请求都通过 Unity 官方 `-batchmode -executeMethod` 进入一个静态入口方法。
3. `动作分发器 + 专项处理器`
   Unity 内部将请求映射到统一 action，再分发给小而专注的处理器执行。

该方案的核心价值是：

1. 外部命令可读、可组合、对 Agent 友好
2. Unity 内部执行路径稳定、可维护、可扩展
3. 适合“拷贝到任意 URP 项目”这一交付形态
4. 不引入常驻服务和额外运行时依赖

## 架构总览

完整命令流如下：

1. 外部用户执行 `unity-cli ...`
2. 外部 CLI 将命令标准化为一个请求文件
3. CLI 启动 Unity：
   `Unity.exe -batchmode -projectPath <path> -executeMethod <entry> --cli-request-file <file> --cli-result-file <file>`
4. Unity 单入口读取请求文件
5. Unity 动作分发器根据 `action` 将请求路由到对应处理器
6. 处理器执行修改、持久化、刷新和验证
7. Unity 将结构化结果写入结果文件
8. 外部 CLI 读取结果文件并转换为 JSON 或人类可读输出

这套设计中：

1. **Unity 内部负责**
   真实 AssetDatabase 操作、场景与 Prefab 变更、URP 材质与 Shader 写入、构建、测试、编译校验。
2. **Unity 外部负责**
   命令体验、参数标准化、输出格式、错误码映射、跨项目可移植性。

## 推荐目录结构

推荐把 scaffold 固定成两部分：一部分放在 Unity 项目内，一部分作为项目外或仓库工具目录中的 CLI。

```text
YourUnityProject/
├─ Assets/
│  └─ Editor/
│     └─ UnityCliBridge/
│        ├─ Entry/
│        │  └─ CliEntryPoint.cs
│        ├─ Core/
│        │  ├─ CliRequest.cs
│        │  ├─ CliResult.cs
│        │  ├─ ActionDispatcher.cs
│        │  └─ ArgumentReader.cs
│        ├─ Actions/
│        │  ├─ SceneActions.cs
│        │  ├─ PrefabActions.cs
│        │  ├─ ImportActions.cs
│        │  ├─ MaterialActions.cs
│        │  ├─ ShaderActions.cs
│        │  ├─ BuildActions.cs
│        │  ├─ TestActions.cs
│        │  └─ CodeActions.cs
│        ├─ Services/
│        │  ├─ AssetQueryService.cs
│        │  ├─ CompileStatusService.cs
│        │  └─ UrpValidationService.cs
│        └─ Models/
└─ tools/ 或独立目录
   └─ unity-cli/
      ├─ commands/
      ├─ process/
      ├─ output/
      └─ config/
```

拆分原则如下：

1. `Entry`
   只负责接收 Unity 命令行入口，不混入业务逻辑。
2. `Core`
   只负责请求、结果、参数读取和动作分发。
3. `Actions`
   每类能力一个动作处理文件，便于后续扩展。
4. `Services`
   放跨命令复用的查询、编译状态、URP 校验等能力。
5. `外部 CLI`
   保持和 Unity 工程代码松耦合，便于后续做打包与复用。

## 命令命名模型

### 外部命令

外部 CLI 使用对人类和 Agent 都友好的子命令风格：

- `unity-cli scene create`
- `unity-cli prefab create`
- `unity-cli import asset`
- `unity-cli material set-color`
- `unity-cli shader assign`
- `unity-cli build player`
- `unity-cli test run`
- `unity-cli code edit-method`

### Unity 内部 action

进入 Unity 内部后，统一落到稳定的 action 名称：

- `scene.create`
- `prefab.create`
- `import.asset`
- `material.set-color`
- `shader.assign`
- `build.player`
- `test.run`
- `code.edit-method`

这层映射的价值在于：

1. 外部命令文案可以迭代
2. Unity 内部协议尽量稳定
3. 扩新命令时不会把入口耦合成一团

## 请求协议

为了避免命令行参数转义复杂度，外部 CLI 不直接把复杂参数塞进 `-executeMethod`，而是先生成请求文件，再把文件路径传给 Unity 入口。

推荐 Unity 入口的最小参数如下：

```text
-executeMethod UnityCliBridge.Entry.CliEntryPoint.Run
--cli-request-file <absolute-path>
--cli-result-file <absolute-path>
```

推荐请求文件结构如下：

```json
{
  "version": "1",
  "action": "material.set-color",
  "args": {
    "assetPath": "Assets/Materials/Player.mat",
    "property": "_BaseColor",
    "value": "#FF8844FF"
  },
  "options": {
    "verify": true,
    "refreshAssets": true,
    "awaitCompile": false
  },
  "context": {
    "invokedAt": "2026-04-20T01:00:00+08:00",
    "correlationId": "req_001"
  }
}
```

该协议需要满足：

1. 可扩展
2. 易于跨语言生成
3. 不依赖终端输出内容进行解析

## 结果协议

Unity 无论成功还是失败，都必须写出结构化结果文件，外部 CLI 只认结果文件，不依赖 stdout 猜测状态。

成功结果示例：

```json
{
  "ok": true,
  "action": "material.set-color",
  "code": "OK",
  "summary": "已更新材质颜色",
  "data": {
    "assetPath": "Assets/Materials/Player.mat",
    "property": "_BaseColor",
    "value": [1.0, 0.53, 0.27, 1.0]
  },
  "warnings": [],
  "verification": {
    "performed": true,
    "checks": [
      "重新加载材质资源成功",
      "属性 _BaseColor 的最终值与请求一致"
    ]
  }
}
```

失败结果示例：

```json
{
  "ok": false,
  "action": "code.edit-method",
  "code": "COMPILATION_FAILED",
  "summary": "代码修改已写入，但 Unity 编译失败",
  "errors": [
    "Assets/Scripts/Player.cs(18,17): error CS1002: ; expected"
  ],
  "verification": {
    "performed": true,
    "checks": [
      "文件修改已落盘",
      "AssetDatabase.Refresh 已执行",
      "编译结果失败"
    ]
  }
}
```

## 错误处理模型

首版错误码保持小而稳定，推荐保留以下错误码：

1. `CLI_INPUT_INVALID`
2. `UNITY_ENTRY_FAILED`
3. `REQUEST_FILE_INVALID`
4. `ACTION_NOT_FOUND`
5. `ASSET_NOT_FOUND`
6. `URP_VALIDATION_FAILED`
7. `CODE_TARGET_NOT_FOUND`
8. `COMPILATION_FAILED`
9. `BUILD_FAILED`
10. `TEST_FAILED`
11. `VERIFICATION_FAILED`

设计原则为：

1. 错误码用于自动化分支处理
2. `summary` 用于快速阅读
3. `errors` 与 `warnings` 用于具体定位

## 无 GUI 验证闭环

由于“无 GUI”是硬约束，任何写操作都不能仅以“命令执行结束”视为成功，必须进入验证闭环。

推荐所有写操作默认执行这 5 步：

1. 执行修改
2. 进行必要持久化，例如 `SaveAssets`、`Refresh`、`SaveScene`
3. 如果相关，等待导入或编译完成
4. 重新查询目标对象的最终状态
5. 将验证信息写入 `verification`

这意味着命令成功的定义是：

**修改已执行，且修改后的最终状态经过复查，与预期一致。**

推荐不同命令组的最小验证要求如下：

1. `scene`
   验证场景文件存在、对象层级存在、场景保存成功。
2. `prefab`
   验证 prefab 资产存在，实例或组件状态符合预期。
3. `import`
   验证资源已被导入，Importer 配置已落盘。
4. `material`
   验证材质重新加载后属性值一致。
5. `shader`
   验证 shader 资源存在，材质可解析目标属性。
6. `build`
   验证产物存在且非空。
7. `test`
   验证 Unity Test Framework 结果已生成。
8. `code`
   验证文件修改已落盘，`AssetDatabase.Refresh` 已执行，并输出最终编译状态。

## 首版命令范围

首版只纳入能够满足“无 GUI 可执行 + 可验证”的命令组。

### 1. scene

- `scene create`
- `scene open`
- `scene save`
- `scene add-gameobject`
- `scene add-component`
- `scene set-transform`

目标：在纯命令行下创建和修改基础场景结构。

### 2. prefab

- `prefab create`
- `prefab apply`
- `prefab instantiate`
- `prefab add-component`

目标：把 Prefab 当作稳定资产来创建、实例化和回写。

### 3. import

- `import asset`
- `import refresh`
- `import set-label`
- `import set-texture-type`
- `import set-model-options`

目标：覆盖最常见的资源导入与导入参数修改。

### 4. material

- `material create`
- `material assign-shader`
- `material set-color`
- `material set-float`
- `material set-texture`
- `material enable-keyword`
- `material disable-keyword`

目标：覆盖 URP 下最稳定、最常见的材质改动。

### 5. shader

- `shader find`
- `shader assign`
- `shader list-properties`

目标：首版只做 shader 引用、查询和属性发现，不做 Shader Graph 节点编辑。

### 6. build

- `build player`
- `build compile-check`

目标：支持命令行构建和纯编译校验。

`build assetbundles` 可作为第二阶段能力，不要求首版强行纳入。

### 7. test

- `test run --platform editmode`
- `test run --platform playmode`

目标：在无 GUI 模式下跑 Unity Test Framework，并拿到结构化结果。

### 8. code

- `code edit-file`
- `code edit-method`
- `code insert-field`
- `code replace-block`

目标：只支持**定向代码修改**，要求显式指定目标文件、类或方法，不支持自然语言自动找代码。

### 9. luna

- `luna build`
- `luna deploy`
- `luna rebuild`（可选）
- `luna size-report`（可选）

目标：在完成插件安装、登录和项目初始配置后，通过 CLI Bridge 统一驱动 Unity Playworks 的构建、部署和产物检查流程。

## Luna / Unity Playworks 集成定位

Luna（当前官方文档对应 Unity Playworks Plugin）需要纳入整体路线，并作为与 `scene`、`material`、`build` 同等级的首版基础命令组之一交付。

原因如下：

1. 官方确实提供命令行能力，可通过 Jake tasks 在终端执行导出、打包和部署。
2. 但命令行使用前必须先在 Unity 插件中登录，否则会出现认证失败。
3. 命令行构建依赖插件 UI 中已经保存好的配置，而不是完全脱离 Editor 状态的纯 headless 协议。
4. 插件本身依赖在线认证，离线状态下不可用。

因此，Luna 在本设计中的定位应为：

1. 作为 Unity CLI Bridge 的首版正式命令组之一
2. 纳入首版协议、错误模型和验收范围
3. 在满足插件安装、Unity 内登录、项目完成基础配置和网络可用的前提下启用

## Luna 命令组建议

建议将 Luna 命令组直接纳入首版：

- `unity-cli luna build`
- `unity-cli luna deploy`
- `unity-cli luna rebuild`（可选）
- `unity-cli luna size-report`（可选）

其内部 action 可映射为：

- `luna.build`
- `luna.deploy`
- `luna.rebuild`
- `luna.size-report`

这组命令不直接复用普通 `build player` 的执行器，而是通过专门的 `LunaActions` 和外部进程适配层驱动官方 Jake tasks。

## Luna 前置条件

Luna 命令组执行前必须满足以下前置条件，否则直接返回结构化失败：

1. Playworks Plugin 已正确安装到当前 Unity 项目中
2. 当前机器已在 Unity 插件中完成登录
3. 插件所需项目配置已在 Unity 中完成并已持久化
4. 当前环境具备网络连接，可完成官方认证
5. Luna / Playworks 包目录和 Jake 运行环境可被外部 CLI 正确解析

如果任一条件不满足，结果应返回：

- `ok: false`
- `code: LUNA_PREREQUISITE_FAILED`
- `summary: Luna 前置条件未满足`

## Luna 验证闭环

虽然 Luna 的执行依赖一次性人工 bootstrap，但它既然属于首版基础能力，就仍然必须遵守与其他首版命令组一致的结构化验证原则。

推荐最小验证闭环如下：

1. 校验插件目录和执行入口存在
2. 校验登录态或令牌信息可用
3. 执行 Jake task
4. 校验构建输出目录或归档文件存在
5. 如果是 deploy，校验平台返回成功状态或已生成可追踪结果

推荐增加以下专用错误码：

1. `LUNA_PREREQUISITE_FAILED`
2. `LUNA_AUTH_REQUIRED`
3. `LUNA_BUILD_FAILED`
4. `LUNA_DEPLOY_FAILED`

## 首版命令边界补充

为了把 Luna 明确纳入首版，同时不误导为“零前置能力”，建议把首版基础命令组理解为两类：

### 首版通用基础命令组

- `scene`
- `prefab`
- `import`
- `material`
- `shader`
- `build`
- `test`
- `code`

### 首版带 bootstrap 前置条件的基础命令组

- `luna`

`luna` 命令组的目标是：

1. 让 CLI Bridge 可以统一驱动 Unity Playworks 的构建与部署流程
2. 把 Luna 集成纳入结构化请求/结果协议
3. 明确保留其“依赖已登录插件和在线认证”的现实限制，不对外误报为零前置纯 headless 能力
4. 在用户完成一次性人工 bootstrap 后，仍然满足后续日常执行无需打开 Unity Editor 窗口

## 首版成功标准

首版完成后，应满足以下验收标准：

1. 任意一个 Unity URP 项目拷入 scaffold 后，可以直接跑通通用基础命令；如需使用 Luna，则允许先完成一次性 bootstrap。
2. 所有写命令都返回结构化结果和验证信息。
3. 所有代码修改命令都能在修改后给出编译状态。
4. 除 Luna 的一次性安装、登录和基础配置外，后续日常执行流程不要求打开 Unity Editor 窗口。
5. 在完成一次性插件安装、登录和基础配置后，`luna build` 与 `luna deploy` 可通过 CLI 稳定执行并返回结构化结果。

## 主要风险

首版的主要风险包括：

1. 试图纳入太多必须依赖 GUI 语义的资产编辑能力，导致“无 GUI”约束失真。
2. 外部 CLI 与 Unity 内部协议同时频繁变化，导致接口不稳定。
3. 验证闭环做得不够硬，使命令表面成功但最终状态不可依赖。
4. 代码修改范围过宽，导致命令失去确定性和安全边界。
5. 不同 Unity URP 项目的差异使某些命令假设失效，因此需要严格依赖“显式参数 + 执行后验证”而不是隐式推断。
6. Luna / Unity Playworks 虽然纳入首版，但其命令能力依赖登录态、在线认证和 UI 预配置，因此文档与错误模型必须持续明确“首版支持”不等于“零前置条件”。

## 推荐下一步

本设计之后的下一步应当是编写详细 implementation plan，并按以下顺序推进：

1. 定义 Unity 内部请求/结果模型与单入口
2. 实现动作分发器和基础错误模型
3. 打通最小闭环命令组：
   `scene`、`material`、`build compile-check`
4. 加入 `shader`、`test` 和 `code` 的定向编辑能力
5. 打通 `luna build` 的前置条件检查、执行器和结果协议
6. 最后补齐外部 CLI 的命令体验与输出包装

实现阶段必须坚持：

1. 先做可验证的最小闭环
2. 每加入一个命令组，都同时补齐结构化结果和验证逻辑
3. 不为了追求“看起来很全”而提前纳入 GUI 强依赖能力
