import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig(({ mode }) => ({
  define: { 'import.meta.env.VITE_CALCULATION_BUILD': JSON.stringify(String(Date.now())) },
  plugins: [
    react(),
    ...(mode === 'single'
      ? [viteSingleFile()]
      : [
          VitePWA({
            registerType: 'prompt',
            manifest: {
              name: 'Trading Plan Pro',
              short_name: 'Trading Plan',
              description: 'Nhật ký giao dịch trên thiết bị',
              start_url: './',
              scope: './',
              display: 'standalone',
              theme_color: '#172b3a',
              background_color: '#f5f7fa',
              icons: [
                { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
                { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
                {
                  src: 'icons/icon-512.png',
                  sizes: '512x512',
                  type: 'image/png',
                  purpose: 'any maskable',
                },
              ],
            },
            workbox: {
              globPatterns: ['**/*.{js,css,html,svg,png,webmanifest,woff2,ttf}'],
              maximumFileSizeToCacheInBytes: 6000000,
              skipWaiting: true,
              clientsClaim: false,
              navigateFallback: 'index.html',
            },
          }),
        ]),
  ],
  base: './',
  build: { outDir: 'dist' },
}));
