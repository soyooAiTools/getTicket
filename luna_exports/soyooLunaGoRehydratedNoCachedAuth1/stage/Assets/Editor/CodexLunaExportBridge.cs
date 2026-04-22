using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using UnityEditor;
using UnityEngine;

namespace Codex.Luna.Cli
{
    [Serializable]
    internal sealed class LunaExportRequest
    {
        public string targetPlatform;
        public string targetPath;
        public string creativeName;
        public string[] scenes;
    }

    [Serializable]
    internal sealed class LunaExportResult
    {
        public bool ok;
        public string code;
        public string summary;
        public string requestPath;
        public string targetPath;
        public int producedFileCount;
        public string[] producedFiles;
        public string[] logs;
    }

    public static class LunaExportBridge
    {
        private const string DefaultRequestAssetPath = "Assets/.export-assets";
        private const string DefaultResultRelativePath = "LunaTemp/codex-luna-export-result.json";
        private const string DefaultLogRelativePath = "LunaTemp/codex-luna-export-bridge.log";
        private const double ExportFallbackDelaySeconds = 20d;
        private const double BuildAbortDetectionGraceSeconds = 30d;

        private static ExportState _state;

        public static void Export()
        {
            if (_state != null)
            {
                Debug.LogWarning("Codex Luna export bridge is already running.");
                return;
            }

            _state = ExportState.Create(ParseArgs());
            Application.logMessageReceived += OnLogMessageReceived;
            EditorApplication.update += OnEditorUpdate;
            EditorApplication.quitting += OnEditorQuitting;
            EditorApplication.delayCall += Begin;
        }

        private static void Begin()
        {
            if (_state == null)
            {
                return;
            }

            _state.Log("Bridge booted.");

            if (File.Exists(_state.RequestPath))
            {
                StartExport();
                return;
            }

            _state.Log("Waiting for export request file: " + _state.RequestPath);
            _state.Phase = ExportPhase.WaitingForRequest;
        }

        private static void OnEditorUpdate()
        {
            if (_state == null)
            {
                return;
            }

            try
            {
                switch (_state.Phase)
                {
                    case ExportPhase.WaitingForRequest:
                        if (File.Exists(_state.RequestPath))
                        {
                            StartExport();
                        }
                        else if (_state.Elapsed.TotalSeconds > _state.RequestWaitSeconds)
                        {
                            Fail("REQUEST_FILE_TIMEOUT", "Timed out waiting for export request file.", null);
                        }

                        break;

                    case ExportPhase.WaitingForWindow:
                        if (_state.ShouldLogPollingStatus())
                        {
                            LogTutorialMediatorState("waiting-window");
                        }

                        if (IsLunaWindowInitialized())
                        {
                            _state.Log("Luna window reported initialized.");
                            LaunchExport();
                        }
                        else if ((DateTime.UtcNow - _state.WindowInitStartedUtc).TotalSeconds > 30d)
                        {
                            Fail("LUNA_WINDOW_INIT_TIMEOUT", "Timed out waiting for Luna window initialization.", null);
                        }

                        break;

                    case ExportPhase.Exporting:
                        if (_state.ShouldLogPollingStatus())
                        {
                            LogTutorialMediatorState("poll");
                        }

                        var buildInProcess = IsLunaBuildInProcess();
                        if (buildInProcess)
                        {
                            _state.NoteBuildInProcess();
                        }

                        if (!_state.WindowExportHandlerAttempted &&
                            _state.ExportElapsed.TotalSeconds >= 5d &&
                            !buildInProcess)
                        {
                            _state.WindowExportHandlerAttempted = true;
                            TryInvokeWindowExportHandler();
                        }

                        if (IsExportComplete())
                        {
                            Succeed("Export completed successfully.");
                            return;
                        }

                        if (!_state.FallbackInvoked &&
                            _state.ExportElapsed.TotalSeconds >= ExportFallbackDelaySeconds)
                        {
                            _state.FallbackInvoked = true;
                            _state.Log("Primary export still pending. Invoking postprocessor fallback.");
                            TryInvokePostprocessor();
                        }

                        if (_state.ShouldAbortStoppedBuild(buildInProcess) && !HasNewOutputFiles())
                        {
                            Fail("LUNA_BUILD_ABORTED", _state.GetBuildAbortSummary(), null);
                            return;
                        }

                        if (_state.ExportElapsed.TotalSeconds > _state.TimeoutSeconds)
                        {
                            Fail("EXPORT_TIMEOUT", "Timed out waiting for Luna export output.", null);
                        }

                        break;
                }
            }
            catch (Exception ex)
            {
                Fail("EXPORT_BRIDGE_FAILED", "Export bridge threw an exception.", ex);
            }
        }

