// 浏览器预览用 mock：当 Electron preload 未注入 window.api 时，提供空态实现，
// 方便脱离 Electron 直接在浏览器迭代 UI。生产 Electron 环境下 preload 会覆盖此 mock。
import type { Canvas } from '../shared/types'
import type { RuntimeStatus } from './lib/runtime-types'

// 浏览器预览用 DAG 演示数据：跨 0 立项 → 5 后期六个步骤，
// 节点无坐标，由 CanvasBoard 按 step 自动分列布局。
function demoCanvas(): Canvas {
  const now = new Date().toISOString()
  const nodes = [
    { id: 'n-brief', step: '0', kind: 'brief', title: '立项单 · 安妮的夏天', status: 'done', ref: { path: '/demo/anni/立项单.v3.json', format: 'json' }, meta: { version: 'v3' }, updatedAt: now },
    { id: 'n-outline', step: '1', kind: 'outline', title: '故事大纲 · 钩子 → 相遇 → 心动', status: 'done', ref: { path: '/demo/anni/outline.json', format: 'json' }, meta: { version: 'v6' }, updatedAt: now },
    { id: 'n-scenes', step: '2', kind: 'scenes', title: '第一集分场 · 5 场 42 句台词', status: 'done', ref: { path: '/demo/anni/scenes.json', format: 'json' }, meta: { version: 'v6' }, updatedAt: now },
    { id: 'n-char-anni', step: '3', kind: 'profiles', title: '安妮 · 女主定妆（配方已锁定）', status: 'active', ref: { path: '/demo/anni/char-anni.json', format: 'json' }, meta: { version: 'v4' }, updatedAt: now },
    { id: 'n-scene-dorm', step: '3', kind: 'visual-style', title: '宿舍外景 · 蝉鸣午后', status: 'done', ref: { path: '/demo/anni/scene-dorm.json', format: 'json' }, meta: { version: 'v2' }, updatedAt: now },
    { id: 'n-storyboard', step: '4', kind: 'storyboard', title: '分镜表 · 18 镜 92″', status: 'done', ref: { path: '/demo/anni/storyboard.json', format: 'json' }, meta: { version: 'v8' }, updatedAt: now },
    { id: 'n-shot-v001', step: '5', kind: 'shot', title: 'V001 D 正片 · 5.2″', status: 'done', ref: { path: '/demo/assets/V001.mp4', format: 'json' }, meta: { version: 'Dv8' }, updatedAt: now },
    { id: 'n-shot-v002', step: '5', kind: 'shot', title: 'V002 D 正片 · 生成中', status: 'active', ref: { path: '/demo/assets/V002.mp4', format: 'json' }, meta: { version: 'Dv6' }, updatedAt: now },
    { id: 'n-shot-v003', step: '5', kind: 'shot', title: 'V003 T 试档 · 等待', status: 'pending', updatedAt: now },
    { id: 'n-edit', step: '6', kind: 'timeline', title: '粗剪时间线 · 12 镜已入轨 61″', status: 'pending', meta: { version: 'v1' }, updatedAt: now },
    { id: 'n-final', step: '7', kind: 'final', title: '成片交付 · 安妮的夏天 E01', status: 'pending', updatedAt: now },
  ]
  const edges = [
    { id: 'e1', from: 'n-brief', to: 'n-outline', auto: false },
    { id: 'e2', from: 'n-outline', to: 'n-scenes', auto: true },
    { id: 'e3', from: 'n-outline', to: 'n-storyboard', auto: true },
    { id: 'e4', from: 'n-scenes', to: 'n-char-anni', auto: false },
    { id: 'e5', from: 'n-scenes', to: 'n-scene-dorm', auto: false },
    { id: 'e6', from: 'n-storyboard', to: 'n-shot-v001', auto: true },
    { id: 'e7', from: 'n-char-anni', to: 'n-shot-v002', auto: false },
    { id: 'e8', from: 'n-scene-dorm', to: 'n-shot-v003', auto: false },
    { id: 'e9', from: 'n-shot-v001', to: 'n-edit', auto: true },
    { id: 'e10', from: 'n-edit', to: 'n-final', auto: true },
  ]
  return {
    schemaVersion: 2,
    projectId: 'anni',
    title: '安妮的夏天',
    nodes: nodes as Canvas['nodes'],
    edges,
    gates: [],
    updatedAt: now,
  }
}

// dev-mock 画布单例 + 订阅广播（模拟主进程 canvasStore 的 canvas:changed）
let demoState: Canvas | null = null
const demoCanvasListeners = new Set<(c: Canvas) => void>()

