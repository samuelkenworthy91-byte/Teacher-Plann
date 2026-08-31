import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  // Keep the starter on the flat config export that actually runs under the pinned ESLint/Next toolchain.
  ...nextCoreWebVitals,
  globalIgnores([".next/**", "out/**", "build/**", "android/**", "next-env.d.ts"]),
  {
    rules: {
      // Copy in this app is written with real apostrophes on purpose.
      "react/no-unescaped-entities": "off",
    },
  },
]);
