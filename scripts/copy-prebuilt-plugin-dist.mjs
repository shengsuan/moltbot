import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Copy pre-built dist files for plugins that have ./dist/ entries.
 * These plugins are skipped by tsdown but still need their compiled assets copied.
 */
export function copyPrebuiltPluginDist(params = {}) {
  const repoRoot = params.cwd ?? params.repoRoot ?? process.cwd();
  const extensionsRoot = path.join(repoRoot, "extensions");
  const distExtensionsRoot = path.join(repoRoot, "dist", "extensions");

  if (!fs.existsSync(extensionsRoot)) {
    return;
  }

  for (const dirent of fs.readdirSync(extensionsRoot, { withFileTypes: true })) {
    if (!dirent.isDirectory()) {
      continue;
    }

    const pluginDir = path.join(extensionsRoot, dirent.name);
    const packageJsonPath = path.join(pluginDir, "package.json");

    if (!fs.existsSync(packageJsonPath)) {
      continue;
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    const extensions = packageJson?.openclaw?.extensions || [];

    // Check if this plugin has dist/ entries (prebuilt)
    const hasDistEntries = extensions.some(
      (entry) => typeof entry === "string" && entry.includes("/dist/"),
    );

    if (!hasDistEntries) {
      continue;
    }

    // Copy the dist directory to the output
    const sourceDistDir = path.join(pluginDir, "dist");
    const targetDistDir = path.join(distExtensionsRoot, dirent.name, "dist");

    if (!fs.existsSync(sourceDistDir)) {
      console.warn(
        `[copy-prebuilt-plugin-dist] Plugin ${dirent.name} has dist/ entries but no dist/ directory found`,
      );
      continue;
    }

    console.log(`[copy-prebuilt-plugin-dist] Copying ${dirent.name}/dist/`);

    fs.mkdirSync(path.dirname(targetDistDir), { recursive: true });
    fs.cpSync(sourceDistDir, targetDistDir, {
      recursive: true,
      force: true,
    });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  copyPrebuiltPluginDist();
}
