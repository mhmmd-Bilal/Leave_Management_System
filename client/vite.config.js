import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// In development every /api request is proxied to the Express server, so the browser sees ONE origin
// and the HTTP-only auth cookie + CSRF cookie work without any CORS/SameSite configuration.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": { target: process.env.VITE_PROXY_TARGET || "http://localhost:5000", changeOrigin: true } },
  },
});
