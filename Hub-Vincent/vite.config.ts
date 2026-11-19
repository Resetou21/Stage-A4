import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@api': path.resolve(__dirname, './src/api'),
      '@generated': path.resolve(__dirname, './src/generated'),
      '@lib': path.resolve(__dirname, './src/lib'),
      '@tanstack/react-start': path.resolve(__dirname, './src/shims/tanstack-react-start.ts'),
      '@vibe/db/client': path.resolve(__dirname, './src/shims/vibe-shims.ts'),
      '@components/vibe-watermark/VibeWatermark': path.resolve(__dirname, './src/shims/vibe-shims.ts'),
    },
  },
  server: {
    port: 3000,
  },
});
