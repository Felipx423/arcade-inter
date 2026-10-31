import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ command, mode }) => ({ define: { __PEGA_QA_FULL_MOTION__: mode === 'performance-qa' || (command === 'serve' && loadEnv(mode, '.', 'PEGA_QA_').PEGA_QA_FULL_MOTION === '1') }, plugins: [react()], base: './', build: { target: 'es2022', chunkSizeWarningLimit: 1700 }, server: { host: '127.0.0.1', port: 4174, strictPort: true } }));
