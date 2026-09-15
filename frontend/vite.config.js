import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    // Suprime warnings de propriedades CSS desconhecidas do esbuild
    // (falsos positivos gerados por nomes de funções JS sendo interpretados como CSS)
    {
      name: 'suppress-css-warnings',
      enforce: 'pre',
      handleHotUpdate() {},
      config() {
        return {
          build: {
            rollupOptions: {
              onwarn(warning, warn) {
                if (
                  warning.code === 'INVALID_ANNOTATION' ||
                  (warning.message && warning.message.includes('is not a known CSS property'))
                ) return;
                warn(warning);
              },
            },
          },
        };
      },
    },
  ],

  build: {
    outDir: '../backend/public',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000, // suprime warning de bundle > 500kb
    cssMinify: false,            // desativa minificação CSS via esbuild (elimina os warnings)
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.message && warning.message.includes('is not a known CSS property')) return;
        warn(warning);
      },
    },
  },

  server: {
    port: 5173,
    proxy: {
      '/auth':          { target: 'http://localhost:3000', changeOrigin: true },
      '/admin':         { target: 'http://localhost:3000', changeOrigin: true },
      '/desossa':       { target: 'http://localhost:3000', changeOrigin: true },
      '/gestao':        { target: 'http://localhost:3000', changeOrigin: true },
      '/produtos':      { target: 'http://localhost:3000', changeOrigin: true },
      '/superadmin':    { target: 'http://localhost:3000', changeOrigin: true },
      '/dashboard':     { target: 'http://localhost:3000', changeOrigin: true },
      '/caixa':         { target: 'http://localhost:3000', changeOrigin: true },
      '/backup':        { target: 'http://localhost:3000', changeOrigin: true },
      '/historico':     { target: 'http://localhost:3000', changeOrigin: true },
      '/comandas':      { target: 'http://localhost:3000', changeOrigin: true },
      '/fornecedores':  { target: 'http://localhost:3000', changeOrigin: true },
      '/contas-pagar':  { target: 'http://localhost:3000', changeOrigin: true },
      '/assados':       { target: 'http://localhost:3000', changeOrigin: true },
      '/health':        { target: 'http://localhost:3000', changeOrigin: true },
      '/api':           { target: 'http://localhost:3000', changeOrigin: true },
      '/logos':         { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
});
