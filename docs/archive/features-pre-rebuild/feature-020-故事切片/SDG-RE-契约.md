# SDG-RE 契约 · feature-020 垂直切片·故事（第 1 步）

> 状态：**v1.1 已闭环**（§8 门控清理已执行并再自检，见变更记录 E-020-03；契约条款未变）
> 日期：2026-10-07
> 本契约只定义第 1 步新增约定；所用 IPC / MCP 工具 / 类型全部沿用 feature-016~019，**不新增接口**。

---

## 1. 复用的既有契约（不改动）

| 能力 | 通道 / 工具 | 定义位置 |
|---|---|---|
| 发送主控指令 | `window.api.promptAsync({ agent:'showrunner', text })` | feature-018 契约 |
| 画布读取/订阅 | `canvas:get` / `canvas:subscribe` | feature-017 契约 |
| 门裁决 | `gate:decide({ gateId, decision, note? })` | feature-018 契约 |
| showrunner 物理工具 | file_read/list/write、canvas_get/update、gate_request（6 个） | provider.ts 第 55-62 行 |
| task 委派 | showrunner frontmatter 已 `task: true`，仅 allow writer/media-director/comfyui-operator | showrunner.md 第 22-27 行 |
| 产物/门/节点类型 | StoryOutline、CharacterProfile、Canvas*、GateId `'1-a'\|'1-b'`、StepId `'1'` | shared/types.ts |

## 2. 落盘契约

### 2.1 目录与路径（决策：采用 016 目标布局）

```
<projectDir>/
├── 立项/brief.json                 # 第 1 步唯一必需输入（已存在）
└── 故事/
    ├── 故事大纲.json               # 1-a 定稿，StoryOutline
    ├── 故事大纲.md                 # MD 镜像
    ├── 人物小传.json               # 1-b 定稿，CharacterProfile[]
    └── 人物小传.md                 # MD 镜像
```

- 落盘一律经 `shortdrama_file_write`（内部 enqueue + archiveExisting + mkdir）；覆盖写前旧文件自动归入 `故事/版本/`（沿用既有归档规则）。
- 写文件入参：`{ path: '故事/故事大纲.json', content: <json string>, format: 'json' }`；MD 用 `format:'md'`。
- **目录名固定为「故事/」**，不使用旧 `剧本/故事大纲|人物小传` 路径。

### 2.2 产物结构（沿用，不增删字段）

- `故事大纲.json` = `StoryOutline`（shared/types.ts 第 58-70 行）；`episodes` 至少含 E01，集数应与 brief 的 `fiveElements.episodeCount` 大体一致。
- `人物小传.json` = `CharacterProfile[]`（第 72-84 行），至少 2 个主要角色；每个角色 `id` 为稳定主键（建议 `c-<拼音/英文>`），该 id 向下贯穿分场/台词/分镜，不得在下游重生。

## 3. 画布节点与边契约

### 3.1 节点（固定 id）

| 节点 id | step | kind | title（示例） | 终态 ref.path |
|---|---|---|---|---|
| `step-1-outline` | `'1'` | `outline` | 故事大纲 | `故事/故事大纲.json` |
| `step-1-profiles` | `'1'` | `profiles` | 人物小传 | `故事/人物小传.json` |

- 生命周期 `pending → active → done`；重开修订时已 done 的大纲不回退（小传基于已 approved 大纲）。
- 节点经 `shortdrama_canvas_update` upsert；`ref.format` 为 `json`。

### 3.2 auto 边（linksTo 派生，renderer 不手画）

| 边 | from → to | 触发 |
|---|---|---|
| 0→1 衔接 | `step-0-brief` → `step-1-outline` | outline 节点 upsert 时带 `linksTo:['step-0-brief']` |
| 1 内部依赖 | `step-1-outline` → `step-1-profiles` | profiles 节点 upsert 时带 `linksTo:['step-1-outline']` |

- 边由 `deriveAutoEdges` 生成确定性 id（`e-<from>--<to>`），幂等。

## 4. 门契约

