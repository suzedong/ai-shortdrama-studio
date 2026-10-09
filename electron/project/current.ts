// feature-017 · 当前活跃项目定位
import fs from 'node:fs'
import { readSessionState } from './library.js'

/** 当前活跃项目目录绝对路径；无项目时抛 INVALID_ARGUMENT */
export function getActiveProjectDir(): string {
  const dir = readSessionState().currentDir
  if (!dir || !fs.existsSync(dir)) {
    throw Object.assign(new Error('当前没有打开的项目'), { code: 'INVALID_ARGUMENT' })
  }
  return dir
}
