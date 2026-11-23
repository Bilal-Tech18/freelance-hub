import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit lit ses fichiers de police .afm à l'exécution : le garder hors du
  // bundler pour que ces assets se résolvent correctement au runtime.
  serverExternalPackages: ["pdfkit"],
};

export default nextConfig;
