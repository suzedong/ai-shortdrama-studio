#!/usr/bin/env node
/* eslint-disable no-console */
// feature-828 / D-035：真实 Electron + 原生目录对话框的静态项目包定向验收。
// 全部路径位于 ASD_TEST_TMP（默认仓库 .test-tmp）；不新增测试 IPC，不读取真实项目库。
const fs = require('node:fs')
const fsp = require('node:fs/promises')
const path = require('node:path')
const net = require('node:net')
const { spawn, execFileSync } = require('node:child_process')
const { Cdp, waitFor } = require('./verify-runtime-interruption.cjs')
const { buildElectronEnv } = require('./acceptance-env.cjs')

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

const repo = path.resolve(__dirname, '..')
const mainEntry = path.join(repo, 'dist-electron', 'electron', 'main.js')
const electron = path.join(repo, 'node_modules', '.bin', 'electron')
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const artifactRoot = path.join(
  path.resolve(process.env.ASD_TEST_TMP || path.join(repo, '.test-tmp')), 'project-transfer', stamp,
)
const workspace = path.join(artifactRoot, 'workspace')
const userData = path.join(artifactRoot, 'userData')
const home = path.join(artifactRoot, 'home')
const runningApps = []
const result = {
  status: 'running',
  evidenceClass: 'real-electron-real-filesystem-native-dialogs',
  realProviderAcceptance: false,
  artifactRoot,
  startedAt: new Date().toISOString(),
  checks: [],
  errors: [],
}

