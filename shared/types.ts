// 共享类型定义 —— 前后端共用的立项阶段数据结构

// 历史 10 节点线性模型（feature-001：仅 library.ts initialNodes() 的历史 manifest.nodes 骨架在用；
// 新立项模型为「1 入口 + 2 节点 + 0-final 一道门」；B-04 随 manifest 7 态状态机整体清退，勿再扩散消费）
export type Stage =
  | 'idea' | 'diagnosis' | 'brief' | 'background' | 'story'
  | 'outline' | 'profiles'
  | 'scenes' | 'dialogue' | 'storyboard'

// 立项六要素（原五要素 + 画幅；类型名保持 FiveElements 不变，术语决策见 feature-005 D-023）
export interface FiveElements {
  genre: string          // 题材赛道
  platforms: string[]    // 目标平台
  episodeDuration: string// 单集时长
  episodeCount: string   // 集数
  tone: string           // 风格基调
  aspectRatio: string    // 画幅：'竖屏 9:16' | '横屏 16:9'（feature-005 D-023）
}

// 视觉风格设定
export interface VisualStyle {
  form: string           // 形态（谱系 4 形态收敛；旧数据枚举仅作历史展示）
  mainStyle: string      // 主画风
  l2Anchor: string       // L2 视觉风格锚词表
  l1World: string        // L1 世界观锚
  qualityRecipe: string  // 质感配方
  anchorWords: string    // 锚点词
  family?: string        // 家族名（如「A 写实影像系」，谱系提取 · feature-005 D-022）
  auxiliaryStyle?: string// 辅助画风（可选，仅限谱系「备」7 项 · feature-005 D-022）
  feasibility?: string   // 可行度（●高/●中/●低，照抄谱系目录 · feature-005 D-022）
}

// 选题诊断（对话流 diagnosis 消息载荷；明细不落独立产物文件）
export interface TopicDiagnosis {
  benchmarkCases: { name: string; platform: string; score: string; play: string; insight: string }[]
  userInsight: string
  hookPatterns: string[]
  compliance: string[]
  conclusion: string
}

// ===== 立项单 v2（feature-001 立项模型重建；设计书 §2.6 / §7.1）=====

// 立项项目性质（入口反问第一问）
export type ProjectKind = 'commercial' | 'memorial'

// 故事前提（5 项最低门槛，§2.6.3；五项均为非空字符串，'待定' 显式表达）
export interface StoryPremise {
  leads: string           // 人物：主角身份/年龄（双方）
  time: string            // 时间：故事发生时间（如「2002 年」）
  place: string           // 地点：城市/环境
  coreEvent: string       // 核心事件：相遇/缘起方式一句话
  seasonBoundary: string  // 边界：本季讲到哪（如「第一季只讲相识」）
}

// 视觉风格引用：只存「风格 ID + 谱系版本」（§2.6.4；谱系实现与 ID 校验属 B-05）
export interface BriefStyle {
  mainStyleId: string          // 主风格谱系 ID，如 'A7'；就绪判定必填非空
  catalogVersion: string       // 谱系版本，如 'v1.46'；与 mainStyleId 成对
  auxiliaryStyleId?: string    // 辅助气氛 ID（0–1 个，可选）
}

// 拍板记录（一键拍板 / 口头拍板等价，§2.6.5）
export interface BriefApprove {
  at: string                   // ISO 时间戳
  by: 'gate' | 'verbal'        // gate=点定案卡按钮；verbal=对话口头确认
  verbal?: { quote: string }   // by==='verbal' 时必填：用户原话
  note?: string                // 门裁决备注（gate 路径可选）
}

// 相对上一版的字段改动（v1 时为空数组）
export interface BriefChange {
  field: string                // 点分字段路径，如 'fiveElements.episodeCount'
  from: string                 // 旧值（v1 无旧值时为 ''）
  to: string                   // 新值
}

// 立项单（立项单.vN.json 事实源；项目根目录版本化全量保留）
export interface ProjectBrief {
  schemaVersion: 2
  version: number              // N，从 1 起单调递增
  kind: ProjectKind
  fiveElements: FiveElements
  premise: StoryPremise
  style: BriefStyle
  diagnosisSummary?: string    // 选题诊断结论摘要（明细留在对话流）
  approve: BriefApprove
  changesFromPrevious: BriefChange[]
  publishedAt: string          // ISO
}

// brief.plan 就绪检查结果（内存态，不落盘）
export type BriefMissingCode =
  | 'KIND_MISSING'            // 未回答商业/纪念反问
  | 'ELEMENT_MISSING'         // 六要素存在空值（不含「待定」）
  | 'PREMISE_MISSING'         // 故事前提 5 项存在空串
  | 'MAIN_STYLE_MISSING'      // style.mainStyleId 或 catalogVersion 为空

