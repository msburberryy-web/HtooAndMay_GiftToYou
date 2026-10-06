import {defineConfig, type Plugin} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';

// Preload the few font files the first screen needs, so text renders in the right font straight away.
const FIRST_SCREEN_FONTS = [/manrope-latin-400-normal.*\.woff2$/, /manrope-latin-500-normal.*\.woff2$/, /cormorant-garamond-latin-400-normal.*\.woff2$/, /newsreader-latin-400-normal.*\.woff2$/];
function preloadFonts(): Plugin {
  return {
    name: 'preload-first-screen-fonts',
    transformIndexHtml(_html, ctx) {
      if (!ctx.bundle) return [];
      const base = '/HtooAndMay_GiftToYou/';
      return Object.keys(ctx.bundle)
        .filter(file => FIRST_SCREEN_FONTS.some(re => re.test(file)))
        .map(file => ({tag: 'link', injectTo: 'head' as const, attrs: {rel: 'preload', href: base + file, as: 'font', type: 'font/woff2', crossorigin: ''}}));
    },
  };
}

export default defineConfig({base: '/HtooAndMay_GiftToYou/', plugins: [react(), preloadFonts()], resolve: {alias: {'@': fileURLToPath(new URL('./', import.meta.url))}}});
