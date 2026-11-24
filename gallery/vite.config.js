import { defineConfig } from 'vite'

// 画像と manifest.json は R2 から配信するので、ビルド成果物には含めない。
// 開発時(serve)だけ手元の gallery/public を使う。
export default defineConfig(({ command }) => ({
  root: '.',
  base: './',
  publicDir: command === 'build' ? false : 'public',
  build: { outDir: 'dist' },
  server: { port: 5175, strictPort: true },
}))