export interface BriefMissing {
  code: BriefMissingCode
  field: string               // 点分字段路径，如 'premise.seasonBoundary'
  message: string             // 人读缺失原因
}

export interface BriefPlan {
  ready: boolean
  missing: BriefMissing[]
  pendingMarks: string[]      // 值为「待定」的字段路径（不阻塞就绪，定案卡须明示）
  nextVersion: number         // 若发布将分配的版本号（最新 + 1；无历史时为 1）
  changesFromPrevious: BriefChange[]
  latestVersion: number | null
}

// brief.plan / brief.publish 入参草案形态（字段可部分缺失参与校验）
export interface BriefDraft {
  kind: ProjectKind | null
  fiveElements: Partial<FiveElements>
  premise: Partial<StoryPremise>
  style: Partial<BriefStyle>
  diagnosisSummary?: string  // 参与字段级 diff（契约 §5），可选
}

// 故事大纲（编剧 Agent）
export interface StoryOutline {
  logline: string        // 一句话故事
  seasonArc: string      // 本季主线
  themes: string[]       // 主题/情绪关键词
  conflicts: string[]    // 核心冲突 / 钩子设计
  episodes: {
    ep: number
    title: string
    synopsis: string     // 本集剧情梗概
    hook: string         // 集尾钩子
  }[]                    // 至少含 E01
}

// 人物小传（单个角色，编剧 Agent）
export interface CharacterProfile {
  id: string             // 稳定 id（如 c-linxia）
  name: string
  age: string
  role: string           // 身份 / 职业
  personality: string    // 性格
  background: string     // 背景（须与背景档案一致）
  motivation: string     // 目标 / 欲望
  arc: string            // 人物弧光
  relationships: string  // 与其他角色关系
  voice: string          // 台词风格 / 音色提示
}

// ===== 分场（一场戏，编剧 Agent · feature-004）=====
export interface Scene {
  ep: number                    // 集号，一期恒为 1
  sceneNo: number               // 场号 1..N（台词、分镜引用键）
  slug: string                  // 场次标题，如「公司·开放办公区」
  interiorExterior: '内' | '外' | '内外'
  dayNight: '日' | '夜' | '晨' | '昏'
  location: string              // 具体地点
  characterIds: string[]        // 出场角色 id（引用 CharacterProfile.id）
  beats: string[]               // 本场节拍 / 动作事件序列
  emotion: string               // 本场情绪基调
  estSeconds: number            // 预估时长（秒）
  summary: string               // 一句话场次梗概
}
export type SceneBreakdown = Scene[]

// ===== 台词（按场组织，编剧 Agent · feature-004）=====
export interface DialogueLine {
  speakerId: string             // 引用 CharacterProfile.id；功能性无小传角色用 '' 兜底
  speakerName?: string          // speakerId 为空时的显示名（路人 / 画外音）
  kind: '对白' | '旁白' | '独白'
  text: string                  // 台词内容
  emotion: string               // 情绪 / 语气提示
  action?: string               // 括号动作提示（舞台指示）
}
export interface DialogueScene {
  ep: number
  sceneNo: number               // 引用 Scene.sceneNo
  lines: DialogueLine[]
}
export type DialogueScript = DialogueScene[]

// ===== 分镜表（对齐架构 §7 分镜条目，编剧 Agent · feature-004）=====
export interface ShotDialogue {
  speakerId: string
  speakerName?: string
  text: string
  emotion: string
}
export interface Shot {
  ep: number
  shotNo: number                // 镜号 1..N
  rowOrder: number              // 行序（表格排序）
  shotSize: string              // 景别：特写 / 近景 / 中景 / 全景 / 远景
  sceneNo: number               // 场景id：一期以分场场号引用
  characterIds: string[]
  action: string                // 画面 / 动作描述
  dialogue: ShotDialogue | null // 本镜主要台词；空镜为 null
  durationSec: number           // 时长（秒）
  camera: string                // 运镜
  refs: string[]                // 参考资产，一期恒为 []
}
export type ShotList = Shot[]

// 确认门 id（feature-001 立项模型重建：STAGE 0 收敛为唯一一道 0-final 定案门）
export type GateId = '0-final' | '1-a' | '1-b' | '2-a' | '2-b' | '2-c'

// 画布节点状态（feature-005 D-016 追加 invalidated：上游变更导致需重新生成）
export type NodeStatus = 'done' | 'active' | 'pending' | 'invalidated'