function getDemoCanvas(): Canvas {
  if (!demoState) demoState = demoCanvas()
  return structuredClone(demoState)
}

// ── file:read 演示产物（仅浏览器 mock 通道；真实 Electron 走主进程文件读取）──
function demoBrief() {
  return {
    schemaVersion: 2 as const,
    version: 3,
    kind: 'commercial' as const,
    fiveElements: {
      genre: '校园 / 恋爱 / 夏日',
      platforms: ['抖音', '快手', '红果短剧'],
      episodeDuration: '约 90 秒',
      episodeCount: '第一季 8 集（先做 E01）',
      tone: '清新治愈 · 暗恋心动 · 轻喜剧节奏',
      aspectRatio: '竖屏 9:16',
    },
    premise: {
      leads: '安妮（18，大一新生）× 林屿（19，本地摄影社少年）',
      time: '现代 · 某个盛夏暑假',
      place: '海边小城（校园 / 海堤 / 废弃灯塔）',
      coreEvent: '安妮骑车迷路撞翻林屿的相机，因一张老灯塔照片结缘',
      seasonBoundary: '第一季只讲两人相识到夏日祭确认心意，灯塔悬念留待第二季',
    },
    style: {
      mainStyleId: 'A7',
      catalogVersion: 'v1.46',
      auxiliaryStyleId: undefined,
    },
    diagnosisSummary: '同类校园恋爱短剧近 90 天头部 12 部平均完播率 38%，前 3 秒「初遇事故」钩子占比 67%；本项目以「误会式开场 + 集尾老照片悬念」切入，A7 拟真人风格与清新治愈基调产能可行，建议立项并先交付 E01 验证钩子。',
    approve: {
      at: '2026-09-12T10:24:00+08:00',
      by: 'gate' as const,
      note: '六要素齐备，按 E01 试播集推进。',
    },
    changesFromPrevious: [
      { field: 'fiveElements.episodeCount', from: '第一季 12 集', to: '第一季 8 集（先做 E01）' },
      { field: 'premise.seasonBoundary', from: '', to: '第一季只讲两人相识到夏日祭确认心意，灯塔悬念留待第二季' },
    ],
    publishedAt: '2026-09-12T10:24:00+08:00',
  }
}

function demoOutline() {
  return {
    logline: '大一新生安妮在海边小城度过的夏天，因一场自行车意外闯入少年林屿的世界，从互相嫌弃到并肩守护海边灯塔。',
    seasonArc: '安妮在暑假随母迁居海边小城，与本地少年林屿因灯塔修复项目结识；两人在争吵与合作中靠近，最终在夏日祭烟花下确认心意，灯塔也重新点亮。',
    themes: ['夏日暗恋', '成长与告别', '小城治愈', '双向救赎'],
    conflicts: ['误会初遇：自行车撞翻林屿的相机', '灯塔拆除危机：开发商 vs 居民', '安妮将在夏末离开小城的倒计时', '林屿不愿提的父母往事'],
    episodes: [
      { ep: 1, title: '海风把你撞进镜头', synopsis: '安妮骑车迷路冲进海堤，撞翻正在拍灯塔的林屿；两人被迫一起送修相机，却在照相馆看到同一幅老灯塔照片。', hook: '照片背面写着安妮小时候的名字。' },
      { ep: 2, title: '灯塔不许拆', synopsis: '安妮发现学校组织的志愿者活动正是守护灯塔，与林屿再次碰面，两人分头收集老居民的灯塔记忆。', hook: '第一位受访老人指着安妮说：你回来了。' },
      { ep: 3, title: '冰柠檬水里的秘密', synopsis: '夏日祭筹备中，安妮替林屿挡下追问，林屿第一次提到父亲与灯塔的关系。', hook: '开发商进场，灯塔围栏一夜之间立起。' },
    ],
  }
}

