(function () {
  function ensureRoot() {
    const canvas = document.getElementById("application-canvas");
    if (!canvas || !canvas.parentNode) return null;

    let root = document.getElementById("luna-postfx-root");
    if (!root) {
      root = document.createElement("div");
      root.id = "luna-postfx-root";
      root.style.position = "relative";
      root.style.display = "inline-block";
      root.style.lineHeight = "0";
      root.style.overflow = "hidden";

      canvas.parentNode.insertBefore(root, canvas);
      root.appendChild(canvas);

      const vignette = document.createElement("div");
      vignette.id = "luna-postfx-vignette";
      vignette.style.position = "absolute";
      vignette.style.inset = "0";
      vignette.style.pointerEvents = "none";
      vignette.style.background =
        "radial-gradient(circle, rgba(0,0,0,0) 45%, rgba(0,0,0,0.40) 100%)";
      vignette.style.opacity = "0";

      const grain = document.createElement("div");
      grain.id = "luna-postfx-grain";
      grain.style.position = "absolute";
      grain.style.inset = "0";
      grain.style.pointerEvents = "none";
      grain.style.opacity = "0";
      grain.style.mixBlendMode = "soft-light";
      grain.style.backgroundImage =
        "linear-gradient(rgba(255,255,255,0.08) 50%, rgba(0,0,0,0.08) 50%), linear-gradient(90deg, rgba(255,255,255,0.04), rgba(0,0,0,0.04))";
      grain.style.backgroundSize = "100% 2px, 3px 100%";

      const colorWash = document.createElement("div");
      colorWash.id = "luna-postfx-colorwash";
      colorWash.style.position = "absolute";
      colorWash.style.inset = "0";
      colorWash.style.pointerEvents = "none";
      colorWash.style.opacity = "0";
      colorWash.style.background = "transparent";

      root.appendChild(vignette);
      root.appendChild(grain);
      root.appendChild(colorWash);
    }

    return {
      root,
      canvas: document.getElementById("application-canvas"),
      vignette: document.getElementById("luna-postfx-vignette"),
      grain: document.getElementById("luna-postfx-grain"),
      colorWash: document.getElementById("luna-postfx-colorwash"),
    };
  }

  function setFilters(options) {
    const fx = ensureRoot();
    if (!fx) return;

    const settings = Object.assign(
      {
        brightness: 100,
        contrast: 100,
        saturate: 100,
        sepia: 0,
        grayscale: 0,
        hueRotate: 0,
        blurPx: 0,
      },
      options || {}
    );

    fx.canvas.style.filter = [
      "brightness(" + settings.brightness + "%)",
      "contrast(" + settings.contrast + "%)",
      "saturate(" + settings.saturate + "%)",
      "sepia(" + settings.sepia + "%)",
      "grayscale(" + settings.grayscale + "%)",
      "hue-rotate(" + settings.hueRotate + "deg)",
      "blur(" + settings.blurPx + "px)",
    ].join(" ");
  }

  function setOverlay(options) {
    const fx = ensureRoot();
    if (!fx) return;

    const settings = Object.assign(
      {
        vignetteOpacity: 0,
        grainOpacity: 0,
        washOpacity: 0,
        washColor: "rgba(255, 120, 80, 1)",
      },
      options || {}
    );

    fx.vignette.style.opacity = String(settings.vignetteOpacity);
    fx.grain.style.opacity = String(settings.grainOpacity);
    fx.colorWash.style.opacity = String(settings.washOpacity);
    fx.colorWash.style.background = settings.washColor;
  }

  function cinematicPreset() {
    setFilters({
      brightness: 102,
      contrast: 112,
      saturate: 108,
      sepia: 6,
      hueRotate: -4,
      blurPx: 0,
    });

    setOverlay({
      vignetteOpacity: 0.9,
      grainOpacity: 0.08,
      washOpacity: 0.04,
      washColor: "rgba(255, 170, 110, 1)",
    });
  }

  window.LunaPostFx = {
    setFilters: setFilters,
    setOverlay: setOverlay,
    cinematicPreset: cinematicPreset,
  };

  window.addEventListener("DOMContentLoaded", ensureRoot);
  window.addEventListener("luna:ready", ensureRoot);
  window.addEventListener("luna:started", ensureRoot);
})();