        private static void StartExport()
        {
            if (_state == null || _state.Phase == ExportPhase.Exporting)
            {
                return;
            }

            if (!_state.ExportPrepared)
            {
                EnsureRequestLoaded();
                Directory.CreateDirectory(_state.TargetPath);
                _state.CaptureExistingOutput();
                LogTutorialMediatorState("before-window-init");
                SubscribeLunaEvents();
                _state.ExportPrepared = true;
            }

            if (!IsLunaWindowInitialized())
            {
                if (!_state.WindowInitAttempted)
                {
                    _state.WindowInitAttempted = true;
                    _state.WindowInitStartedUtc = DateTime.UtcNow;
                    TryInitializeLunaWindow();
                }

                _state.Phase = ExportPhase.WaitingForWindow;
                return;
            }

            LaunchExport();
        }

        private static void LaunchExport()
        {
            if (_state == null || _state.Phase == ExportPhase.Exporting)
            {
                return;
            }

            _state.ExportStartedUtc = DateTime.UtcNow;
            LogTutorialMediatorState("before-refresh");
            LogRequestFileSnapshot("before-refresh");

            _state.Log("Refreshing AssetDatabase before export.");
            AssetDatabase.Refresh(ImportAssetOptions.ForceUpdate | ImportAssetOptions.ForceSynchronousImport);

            if (!string.IsNullOrEmpty(_state.RequestAssetPath))
            {
                _state.Log("Importing request asset: " + _state.RequestAssetPath);
                AssetDatabase.ImportAsset(
                    _state.RequestAssetPath,
                    ImportAssetOptions.ForceUpdate | ImportAssetOptions.ForceSynchronousImport);
            }

            LogRequestFileSnapshot("before-export");
            _state.Log("Invoking LunaCLI.Export().");
            InvokeLunaCliExport();
            LogTutorialMediatorState("after-export");

            if (!IsLunaBuildInProcess())
            {
                TryKickBuildService();
            }

            _state.Phase = ExportPhase.Exporting;
        }

        private static void EnsureRequestLoaded()
        {
            if (_state == null)
            {
                throw new InvalidOperationException("Bridge state is not initialized.");
            }

            if (!File.Exists(_state.RequestPath))
            {
                throw new FileNotFoundException("Export request file not found.", _state.RequestPath);
            }

            var requestJson = File.ReadAllText(_state.RequestPath);
            var request = JsonUtility.FromJson<LunaExportRequest>(requestJson) ?? new LunaExportRequest();
            if (request.scenes == null || request.scenes.Length == 0)
            {
                request.scenes = EditorBuildSettings.scenes
                    .Where(scene => scene != null && scene.enabled && !string.IsNullOrWhiteSpace(scene.path))
                    .Select(scene => scene.path)
                    .ToArray();

                if (request.scenes.Length > 0)
                {
                    _state.Log("Filled missing request scenes from EditorBuildSettings: " + string.Join(", ", request.scenes));
                    requestJson = ReplaceJsonStringArray(requestJson, "scenes", request.scenes);
                    File.WriteAllText(_state.RequestPath, requestJson);
                    _state.Log("Persisted request scenes back to request file.");

                    if (!string.IsNullOrEmpty(_state.RequestAssetPath))
                    {
                        AssetDatabase.ImportAsset(
                            _state.RequestAssetPath,
                            ImportAssetOptions.ForceUpdate | ImportAssetOptions.ForceSynchronousImport);
                        _state.Log("Reimported request asset after scene backfill: " + _state.RequestAssetPath);
                    }
                }
            }

            TrySynchronizeLunaCacheScenes(request);
            TrySynchronizeLunaProjectScenes(request);
            _state.Request = request;

            if (string.IsNullOrWhiteSpace(_state.TargetPath))
            {
                _state.TargetPath = string.IsNullOrWhiteSpace(request.targetPath)
                    ? Path.Combine(_state.ProjectRoot, "LunaTemp", "stage1")
                    : Path.GetFullPath(request.targetPath);
            }

            _state.Log("Resolved target path: " + _state.TargetPath);
            if (request.scenes != null && request.scenes.Length > 0)
            {
                _state.Log("Scenes: " + string.Join(", ", request.scenes));
            }
        }

