import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'desktop' ? './' : '/',
  publicDir: mode === 'desktop' ? false : 'public',
  define: { 'import.meta.env.VITE_LOCAL_APP': JSON.stringify(mode === 'desktop' ? 'true' : 'false') },
  build: { ...(mode === 'desktop' ? { outDir: 'dist-local' } : {}),
    rolldownOptions:{...(mode === 'desktop' ? {input:'local.html'} : {}),output:{codeSplitting:{groups:[{name:'racing-engine',test:/@babylonjs\/core/,priority:20}]}}},
  },
}));

