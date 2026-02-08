import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [tailwindcss(), tsconfigPaths()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        framer: resolve(__dirname, "framer.html"),
        poster: resolve(__dirname, "poster.html"),
        nepaliPdf: resolve(__dirname, "nepali-pdf.html"),
      },
    },
  },
});
