import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig(({ mode }) => ({
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
              icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
            },
            workbox: {
              globPatterns: ['**/*.{js,css,html,svg,webmanifest}'],
              maximumFileSizeToCacheInBytes: 6000000,
              skipWaiting: false,
              clientsClaim: false,
              navigateFallback: 'index.html',
            },
          }),
        ]),
  ],
  base: './',
  build: { outDir: 'dist' },
}));