function demoScenes() {
  return [
    {
      ep: 1, sceneNo: 1, slug: '海堤公路 · 日', interiorExterior: '外' as const, dayNight: '日' as const,
      location: '临海公路，左侧防波堤与大海', characterIds: ['c-anni', 'c-linyu'],
      beats: ['安妮骑车下坡迷路，海风掀起裙摆', '低头看地图时冲入逆行', '撞翻蹲在路边拍照的林屿，相机飞出', '两人同时扑向相机，额头差点相撞'],
      emotion: '慌乱 · 喜剧 · 心跳伏笔', estSeconds: 20,
      summary: '误会式开场：自行车事故让两人在海堤第一次相遇。',
    },
    {
      ep: 1, sceneNo: 2, slug: '老照相馆 · 内', interiorExterior: '内' as const, dayNight: '日' as const,
      location: '巷子深处的老式照相馆，墙上挂满旧照片', characterIds: ['c-anni', 'c-linyu'],
      beats: ['林屿心疼检查镜头，安妮不停道歉', '老板娘认出相机型号，随口提起灯塔老照片', '两人目光同时落在墙上同一幅灯塔合影', '安妮翻过照片，看见自己小时候的名字'],
      emotion: '好奇 · 悬念', estSeconds: 22,
      summary: '送修相机引出老照片，E01 集尾钩子落地。',
    },
    {
      ep: 1, sceneNo: 3, slug: '学校走廊 · 内', interiorExterior: '内' as const, dayNight: '日' as const,
      location: '大学教学楼走廊，社团招新摊位', characterIds: ['c-anni', 'c-xiaotang'],
      beats: ['转学生安妮找志愿者活动摊位', '小唐热情拉她加入灯塔守护社', '安妮在报名表上看到「林屿」的名字'],
      emotion: '新鲜 · 期待', estSeconds: 16,
      summary: '安妮主动加入灯塔守护社，为再遇铺路。',
    },
    {
      ep: 1, sceneNo: 4, slug: '宿舍天台 · 昏', interiorExterior: '外' as const, dayNight: '昏' as const,
      location: '女生宿舍天台，可远眺灯塔', characterIds: ['c-anni', 'c-sumin'],
      beats: ['安妮向室友苏敏展示老照片', '苏敏讲出灯塔拆迁传闻', '安妮望着远处灯塔出神'],
      emotion: '疑惑 · 决意', estSeconds: 16,
      summary: '支线信息投放：灯塔面临拆除。',
    },
    {
      ep: 1, sceneNo: 5, slug: '灯塔下礁石滩 · 夜', interiorExterior: '外' as const, dayNight: '夜' as const,
      location: '废弃灯塔前的礁石滩，月光', characterIds: ['c-anni', 'c-linyu'],
      beats: ['安妮独自夜探灯塔被涨潮困住', '林屿打着手电出现，默默伸出手', '两人翻过礁石，远处灯塔的光忽然扫过一圈'],
      emotion: '惊险 · 心动', estSeconds: 18,
      summary: '英雄救美式收尾，灯塔居然亮了。',
    },
  ]
}

function demoStoryboard() {
  const rows: [number, number, string, string, number, string, [string, string] | null][] = [
    [1, 1, '远景', '航拍下压，海堤公路与海岸线展开', 5, '无人机缓推', null],
    [2, 1, '全景', '安妮骑车下坡，白衬衫被风鼓起', 4, '侧向跟拍', null],
    [3, 1, '近景', '安妮低头看手绘地图，刘海被吹乱', 4, '手持轻晃', ['c-anni', '（自语）海堤……到底是哪条啊？']],
    [4, 1, '特写', '刹车手柄被急捏，金属反光', 2, '定格半拍', null],
    [5, 1, '中景', '林屿蹲身拍照毫无察觉，相机取景器里是灯塔', 5, '过肩', null],
    [6, 1, '全景', '自行车冲入画面撞翻林屿，相机脱手飞出', 4, '升格', null],
    [7, 2, '特写', '相机在地上翻滚停住，镜头盖裂开', 3, '低机位', null],
    [8, 2, '近景', '两人同时扑向相机，额头险些相撞', 4, '正反打', ['c-linyu', '你走路不看——等等，你是骑车的！']],
    [9, 2, '中景', '安妮双手合十连连鞠躬道歉', 5, '固定', ['c-anni', '对不起对不起！我赔，我打工赔你！']],
    [10, 2, '全景', '巷弄深处照相馆，暖黄灯光与门外冷色对比', 5, '缓推', null],
    [11, 2, '近景', '墙上老照片墙，正中一幅黑白灯塔合影', 5, '摇镜', null],
    [12, 2, '特写', '安妮指尖停在照片角落的小女孩脸上', 4, '浅景深', null],
    [13, 2, '特写', '翻过照片，钢笔字「小安妮 6 岁 夏」', 5, '静帧+推近', null],
    [14, 3, '中景', '社团招新走廊，小唐把传单塞进安妮怀里', 9, '横移', ['c-xiaotang', '守护灯塔社！就差你一个！']],
    [15, 4, '近景', '天台黄昏，苏敏用手机展示拆迁新闻', 10, '双人侧拍', ['c-sumin', '听说月底就进场拆了。']],
    [16, 5, '远景', '夜探礁石滩，手电光束在雾气里晃动', 6, '远景剪影', null],
    [17, 5, '中景', '涨潮漫过脚边，安妮后退被林屿一把拉住', 6, '手持急推', ['c-linyu', '抓稳，别往下看。']],
    [18, 5, '全景', '废弃灯塔顶的灯忽然缓缓扫出一道光', 6, '仰拍+光晕', null],
  ]
  return rows.map(([shotNo, sceneNo, shotSize, action, durationSec, camera, dl], i) => ({
    ep: 1, shotNo, rowOrder: i, shotSize, sceneNo,
    characterIds: dl ? [dl[0]] : [],
    action,
    dialogue: dl ? { speakerId: dl[0], text: dl[1], emotion: shotNo === 17 ? '紧张' : shotNo === 9 ? '急切' : '自然' } : null,
    durationSec, camera, refs: [],
  }))
}

