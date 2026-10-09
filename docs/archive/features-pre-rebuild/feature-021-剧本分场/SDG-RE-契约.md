# SDG-RE 契约 · feature-021 垂直切片·剧本分场（第 2 步）

> 状态：**v1.1 已验收**（v1.0 已签字；v1.1 = §3.2 patch.edges 建边、§4.1 发门前结构校验，2026-10-07 真机验收通过）
> 日期：2026-10-07
> 本契约只定义第 2 步新增约定；所用 IPC / MCP 工具 / 类型全部沿用 feature-016~020，**不新增接口**。

---

## 1. 复用的既有契约（不改动）

| 能力 | 通道 / 工具 | 定义位置 |
|---|---|---|
| 发送主控指令 | `window.api.promptAsync({ agent:'showrunner', text })` | feature-018 契约 |
| 画布读取/订阅 | `canvas:get` / `canvas:subscribe` | feature-017 契约 |
| 门裁决 | `gate:decide({ gateId, decision, note? })` | feature-018 契约 |
| showrunner 物理工具 | file_read/list/write、canvas_get/update、gate_request（6 个） | provider.ts |
| task 委派 | showrunner frontmatter 已 `task: true`，仅 allow writer/media-director/comfyui-operator | showrunner.md |
| 产物/门/节点类型 | Scene、DialogueScene、Canvas*、GateId `'2-a'\|'2-b'`、StepId `'2'` | shared/types.ts |

## 2. 落盘契约

### 2.1 目录与路径（决策：采用 016 目标布局）

```
<projectDir>/
├── 立项/brief.json                 # 必需输入（已存在）
├── 故事/
│   ├── 故事大纲.json               # 必需输入（feature-020 定稿）
│   └── 人物小传.json               # 必需输入（角色 id 事实源）
└── 剧本/
    ├── 分场.json                   # 2-a 定稿，SceneBreakdown（ep=1）
    ├── 分场.md                     # MD 镜像
    ├── 台词.json                   # 2-b 定稿，DialogueScript（ep=1）
    └── 台词.md                     # MD 镜像
```

- 落盘一律经 `shortdrama_file_write`（内部 enqueue + archiveExisting + mkdir）；覆盖写前旧文件自动归入 `剧本/版本/`（沿用既有归档规则）。
- 写文件入参：`{ path: '剧本/分场.json', content: <json string>, format: 'json' }`；MD 用 `format:'md'`。
- **目录名固定为「剧本/」**；第 2 步不写旧 `分镜/` 路径（分镜产物归第 4 步）。

### 2.2 产物结构（沿用，不增删字段）

- `分场.json` = `SceneBreakdown`（shared/types.ts 第 86-100 行），本切片 `ep` 恒为 1；至少 3 场；每场 `sceneNo` 为 1..N 连续场号（台词引用键），`characterIds[]` 必须取自人物小传既有 id，`beats` 非空，`estSeconds` 为正整数。
- `台词.json` = `DialogueScript`（第 102-116 行），逐场组织：`sceneNo` 必须覆盖分场全部场号；`DialogueLine.speakerId` 引用小传 id，功能性无小传角色用 `''` + `speakerName` 兜底；`kind` 取 `对白/旁白/独白`。

## 3. 画布节点与边契约

### 3.1 节点（固定 id）

| 节点 id | step | kind | title（示例） | 终态 ref.path |
|---|---|---|---|---|
| `step-2-scenes` | `'2'` | `scenes` | 第一集分场 | `剧本/分场.json` |
| `step-2-dialogue` | `'2'` | `dialogue` | 第一集台词 | `剧本/台词.json` |

- 生命周期 `pending → active → done`；重开修订时已 done 的分场不回退（台词基于已 approved 分场）。
- 节点经 `shortdrama_canvas_update` upsert；`ref.format` 为 `json`。

### 3.2 auto 边（showrunner 用 patch.edges 直建，renderer 不手画）

> **v1.1 修订（C7 真机返工）**：v1.0 写的「节点带 `linksTo:['<上游>']` 派生」与 `deriveAutoEdges` 的实现语义（from=本节点、to=linksTo 目标）相反，照做必产出反向边。第 2 步改为 **showrunner 在门 approved 后**用 `shortdrama_canvas_update({ edges:[{ from, to, auto:true }] })` 直接建边；writer upsert 节点不带 `linksTo`。

| 边 | from → to | 触发（2-a / 2-b approved 后的收尾 update） |
|---|---|---|
| 1→2 衔接 | `step-1-profiles` → `step-2-scenes` | `edges:[{ from:'step-1-profiles', to:'step-2-scenes', auto:true }]` |
| 2 内部依赖 | `step-2-scenes` → `step-2-dialogue` | `edges:[{ from:'step-2-scenes', to:'step-2-dialogue', auto:true }]` |

- 边确定性 id（`e-<from>--<to>`），按 from/to 去重，幂等。
- **状态时序**：writer 落盘后节点只 upsert 为 `active`；showrunner 发门前必须 `file_read` 做结构校验（§4.1），门 approved 后同一次 update 置 `done` 并建边——不得在门裁决前置 done。

## 4. 门契约

| gateId | 裁决对象 | payload（引用，不内联全文） |
|---|---|---|
| `2-a` | 第一集分场 | `{ ref:'剧本/分场.json', sceneCount, totalSeconds }` |
| `2-b` | 第一集台词 | `{ ref:'剧本/台词.json', sceneCount, lineCount }` |

- 门只能由 **showrunner** 调 `shortdrama_gate_request({ gateId, question, options, payload })` 发起；writer 不发门。
- 语义沿用 GateBridge（feature-019 定稿 / D-004）：
  - `pending`：阻塞等待，跨重启可同 id 重挂。
  - `rejected`：**非终态**，showrunner 据 `note` 重做后以**同一 gateId** 重开为 pending。
  - `approved`：终态，同 id 再请求抛 `INVALID_ARGUMENT`。
