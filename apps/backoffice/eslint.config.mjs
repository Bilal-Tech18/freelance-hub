import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Scripts d'exemple (widget Scriptable iOS), pas du code de l'app.
    "docs/**",
  ]),
  {
    rules: {
      // TODO: refactorer les composants concernés puis repasser en "error"
      // (desktop-sidebar, mobile-sidebar, onboarding-wizard, connections/page).
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
    },
  },
]);

export default eslintConfig;