function check(name, condition, detail) {
  const passed = Boolean(condition)
  result.checks.push({ name, passed, detail: detail ?? null })
  if (!passed) result.errors.push(name)
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`)
  return passed
}

function assert(name, condition, detail) {
  if (!check(name, condition, detail)) throw new Error(`${name}: ${JSON.stringify(detail ?? null)}`)
}

async function exists(target) {
  try { await fsp.access(target); return true } catch { return false }
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port
      server.close(() => resolve(port))
    })
  })
}

async function launchApp() {
  const port = await freePort()
  const logPath = path.join(artifactRoot, `electron-${runningApps.length + 1}.log`)
  const log = fs.createWriteStream(logPath)
  const env = {
    ...process.env,
    ...buildElectronEnv({ userData, home }),
    ASD_ACCEPTANCE: '1',
    ASD_USER_DATA: userData,
    HOME: home,
    USERPROFILE: home,
    ELECTRON_DISABLE_SECURITY_WARNINGS: '1',
  }
  delete env.ELECTRON_RUN_AS_NODE
  const child = spawn(electron, [mainEntry, '--no-sandbox', `--remote-debugging-port=${port}`], {
    cwd: workspace, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true,
  })
  child.stdout.pipe(log)
  child.stderr.pipe(log)
  const app = { child, log, logPath, cdp: null, exited: false }
  runningApps.push(app)
  child.once('exit', () => { app.exited = true; log.end() })
  const page = await waitFor('Electron CDP 页面', async () => {
    const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json())
    return pages.find(entry => entry.type === 'page' && entry.url.includes('dist/index.html'))
  })
  app.cdp = new Cdp(page.webSocketDebuggerUrl)
  await app.cdp.open()
  await waitFor('window.api 就绪', () => app.cdp.evaluate('typeof window.api === "object"'))
  return app
}

async function killApp(app) {
  if (!app || app.exited) return
  try { process.kill(-app.child.pid, 'SIGTERM') } catch (error) {
    if (error.code !== 'ESRCH') throw error
  }
  await Promise.race([
    new Promise(resolve => app.child.once('exit', resolve)),
    delay(8_000).then(async () => {
      if (!app.exited) {
        try { process.kill(-app.child.pid, 'SIGKILL') } catch {}
      }
    }),
  ])
}

function osascript(script) {
  return execFileSync('osascript', ['-e', script], { encoding: 'utf8' }).trim()
}

function dialogScript(title, action = '') {
  return `tell application "System Events"
    repeat with p in (every process whose name is "Electron")
      tell p
        set matched to false
        try
          set matched to ((name of every window) as string) contains ${JSON.stringify(title)}
        end try
        if matched then
          set frontmost to true
          ${action}
          return true
        end if
      end tell
    end repeat
    return false
  end tell`
}

async function waitDialog(title) {
  let diagnostic = '未取得窗口状态'
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    try {
      diagnostic = osascript(dialogScript(title))
      if (diagnostic === 'true') return
    } catch (error) { diagnostic = String(error) }
    await delay(250)
  }
  throw new Error(`等待超时：原生对话框 ${title}；${diagnostic}`)
}

function acceptSave(title, dir) {
  const action = `keystroke "g" using {command down, shift down}
    delay 1
    set value of text field 1 of sheet 1 of window ${JSON.stringify(title)} to ${JSON.stringify(`${dir}/`)}
    delay 0.3
    key code 36
    delay 1
    key code 36`
  if (osascript(dialogScript(title, action)) !== 'true') throw new Error('导出对话框已消失')
}

function cancelDialog(title) {
  if (osascript(dialogScript(title, 'key code 53')) !== 'true') throw new Error('导入/导出对话框已消失')
}

function chooseDirectory(title, dir) {
  const action = `keystroke "g" using {command down, shift down}
    delay 1
    set value of text field 1 of sheet 1 of window ${JSON.stringify(title)} to ${JSON.stringify(`${dir}/`)}
    delay 0.3
    key code 36
    delay 1
    key code 36`
  if (osascript(dialogScript(title, action)) !== 'true') throw new Error('目录选择对话框已消失')
}

function inspectDialog(title) {
  return osascript(dialogScript(title)) === 'true' ? 'dialog-present' : 'dialog-not-found'
}

async function driveDialog(app, title, expression, action) {
  const pending = app.cdp.evaluate(expression)
  await Promise.race([
    waitDialog(title),
    pending.then(
      () => { throw new Error(`${title} 在检测到原生对话框前已返回`) },
      error => { throw error },
    ),
  ])
  action()
  await delay(500)
  const dialogState = inspectDialog(title)
  result.dialogDiagnostics ||= []
  result.dialogDiagnostics.push({ title, state: dialogState })
  if (dialogState !== 'dialog-not-found') {
    const screenshot = path.join(artifactRoot, `dialog-${result.dialogDiagnostics.length}.png`)
    execFileSync('screencapture', ['-x', screenshot])
    result.dialogDiagnostics[result.dialogDiagnostics.length - 1].screenshot = screenshot
  }
  console.log(`DIALOG ${title}: ${dialogState}`)
  return pending
}

function brief(version, title) {
  return {
    schema: 'shortdrama.brief/v1', version, title,
    publishedAt: `2026-11-26T00:00:0${version}.000Z`, changesFromPrevious: [],
    meta: { projectId: 'project-accept-transfer', savedAt: `2026-11-26T00:00:0${version}.000Z`, tag: null },
    kind: 'commercial',
    fiveElements: {
      episodeDuration: '60秒', episodeCount: '12', aspectRatio: '9:16',
      genre: '悬疑', tone: '紧凑', platforms: ['抖音'],
    },
    premise: { leads: '主角', time: '现代', place: '上海', coreConflict: '寻找真相', sellingPoint: '连续反转' },
    style: { spectrumRef: null, spectrumSnapshot: null, custom: null },
    l0: { tags: ['验收'], notes: title },
    characters: '主角：林夏', world: '现代上海', structure: '三幕式',
    diagnosisSummary: null, approve: { by: 'ui', at: null },
    decisions: {
      kind: 'mark', fiveElements: 'mark', premise: 'mark', style: 'mark',
      l0: 'mark', characters: 'mark', world: 'mark', structure: 'mark',
    },
  }
}

async function prepareSource(app) {
  const project = await app.cdp.evaluate('window.api.createProject("project-accept-transfer")')
  const now = '2026-11-26T00:00:00.000Z'
  const node = (id, title, x, y) => ({
    id, step: '1', kind: 'outline', title, status: 'done',
    position: { x, y }, ref: { path: '故事/outline.json', format: 'json' }, updatedAt: now,
  })
  const canvas = {
    schemaVersion: 4, projectId: path.basename(project.dir), title: '非空静态项目包',
    pages: [
      {
        id: 'page-story', title: '故事页', activeCanvasId: 'canvas-story', viewports: {},
        canvases: [{
          id: 'canvas-story', title: '故事画布', viewport: null, edges: [],
          nodes: [node('story-1', '故事节点一', 80, 80), node('story-2', '故事节点二', 360, 80)],
        }],
      },
      {
        id: 'page-storyboard', title: '分镜页', activeCanvasId: 'canvas-board', viewports: {},
        canvases: [{
          id: 'canvas-board', title: '分镜画布', viewport: null, edges: [],
          nodes: [node('board-1', '分镜节点', 120, 160)],
        }],
      },
    ],
    activePageId: 'page-story', activeView: 'canvas', gates: [],
    revision: 7, receipts: [], updatedAt: now,
  }
  await fsp.mkdir(path.join(project.dir, '故事'), { recursive: true })
  await fsp.mkdir(path.join(project.dir, '资产'), { recursive: true })
  await fsp.writeFile(path.join(project.dir, 'canvas.json'), JSON.stringify(canvas, null, 2))
  await fsp.writeFile(path.join(project.dir, '立项单.v1.json'), JSON.stringify(brief(1, '第一版')))
  await fsp.writeFile(path.join(project.dir, '立项单.v2.json'), JSON.stringify(brief(2, '第二版')))
  await fsp.writeFile(path.join(project.dir, '故事', 'outline.json'), JSON.stringify({ title: '完整故事', content: '真实故事内容' }))
  await fsp.writeFile(path.join(project.dir, '故事', '剧本.md'), '# 第一场\n真实剧本文本\n')
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
  await fsp.writeFile(path.join(project.dir, '资产', '角色.png'), png)
  await fsp.writeFile(path.join(project.dir, '资产', 'asset-index.json'), JSON.stringify([
    { id: 'asset-role', kind: 'image', path: '资产/角色.png', createdAt: now },
  ], null, 2))
  const exclusions = [
    '.agent-runs.json', '.agent-runs.json.tmp', 'opencode.json', 'ai-service.json',
    '.env', '.env.local', 'private.key', 'comfy-jobs.json', '.git/config',
    '.session.archive/old.json', 'runtime/cache.bin', 'runtime/run.lock',
    'node_modules/pkg/index.js', '.sdg-staging-old/file.txt', '资产/缩略图/cache.png',
    '故事/剧本.md.tmp', '资产/生成.part',
  ]
  for (const relative of exclusions) {
    const target = path.join(project.dir, relative)
    await fsp.mkdir(path.dirname(target), { recursive: true })
    await fsp.writeFile(target, '验收垃圾数据，不得进入静态项目包')
  }
  await app.cdp.evaluate(`window.api.openProject(${JSON.stringify(project.dir)})`)
  await waitFor('源项目工作台打开', () => app.cdp.evaluate('!!document.querySelector("textarea")'))
  return { project, canvas, png, exclusions }
}

async function walk(root) {
  const output = []
  async function visit(dir, prefix = '') {
    for (const entry of await fsp.readdir(dir, { withFileTypes: true })) {
      const relative = path.join(prefix, entry.name)
      output.push(relative)
      if (entry.isDirectory()) await visit(path.join(dir, entry.name), relative)
    }
  }
  await visit(root)
  return output
}

async function assertStaticPackage(name, dir, source) {
  const entries = await walk(dir)
  for (const relative of source.exclusions) {
    assert(`${name} 排除 ${relative}`, !(await exists(path.join(dir, relative))))
  }
  const canvas = JSON.parse(await fsp.readFile(path.join(dir, 'canvas.json'), 'utf8'))
  assert(`${name} 保留两页三画布与真实节点`,
    canvas.pages?.length === 2
      && canvas.pages.every(page => page.canvases.length > 0 && page.canvases.every(item => item.nodes.length > 0)))
  assert(`${name} 保留立项历史`,
    (await exists(path.join(dir, '立项单.v1.json')))
      && (await exists(path.join(dir, '立项单.v2.json'))))
  assert(`${name} 保留故事与媒体字节`,
    (await fsp.readFile(path.join(dir, '故事', '剧本.md'), 'utf8')).includes('真实剧本文本')
      && (await fsp.readFile(path.join(dir, '资产', '角色.png'))).equals(source.png))
  return entries
}

async function main() {
  if (process.platform !== 'darwin') throw new Error('原生对话框验收当前仅支持 macOS')
  await Promise.all([
    fsp.mkdir(workspace, { recursive: true }), fsp.mkdir(userData, { recursive: true }),
    fsp.mkdir(home, { recursive: true }),
  ])
  await fsp.writeFile(path.join(userData, 'workspace.json'), JSON.stringify({
    version: 1, rootDir: workspace, updatedAt: new Date().toISOString(),
  }))
  assert('构建产物存在', fs.existsSync(mainEntry) && fs.existsSync(path.join(repo, 'dist', 'index.html')))

  const first = await launchApp()
  const source = await prepareSource(first)
  const sourceDir = source.project.dir
  const beforeCancel = await first.cdp.evaluate('window.api.listProjects()')

  const importCanceled = await driveDialog(first, '导入静态项目包', 'window.api.projectImport()', () => cancelDialog('导入静态项目包'))
  assert('原生导入取消返回 canceled', importCanceled.canceled === true)
  const exportCanceled = await driveDialog(first, '导出静态项目包', `window.api.projectExport(${JSON.stringify(sourceDir)})`, () => cancelDialog('导出静态项目包'))
  assert('原生导出取消返回 canceled', exportCanceled.canceled === true)
  assert('取消不创建项目或导出目录',
    (await first.cdp.evaluate('window.api.listProjects()')).length === beforeCancel.length
      && !(await exists(path.join(artifactRoot, `${path.basename(sourceDir)}-导出`))))

  const badImport = path.join(artifactRoot, 'bad-import')
  await fsp.mkdir(badImport, { recursive: true })
  await fsp.writeFile(path.join(badImport, 'manifest.json'), JSON.stringify({ schema: 'shortdrama.project/v1', title: 'bad' }))
  await fsp.writeFile(path.join(badImport, 'canvas.json'), '{bad json')
  let invalidError = null
  try {
    await driveDialog(first, '导入静态项目包', 'window.api.projectImport()', () => chooseDirectory('导入静态项目包', badImport))
  } catch (error) { invalidError = String(error) }
  assert('损坏项目包在真实 IPC 中失败', invalidError?.includes('CANVAS_CORRUPT'), invalidError)
  assert('导入失败无 staging 遗留', !(await fsp.readdir(workspace)).some(name => name.startsWith('.sdg-staging-')))

  await first.cdp.evaluate('window.api.activeSession("ses_missing_for_export_failure")')
  let exportError = null
  try {
    await driveDialog(first, '导出静态项目包', `window.api.projectExport(${JSON.stringify(sourceDir)})`, () => acceptSave('导出静态项目包', artifactRoot))
  } catch (error) { exportError = String(error) }
  assert('运行时历史读取失败使导出失败', Boolean(exportError), exportError)
  const exportDir = path.join(artifactRoot, `${path.basename(sourceDir)}-导出`)
  assert('导出失败不创建目标', !(await exists(exportDir)))
  const documentsDir = path.dirname(exportDir)
  const documentEntries = (await exists(documentsDir)) ? await fsp.readdir(documentsDir) : []
  assert('导出失败无 staging 遗留', !documentEntries.some(name => name.startsWith('.sdg-export-')))
  await first.cdp.evaluate('window.api.activeSession(null)')

  const exported = await driveDialog(first, '导出静态项目包', `window.api.projectExport(${JSON.stringify(sourceDir)})`, () => acceptSave('导出静态项目包', artifactRoot))
  assert('原生导出成功', exported.canceled === false && exported.exportDir === exportDir, exported)
  assert('源运行账本仍保留', await exists(path.join(sourceDir, '.agent-runs.json')))
  result.exportedEntries = await assertStaticPackage('导出包', exportDir, source)

  const beforeImports = await first.cdp.evaluate('window.api.listProjects()')
  const imported = await driveDialog(first, '导入静态项目包', 'window.api.projectImport()', () => chooseDirectory('导入静态项目包', exportDir))
  assert('原生导入创建新副本', imported.canceled === false && imported.dir !== sourceDir, imported)
  const importedDir = imported.dir
  await assertStaticPackage('导入副本', importedDir, source)
  const importedSession = JSON.parse(await fsp.readFile(path.join(importedDir, '.session.json'), 'utf8'))
  assert('导入来源标题可追溯', importedSession.title === 'project-accept-transfer', importedSession.title)
  const importedIdentity = JSON.parse(await fsp.readFile(path.join(importedDir, 'canvas.json'), 'utf8'))
  assert('导入生成独立画布身份', importedIdentity.projectId === path.basename(importedDir))
  await first.cdp.evaluate(`window.api.openProject(${JSON.stringify(importedDir)})`)
  const [importedCanvas, history, assets, story] = await Promise.all([
    first.cdp.evaluate('window.api.canvas.get()'),
    first.cdp.evaluate('window.api.briefHistory()'),
    first.cdp.evaluate('window.api.asset.list()'),
    first.cdp.evaluate('window.api.fileRead({path:"故事/剧本.md"})'),
  ])
  assert('真实 API 可读两页画布', importedCanvas.pages.length === 2)
  assert('真实 API 可读两个立项版本', history.versions.some(item => item.version === 1) && history.versions.some(item => item.version === 2))
  assert('真实 API 可读资产索引', assets.some(item => item.id === 'asset-role'))
  assert('真实 API 可读故事内容', story.ok === true && story.content.includes('真实剧本文本'))

  const repeated = await driveDialog(first, '导入静态项目包', 'window.api.projectImport()', () => chooseDirectory('导入静态项目包', exportDir))
  assert('重复导入再次创建独立副本', repeated.canceled === false && repeated.dir !== importedDir && repeated.dir !== sourceDir)
  assert('导入数量严格增加两个', (await first.cdp.evaluate('window.api.listProjects()')).length === beforeImports.length + 2)
  result.projects = { sourceDir, importedDir, repeatedDir: repeated.dir }

  await killApp(first)
  const second = await launchApp()
  const afterRestart = await second.cdp.evaluate('window.api.listProjects()')
  assert('重启后源项目与两个导入副本均保留',
    [sourceDir, importedDir, repeated.dir].every(dir => afterRestart.some(project => project.dir === dir)))
  await second.cdp.evaluate(`window.api.openProject(${JSON.stringify(importedDir)})`)
  const restartedCanvas = await second.cdp.evaluate('window.api.canvas.get()')
  assert('重启后导入副本仍可读', restartedCanvas.pages.length === 2 && restartedCanvas.pages[1].canvases[0].nodes.length === 1)
  const capture = await second.cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  await fsp.writeFile(path.join(artifactRoot, 'after-restart.png'), Buffer.from(capture.data, 'base64'))
  result.exportDir = exportDir
}

void (async () => {
  try {
    await main()
    result.status = result.errors.length === 0 ? 'passed' : 'failed'
  } catch (error) {
    result.status = 'failed'
    result.error = error.stack || String(error)
    process.exitCode = 1
  } finally {
    for (const app of runningApps) {
      try { app.cdp?.close() } catch {}
      try { await killApp(app) } catch (error) { result.cleanupError = String(error) }
    }
    result.finishedAt = new Date().toISOString()
    await fsp.mkdir(artifactRoot, { recursive: true })
    await fsp.writeFile(path.join(artifactRoot, 'result.json'), JSON.stringify(result, null, 2))
    console.log(JSON.stringify({ status: result.status, artifactRoot, checks: result.checks.length, error: result.error }, null, 2))
  }
})()