// Agent 对话消息
export type MessageKind =
  | 'text'         // 普通文本（用户气泡 / Agent 文本）
  | 'brief'        // 创意简报卡
  | 'diagnosis'    // 选题诊断结果
  | 'visual-style' // 视觉风格结果
  | 'progress'     // 进度提示
  | 'error'        // 失败（可重试）
  | 'gate'         // 确认门待处理
  | 'gate-action'  // 确认门动作（确认/否决）
  | 'archive'      // 背景档案锁定
  | 'stage'              // 阶段进入标记（data.phase: 'story' | 'script'）
  | 'story-outline'      // 故事大纲结果
  | 'character-profiles' // 人物小传结果
  | 'scenes'             // 分场结果（feature-004）
  | 'dialogue'           // 台词结果（feature-004）
  | 'storyboard'         // 分镜表结果（feature-004）
  | 'unlock'             // 变更定稿事实：下游失效（feature-005 D-016）
  | 'revision'           // 修改会话生命周期（data.action: 'start' | 'cancel' · feature-005 D-016）
  | 'revision-draft'     // 人工事实候选文本（创意/档案对话改写 · feature-005 D-016）

export type MessageStatus = 'pending' | 'done' | 'error'

export interface ChatMessage {
  id: string                    // 生成规则：m-{ts}-{seq}
  role: 'user' | 'agent' | 'system'
  kind: MessageKind             // 必填；旧数据无此字段按 'text' 处理
  content: string               // 文本内容/摘要；结构化数据放 data
  status?: MessageStatus        // progress 类消息必填
  data?: unknown                // kind 对应的结构化载荷
  toolCall?: { name: string; args: string; result: string }
  candidate?: boolean    // true=AI 产物未定稿候选（同 kind 同 data；replay 不计入有效态 · feature-005 D-016）
  ts: number
}

// ===== 产物变更传播（feature-005 D-016）=====

// 变更发起源：idea/background（人工事实）+ AI 产物源（gate id 命名）
// feature-001：删除旧立项门 0-c/0-d；立项后变更解锁（0-final）属 B-03/P1，暂不加入
export type RevisionSource =
  | 'idea' | 'background'
  | '1-a' | '1-b' | '2-a' | '2-b' | '2-c'

// unlock 消息载荷：变更定稿事实，downstream 全部失效
export interface UnlockData {
  source: RevisionSource
  downstream: Stage[]   // 需重新走的节点；S3-S8 不含已过门的本棒；2-c 为 []
  newIdea?: string      // 仅 source==='idea'
}

// revision 消息载荷：修改会话生命周期
export interface RevisionMessageData {
  action: 'start' | 'cancel'
  source: RevisionSource
}

// revision-draft 消息载荷：人工事实候选文本
export interface RevisionDraftData {
  source: 'idea' | 'background'
  text: string          // Agent 改写后的完整新文本
}

// 项目会话
export interface ProjectSession {
  dir: string
  title: string          // 一期固定 '新项目'
  createdAt: string      // ISO
  lastOpenedAt: string   // ISO
}

// userData/session-state.json 文件格式
export interface SessionStateFile {
  currentDir: string | null
}

// ===== feature-017 新增：画布基座模型（逐字采用 feature-016 契约 §4.1）=====

/** 八步闭环步骤编号 0 立项 → 7 发布 */
export type StepId = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7'

/** 画布节点：以 ref.path 引用产物文件，不内联大产物 */
export interface CanvasNode {
  id: string                         // 稳定节点 id（如 step-1-outline）
  step: StepId
  kind: string                       // 产物类型：brief/outline/profiles/scenes/dialogue/storyboard/asset-image/...
  title: string
  status: 'pending' | 'active' | 'done' | 'invalidated'
  ref?: { path: string; format: 'json' | 'md' }  // 产物落盘位置
  meta?: Record<string, unknown>
  updatedAt: string
}

/** 画布边 */
export interface CanvasEdge {
  id: string
  from: string                       // 源节点 id
  to: string                         // 目标节点 id
  auto: boolean                      // true = 系统按依赖自动连线
}

/** 画布裁决门 */
export interface CanvasGate {
  gateId: string                     // 动态门 id（STAGE 0 为 0-final；由 Agent 经 gate.request 提交）
  status: 'pending' | 'approved' | 'rejected'
  question: string
  options: string[]
  payload?: unknown                  // 待裁决的候选产物引用
}

/** Canvas 单一工作态 */
export interface Canvas {
  schemaVersion: 2
  projectId: string
  title: string
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  gates: CanvasGate[]
  updatedAt: string
}

/** 本地 / 局域网 ComfyUI 实例配置 */
export interface ComfyInstance {
  id: string
  name: string
  baseUrl: string                    // 本地/局域网可配，如 http://192.168.x.x:8188
  enabled: boolean
  addedAt: string
}

/** 资产索引条目 */
export interface AssetIndexItem {
  id: string
  kind: 'image' | 'video' | 'music' | 'workflow'
  path: string
  sourceJobId?: string
  meta?: Record<string, unknown>
  createdAt: string
}
