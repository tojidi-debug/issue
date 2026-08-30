import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  base: "/issue/",
  plugins: [react(), viteSingleFile()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  build: {
    outDir: "pages-dist",
    emptyOutDir: true,
    assetsInlineLimit: () => true,
    cssCodeSplit: false,
    rollupOptions: {
      input: fileURLToPath(new URL("./index3.html", import.meta.url)),
    },
  },
});