        private static void TrySynchronizeLunaCacheScenes(LunaExportRequest request)
        {
            if (_state == null || request == null || request.scenes == null || request.scenes.Length == 0)
            {
                return;
            }

            var cachePath = Path.Combine(_state.ProjectRoot, "LunaTemp", "luna-cache.json");
            if (!File.Exists(cachePath))
            {
                return;
            }

            var cacheJson = File.ReadAllText(cachePath);
            var serializedScenes = "[" + string.Join(
                ",",
                request.scenes.Select(scene => "\"" + scene.Replace("\\", "\\\\").Replace("\"", "\\\"") + "\"")) + "]";

            var updatedJson = new Regex("(\"scenes\"\\s*:\\s*)\\[[^\\]]*\\]")
                .Replace(cacheJson, match => match.Groups[1].Value + serializedScenes, 1);

            var startupScene = request.scenes.Length > 0 ? 0 : -1;
            updatedJson = new Regex("(\"startupScene\"\\s*:\\s*)-?\\d+")
                .Replace(updatedJson, match => match.Groups[1].Value + startupScene, 1);

            if (string.Equals(cacheJson, updatedJson, StringComparison.Ordinal))
            {
                return;
            }

            File.WriteAllText(cachePath, updatedJson);
            _state.Log("Synchronized Luna cache scenes: " + string.Join(", ", request.scenes));
        }

        private static void TrySynchronizeLunaProjectScenes(LunaExportRequest request)
        {
            if (_state == null || request == null || request.scenes == null || request.scenes.Length == 0)
            {
                return;
            }

            var configPath = Path.Combine(_state.ProjectRoot, "luna.json");
            if (!File.Exists(configPath))
            {
                return;
            }

            var configJson = File.ReadAllText(configPath);
            var serializedScenes = "[" + string.Join(
                ",",
                request.scenes.Select(scene => "\"" + scene.Replace("\\", "\\\\").Replace("\"", "\\\"") + "\"")) + "]";

            var updatedJson = new Regex("(\"scenes\"\\s*:\\s*)\\[[^\\]]*\\]")
                .Replace(configJson, match => match.Groups[1].Value + serializedScenes, 1);

            updatedJson = new Regex("(\"disabledScenes\"\\s*:\\s*)\\[[^\\]]*\\]")
                .Replace(updatedJson, match => match.Groups[1].Value + "[]", 1);

            updatedJson = new Regex("(\"startupScene\"\\s*:\\s*)-?\\d+")
                .Replace(updatedJson, match => match.Groups[1].Value + "0", 1);

            if (string.Equals(configJson, updatedJson, StringComparison.Ordinal))
            {
                return;
            }

            File.WriteAllText(configPath, updatedJson);
            _state.Log("Synchronized luna.json scenes: " + string.Join(", ", request.scenes));
        }

        private static string ReplaceJsonStringArray(string json, string key, string[] values)
        {
            var serializedValues = "[" + string.Join(
                ",",
                values.Select(value => "\"" + value.Replace("\\", "\\\\").Replace("\"", "\\\"") + "\"")) + "]";

            return new Regex("(\"" + Regex.Escape(key) + "\"\\s*:\\s*)\\[[^\\]]*\\]")
                .Replace(json, match => match.Groups[1].Value + serializedValues, 1);
        }

        private static void LogRequestFileSnapshot(string stage)
        {
            if (_state == null || string.IsNullOrWhiteSpace(_state.RequestPath) || !File.Exists(_state.RequestPath))
            {
                return;
            }

            try
            {
                _state.Log("Request snapshot [" + stage + "]: " + File.ReadAllText(_state.RequestPath));
            }
            catch (Exception ex)
            {
                _state.Log("Failed to read request snapshot [" + stage + "]: " + ex.Message);
            }
        }

