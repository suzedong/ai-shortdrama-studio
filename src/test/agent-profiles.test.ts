// feature-018 · T1/T2：4 个摄制组 profile 的 frontmatter 与系统提示静态契约
import { describe, expect, it } from 'vitest'
import path from 'node:path'
import fsp from 'node:fs/promises'

const AGENTS_DIR = path.join(process.cwd(), 'resources', 'opencode', 'agents')
const PROFILE_FILES = [
  'showrunner.md',
  'writer.md',
  'media-director.md',
  'comfyui-operator.md',
] as const

async function readProfile(file: string): Promise<string> {
  return fsp.readFile(path.join(AGENTS_DIR, file), 'utf-8')
}

function splitFrontmatter(md: string): { fm: string; body: string } {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(md)
  if (!match) throw new Error('缺少 frontmatter 围栏')
  return { fm: match[1]!, body: match[2]! }
}

// 契约 §3：各 profile 的物理工具 true 键
const TOOLS_TRUE: Record<string, string[]> = {
  'showrunner.md': [
    'shortdrama_file_read',
    'shortdrama_file_list',
    'shortdrama_file_write',
    'shortdrama_canvas_get',
    'shortdrama_canvas_update',
    'shortdrama_gate_request',
    // feature-001：立项三工具物理 ID 保留点号（契约 §3）
    'shortdrama_brief.plan',
    'shortdrama_brief.publish',
    'shortdrama_brief.list',
    // feature-801：manifest 状态机两工具物理 ID 保留点号
    'shortdrama_manifest.get',
    'shortdrama_manifest.advance',
    // feature-802：视觉风格谱系三工具物理 ID 保留点号
    'shortdrama_style.catalog',
    'shortdrama_style.get',
    'shortdrama_style.validate',
    // feature-002：立项再版评估/提交 + 节点对齐物理 ID 保留点号
    'shortdrama_brief.impact.assess',
    'shortdrama_brief.impact.commit',
    'shortdrama_canvas.align',
  ],
  'writer.md': [
    'shortdrama_file_read',
    'shortdrama_file_list',
    'shortdrama_file_write',
    'shortdrama_canvas_get',
    'shortdrama_canvas_update',
  ],
  'media-director.md': [
    'shortdrama_file_read',
    'shortdrama_file_list',
    'shortdrama_file_write',
    'shortdrama_canvas_get',
    'shortdrama_canvas_update',
    'shortdrama_asset_register',
    'shortdrama_asset_list',
    'shortdrama_comfyui_queue',
    'shortdrama_comfyui_status',
  ],
  'comfyui-operator.md': [
    'shortdrama_file_read',
    'shortdrama_file_list',
    'shortdrama_file_write',
    'shortdrama_canvas_update',
    'shortdrama_asset_register',
    'shortdrama_asset_list',
    'shortdrama_comfyui_instances',
    'shortdrama_comfyui_queue',
    'shortdrama_comfyui_status',
  ],
}

describe('T1 · profile frontmatter 静态契约', () => {
  it('4 文件齐全', async () => {
    for (const file of PROFILE_FILES) {
      await expect(fsp.access(path.join(AGENTS_DIR, file))).resolves.toBeUndefined()
    }
  })

  it('showrunner：primary + 17 物理工具 + task 常驻 + 占位符 model', async () => {
    const { fm } = splitFrontmatter(await readProfile('showrunner.md'))
    expect(fm).toMatch(/^mode: primary$/m)
    expect(fm).toMatch(/^model: ark\/__ARK_MODEL_ID__$/m)
    expect(fm).toMatch(/^temperature: 0\.2$/m)
    expect(fm).toMatch(/^  task: true$/m)
    for (const key of TOOLS_TRUE['showrunner.md']!) {
      expect(fm).toMatch(new RegExp(`^  ${key}: true$`, 'm'))
    }
  })

  it('showrunner permission.task：* deny + 三个专职 allow', async () => {
    const { fm } = splitFrontmatter(await readProfile('showrunner.md'))
    expect(fm).toMatch(/^    "\*": deny$/m)
    expect(fm).toMatch(/^    writer: allow$/m)
    expect(fm).toMatch(/^    media-director: allow$/m)
    expect(fm).toMatch(/^    comfyui-operator: allow$/m)
  })

  it('三个专职：subagent + task 禁用（tools:false / permission:deny）+ 各自物理工具', async () => {
    const expectedMode = {
      'writer.md': '0.3',
      'media-director.md': '0.2',
      'comfyui-operator.md': '0.1',
    } as const
    for (const file of ['writer.md', 'media-director.md', 'comfyui-operator.md'] as const) {
      const { fm } = splitFrontmatter(await readProfile(file))
      expect(fm).toMatch(/^mode: subagent$/m)
      expect(fm).toMatch(/^model: ark\/__ARK_MODEL_ID__$/m)
      expect(fm).toMatch(new RegExp(`^temperature: ${expectedMode[file]}$`, 'm'))
      expect(fm).toMatch(/^  task: false$/m)
      expect(fm).toMatch(/^  task: deny$/m)
      for (const key of TOOLS_TRUE[file]!) {
        expect(fm).toMatch(new RegExp(`^  ${key}: true$`, 'm'))
      }
    }
  })

  it('frontmatter 点号工具键仅允许立项三工具、状态机两工具、feature-802 谱系三工具与 feature-002 再版三工具', async () => {
    const dottedWhitelist = [
      'shortdrama_brief.plan',
      'shortdrama_brief.publish',
      'shortdrama_brief.list',
      'shortdrama_manifest.get',
      'shortdrama_manifest.advance',
      'shortdrama_style.catalog',
      'shortdrama_style.get',
      'shortdrama_style.validate',
      'shortdrama_brief.impact.assess',
      'shortdrama_brief.impact.commit',
      'shortdrama_canvas.align',
    ]
    for (const file of PROFILE_FILES) {
      const { fm } = splitFrontmatter(await readProfile(file))
      const dottedKeys = [...fm.matchAll(/^\s+(shortdrama_\S*\.\S*):/gm)].map(m => m[1])
      for (const key of dottedKeys) {
        expect(dottedWhitelist).toContain(key)
      }
      // 点号键只可能出现在 showrunner profile
      if (dottedKeys.length > 0) expect(file).toBe('showrunner.md')
    }
  })
})