- 门序固定：`2-a` approved 前不得发起 `2-b`；确认点不减少、不合门。
- renderer 不硬编码业务合格判定（无 harness 字段）；分场/台词的质量核对由 showrunner 在发起门前自行推理确认。

### 4.1 发门前结构校验（v1.1 新增，C7 返工）

showrunner 回收 writer 委派后，必须 `shortdrama_file_read` 读回 JSON 逐项校验；任一不符不发门，经 `task` 指明具体不符点让 writer 重做，再校验直至合格：

- 分场：顶层为裸数组 `Scene[]`（不得包裹对象）；每场字段恰好为 `ep/sceneNo/slug/interiorExterior/dayNight/location/characterIds/beats/emotion/estSeconds/summary`；`ep=1`、`sceneNo` 1..N 连续、枚举值合法、`estSeconds` 正整数、`beats` 非空、`characterIds` 全部存在于小传；≥3 场。
- 台词：顶层为裸数组 `DialogueScene[]`；每 scene 字段恰好为 `ep/sceneNo/lines`，`sceneNo` 覆盖分场；每行字段恰好为 `speakerId/speakerName?/kind/text/emotion/action?`（禁用 `type/note` 等自造名），`kind` 枚举合法；无小传功能角色 `speakerId:''` 且给 `speakerName`。
- 该校验由 showrunner 经推理 + file_read 完成，**不新增 IPC/MCP 工具**、不改 `shared/types.ts`。

## 5. task 委派契约

- 分场、台词的写作必须经 `task` 委派 `writer`；showrunner 不自行撰写正文。
- 委派交接物至少包含：
  - 分场：`{ input:['立项/brief.json','故事/故事大纲.json','故事/人物小传.json'], output:'剧本/分场.json', mirror:'剧本/分场.md', nodeId:'step-2-scenes', schema:'SceneBreakdown', ep:1 }`
  - 台词：`{ input:['故事/人物小传.json','剧本/分场.json'], output:'剧本/台词.json', mirror:'剧本/台词.md', nodeId:'step-2-dialogue', schema:'DialogueScript', ep:1 }`
- writer 回交：产物路径、节点 id 与状态、一句话摘要；showrunner 核对落盘后再发起对应门。
- writer 工具域仅 file_read/list/write + canvas_get/update；`task` 被 deny，无 gate 工具。

## 6. 恢复契约

- 每回合开始 `shortdrama_canvas_get`：
  - 存在第 2 步 `status:'pending'` 门 → 用同一 gateId 重新 `gate_request` 重挂等待。
  - 已 approved 的门/已 done 的节点不重做；从中断处继续（如 2-a 已过则直接做 2-b）。

## 7. 异常与边界

| 场景 | 行为 |
|---|---|
| 缺 `故事/故事大纲.json` 或 `故事/人物小传.json`（第 1 步未完成） | 不启动第 2 步，showrunner 明确告知"请先完成故事"；不臆造输入。 |
| writer 产出引用了小传中不存在的角色 id / 不存在的场号 | showrunner 核对发现后不发起门，退回 writer 按既有 id 修正。 |
| writer 请求越权工具（gate/task/comfyui/asset） | 运行时按白名单拒绝（INVALID_ARGUMENT）；第 2 步不出现媒体调用。 |
| approved 门同 id 再请求 | GateBridge 抛 INVALID_ARGUMENT（终态）。 |
| 尝试调用 comfyui.* / asset.* | 第 2 步禁止；不在 showrunner 白名单，调用被拦截。 |

## 8. 门控清理契约（验收通过后，白名单严格控制）

> 触发 K3（旧系统改造/弃用），执行前在变更记录登记用户确认。

**IPC / 类型层**
- `electron/session.ts`：删除 `enterScript`、`saveScript`、`readScriptContext`（经 grep 确认仅文档引用、无代码调用的废弃函数），以及仅被 `saveScript` 使用的 `renderScenesMd` / `renderDialogueMd` / `renderStoryboardMd`（grep 已确认无其他引用）；清理因此变成无引用的类型 import。
- `electron/main.ts`：删除 `script:enter` / `script:save` handler 及对应 import。
- `electron/preload.ts`：删除 `enterScript` / `saveScript` 键。
- `src/global.d.ts`：删除对应类型键与相关 import。

**旧 App / 前端编排层**
- `src/App.tsx`：移除剧本段对 `enterScript` / `saveScript` 的调用及配套剧本状态机编排（handleEnterScript、2-a/2-b/2-c confirm 落盘动作、自动连跑分场→台词→分镜、restore 中三门重开分支）；保留第 2 步节点的**只读展示/查看**能力（节点卡、失效态、画布分组标题），不影响旧壳启动与查看。
- `src/lib/gates.tsx`：删除 `buildGate2a` / `buildGate2b` / `buildGate2c`（确认仅旧 App 使用）；其测试 `src/lib/gates-script.test.ts` 及其他测试中的相关用例/mock 同步更新。

**底层字段（沿用 feature-020 storyRedo 先例，保留）**
- `scriptRedo` 的 App state 声明、workflow 快照字段、`src/lib/workflow.ts` / `src/lib/replay.ts` 底层字段不在白名单删除范围，保留；仅移除 App 剧本编排动作。

- 清理边界：**只删剧本（旧 STAGE 2）链路**，不得触碰旧 App 立项（第 0 步）与故事（第 1 步）链路；清理前后各跑一次自检（typecheck / test:run / build:electron）。
- 旧 App 整体壳在 feature-022 下线，本切片不做。
