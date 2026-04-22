const fs = require("fs");
const path = require("path");

const packageJsonPath = path.resolve(__dirname, "package.json");
const originalReadFileSync = fs.readFileSync;

// The Luna pipeline lives under Unity's Packages/ folder, so we cannot keep a
// real package.json here without Unity treating the whole directory as a UPM package.
// The bundled Jake CLI only needs the file for startup metadata, so we provide
// an in-memory fallback instead of creating it on disk.
fs.readFileSync = function patchedReadFileSync(filePath, options) {
  const resolvedPath = typeof filePath === "string" ? path.resolve(filePath) : null;
  if (resolvedPath === packageJsonPath && !fs.existsSync(packageJsonPath)) {
    const fallbackJson = "{}";
    if (typeof options === "string" || (options && typeof options === "object" && options.encoding)) {
      return fallbackJson;
    }

    return Buffer.from(fallbackJson);
  }

  return originalReadFileSync.apply(fs, arguments);
};

try {
  require("./jake.bundle.js");
} finally {
  fs.readFileSync = originalReadFileSync;
}
