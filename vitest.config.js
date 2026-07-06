import { defineConfig } from "vitest/config";
import path from "node:path";

// Tests unitaires : logique pure uniquement (aucun vrai service, aucune
// vraie donnée patient). L'alias @/ pointe vers la racine du projet.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
  test: {
    include: ["test/**/*.test.js"],
    environment: "node",
  },
});
