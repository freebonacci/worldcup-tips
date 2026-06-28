import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base: './' keeps asset paths relative so the build works both locally and
// when served from a GitHub Pages project subpath (e.g. /worldcup-tips/).
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
})
