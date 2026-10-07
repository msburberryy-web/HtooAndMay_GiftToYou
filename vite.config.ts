import {defineConfig, type Plugin} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
import {DEFAULT_GIFT_API_URL} from './lib/endpoint';

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

// Starts the guest's first request to Apps Script while the page is still loading the app code,
// instead of after (saves the app's download + start-up time on the first visit).
function earlyStart(): Plugin {
  return {
    name: 'early-start-request',
    transformIndexHtml() {
      const url = JSON.stringify(process.env.VITE_GIFT_API_URL || DEFAULT_GIFT_API_URL);
      const js = `(function(){try{var m=/^#code=([A-Za-z0-9]{6,40})/.exec(location.hash),c=m?m[1]:null;if(!c){try{c=sessionStorage.getItem('gift-code')}catch(e){}}c=c?String(c).replace(/[\\s-]/g,'').toUpperCase():'';window.__giftBoot={code:c,promise:fetch(${url},{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(c?{action:'init',code:c}:{action:'init'}),redirect:'follow'}).then(function(r){return r.json()})}}catch(e){}})();`;
      return [{tag: 'script', injectTo: 'head-prepend' as const, children: js}];
    },
  };
}

export default defineConfig({base: '/HtooAndMay_GiftToYou/', plugins: [react(), preloadFonts(), earlyStart()], resolve: {alias: {'@': fileURLToPath(new URL('./', import.meta.url))}}});
