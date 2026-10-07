import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({base:'./',envFile:false,plugins:[react()],build:{chunkSizeWarningLimit:1800,rollupOptions:{input:{main:'index.html',recovery:'recovery-reader.html'}}}});
