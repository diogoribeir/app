import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base obrigatoria = nome do repo (/app/) + pasta publicada no Pages
export default defineConfig({
  plugins: [react()],
  base: '/app/hrv-comparador/'
})