describe('T2 · 系统提示静态契约', () => {
  it('showrunner：八步 0–7、内容自产、强制外包三条款、门纪律/恢复、能力诚实、模型纪律', async () => {
    const { body } = splitFrontmatter(await readProfile('showrunner.md'))
    expect(body).toMatch(/0 立项[\s\S]*7 发布/)
    expect(body).toContain('内容自产')
    expect(body).toContain('强制外包')
    expect(body).toMatch(/委派 `writer`/)
    expect(body).toMatch(/委派 `media-director`/)
    expect(body).toMatch(/委派 `comfyui-operator`/)
    expect(body).toContain('门纪律')
    expect(body).toContain('门恢复')
    expect(body).toContain('能力诚实')
    expect(body).toContain('模型纪律')
  })

  it('三个专职均含"不发门 / 不派 task"条款', async () => {
    for (const file of ['writer.md', 'media-director.md', 'comfyui-operator.md'] as const) {
      const { body } = splitFrontmatter(await readProfile(file))
      expect(body).toContain('不发门')
      expect(body).toMatch(/不派\s?task/)
    }
  })

  it('内容自产措辞：文本由自身推理产出；无"经工具生成/产出内容"旧式表述', async () => {
    for (const file of ['showrunner.md', 'writer.md', 'media-director.md'] as const) {
      const { body } = splitFrontmatter(await readProfile(file))
      expect(body).toContain('自身推理产出')
      // 紧匹配：禁止"经工具生成/产出内容"肯定式表述；引号内的否定式不命中
      expect(body).not.toMatch(/经工具(直接)?(生成|产出)内容/)
    }
  })

  it('feature-802：showrunner 第 0 步动作化——先查后选、6 封闭候选、styleIssues 与装载三码', async () => {
    const { body } = splitFrontmatter(await readProfile('showrunner.md'))
    // 选型前必须调谱系工具
    expect(body).toContain('shortdrama_style.catalog')
    expect(body).toContain('shortdrama_style.get')
    expect(body).toContain('shortdrama_style.validate')
    // 封闭候选域与逐字版本
    expect(body).toContain('`B1` 清新生活流与 `D1`–`D5`')
    expect(body).toMatch(/逐字采用返回的 `version`/)
    // ready:false 时 styleIssues 必须处理
    expect(body).toContain('styleIssues[].message')
    // 装载三码显式阻断
    expect(body).toContain('STYLE_CATALOG_MISSING')
    expect(body).toContain('STYLE_CATALOG_PARSE_ERROR')
    expect(body).toContain('STYLE_CATALOG_DRIFT')
    // 三工具名不得出现在第 0 步之外（第 0 步为正文唯一章节，计数锚点：第 1/2 步不含）
    expect(body).not.toMatch(/第 1 步[\s\S]*shortdrama_style\./)
  })

  it('feature-802：三个专职 profile 正文不出现 style 谱系工具', async () => {
    for (const file of ['writer.md', 'media-director.md', 'comfyui-operator.md'] as const) {
      const { fm, body } = splitFrontmatter(await readProfile(file))
      expect(fm).not.toContain('shortdrama_style.')
      expect(body).not.toContain('shortdrama_style.')
    }
  })
})
