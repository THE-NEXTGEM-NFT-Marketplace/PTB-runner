import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/],
    },
    rollupOptions: {
      external: (id) => {
        // Don't externalize @mysten/sui packages
        if (id.startsWith('@mysten/sui')) {
          return false;
        }
        return false;
      },
    },
  },
  optimizeDeps: {
    include: ['@mysten/sui/client', '@mysten/sui/transactions'],
  },
}));