        private static bool IsExportComplete()
        {
            if (_state == null)
            {
                return false;
            }

            if (!Directory.Exists(_state.TargetPath))
            {
                return false;
            }

            if (!HasNewOutputFiles())
            {
                return false;
            }

            if (IsLunaBuildInProcess())
            {
                return false;
            }

            if (RequiresSceneOutput() && !HasExportedScenes())
            {
                _state.Log("Export output is still missing scene artifacts under assets/scenes.");
                return false;
            }

            return true;
        }

        private static bool HasNewOutputFiles()
        {
            if (_state == null || !Directory.Exists(_state.TargetPath))
            {
                return false;
            }

            foreach (var file in Directory.GetFiles(_state.TargetPath, "*", SearchOption.AllDirectories))
            {
                var fullPath = Path.GetFullPath(file);
                if (_state.ExistingOutput.Contains(fullPath))
                {
                    if (File.GetLastWriteTimeUtc(fullPath) > _state.ExportStartedUtc.AddSeconds(-1))
                    {
                        return true;
                    }

                    continue;
                }

                return true;
            }

            return false;
        }

        private static bool RequiresSceneOutput()
        {
            return _state?.Request?.scenes != null && _state.Request.scenes.Length > 0;
        }

        private static bool HasExportedScenes()
        {
            if (_state == null || string.IsNullOrWhiteSpace(_state.TargetPath))
            {
                return false;
            }

            var sceneDirectory = Path.Combine(_state.TargetPath, "assets", "scenes");
            return Directory.Exists(sceneDirectory) &&
                   Directory.GetFiles(sceneDirectory, "*", SearchOption.AllDirectories).Length > 0;
        }

        private static bool HasEssentialExportOutputs()
        {
            if (_state == null || string.IsNullOrWhiteSpace(_state.TargetPath) || !Directory.Exists(_state.TargetPath))
            {
                return false;
            }

            if (!HasNewOutputFiles())
            {
                return false;
            }

            if (RequiresSceneOutput() && !HasExportedScenes())
            {
                return false;
            }

            var jsDirectory = Path.Combine(_state.TargetPath, "js");
            if (!Directory.Exists(jsDirectory))
            {
                return false;
            }

            return File.Exists(Path.Combine(jsDirectory, "playground.json")) &&
                   File.Exists(Path.Combine(jsDirectory, "unity.json"));
        }

        private static void InvokeLunaCliExport()
        {
            var method = FindStaticMethod("LunaCLI", "Export");
            if (method == null)
            {
                throw new MissingMethodException("Could not locate LunaCLI.Export().");
            }

            method.Invoke(null, null);
        }

        private static void TryInvokePostprocessor()
        {
            if (_state == null || string.IsNullOrEmpty(_state.RequestAssetPath))
            {
                return;
            }

            var method = FindStaticMethod(
                "Luna.Unity.EditorScripts.LunaAssetPostprocessor",
                "OnPostprocessAllAssets");

            if (method == null)
            {
                _state.Log("Fallback postprocessor was not found.");
                return;
            }

            method.Invoke(
                null,
                new object[]
                {
                    new[] { _state.RequestAssetPath },
                    Array.Empty<string>(),
                    Array.Empty<string>(),
                    Array.Empty<string>()
                });
        }

        private static MethodInfo FindStaticMethod(string typeName, string methodName)
        {
            foreach (var assembly in AppDomain.CurrentDomain.GetAssemblies())
            {
                var type = assembly.GetType(typeName, false);
                if (type == null)
                {
                    continue;
                }

                var method = type.GetMethod(
                    methodName,
                    BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Static);

                if (method != null)
                {
                    return method;
                }
            }

            return null;
        }

        private static void SubscribeLunaEvents()
        {
            SubscribeStaticActionEvent(
                "Luna.Unity.EditorScripts.LunaAssetPostprocessor",
                "OnPostProcessed",
                () => _state?.Log("Event fired: LunaAssetPostprocessor.OnPostProcessed"));

            SubscribeStaticActionEvent(
                "Luna.Unity.Utils.Shaders.LunaSVC",
                "OnBuildCompleted",
                () => _state?.Log("Event fired: LunaSVC.OnBuildCompleted"));
        }

