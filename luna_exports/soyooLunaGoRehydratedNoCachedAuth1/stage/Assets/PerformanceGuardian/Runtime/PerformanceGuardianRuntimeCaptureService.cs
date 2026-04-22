using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using Unity.Profiling;
using UnityEngine;

namespace PerformanceGuardian.Runtime
{
    public class PerformanceGuardianRuntimeCaptureService : MonoBehaviour
    {
        private const float SpikeThresholdMs = 33.33f;
        private const string ReportFileName = "player-capture.json";

        private readonly List<PerformanceGuardianFrameSample> _frames = new List<PerformanceGuardianFrameSample>();

        private PerformanceGuardianRuntimeSettings _settings;
        private float _elapsedSeconds;
        private bool _captureCompleted;

        public void Initialize(PerformanceGuardianRuntimeSettings settings)
        {
            _settings = settings ?? throw new ArgumentNullException(nameof(settings));
            ApplyQualityLevel(settings.QualityLevel);
        }

        private void Update()
        {
            if (_captureCompleted || _settings == null)
            {
                return;
            }

            _elapsedSeconds += Time.unscaledDeltaTime;
            FrameTimingManager.CaptureFrameTimings();

            if (_elapsedSeconds >= _settings.WarmupSeconds && _elapsedSeconds < _settings.WarmupSeconds + _settings.CaptureSeconds)
            {
                _frames.Add(CaptureFrameSample());
            }

            if (_elapsedSeconds >= _settings.WarmupSeconds + _settings.CaptureSeconds)
            {
                CompleteCapture();
            }
        }

        private void OnDestroy()
        {
        }

        public static PerformanceGuardianCaptureReport.SummaryData BuildSummary(PerformanceGuardianFrameSample[] frames)
        {
            var safeFrames = frames ?? new PerformanceGuardianFrameSample[0];
            if (safeFrames.Length == 0)
            {
                return new PerformanceGuardianCaptureReport.SummaryData();
            }

            return new PerformanceGuardianCaptureReport.SummaryData
            {
                P95CpuMainMs = Percentile(CollectCpuMainValues(safeFrames)),
                P95GpuMs = Percentile(CollectGpuValues(safeFrames)),
                P95DrawCalls = Percentile(CollectDrawCallValues(safeFrames)),
                SpikeCount = CountSpikes(safeFrames)
            };
        }

        private PerformanceGuardianFrameSample CaptureFrameSample()
        {
            var cpuMainMs = Time.unscaledDeltaTime * 1000f;
            return new PerformanceGuardianFrameSample
            {
                CpuMainMs = cpuMainMs,
                CpuRenderMs = 0f,
                GpuMs = 0f,
                DrawCalls = 0,
                SetPassCalls = 0,
                Batches = 0,
                Triangles = 0,
                Vertices = 0
            };
        }

        private void CompleteCapture()
        {
            _captureCompleted = true;

            var report = new PerformanceGuardianCaptureReport
            {
                RunId = _settings.RunId,
                Frames = new List<PerformanceGuardianFrameSample>(_frames),
                Summary = BuildSummary(_frames.ToArray())
            };

            Directory.CreateDirectory(_settings.OutputRoot);
            var reportPath = Path.Combine(_settings.OutputRoot, ReportFileName);
            File.WriteAllText(reportPath, SerializeReport(report));
            QuitSuccessfully();
        }

        private static float[] CollectCpuMainValues(PerformanceGuardianFrameSample[] frames)
        {
            var values = new float[frames.Length];
            for (var index = 0; index < frames.Length; index++)
            {
                values[index] = frames[index].CpuMainMs;
            }

            return values;
        }

        private static float[] CollectGpuValues(PerformanceGuardianFrameSample[] frames)
        {
            var values = new float[frames.Length];
            for (var index = 0; index < frames.Length; index++)
            {
                values[index] = frames[index].GpuMs;
            }

            return values;
        }

        private static int[] CollectDrawCallValues(PerformanceGuardianFrameSample[] frames)
        {
            var values = new int[frames.Length];
            for (var index = 0; index < frames.Length; index++)
            {
                values[index] = frames[index].DrawCalls;
            }

            return values;
        }

