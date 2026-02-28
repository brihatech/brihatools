import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tailwindcss(), tsconfigPaths()],
  server: {
    fs: {
      allow: ["."],
    },
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  optimizeDeps: {
    exclude: ["onnxruntime-web"],
    entries: ["src/main.tsx"],
  },
  build: {
    target: "esnext",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes("node_modules/react") ||
            id.includes("node_modules/react-dom") ||
            id.includes("node_modules/react-router") ||
            id.includes("node_modules/scheduler")
          )
            return "vendor";
          if (id.includes("node_modules/onnxruntime-web")) return "onnx";
          if (id.includes("node_modules/jszip")) return "jszip";
          if (id.includes("node_modules/pdfjs-dist")) return "pdfjs";
          if (id.includes("node_modules/xlsx")) return "xlsx";
        },
      },
    },
  },
});