function demoProfiles() {
  return [
    {
      id: 'c-anni', name: '安妮', age: '18', role: '大一新生 · 女主',
      personality: '外向冒失但内心细腻，认死理，对喜欢的事一股脑扎进去',
      background: '母亲是海边小城人，六岁前住在灯塔旁；父母离异后随父在大城市长大，今夏随母回到小城',
      motivation: '搞清楚自己与灯塔、与老照片的关系；想被「需要」',
      arc: '从把小城当临时中转站，到主动守护灯塔、接受归属',
      relationships: '林屿：事故冤家 → 并肩伙伴 → 心动；苏敏：室友兼军师；小唐：社团好友',
      voice: '语速偏快，爱用反问；紧张时碎碎念',
    },
    {
      id: 'c-linyu', name: '林屿', age: '19', role: '本地少年 · 摄影社骨干 · 男主',
      personality: '外冷内热，嘴硬心软；对灯塔与旧物有近乎固执的执念',
      background: '父亲曾是最后一任灯塔守护人，病逝后灯塔废弃；他用相机记录灯塔的最后一个夏天',
      motivation: '阻止灯塔拆除，留住与父亲有关的一切',
      arc: '从独自硬扛到学会求助、学会让安妮走进自己的世界',
      relationships: '安妮：闯入者 → 同路人；小唐：发小',
      voice: '短句、少形容词；关心人时用命令式',
    },
  ]
}

function demoSceneDorm() {
  return {
    form: '日系动画写实',
    mainStyle: '京都动画系清新柔光',
    l2Anchor: '黄昏暖橙 + 海蓝补色',
    l1World: '女生宿舍天台 · 远眺废弃灯塔',
    qualityRecipe: 'magic hour 侧逆光，色温 3200K ↔ 6500K 对比；栏杆剪影；远处大气雾 20%，灯塔体积光',
    anchorWords: '天台, 铁丝栏杆, 黄昏, 手机屏反光, 远处灯塔',
    family: 'A 写实影像系',
    feasibility: '●高',
  }
}

// dev-mock 媒体通道：假路径 /demo/assets/V001.mp4 映射到仓库内真实 H3 演示片
// （用 A7 拟真人·标准 20 步演示 D 档成片质感；Vite ?url：dev 直服务、build 自动产出资源）
const DEMO_SHOT_V001_MODULES = import.meta.glob<string>(
  '../resources/H3-Style/_style_preview/A_写实影像/A7_拟真人仿真人动漫_标准20步.mp4',
  { eager: true, query: '?url', import: 'default' },
)
const DEMO_SHOT_V001_URL =
  DEMO_SHOT_V001_MODULES['../resources/H3-Style/_style_preview/A_写实影像/A7_拟真人仿真人动漫_标准20步.mp4']

function demoShotV001() {
  return {
    video: '/demo/assets/V001.mp4',
    videoUrl: DEMO_SHOT_V001_URL,
    status: '成片已定稿（D 档第 8 版）',
    model: 'MiniMax H3 · ComfyUI B5 工作流',
    tier: 'D 正片',
    seed: 88213001,
    durationSec: 5.2,
    note: '角色一致性 18/18 通过；海堤材质走场景配方 scene-dorm v2；运镜与分镜 V001 对齐（无人机缓推）。',
  }
}

function demoShotV002() {
  return {
    video: '',
    status: '生成中（T 档试档后转 D，第 6 次）',
    model: 'MiniMax H3 · ComfyUI B5 工作流',
    tier: 'D 正片',
    seed: 88213002,
    durationSec: 4.0,
    note: '队列批次 B5 · 12/18；本镜等待实例 :8001 返回，口型按台词驱动。',
  }
}

