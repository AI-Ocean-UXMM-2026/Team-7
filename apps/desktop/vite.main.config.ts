import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const here = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  build: {
    target: "node22",
    ssr: true,
    outDir: "dist-electron",
    emptyOutDir: true,
    minify: false,
    rollupOptions: {
      input: {
        main: `${here}src/main/index.ts`,
      },
      external: ["electron"],
      output: {
        format: "cjs",
        entryFileNames: "[name].cjs",
        chunkFileNames: "chunks/[name]-[hash].cjs",
      },
    },
  },
});