| gateId | 裁决对象 | payload（引用，不内联全文） |
|---|---|---|
| `1-a` | 故事大纲 | `{ ref:'故事/故事大纲.json', logline, episodeCount }` |
| `1-b` | 人物小传 | `{ ref:'故事/人物小传.json', characterIds }` |

- 门只能由 **showrunner** 调 `shortdrama_gate_request` 发起；writer 不发门。
- 语义沿用 GateBridge（feature-019 定稿 / D-004）：
  - `pending`：阻塞等待，跨重启可同 id 重挂。
  - `rejected`：**非终态**，showrunner 据 `note` 重做后以**同一 gateId** 重开为 pending。
  - `approved`：终态，同 id 再请求抛 `INVALID_ARGUMENT`。
- 门序固定：`1-a` approved 前不得发起 `1-b`；确认点不减少、不合门。

## 5. task 委派契约

- 大纲、小传的写作必须经 `task` 委派 `writer`；showrunner 不自行撰写正文。
- 委派交接物至少包含：
  - 大纲：`{ input:'立项/brief.json', output:'故事/故事大纲.json', mirror:'故事/故事大纲.md', nodeId:'step-1-outline', schema:'StoryOutline' }`
  - 小传：`{ input:['立项/brief.json','故事/故事大纲.json'], output:'故事/人物小传.json', mirror:'.md', nodeId:'step-1-profiles', schema:'CharacterProfile[]' }`
- writer 回交：产物路径、节点 id 与状态、一句话摘要；showrunner 核对落盘后再发起对应门。
- writer 工具域仅 file_read/list/write + canvas_get/update；`task` 被 deny，无 gate 工具。

## 6. 恢复契约

- 每回合开始 `shortdrama_canvas_get`：
  - 存在第 1 步 `status:'pending'` 门 → 用同一 gateId 重新 `gate_request` 重挂等待。
  - 已 approved 的门/已 done 的节点不重做；从中断处继续（如 1-a 已过则直接做 1-b）。

## 7. 异常与边界

| 场景 | 行为 |
|---|---|
| 缺 `立项/brief.json`（未完成立项） | 不启动第 1 步，showrunner 明确告知"请先完成立项"；不臆造输入。 |
| writer 请求越权工具（gate/task/comfyui/asset） | 运行时按白名单拒绝（INVALID_ARGUMENT）；第 1 步不出现媒体调用。 |
| approved 门同 id 再请求 | GateBridge 抛 INVALID_ARGUMENT（终态）。 |
| 尝试调用 comfyui.* / asset.* | 第 1 步禁止；不在 showrunner 白名单，调用被拦截。 |

## 8. 门控清理契约（验收通过后，白名单严格控制）

> 触发 K3（旧系统改造/弃用），执行前在变更记录登记用户确认。

**IPC / 类型层**
- `electron/session.ts`：删除 `enterStory`、`saveStory`（含仅被其使用的 MD 渲染器 `renderOutlineMd`/`renderProfilesMd`，若确认无其他引用）。
- `electron/main.ts`：删除 `story:enter` / `story:save` handler 及对应 import。
- `electron/preload.ts`：删除 `enterStory` / `saveStory` 键。
- `src/global.d.ts`：删除对应类型键与相关 import。

**旧 App / 前端编排层**
- `src/App.tsx`：移除故事段对 `enterStory` / `saveStory` 的调用及配套故事状态机编排（storyRedo 相关流转、handleEnterStory、1-a/1-b confirm 落盘动作、自动连跑大纲→小传）；保留故事节点的**只读展示/查看**能力（节点卡、失效态、画布分组标题），不影响旧壳启动与查看。
- `src/lib/gates.tsx`：删除 `buildGate1a` / `buildGate1b`（确认仅旧 App 使用）；其测试 `src/lib/gates-story.test.ts` 及其他测试中的相关用例/mock 同步更新。

- 清理边界：**只删故事链路**，不得触碰旧 App 立项（第 0 步）与第 2 步链路；清理前后各跑一次自检（typecheck / test:run / build:electron）。
- 旧 App 整体壳在 feature-022 下线，本切片不做。
