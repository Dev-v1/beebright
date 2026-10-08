import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'desktop' ? './' : '/',
  publicDir: mode === 'desktop' ? false : 'public',
  define: mode === 'desktop' ? { 'import.meta.env.VITE_LOCAL_APP': JSON.stringify('true') } : {},
  build: mode === 'desktop' ? { outDir: 'dist-local', rollupOptions: { input: 'local.html' } } : {},
}));

