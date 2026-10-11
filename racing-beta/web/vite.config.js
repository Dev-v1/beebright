import {defineConfig} from 'vite';
export default defineConfig({base:'./',build:{outDir:'dist',target:'es2022',rolldownOptions:{output:{codeSplitting:{groups:[{name:'racing-engine',test:/@babylonjs\/core/,priority:20}]}}}}});
