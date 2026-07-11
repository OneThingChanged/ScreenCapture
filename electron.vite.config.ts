import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/main/index.ts') }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/preload/index.ts') }
      }
    }
  },
  renderer: {
    plugins: [react()],
    root: 'src/renderer',
    server: {
      port: 4000,
      strictPort: true
    },
    build: {
      rollupOptions: {
        input: {
          app: resolve(__dirname, 'src/renderer/app/index.html'),
          frame: resolve(__dirname, 'src/renderer/frame/index.html'),
          overlay: resolve(__dirname, 'src/renderer/overlay/index.html'),
          picker: resolve(__dirname, 'src/renderer/picker/index.html'),
          recorder: resolve(__dirname, 'src/renderer/recorder/index.html')
        }
      }
    }
  }
})