        private static int CountSpikes(PerformanceGuardianFrameSample[] frames)
        {
            var spikeCount = 0;
            for (var index = 0; index < frames.Length; index++)
            {
                var frame = frames[index];
                if (frame.CpuMainMs >= SpikeThresholdMs || frame.GpuMs >= SpikeThresholdMs)
                {
                    spikeCount++;
                }
            }

            return spikeCount;
        }

        private static string SerializeReport(PerformanceGuardianCaptureReport report)
        {
            var builder = new StringBuilder(512);
            builder.AppendLine("{");
            builder.Append("  \"RunId\": \"").Append(EscapeJson(report.RunId)).AppendLine("\",");
            builder.AppendLine("  \"Frames\": [");

            for (var index = 0; index < report.Frames.Count; index++)
            {
                var frame = report.Frames[index];
                builder.AppendLine("    {");
                builder.Append("      \"CpuMainMs\": ").Append(FormatFloat(frame.CpuMainMs)).AppendLine(",");
                builder.Append("      \"CpuRenderMs\": ").Append(FormatFloat(frame.CpuRenderMs)).AppendLine(",");
                builder.Append("      \"GpuMs\": ").Append(FormatFloat(frame.GpuMs)).AppendLine(",");
                builder.Append("      \"DrawCalls\": ").Append(frame.DrawCalls).AppendLine(",");
                builder.Append("      \"SetPassCalls\": ").Append(frame.SetPassCalls).AppendLine(",");
                builder.Append("      \"Batches\": ").Append(frame.Batches).AppendLine(",");
                builder.Append("      \"Triangles\": ").Append(frame.Triangles).AppendLine(",");
                builder.Append("      \"Vertices\": ").Append(frame.Vertices).AppendLine();
                builder.Append("    }");
                builder.AppendLine(index == report.Frames.Count - 1 ? string.Empty : ",");
            }

            builder.AppendLine("  ],");
            builder.AppendLine("  \"Summary\": {");
            builder.Append("    \"P95CpuMainMs\": ").Append(FormatFloat(report.Summary.P95CpuMainMs)).AppendLine(",");
            builder.Append("    \"P95GpuMs\": ").Append(FormatFloat(report.Summary.P95GpuMs)).AppendLine(",");
            builder.Append("    \"P95DrawCalls\": ").Append(report.Summary.P95DrawCalls).AppendLine(",");
            builder.Append("    \"SpikeCount\": ").Append(report.Summary.SpikeCount).AppendLine();
            builder.AppendLine("  }");
            builder.AppendLine("}");
            return builder.ToString();
        }

        private static string EscapeJson(string value)
        {
            return (value ?? string.Empty).Replace("\\", "\\\\").Replace("\"", "\\\"");
        }

        private static string FormatFloat(float value)
        {
            return value.ToString("0.###", CultureInfo.InvariantCulture);
        }

        private static void ApplyQualityLevel(string qualityLevel)
        {
            if (string.IsNullOrWhiteSpace(qualityLevel))
            {
                return;
            }

            var qualityLevels = QualitySettings.names;
            for (var index = 0; index < qualityLevels.Length; index++)
            {
                if (string.Equals(qualityLevels[index], qualityLevel, StringComparison.OrdinalIgnoreCase))
                {
                    QualitySettings.SetQualityLevel(index, true);
                    return;
                }
            }
        }

        private static void QuitSuccessfully()
        {
#if UNITY_EDITOR
            Application.Quit();
#else
            Environment.Exit(0);
#endif
        }

        private static float Percentile(float[] values)
        {
            Array.Sort(values);
            return values[PercentileIndex(values.Length)];
        }

        private static int Percentile(int[] values)
        {
            Array.Sort(values);
            return values[PercentileIndex(values.Length)];
        }

        private static int PercentileIndex(int length)
        {
            if (length <= 1)
            {
                return 0;
            }

            return Mathf.Clamp(Mathf.CeilToInt(length * 0.95f) - 1, 0, length - 1);
        }
    }
}
