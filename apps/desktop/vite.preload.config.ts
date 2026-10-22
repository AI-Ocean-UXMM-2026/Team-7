import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const here = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  build: {
    target: "node22",
    ssr: true,
    outDir: "dist-electron",
    emptyOutDir: false,
    minify: false,
    rollupOptions: {
      input: { preload: `${here}src/main/preload.ts` },
      external: ["electron"],
      output: {
        format: "cjs",
        entryFileNames: "[name].cjs",
      },
    },
  },
});
