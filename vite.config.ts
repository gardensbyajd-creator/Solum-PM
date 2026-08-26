import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          supabase: ["@supabase/supabase-js"],
          icons: ["lucide-react"],
        },
      },
    },
  },
  server: {
    allowedHosts: ["5174-i3woac5t1cvglh7p21wnh-a5bcba4c.us3.manus.computer"],
  },
  preview: {
    allowedHosts: ["5173-i3woac5t1cvglh7p21wnh-a5bcba4c.us3.manus.computer"],
  },
});
