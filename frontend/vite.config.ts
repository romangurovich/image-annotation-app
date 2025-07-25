import { defineConfig } from "vite";
import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  base: "/", // Ensures root-relative asset URLs
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
      "~backend/client": path.resolve(__dirname, "./client"),
      "~backend": path.resolve(__dirname, "../backend"),
    },
  },
  plugins: [tailwindcss(), react()],
  build: {
    minify: false,
    outDir: "../backend/frontend/dist", // Output to desired directory
  },
});
