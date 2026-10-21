import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({base:'./',envFile:false,plugins:[react()],server:{watch:{ignored:['**/.sunny-dev/**','**/.superpowers/**','**/release*/**']}},build:{chunkSizeWarningLimit:1800,rollupOptions:{input:{main:'index.html',recovery:'recovery-reader.html'}}}});
