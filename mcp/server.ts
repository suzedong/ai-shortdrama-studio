// MCP 网关骨架 —— 一期注册占位工具，二期逐项实现
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

const server = new Server(
  { name: 'shortdrama-mcp', version: '0.1.0' },
  { capabilities: { tools: {} } },
)

// 工具注册表（二期按设计文档第 5 节逐项实现）
const tools = [
  {
    name: 'canvas.read',
    description: '读取画布节点与连线',
    inputSchema: { type: 'object', properties: { nodeId: { type: 'string' } } },
  },
  {
    name: 'project.manifest',
    description: '读取/写入项目 manifest（立项五要素、视觉风格、预检清单）',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'file.write',
    description: '文本资产落盘（剧本/分镜）',
    inputSchema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } } },
  },
  {
    name: 'video.submit',
    description: '提交视频生成任务到云端矩阵',
    inputSchema: { type: 'object', properties: { prompt: { type: 'string' } } },
  },
  {
    name: 'harness.verify',
    description: '执行 Harness 质量校验',
    inputSchema: { type: 'object', properties: { target: { type: 'string' } } },
  },
  {
    name: 'skill.list',
    description: '列出可用 Skill',
    inputSchema: { type: 'object', properties: {} },
  },
]

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params
  // TODO: 二期实现真实逻辑
  return {
    content: [{ type: 'text', text: `[mock] tool=${name} args=${JSON.stringify(args)}` }],
  }
})

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('shortdrama-mcp server running on stdio')
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
