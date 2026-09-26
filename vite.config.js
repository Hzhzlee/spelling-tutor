import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // The bundled pinyin lookup (~400 KB raw, ~150 KB gzipped) makes the bundle
  // larger than Vite's default warning size; that is expected.
  build: { chunkSizeWarningLimit: 900 },
});
