// Standalone client build: the same client/ sources Muse bundles, built
// with Vite + Tailwind v4. "@hatch/space-sdk" resolves to ./sdk (a local
// file: dependency), so no game file changes.
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 8787);

/* The 33 real photos (client/src/assets/*.jpg) are not in the repo, so
   imports of them would fail the build. A missing photo resolves to "" so the
   experience cards simply render without their photo backdrop (the game
   already handles that). Drop the originals into client/src/assets/ and
   they are picked up automatically. */
const missingPhotos = (): Plugin => ({
  name: "missing-photos",
  enforce: "pre",
  resolveId(id, importer) {
    if (!importer || !/\.(jpe?g|png|webp)$/i.test(id)) return null;
    const file = resolve(dirname(importer), id);
    return existsSync(file) ? null : `\0missing-photo:${id}`;
  },
  load(id) {
    return id.startsWith("\0missing-photo:") ? "export default '';" : null;
  },
});

export default defineConfig({
  root: resolve(HERE, "../client"),
  base: "./",
  plugins: [missingPhotos(), react(), tailwindcss()],
  build: {
    outDir: resolve(HERE, "dist"), emptyOutDir: true, chunkSizeWarningLimit: 4000,
    // libraries in their own files: a game update re-downloads only the game code,
    // three.js / React stay in the browser cache (the server marks hashed files immutable)
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/three/")) return "three";
          if (/node_modules\/(react|react-dom|scheduler|@tanstack)\//.test(id)) return "react";
          if (id.includes("/client/src/i18n-en") || id.includes("/client/src/stories-en") || id.includes("/client/src/places-en")) return "english";
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: { "/actions": `http://127.0.0.1:${PORT}` },
  },
});
