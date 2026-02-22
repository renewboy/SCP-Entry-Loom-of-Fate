import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
    return {
      base: process.env.DESKTOP_BUILD === '1' ? './' : '/',
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        minify: 'terser',
        sourcemap: false,
        terserOptions: {
          mangle: true,
          compress: {
            drop_console: true,
            drop_debugger: true
          },
          format: {
            comments: false
          }
        }
      }
    };
});
