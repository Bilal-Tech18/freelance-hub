import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Les modules serveur commencent par `import "server-only"`, dont l'entrée par défaut
// jette hors d'un Server Component (Next résout une entrée vide via la condition
// « react-server », que Vitest n'applique pas). En test on l'aliase vers un stub
// local : pas de chirurgie de chaîne sur un chemin de node_modules, qui casserait
// silencieusement si le paquet changeait de layout.
const serverOnlyStub = fileURLToPath(new URL("./test/stubs/server-only.ts", import.meta.url));

// Même alias `@/*` que tsconfig : sans lui, tout module testé qui importe un
// autre fichier du projet par son chemin absolu échoue à la résolution.
const srcDir = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: "server-only", replacement: serverOnlyStub },
      { find: /^@\//, replacement: `${srcDir}/` },
    ],
  },
});
