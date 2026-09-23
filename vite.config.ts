import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({base:'./',envFile:false,plugins:[react()],build:{chunkSizeWarningLimit:1800}});
