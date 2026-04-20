using System.Globalization;
using UnityEngine;

#if UNITY_LUNA
using Bridge;
#endif

public class LunaPostFxController : MonoBehaviour
{
    [Header("Canvas Filters")]
    [Range(0, 200)] public int brightness = 100;
    [Range(0, 300)] public int contrast = 100;
    [Range(0, 300)] public int saturate = 100;
    [Range(0, 100)] public int sepia = 0;
    [Range(0, 100)] public int grayscale = 0;
    [Range(-180, 180)] public int hueRotate = 0;

    [Header("Overlay")]
    [Range(0f, 1f)] public float vignetteOpacity = 0.35f;
    [Range(0f, 1f)] public float grainOpacity = 0.05f;
    [Range(0f, 1f)] public float washOpacity = 0.02f;
    public string washColor = "rgba(255, 170, 110, 1)";

    private void Start()
    {
#if UNITY_LUNA
        Bridge.Script.Write(
            "window.LunaPostFx && window.LunaPostFx.setFilters({" +
            "brightness:" + brightness + "," +
            "contrast:" + contrast + "," +
            "saturate:" + saturate + "," +
            "sepia:" + sepia + "," +
            "grayscale:" + grayscale + "," +
            "hueRotate:" + hueRotate +
            "});"
        );

        Bridge.Script.Write(
            "window.LunaPostFx && window.LunaPostFx.setOverlay({" +
            "vignetteOpacity:" + ToJsFloat(vignetteOpacity) + "," +
            "grainOpacity:" + ToJsFloat(grainOpacity) + "," +
            "washOpacity:" + ToJsFloat(washOpacity) + "," +
            "washColor:'" + EscapeJs(washColor) + "'" +
            "});"
        );
#endif
    }

    private static string ToJsFloat(float value)
    {
        return value.ToString(CultureInfo.InvariantCulture);
    }

    private static string EscapeJs(string value)
    {
        return (value ?? string.Empty).Replace("\\", "\\\\").Replace("'", "\\'");
    }
}
