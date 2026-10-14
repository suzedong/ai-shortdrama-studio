// feature-804：tsc 只能产出 preload.js，但 package.json 为 ESM（"type":"module"），
// Electron preload 必须是 CommonJS（.cjs），main.ts 也按 preload.cjs 加载。
// 编译后重命名，使真机 Electron 能加载 preload（否则 window.api 缺失、退化为 dev mock）。
const { renameSync, existsSync } = require('fs')

const src = 'dist-electron/electron/preload.js'
const dest = 'dist-electron/electron/preload.cjs'

if (!existsSync(src)) {
  console.error(`[rename-preload] 未找到编译产物：${src}`)
  process.exit(1)
}
renameSync(src, dest)
