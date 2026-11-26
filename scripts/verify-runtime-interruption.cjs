#!/usr/bin/env node
// feature-808/817/830：真实 Electron + 真实 opencode 的定向故障注入。
// Provider 为本地受控 mock，只控制工具调用与响应中断时序，不构成真实 Provider 验收。
const assert = require('node:assert/strict')
const fs = require('node:fs')
const fsp = require('node:fs/promises')
const http = require('node:http')
const net = require('node:net')
const path = require('node:path')
const { spawn, execFileSync } = require('node:child_process')
const { buildElectronEnv } = require('./acceptance-env.cjs')

const repo = path.resolve(__dirname, '..')
const electronBinary = require('electron')
const mainEntry = path.join(repo, 'dist-electron', 'electron', 'main.js')
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const artifactRoot = path.join(
  path.resolve(process.env.ASD_TEST_TMP || path.join(repo, '.test-tmp')), 'runtime-interruption', stamp,
)
const userData = path.join(artifactRoot, 'userData')
const workspace = path.join(artifactRoot, 'workspace')
const result = {
  feature: ['808', '817', '830'],
  change: '2026-11-26-runtime-interruption-recovery',
  status: 'running',
  evidenceClass: 'real-electron-real-opencode-controlled-mock',
  realProviderAcceptance: false,
  startedAt: new Date().toISOString(),
  artifactRoot,
  checks: [],
}
const runningApps = new Set()
let provider = null

function check(name, condition, detail) {
  assert.ok(condition, `${name}${detail ? `：${JSON.stringify(detail)}` : ''}`)
  result.checks.push({ name, passed: true, ...(detail === undefined ? {} : { detail }) })
}

async function waitFor(label, fn, timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs
  let lastError = null
  while (Date.now() < deadline) {
    try {
      const value = await fn()
      if (value) return value
    } catch (error) {
      lastError = error
    }
    await new Promise(resolve => setTimeout(resolve, 150))
  }
  throw new Error(`等待超时：${label}${lastError ? `；最后错误：${lastError.message}` : ''}`)
}

async function freePort() {
  const server = net.createServer()
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject))
  const port = server.address().port
  await new Promise(resolve => server.close(resolve))
  return port
}

function processTable() {
  return execFileSync('ps', ['-axo', 'pid=,ppid=,command='], { encoding: 'utf-8', maxBuffer: 8 * 1024 * 1024 })
    .split('\n')
    .map(line => line.match(/^\s*(\d+)\s+(\d+)\s+(.*)$/))
    .filter(Boolean)
    .map(match => ({ pid: Number(match[1]), ppid: Number(match[2]), command: match[3] }))
}

function descendantsOf(pid) {
  const table = processTable()
  const descendants = []
  const queue = [pid]
  while (queue.length > 0) {
    const parent = queue.shift()
    for (const child of table.filter(entry => entry.ppid === parent)) {
      descendants.push(child)
      queue.push(child.pid)
    }
  }
  return descendants
}

function killPid(pid, signal = 'SIGKILL') {
  try { process.kill(pid, signal) } catch (error) {
    if (error.code !== 'ESRCH') throw error
  }
}

async function killApp(app) {
  if (!app || app.child.exitCode !== null || app.child.signalCode !== null) return
  const descendants = descendantsOf(app.child.pid)
  result.injectedProcesses = descendants.map(entry => ({ pid: entry.pid, command: entry.command }))
  killPid(app.child.pid)
  await waitFor('Electron SIGKILL 退出', () => app.child.exitCode !== null || app.child.signalCode !== null, 10_000)
  for (const entry of descendants.reverse()) killPid(entry.pid)
}

class ControlledProvider {
  constructor() {
    this.requests = []
    this.held = []
    this.server = http.createServer((req, res) => void this.handle(req, res))
  }

  async listen() {
    await new Promise((resolve, reject) => this.server.listen(0, '127.0.0.1', resolve).once('error', reject))
    this.baseUrl = `http://127.0.0.1:${this.server.address().port}/v1`
  }

  async close() {
    for (const res of this.held) if (!res.destroyed) res.destroy()
    await new Promise(resolve => this.server.close(resolve))
  }