        private static void SubscribeStaticActionEvent(string typeName, string eventName, Action handler)
        {
            var type = FindType(typeName);
            var eventInfo = type?.GetEvent(
                eventName,
                BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Static);

            if (eventInfo == null)
            {
                _state?.Log("Event not found: " + typeName + "." + eventName);
                return;
            }

            eventInfo.AddEventHandler(null, handler);
            _state?.Log("Subscribed to event: " + typeName + "." + eventName);
        }

        private static void LogTutorialMediatorState(string stage)
        {
            var type = FindType("Luna.Unity.Tutorial.TutorialMediator");
            if (type == null)
            {
                _state?.Log("TutorialMediator type not found at stage " + stage + ".");
                return;
            }

            var isUserSignedIn = ReadStaticProperty(type, "isUserSignedIn");
            var isLunaWindowInit = ReadStaticProperty(type, "IsLunaWindowInit");
            var isBuildInProcess = ReadStaticProperty(type, "IsBuildInProcess");
            var scenesInBuild = ReadStaticProperty(type, "ScenesInBuild") as System.Collections.IEnumerable;
            var startupSceneMethod = type.GetMethod(
                "StartupScene",
                BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Static);

            string startupScene = null;
            if (startupSceneMethod != null)
            {
                startupScene = startupSceneMethod.Invoke(null, null) as string;
            }

            var scenes = scenesInBuild == null
                ? string.Empty
                : string.Join(", ", scenesInBuild.Cast<object>().Select(item => item?.ToString() ?? "<null>"));

            _state?.Log(
                string.Format(
                    "TutorialMediator[{0}] signedIn={1}, windowInit={2}, buildInProcess={3}, startupScene={4}, scenes=[{5}]",
                    stage,
                    isUserSignedIn ?? "<null>",
                    isLunaWindowInit ?? "<null>",
                    isBuildInProcess ?? "<null>",
                    startupScene ?? "<null>",
                    scenes));
        }

        private static bool IsLunaWindowInitialized()
        {
            var type = FindType("Luna.Unity.Tutorial.TutorialMediator");
            var value = ReadStaticProperty(type, "IsLunaWindowInit");
            return value is bool flag && flag;
        }

        private static bool IsLunaBuildInProcess()
        {
            var type = FindType("Luna.Unity.Tutorial.TutorialMediator");
            var value = ReadStaticProperty(type, "IsBuildInProcess");
            return value is bool flag && flag;
        }

        private static void TryInitializeLunaWindow()
        {
            var type = FindType("Luna.Unity.EditorScripts.Interface.LunaExportWindow");
            if (type == null)
            {
                _state?.Log("LunaExportWindow type not found.");
                return;
            }

            _state?.Log("Attempting Luna window initialization.");
            var window = EditorWindow.GetWindow(type, false, "Unity Playworks Plugin 7.1.0", false);
            _state.WindowInstance = window;
            if (window == null)
            {
                _state?.Log("Failed to create LunaExportWindow instance.");
                return;
            }

            InvokeInstanceLifecycle(window, "Awake");
            InvokeInstanceLifecycle(window, "OnEnable");
            window.Repaint();
            LogTutorialMediatorState("after-window-init-attempt");
        }

        private static void TryInvokeWindowExportHandler()
        {
            var window = _state?.WindowInstance;
            if (window == null)
            {
                _state?.Log("Window export handler skipped because Luna window instance is null.");
                return;
            }

            var method = window.GetType().GetMethod(
                "method_21",
                BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance,
                null,
                new[] { typeof(object), typeof(EventArgs) },
                null);

            if (method == null)
            {
                _state?.Log("Window export handler method_21(object, EventArgs) was not found.");
                return;
            }

            _state?.Log("Invoking LunaExportWindow.method_21(object, EventArgs) fallback.");
            method.Invoke(window, new object[] { null, EventArgs.Empty });
            LogTutorialMediatorState("after-window-handler");
        }

