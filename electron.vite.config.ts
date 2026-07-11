import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

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
    root: 'src/renderer',
    server: {
      port: 4000,
      strictPort: true
    },
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'src/renderer/main/index.html'),
          frame: resolve(__dirname, 'src/renderer/frame/index.html'),
          frames: resolve(__dirname, 'src/renderer/frames/index.html'),
          compress: resolve(__dirname, 'src/renderer/compress/index.html'),
          overlay: resolve(__dirname, 'src/renderer/overlay/index.html'),
          picker: resolve(__dirname, 'src/renderer/picker/index.html'),
          editor: resolve(__dirname, 'src/renderer/editor/index.html'),
          settings: resolve(__dirname, 'src/renderer/settings/index.html'),
          recorder: resolve(__dirname, 'src/renderer/recorder/index.html')
        }
      }
    }
  }
})
