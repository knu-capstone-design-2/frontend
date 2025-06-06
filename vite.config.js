import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://13.125.19.139:8004",
        // target: 'http://localhost:8004',
        changeOrigin: true,
      },
    },
  },
});