        private static object GetBuildServiceInstance(EditorWindow window)
        {
            var method = window.GetType().GetMethod(
                "method_1",
                BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance,
                null,
                Type.EmptyTypes,
                null);

            return method?.Invoke(window, null);
        }

        private static void TryKickBuildService()
        {
            if (_state == null || _state.BuildServiceKickAttempted)
            {
                return;
            }

            _state.BuildServiceKickAttempted = true;

            if (_state.WindowInstance == null)
            {
                _state.Log("BuildService kick skipped because Luna window instance is null.");
                return;
            }

            var buildService = GetBuildServiceInstance(_state.WindowInstance);
            if (buildService == null)
            {
                _state.Log("BuildService kick skipped because BuildService instance was not resolved.");
                return;
            }

            var method = buildService.GetType().GetMethod(
                "method_9",
                BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance,
                null,
                Type.EmptyTypes,
                null);

            if (method == null)
            {
                _state.Log("BuildService.method_9() was not found.");
                return;
            }

            _state.Log("Invoking BuildService.method_9() fallback.");
            method.Invoke(buildService, null);
            if (IsLunaBuildInProcess())
            {
                _state.NoteBuildInProcess();
            }
            LogTutorialMediatorState("after-build-service-kick");
        }

        private static void InvokeInstanceLifecycle(object instance, string methodName)
        {
            var method = instance.GetType().GetMethod(
                methodName,
                BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance);

            if (method == null)
            {
                _state?.Log("Lifecycle method not found: " + methodName);
                return;
            }

            var result = method.Invoke(instance, null);
            if (result is Task)
            {
                _state?.Log("Lifecycle method returned task: " + methodName);
            }
        }

        private static object ReadStaticProperty(Type type, string propertyName)
        {
            if (type == null)
            {
                return null;
            }

            var property = type.GetProperty(
                propertyName,
                BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Static);

            return property?.GetValue(null, null);
        }

        private static Type FindType(string typeName)
        {
            foreach (var assembly in AppDomain.CurrentDomain.GetAssemblies())
            {
                var type = assembly.GetType(typeName, false);
                if (type != null)
                {
                    return type;
                }
            }

            return null;
        }

        private static Dictionary<string, string> ParseArgs()
        {
            var args = Environment.GetCommandLineArgs();
            var parsed = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

            for (var index = 0; index < args.Length; index++)
            {
                var token = args[index];
                if (!token.StartsWith("--", StringComparison.Ordinal))
                {
                    continue;
                }

                if (index + 1 >= args.Length)
                {
                    continue;
                }

                parsed[token] = args[index + 1];
                index++;
            }

            return parsed;
        }

        private static void OnLogMessageReceived(string condition, string stackTrace, LogType type)
        {
            _state?.Log("[" + type + "] " + condition);
            if (_state != null && type == LogType.Exception && !string.IsNullOrWhiteSpace(stackTrace))
            {
                _state.Log(stackTrace);
            }

            _state?.TrackRuntimeFailure(condition, stackTrace, type);
        }

        private static void OnEditorQuitting()
        {
            if (_state == null || _state.Finalized)
            {
                return;
            }

            var hasCompleteOutput = false;
            try
            {
                hasCompleteOutput = IsExportComplete() || HasEssentialExportOutputs();
            }
            catch
            {
                hasCompleteOutput = false;
            }

            var result = hasCompleteOutput
                ? CreateResult(true, "OK", "Unity quit after Luna export produced complete output.")
                : CreateResult(false, "UNITY_QUIT_BEFORE_RESULT", "Unity quit before the bridge finalized with complete export output.");

            Directory.CreateDirectory(Path.GetDirectoryName(_state.ResultPath) ?? _state.ProjectRoot);
            File.WriteAllText(_state.ResultPath, JsonUtility.ToJson(result, true));
            _state.Finalized = true;
        }

        private static void Succeed(string summary)
        {
            if (_state == null)
            {
                return;
            }

            Finish(CreateResult(true, "OK", summary), 0);
        }

