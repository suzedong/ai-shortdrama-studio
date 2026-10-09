// feature-010 · MCP 业务工具 HTTP 服务（主进程，仅绑 loopback）
// MCP over Streamable HTTP：单一 /mcp，POST 处理 JSON-RPC，GET 开 SSE；Bearer 鉴权。
// 严格匹配《SDG-RE-契约.md》§2。
import http from 'node:http'
import crypto from 'node:crypto'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { registerPureTools } from './tools.js'

export interface McpToolServerHandle {
  port: number
  token: string
  url: string
  close: () => Promise<void>
}

export interface StartMcpToolServerOptions {
  host?: string
  portRangeStart?: number
  portRangeCount?: number
}

const DEFAULT_HOST = '127.0.0.1'
const DEFAULT_PORT_START = 4100
const DEFAULT_PORT_COUNT = 25

function listen(server: http.Server, host: string, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, host, () => {
      server.removeListener('error', reject)
      resolve()
    })
  })
}

async function probePort(host: string, start: number, count: number): Promise<{ server: http.Server; port: number }> {
  let lastErr: unknown = null
  for (let offset = 0; offset < count; offset += 1) {
    const port = start + offset
    const server = http.createServer()
    try {
      await listen(server, host, port)
      return { server, port }
    } catch (err) {
      lastErr = err
      // 端口占用（EADDRINUSE）才顺探；其余错误立即抛出
      const code = (err as { code?: string }).code
      if (code !== 'EADDRINUSE') throw err
    }
  }
  throw new Error(`MCP 端口 ${start}–${start + count - 1} 均不可用：${String(lastErr)}`)
}

function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      // 简单上限 1 MiB，防异常大 body
      if (size > 1024 * 1024) {
        reject(new Error('MCP request body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8')
      if (!raw) {
        resolve(undefined)
        return
      }
      try {
        resolve(JSON.parse(raw))
      } catch {
        resolve(undefined)
      }
    })
    req.on('error', reject)
  })
}

export async function startMcpToolServer(opts: StartMcpToolServerOptions = {}): Promise<McpToolServerHandle> {
  const host = opts.host ?? DEFAULT_HOST
  const portStart = opts.portRangeStart ?? DEFAULT_PORT_START
  const portCount = opts.portRangeCount ?? DEFAULT_PORT_COUNT

  const token = crypto.randomBytes(24).toString('base64url')

  const { server, port } = await probePort(host, portStart, portCount)

  const mcpServer = new McpServer(
    { name: 'shortdrama-tools', version: '1.0.0' },
    { capabilities: { tools: {} } },
  )
  registerPureTools(mcpServer)

  // stateful：sessionId 由 transport 生成并在响应头回传
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
  })

  await mcpServer.connect(transport)

  const reject401 = (res: http.ServerResponse) => {
    res.writeHead(401, {
      'Content-Type': 'application/json',
      'WWW-Authenticate': 'Bearer',
    })
    res.end(JSON.stringify({ error: 'unauthorized' }))
  }

  server.on('request', async (req, res) => {
    try {
      if (req.url !== '/mcp') {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'not found' }))
        return
      }

      // Bearer 鉴权（恒定时间比较）
      const auth = req.headers.authorization ?? ''
      const expected = `Bearer ${token}`
      const authBuf = Buffer.from(auth)
      const expectedBuf = Buffer.from(expected)
      if (authBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(authBuf, expectedBuf)) {
        reject401(res)
        return
      }

      if (req.method === 'GET') {
        // 打开 SSE
        await transport.handleRequest(req, res)
        return
      }

      if (req.method === 'POST') {
        const body = await readBody(req)
        if (body === undefined) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32600, message: 'invalid request body' }, id: null }))
          return
        }
        await transport.handleRequest(req, res, body)
        return
      }

      if (req.method === 'DELETE') {
        await transport.handleRequest(req, res)
        return
      }

      res.writeHead(405, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'method not allowed' }))
    } catch (err) {
      console.error('[mcp] request 处理失败:', err)
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'internal error' }))
      }
    }
  })

  const close = async () => {
    try {
      await transport.close()
    } catch (err) {
      console.error('[mcp] transport close 失败:', err)
    }
    try {
      await mcpServer.close()
    } catch (err) {
      console.error('[mcp] mcpServer close 失败:', err)
    }
    await new Promise<void>((resolve) => {
      server.close(() => resolve())
    })
  }

  return {
    port,
    token,
    url: `http://${host}:${port}/mcp`,
    close,
  }
}