  completeHeld(text = '人工重试已完成') {
    for (const res of this.held.splice(0)) {
      if (res.destroyed || res.writableEnded) continue
      this.writeSse(res, [
        { role: 'assistant', content: text },
        { finish_reason: 'stop' },
      ])
      res.end()
    }
  }

  writeSse(res, deltas) {
    if (!res.headersSent) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      })
    }
    for (const delta of deltas) {
      const { finish_reason = null, ...content } = delta
      res.write(`data: ${JSON.stringify({
        id: 'chatcmpl-runtime-recovery', object: 'chat.completion.chunk', created: 1,
        model: 'mock-1', choices: [{ index: 0, delta: content, finish_reason }],
      })}\n\n`)
    }
    if (deltas.some(delta => delta.finish_reason)) res.write('data: [DONE]\n\n')
  }

  async handle(req, res) {
    if (req.method === 'GET' && req.url === '/v1/models') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ object: 'list', data: [{ id: 'mock-1', object: 'model', created: 1, owned_by: 'mock' }] }))
      return
    }
    if (req.method !== 'POST' || req.url !== '/v1/chat/completions') {
      res.writeHead(404).end()
      return
    }
    let raw = ''
    for await (const chunk of req) raw += chunk
    const body = JSON.parse(raw)
    this.requests.push({ at: new Date().toISOString(), stream: body.stream === true, messageCount: body.messages?.length })
    const index = this.requests.length
    if (body.stream !== true) {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        id: 'chatcmpl-runtime-recovery', object: 'chat.completion', created: 1, model: 'mock-1',
        choices: [{ index: 0, message: { role: 'assistant', content: '受控响应' }, finish_reason: 'stop' }],
      }))
      return
    }
    if (index === 1) {
      const optionText = '请选择后续方向\n【选项】\n1. 都市逆袭\n2. 悬疑推理\n【/选项】'
      const gateArgs = JSON.stringify({
        gateId: 'gate-runtime-recovery', title: '运行恢复验收门',
        question: '是否批准中断前生成的方案？', options: ['批准', '拒绝'],
      })
      this.writeSse(res, [
        { role: 'assistant', content: optionText },
        { tool_calls: [{ index: 0, id: 'call-gate-runtime-recovery', type: 'function', function: { name: 'shortdrama_gate_request', arguments: gateArgs } }] },
        { finish_reason: 'tool_calls' },
      ])
      res.end()
      return
    }
    // 第二次请求是 gate 工具结果后的续答；第三次是人工重试。均保持 pending，等待显式放行。
    this.held.push(res)
  }
}

class Cdp {
  constructor(url) {
    this.ws = new WebSocket(url)
    this.nextId = 1
    this.pending = new Map()
    this.ws.addEventListener('message', event => {
      const message = JSON.parse(event.data)
      if (!message.id) return
      const pending = this.pending.get(message.id)
      if (!pending) return
      this.pending.delete(message.id)
      clearTimeout(pending.timer)
      if (message.error) pending.reject(new Error(JSON.stringify(message.error)))
      else pending.resolve(message.result)
    })
    this.ws.addEventListener('close', () => {
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timer)
        pending.reject(new Error('CDP 连接已关闭'))
      }
      this.pending.clear()
    })
  }

  async open() {
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true })
      this.ws.addEventListener('error', () => reject(new Error('CDP WebSocket 连接失败')), { once: true })
    })
    await this.send('Runtime.enable')
    await this.send('Page.enable')
  }

  send(method, params = {}) {
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`CDP ${method} 超时`))
      }, 60_000)
      this.pending.set(id, { resolve, reject, timer })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }

  async evaluate(expression) {
    const response = await this.send('Runtime.evaluate', {
      expression, awaitPromise: true, returnByValue: true, userGesture: true,
    })
    if (response.exceptionDetails) {
      throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text)
    }
    return response.result.value
  }

  close() { this.ws.close() }
}