        private static void Fail(string code, string summary, Exception exception)
        {
            if (_state == null)
            {
                Debug.LogError(summary + (exception == null ? string.Empty : Environment.NewLine + exception));
                EditorApplication.Exit(1);
                return;
            }

            if (exception != null)
            {
                _state.Log(exception.ToString());
                Debug.LogException(exception);
            }
            else
            {
                Debug.LogError(summary);
            }

            Finish(CreateResult(false, code, summary), 1);
        }

        private static void Finish(LunaExportResult result, int exitCode)
        {
            if (_state != null)
            {
                Directory.CreateDirectory(Path.GetDirectoryName(_state.ResultPath) ?? _state.ProjectRoot);
                File.WriteAllText(_state.ResultPath, JsonUtility.ToJson(result, true));
                _state.Finalized = true;
            }

            EditorApplication.update -= OnEditorUpdate;
            Application.logMessageReceived -= OnLogMessageReceived;
            EditorApplication.quitting -= OnEditorQuitting;
            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);
            _state = null;
            EditorApplication.Exit(exitCode);
        }

        private static LunaExportResult CreateResult(bool ok, string code, string summary)
        {
            var result = new LunaExportResult
            {
                ok = ok,
                code = code,
                summary = summary,
                requestPath = _state?.RequestPath,
                targetPath = _state?.TargetPath,
                producedFiles = _state?.GetProducedFiles() ?? Array.Empty<string>(),
                logs = _state?.Logs.ToArray() ?? Array.Empty<string>()
            };
            result.producedFileCount = result.producedFiles.Length;
            return result;
        }

        private sealed class ExportState
        {
            public string ProjectRoot;
            public string RequestPath;
            public string RequestAssetPath;
            public string ResultPath;
            public string LogPath;
            public string TargetPath;
            public double TimeoutSeconds;
            public double RequestWaitSeconds;
            public DateTime StartedUtc;
            public DateTime ExportStartedUtc;
            public DateTime LastPollingStatusUtc;
            public DateTime WindowInitStartedUtc;
            public DateTime BuildActiveUtc;
            public DateTime LastFailureUtc;
            public ExportPhase Phase;
            public bool FallbackInvoked;
            public bool ExportPrepared;
            public bool WindowInitAttempted;
            public bool WindowExportHandlerAttempted;
            public bool BuildServiceKickAttempted;
            public bool BuildWasInProcess;
            public bool Finalized;
            public string LastFailureCondition;
            public string LastFailureStackTrace;
            public LunaExportRequest Request;
            public EditorWindow WindowInstance;
            public readonly List<string> Logs = new List<string>();
            public readonly HashSet<string> ExistingOutput = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            public TimeSpan Elapsed => DateTime.UtcNow - StartedUtc;

            public TimeSpan ExportElapsed =>
                ExportStartedUtc == default ? TimeSpan.Zero : DateTime.UtcNow - ExportStartedUtc;

            public static ExportState Create(IReadOnlyDictionary<string, string> args)
            {
                var projectRoot = Path.GetDirectoryName(Application.dataPath) ?? Application.dataPath;
                var requestPath = GetArgument(args, "--codex-request-path") ??
                                  Path.Combine(projectRoot, DefaultRequestAssetPath.Replace('/', Path.DirectorySeparatorChar));
                var resultPath = GetArgument(args, "--codex-result-path") ??
                                 Path.Combine(projectRoot, DefaultResultRelativePath.Replace('/', Path.DirectorySeparatorChar));
                var targetPath = GetArgument(args, "--codex-target-path");
                var logPath = Path.Combine(projectRoot, DefaultLogRelativePath.Replace('/', Path.DirectorySeparatorChar));

                return new ExportState
                {
                    ProjectRoot = projectRoot,
                    RequestPath = Path.GetFullPath(requestPath),
                    RequestAssetPath = TryToAssetPath(projectRoot, requestPath),
                    ResultPath = Path.GetFullPath(resultPath),
                    LogPath = Path.GetFullPath(logPath),
                    TargetPath = string.IsNullOrWhiteSpace(targetPath) ? null : Path.GetFullPath(targetPath),
                    TimeoutSeconds = ParseDouble(GetArgument(args, "--codex-timeout-sec"), 900d),
                    RequestWaitSeconds = ParseDouble(GetArgument(args, "--codex-request-wait-sec"), 60d),
                    StartedUtc = DateTime.UtcNow,
                    Phase = ExportPhase.Initializing
                };
            }

