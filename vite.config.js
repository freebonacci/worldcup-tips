import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Project-pages deploy lives at https://<user>.github.io/worldcup-tips/, so the
// production build needs that subpath as its base. Local dev stays on '/'.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/worldcup-tips/' : '/',
  plugins: [react(), tailwindcss()],
}))
