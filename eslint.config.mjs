import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  { settings: { next: { rootDir: "apps/web/" } } },
  {
    files: ["apps/desktop/src/renderer/**/*.{ts,tsx}"],
    rules: { "@next/next/no-img-element": "off" },
  },
  globalIgnores(["agent/**", ".agents/**", "**/.next/**", "**/out/**", "**/dist/**", "**/dist-electron/**", "**/next-env.d.ts"]),
]);