            public void Log(string message)
            {
                var line = "[" + DateTime.Now.ToString("O") + "] " + message;
                Logs.Add(line);
                Directory.CreateDirectory(Path.GetDirectoryName(LogPath) ?? ProjectRoot);
                File.AppendAllText(LogPath, line + Environment.NewLine);
            }

            public void CaptureExistingOutput()
            {
                ExistingOutput.Clear();
                if (!Directory.Exists(TargetPath))
                {
                    return;
                }

                foreach (var file in Directory.GetFiles(TargetPath, "*", SearchOption.AllDirectories))
                {
                    ExistingOutput.Add(Path.GetFullPath(file));
                }
            }

            public string[] GetProducedFiles()
            {
                if (string.IsNullOrWhiteSpace(TargetPath) || !Directory.Exists(TargetPath))
                {
                    return Array.Empty<string>();
                }

                return Directory
                    .GetFiles(TargetPath, "*", SearchOption.AllDirectories)
                    .Select(path => path.Substring(TargetPath.TrimEnd(Path.DirectorySeparatorChar).Length).TrimStart(Path.DirectorySeparatorChar))
                    .OrderBy(path => path, StringComparer.OrdinalIgnoreCase)
                    .ToArray();
            }

            public bool ShouldLogPollingStatus()
            {
                if (DateTime.UtcNow - LastPollingStatusUtc < TimeSpan.FromSeconds(15))
                {
                    return false;
                }

                LastPollingStatusUtc = DateTime.UtcNow;
                return true;
            }

            public void NoteBuildInProcess()
            {
                BuildWasInProcess = true;
                BuildActiveUtc = DateTime.UtcNow;
            }

            public void TrackRuntimeFailure(string condition, string stackTrace, LogType type)
            {
                if (Phase != ExportPhase.Exporting)
                {
                    return;
                }

                if (type != LogType.Error && type != LogType.Exception && type != LogType.Assert)
                {
                    return;
                }

                if (string.IsNullOrWhiteSpace(condition))
                {
                    return;
                }

                if (condition.IndexOf("No graphic device is available", StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    return;
                }

                if (condition.IndexOf("GfxDevice renderer is null", StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    return;
                }

                LastFailureUtc = DateTime.UtcNow;
                LastFailureCondition = condition.Trim();
                LastFailureStackTrace = string.IsNullOrWhiteSpace(stackTrace) ? null : stackTrace.Trim();
            }

            public bool ShouldAbortStoppedBuild(bool buildInProcess)
            {
                if (!BuildWasInProcess || buildInProcess)
                {
                    return false;
                }

                if (ExportElapsed.TotalSeconds < BuildAbortDetectionGraceSeconds)
                {
                    return false;
                }

                return true;
            }

            public string GetBuildAbortSummary()
            {
                const string fallbackSummary = "BuildService stopped before producing export output.";

                if (string.IsNullOrWhiteSpace(LastFailureCondition))
                {
                    return fallbackSummary;
                }

                return fallbackSummary + " Last error: " + LastFailureCondition;
            }

            private static string GetArgument(IReadOnlyDictionary<string, string> args, string key)
            {
                return args.TryGetValue(key, out var value) ? value : null;
            }

            private static double ParseDouble(string raw, double fallback)
            {
                return double.TryParse(raw, out var value) ? value : fallback;
            }

            private static string TryToAssetPath(string projectRoot, string fullOrRelativePath)
            {
                var absolutePath = Path.GetFullPath(fullOrRelativePath);
                var normalizedProjectRoot = Path.GetFullPath(projectRoot)
                    .TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar) + Path.DirectorySeparatorChar;

                if (!absolutePath.StartsWith(normalizedProjectRoot, StringComparison.OrdinalIgnoreCase))
                {
                    return null;
                }

                return absolutePath.Substring(normalizedProjectRoot.Length).Replace('\\', '/');
            }
        }

        private enum ExportPhase
        {
            Initializing,
            WaitingForRequest,
            WaitingForWindow,
            Exporting
        }
    }
}
