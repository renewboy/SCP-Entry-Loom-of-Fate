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
        },
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (!id.includes('node_modules')) return;
              if (id.includes('/react-dom/') || id.includes('/react/')) return 'react-vendor';
              if (id.includes('/@supabase/')) return 'supabase';
              if (id.includes('/framer-motion/')) return 'motion';
              if (id.includes('/react-markdown/') || id.includes('/rehype-') || id.includes('/hast-')) return 'markdown';
              if (id.includes('/lucide-react/')) return 'icons';
              if (id.includes('/zod/') || id.includes('/zod-to-json-schema/')) return 'zod';
              return 'vendor';
            }
          }
        }
      }
    };
});