// path → JSON 字符串
const DEMO_FILES: Record<string, () => unknown> = {
  '/demo/anni/立项单.v3.json': demoBrief,
  '/demo/anni/outline.json': demoOutline,
  '/demo/anni/scenes.json': demoScenes,
  '/demo/anni/storyboard.json': demoStoryboard,
  '/demo/anni/char-anni.json': demoProfiles,
  '/demo/anni/scene-dorm.json': demoSceneDorm,
  '/demo/assets/V001.mp4': demoShotV001,
  '/demo/assets/V002.mp4': demoShotV002,
}

function stoppedStatus(): RuntimeStatus {
  return {
    state: 'stopped',
    port: null,
    version: null,
    healthy: false,
    startedAt: null,
    error: null,
  }
}

export function installDevMockApi(): void {
  if (typeof window === 'undefined' || (window as unknown as { api?: unknown }).api) return

  const noop = () => undefined
  const resolve = <T,>(v: T) => Promise.resolve(v)

  const api = {
    listProjects: () => resolve([
      { dir: '/demo/anni', name: '安妮的夏天', updatedAt: new Date().toISOString() },
      { dir: '/demo/jiugang', name: '旧港往事', updatedAt: new Date().toISOString() },
    ]),
    createProject: (name?: string) => resolve({ dir: `/demo/${name || 'untitled'}` }),
    openProject: () => resolve({ ok: true as const }),
    configStatus: () => resolve({ arkConfigured: false }),

    runtime: {
      start: () => resolve(stoppedStatus()),
      stop: () => resolve(stoppedStatus()),
      status: () => resolve(stoppedStatus()),
      createSession: () => resolve({ id: 'sess-demo', title: null, createdAt: new Date().toISOString() }),
      listSessions: () => resolve([]),
      abortSession: () => resolve({ ok: true as const }),
      deleteSession: () => resolve({ ok: true as const }),
      prompt: () => resolve({ messageId: 'm-demo', accepted: true as const }),
      promptAsync: () => resolve({ accepted: true as const, messageId: 'm-demo' }),
      subscribe: () => resolve({ ok: true as const }),
      unsubscribe: () => resolve({ ok: true as const }),
      listAgents: () => resolve([]),
      onEvent: () => noop,
      onStatusChange: () => noop,
    },

    canvas: {
      get: () => resolve(getDemoCanvas()),
      subscribe: () => resolve({ ok: true as const }),
      unsubscribe: () => resolve({ ok: true as const }),
      onChange: (cb: (c: Canvas) => void) => {
        demoCanvasListeners.add(cb)
        return () => { demoCanvasListeners.delete(cb) }
      },
    },

    gate: {
      decide: () => resolve({ ok: true as const }),
      onChanged: () => noop,
    },

    asset: {
      list: (kind?: string) => resolve(
        [
          { id: 'a1', kind: 'image', path: '/demo/assets/anni-cast.png', createdAt: new Date().toISOString() },
          { id: 'a2', kind: 'image', path: '/demo/assets/linyu-cast.png', createdAt: new Date().toISOString() },
          { id: 'a3', kind: 'image', path: '/demo/assets/xiaotang-cast.png', createdAt: new Date().toISOString() },
          { id: 'a4', kind: 'image', path: '/demo/assets/sumin-cast.png', createdAt: new Date().toISOString() },
          { id: 'v1', kind: 'video', path: '/demo/assets/V001.mp4', createdAt: new Date().toISOString() },
          { id: 'm1', kind: 'music', path: '/demo/assets/theme.mp3', createdAt: new Date().toISOString() },
        ].filter(a => !kind || a.kind === kind)
      ),
    },

    fileRead: ({ path }: { path: string }) => {
      const factory = DEMO_FILES[path]
      if (!factory) {
        return resolve({ ok: false as const, error: { code: 'DEV_MOCK', message: `浏览器预览 mock：演示产物库中无 ${path}` } })
      }
      return resolve({ ok: true as const, format: 'json' as const, content: JSON.stringify(factory()) })
    },

    settings: {
      comfy: {
        list: () => resolve([]),
        upsert: () => resolve({ id: 'mock', name: 'mock', url: 'http://localhost:8188', enabled: true }),
        remove: () => resolve({ ok: true as const }),
      },
    },
  }

  Object.assign(api, { __devMock: true })
  ;(window as unknown as { api: typeof api }).api = api
}