async function launchApp() {
  const port = await freePort()
  const log = fs.createWriteStream(path.join(artifactRoot, `electron-${port}.log`), { flags: 'a' })
  const env = {
    ...process.env,
    ...buildElectronEnv({ userData }),
    ASD_ACCEPTANCE: '1',
    ASD_USER_DATA: userData,
    MOCK_API_KEY: 'controlled-local-only',
  }
  delete env.VITE_DEV_SERVER_URL
  delete env.ELECTRON_RUN_AS_NODE
  const child = spawn(electronBinary, [
    mainEntry, `--remote-debugging-port=${port}`, '--remote-allow-origins=*',
  ], { cwd: repo, env, stdio: ['ignore', 'pipe', 'pipe'] })
  child.stdout.pipe(log)
  child.stderr.pipe(log)
  const app = { child, port }
  runningApps.add(app)
  child.once('exit', (code, signal) => {
    app.exit = { code, signal }
    log.end()
  })
  const page = await waitFor('Electron CDP 页面', async () => {
    const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json())
    return pages.find(entry => entry.type === 'page' && entry.url.includes('dist/index.html'))
  })
  const cdp = new Cdp(page.webSocketDebuggerUrl)
  await cdp.open()
  app.cdp = cdp
  await waitFor('window.api 就绪', () => cdp.evaluate('typeof window.api === "object"'))
  await cdp.evaluate(`window.api.settings.ai.update({ runtime: { mockBaseUrl: ${JSON.stringify(provider.baseUrl)} } })`)
  return app
}

async function screenshot(app, name) {
  const capture = await app.cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  await fsp.writeFile(path.join(artifactRoot, name), Buffer.from(capture.data, 'base64'))
}

