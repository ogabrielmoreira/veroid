import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

// O app vive em gabrielmoreira.tech/veroid (ver DECISIONS.md, D-002).
// O build sai em dist/veroid para que o Worker sirva /veroid/* sem reescrita de caminho.
export const BASE_PATH = '/veroid/'

export default defineConfig({
  base: BASE_PATH,
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist/veroid',
    emptyOutDir: true,
    sourcemap: false,
  },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: 5173 },
})
