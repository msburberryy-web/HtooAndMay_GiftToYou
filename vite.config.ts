import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
export default defineConfig({base:'/HtooAndMay_GiftToYou/',plugins:[react()],resolve:{alias:{'@':fileURLToPath(new URL('./',import.meta.url))}}});