async function main() {
  await fsp.mkdir(userData, { recursive: true })
  await fsp.mkdir(workspace, { recursive: true })
  await fsp.writeFile(path.join(userData, 'workspace.json'), JSON.stringify({
    version: 1, rootDir: workspace, updatedAt: new Date().toISOString(),
  }))
  check('构建产物存在', fs.existsSync(mainEntry) && fs.existsSync(path.join(repo, 'dist', 'index.html')))
  provider = new ControlledProvider()
  await provider.listen()
  result.provider = { kind: 'controlled-mock', providerID: 'mock', modelID: 'mock-1' }

  const first = await launchApp()
  const project = await first.cdp.evaluate('window.api.createProject("project-accept-runtime-recovery")')
  const canvas = {
    schemaVersion: 4, projectId: path.basename(project.dir), title: '运行中断恢复验收',
    pages: [{
      id: 'page-1', title: '主画布', activeCanvasId: 'canvas-1', viewports: {},
      canvases: [{
        id: 'canvas-1', title: '主画布', viewport: null, edges: [],
        nodes: [{
          id: 'story-outline', step: '1', kind: 'outline', title: '已落盘故事', status: 'done',
          position: { x: 100, y: 80 }, ref: { path: '故事/outline.json', format: 'json' },
          updatedAt: '2026-11-26T00:00:00.000Z',
        }],
      }],
    }],
    activePageId: 'page-1', activeView: 'canvas', gates: [],
    revision: 0, receipts: [], updatedAt: '2026-11-26T00:00:00.000Z',
  }
  await fsp.mkdir(path.join(project.dir, '故事'), { recursive: true })
  await fsp.writeFile(path.join(project.dir, '故事', 'outline.json'), '{"title":"中断前已落盘"}')
  await fsp.writeFile(path.join(project.dir, 'canvas.json'), JSON.stringify(canvas, null, 2))
  await first.cdp.evaluate(`window.api.openProject(${JSON.stringify(project.dir)})`)
  const session = await first.cdp.evaluate('window.api.runtime.createSession("运行中断恢复会话")')
  await first.cdp.evaluate(`window.api.activeSession(${JSON.stringify(session.id)})`)
  await first.cdp.evaluate(`window.api.runtime.subscribe(${JSON.stringify(session.id)})`)
  await first.cdp.send('Page.reload', { ignoreCache: true })
  await waitFor('首轮工作台绑定', () => first.cdp.evaluate(`document.body.innerText.includes('project-accept-runtime-recovery') && !!document.querySelector('textarea')`))

  const request = { sessionId: session.id, text: '生成一个中断恢复测试方案', agent: 'showrunner', model: { providerID: 'mock', modelID: 'mock-1' } }
  const accepted = await first.cdp.evaluate(`window.api.runtime.promptAsync(${JSON.stringify(request)})`)
  check('首轮 promptAsync 返回真实 messageID', accepted.accepted === true && accepted.messageId.startsWith('msg_'), accepted)
  const oldRunId = accepted.messageId
  await waitFor('gate 工具结果后的受控挂起', () => provider.requests.length >= 2)
  await waitFor('pending Gate 与 running 账本落盘', async () => {
    const [runs, currentCanvas] = await Promise.all([
      first.cdp.evaluate('window.api.runtime.runs()'),
      first.cdp.evaluate('window.api.canvas.get()'),
    ])
    return runs.some(run => run.id === oldRunId && run.status === 'running')
      && currentCanvas.gates.some(gate => gate.gateId === 'gate-runtime-recovery' && gate.status === 'pending')
  })
  const beforeMessages = await first.cdp.evaluate(`window.api.runtime.sessionMessages(${JSON.stringify(session.id)})`)
  check('中断前用户与 assistant 历史已持久化', beforeMessages.some(message => message.info.id === oldRunId && message.info.role === 'user') && beforeMessages.some(message => message.info.role === 'assistant'), { count: beforeMessages.length })
  const beforeCanvas = await first.cdp.evaluate('window.api.canvas.get()')
  check('中断前画布产物与 pending Gate 已落盘', beforeCanvas.pages[0].canvases[0].nodes.some(node => node.id === 'story-outline'))
  const descendants = descendantsOf(first.child.pid)
  check('真实 opencode 子进程存在', descendants.some(entry => entry.command.includes('opencode') && entry.command.includes('serve')), descendants.map(entry => entry.command))
  result.beforeKill = { runId: oldRunId, messageCount: beforeMessages.length, providerRequests: provider.requests.length }
  await killApp(first)
  result.checks.push({ name: 'SIGKILL Electron 并清理其遗留 opencode 子进程', passed: true })

  const ledgerPath = path.join(project.dir, '.agent-runs.json')
  const ledger = JSON.parse(await fsp.readFile(ledgerPath, 'utf-8'))
  ledger.push({
    id: 'msg_orphan_recovery_fixture', sessionId: session.id,
    request: { ...request, text: '无可回放用户历史的故障夹具' },
    status: 'running', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  })
  await fsp.writeFile(ledgerPath, JSON.stringify(ledger, null, 2))
  result.orphanFixture = 'SIGKILL 后向真实项目账本注入 running 记录；无对应 opencode 用户消息，仅用于孤儿恢复分支。'

  const second = await launchApp()
  await waitFor('冷启动对账为 interrupted', async () => {
    const runs = await second.cdp.evaluate('window.api.runtime.runs()')
    return runs.find(run => run.id === oldRunId)?.status === 'interrupted'
      && runs.find(run => run.id === 'msg_orphan_recovery_fixture')?.status === 'interrupted'
  })
  const afterMessages = await second.cdp.evaluate(`window.api.runtime.sessionMessages(${JSON.stringify(session.id)})`)
  check('重启后消息不丢失', afterMessages.length >= beforeMessages.length && afterMessages.some(message => message.info.id === oldRunId), { before: beforeMessages.length, after: afterMessages.length })
  const recoveredCanvas = await second.cdp.evaluate('window.api.canvas.get()')
  check('重启后画布产物与 pending Gate 保留且未代决', recoveredCanvas.pages[0].canvases[0].nodes.some(node => node.id === 'story-outline') && recoveredCanvas.gates.some(gate => gate.gateId === 'gate-runtime-recovery' && gate.status === 'pending'))
  await waitFor('恢复卡、OptionCard、Gate 与孤儿卡上屏', () => second.cdp.evaluate(`(() => {
    const cards = document.querySelectorAll('[data-run-recovery]')
    return cards.length === 2 && document.body.innerText.includes('是否批准中断前生成的方案？')
      && document.body.innerText.includes('提交结果未知') && document.body.innerText.includes('已中断')
      && !!document.querySelector('[data-chat-option="1"]') && !document.querySelector('[data-picked]')
  })()`))
  const blocked = await second.cdp.evaluate(`(() => {
    const card = document.querySelector('[data-run-recovery][data-run-id="${oldRunId}"]')
    return { disabled: card?.querySelector('button')?.disabled, reason: card?.textContent }
  })()`)
  check('未决 Gate 阻断人工重试', blocked.disabled === true && blocked.reason.includes('请先完成未决 Gate'), blocked)
  check('冷启动没有自动重试或代选 OptionCard', provider.requests.length === 2 && !(await second.cdp.evaluate('!!document.querySelector("[data-picked]")')))
  await screenshot(second, 'after-restart.png')

  await second.cdp.evaluate('window.api.gate.decide({ gateId: "gate-runtime-recovery", decision: "rejected", note: "故障注入验收：人工拒绝旧门" })')
  await waitFor('人工裁决后旧恢复卡可点击', () => second.cdp.evaluate(`(() => {
    const button = document.querySelector('[data-run-recovery][data-run-id="${oldRunId}"] button')
    return button && !button.disabled
  })()`))
  await second.cdp.evaluate(`(() => {
    const button = document.querySelector('[data-run-recovery][data-run-id="${oldRunId}"] button')
    button.click()
    button.click()
  })()`)
  check('双击恢复按钮不展示并发内部错误',
    !(await second.cdp.evaluate('document.body.innerText')).includes('不能并发重试'))
  await waitFor('仅一次人工重试创建新 running 记录', async () => {
    const runs = await second.cdp.evaluate('window.api.runtime.runs()')
    return runs.some(run => run.retryOfMessageId === oldRunId && run.status === 'running')
      && provider.requests.length === 3
  })
  const retryRuns = await second.cdp.evaluate('window.api.runtime.runs()')
  const retry = retryRuns.find(run => run.retryOfMessageId === oldRunId)
  check('重试 ID 不同且血缘正确', retry && retry.id !== oldRunId && retry.retryOfMessageId === oldRunId, retry)
  check('旧中断与孤儿运行不被改写或自动重试', retryRuns.find(run => run.id === oldRunId)?.status === 'interrupted' && retryRuns.find(run => run.id === 'msg_orphan_recovery_fixture')?.status === 'interrupted')
  check('连续点击只提交一个新运行', retryRuns.length === 3 && provider.requests.length === 3, { runs: retryRuns.length, providerRequests: provider.requests.length })
  await waitFor('新用户消息展示重试血缘', () => second.cdp.evaluate(`!!document.querySelector('[data-run-lineage="${oldRunId}"]')`))
  result.retry = { oldRunId, newRunId: retry.id, statusBeforeProviderRelease: retry.status }

  provider.completeHeld()
  await waitFor('人工重试正常完成', async () => {
    const runs = await second.cdp.evaluate('window.api.runtime.runs()')
    return runs.find(run => run.id === retry.id)?.status === 'completed'
  })
  const finalRuns = await second.cdp.evaluate('window.api.runtime.runs()')
  check('重试完成后仅新运行进入 completed', finalRuns.find(run => run.id === retry.id)?.status === 'completed' && finalRuns.find(run => run.id === oldRunId)?.status === 'interrupted')
  const finalMessages = await second.cdp.evaluate(`window.api.runtime.sessionMessages(${JSON.stringify(session.id)})`)
  check('重试使用新的真实用户 messageID', finalMessages.some(message => message.info.id === retry.id && message.info.role === 'user'))
  await screenshot(second, 'after-retry.png')
  await second.cdp.evaluate('window.api.runtime.stop()')
  await second.cdp.send('Browser.close').catch(() => {})
  await waitFor('验收应用正常退出', () => second.exit, 15_000)
  result.providerRequests = provider.requests
  result.finalRuns = finalRuns.map(run => ({ id: run.id, status: run.status, retryOfMessageId: run.retryOfMessageId }))
}

async function run() {
  try {
    await main()
    result.status = 'passed'
  } catch (error) {
    result.status = 'failed'
    result.error = error.stack || String(error)
    process.exitCode = 1
  } finally {
    for (const app of runningApps) {
      try { app.cdp?.close() } catch {}
      try { await killApp(app) } catch (error) { result.cleanupError = String(error) }
    }
    if (provider) await provider.close()
    result.finishedAt = new Date().toISOString()
    await fsp.mkdir(artifactRoot, { recursive: true })
    await fsp.writeFile(path.join(artifactRoot, 'result.json'), JSON.stringify(result, null, 2))
    console.log(JSON.stringify({ status: result.status, artifactRoot, checks: result.checks.length, error: result.error }, null, 2))
  }
}

if (require.main === module) void run()

module.exports = { Cdp, waitFor }
