# SDG-RE 契约 · feature-018 摄制组 profiles 与主控链路

> 状态：**v1.0 待审批**
> 日期：2026-10-07
> 本文件锁定 4 个 profile 的 frontmatter 与系统提示必备条款、门恢复协议、client 校验规则。
> 字段 / 签名变更即 K8，须重新评审。逻辑角色与职责边界沿用 016 契约 §2，不重议。

---

## 1. 物理工具 ID 映射（2026-10-07 对锁定二进制 1.18.34 真机探针实证）

opencode 对 remote MCP 工具的 ID 归一化规则：**`<server名>_<工具名>`，并将 `.` 全部替换为 `_`**。
本平台 server 名固定为 `shortdrama`（provider.ts SHORTDRAMA_MCP_NAME）。016 §2 中的逻辑名与物理 ID 对照：

| 逻辑名（016 §2/§3） | 物理 ID（frontmatter / client 校验实际使用） |
|---|---|
| `file.read` | `shortdrama_file_read` |
| `file.list` | `shortdrama_file_list` |
| `file.write` | `shortdrama_file_write` |
| `canvas.get` | `shortdrama_canvas_get` |
| `canvas.update` | `shortdrama_canvas_update` |
| `gate.request` | `shortdrama_gate_request` |
| `asset.register` | `shortdrama_asset_register` |
| `asset.list` | `shortdrama_asset_list` |
| `comfyui.instances` | `shortdrama_comfyui_instances` |
| `comfyui.queue` | `shortdrama_comfyui_queue` |
| `comfyui.status` | `shortdrama_comfyui_status` |

探针方法留档：fake OpenAI 服务（127.0.0.1:4099）记录 chat completion 请求中 `tools[].function.name`，11 个工具 ID 全部按上表出现。profile frontmatter 与 client 校验**必须**使用物理 ID，不得在 frontmatter 中写点号工具名。

`task` 子 agent 白名单（同一探针实证归一化结果）：

```yaml
permission:
  task:
    "*": deny
    writer: allow
    media-director: allow
    comfyui-operator: allow
```

## 2. Profile 清单与安装

| name | 文件 | mode | 对外可见 |
|---|---|---|---|
| `showrunner` | showrunner.md | primary | 是（新主控） |
| `writer` | writer.md | subagent | 否 |
| `media-director` | media-director.md | subagent | 否 |
| `comfyui-operator` | comfyui-operator.md | subagent | 否 |
| `director`（旧） | director.md | primary | 并存保留至 022 |

安装规则：

1. 每次启动 `setupRuntimeFiles` 重生成配置时，渲染安装全部 5 个 profile；`__ARK_MODEL_ID__` 占位符替换为 ARK_MODEL 的机制对所有 profile 一致。
2. ARK_MODEL 缺失：5 个 profile 均不安装，返回 `UPSTREAM_AUTH_MISSING`（沿用 016 §2-2，不静默回退）。
3. 模板来源解析沿用 `resolveDefaultDirectorTemplatePath` 的打包 / 开发态候选逻辑，泛化为按文件名解析（resources/opencode/agents/<file>）。

## 3. 四个 profile frontmatter（逐字规格）

### 3.1 showrunner.md

```yaml
---
description: 主创 / 主控 Agent（AI 短剧 Agent 平台 · feature-018）。理解意图、立项诊断、拆解八步任务、在关键节点发确认门、分派专职 agent；自身产出立项 / 故事 / 剧本类文本。
mode: primary
model: ark/__ARK_MODEL_ID__
temperature: 0.2
tools:
  task: true
  read: false
  glob: false
  grep: false
  write: false
  edit: false
  bash: false
  webfetch: false
  todowrite: false
  shortdrama_file_read: true
  shortdrama_file_list: true
  shortdrama_file_write: true
  shortdrama_canvas_get: true
  shortdrama_canvas_update: true
  shortdrama_gate_request: true
permission:
  task:
    "*": deny
    writer: allow
    media-director: allow
    comfyui-operator: allow
  read: deny
  glob: deny
  grep: deny
  write: deny
  edit: deny
  bash: deny
  webfetch: deny
  todowrite: deny
  shortdrama_file_read: allow
  shortdrama_file_list: allow
  shortdrama_file_write: allow
  shortdrama_canvas_get: allow
  shortdrama_canvas_update: allow
  shortdrama_gate_request: allow
---
```

### 3.2 writer.md

```yaml
---
description: 编剧 Agent（feature-018）。负责故事大纲、人物小传、分场、台词的文本推理与落盘；只做文本，不发门、不派任务、不碰媒体提交。
mode: subagent
model: ark/__ARK_MODEL_ID__
temperature: 0.3
tools:
  task: false
  read: false
  write: false
  edit: false
  bash: false
  webfetch: false
  todowrite: false
  shortdrama_file_read: true
  shortdrama_file_list: true
  shortdrama_file_write: true
  shortdrama_canvas_get: true
  shortdrama_canvas_update: true
permission:
  task: deny
  read: deny
  write: deny
  edit: deny
  bash: deny
  webfetch: deny
  todowrite: deny
  shortdrama_file_read: allow
  shortdrama_file_list: allow
  shortdrama_file_write: allow
  shortdrama_canvas_get: allow
  shortdrama_canvas_update: allow
---
```

### 3.3 media-director.md

```yaml
---
description: 媒体导演 Agent（feature-018）。负责资产（第 3 步）、分镜 / 镜头（第 4/5 步）的结构化文本与镜头设计，并提交媒体任务；不做配乐 / 成片等后期操作。
mode: subagent
model: ark/__ARK_MODEL_ID__
temperature: 0.2
tools:
  task: false
  read: false
  write: false
  edit: false
  bash: false
  webfetch: false
  todowrite: false
  shortdrama_file_read: true
  shortdrama_file_list: true
  shortdrama_file_write: true
  shortdrama_canvas_get: true
  shortdrama_canvas_update: true
  shortdrama_asset_register: true
  shortdrama_asset_list: true
  shortdrama_comfyui_queue: true
  shortdrama_comfyui_status: true
permission:
  task: deny
  read: deny
  write: deny
  edit: deny
  bash: deny
  webfetch: deny
  todowrite: deny
  shortdrama_file_read: allow
  shortdrama_file_list: allow
  shortdrama_file_write: allow
  shortdrama_canvas_get: allow
  shortdrama_canvas_update: allow
  shortdrama_asset_register: allow
  shortdrama_asset_list: allow
  shortdrama_comfyui_queue: allow
  shortdrama_comfyui_status: allow
---
```

### 3.4 comfyui-operator.md

```yaml
---
description: 引擎操作员 Agent（feature-018）。选择 / 参数化 ComfyUI 工作流、提交任务、轮询产出、回写资产与画布；不做创意文本。
mode: subagent
model: ark/__ARK_MODEL_ID__
temperature: 0.1
tools:
  task: false
  read: false
  write: false
  edit: false
  bash: false
  webfetch: false
  todowrite: false
  shortdrama_file_read: true
  shortdrama_file_list: true
  shortdrama_file_write: true
  shortdrama_canvas_update: true
  shortdrama_asset_register: true
  shortdrama_asset_list: true
  shortdrama_comfyui_instances: true
  shortdrama_comfyui_queue: true
  shortdrama_comfyui_status: true
permission:
  task: deny
  read: deny
  write: deny
  edit: deny
  bash: deny
  webfetch: deny
  todowrite: deny
  shortdrama_file_read: allow
  shortdrama_file_list: allow
  shortdrama_file_write: allow
  shortdrama_canvas_update: allow
  shortdrama_asset_register: allow
  shortdrama_asset_list: allow
  shortdrama_comfyui_instances: allow
  shortdrama_comfyui_queue: allow
  shortdrama_comfyui_status: allow
---
```

## 4. 系统提示必备条款（语义条款，措辞可润色，条款不可缺）

### 4.1 showrunner

1. 身份与八步闭环：覆盖 0 立项 → 1 故事 → 2 剧本分场 → 3 资产 → 4 分镜 → 5 镜头 → 6 后期 → 7 发布；每步有明确产物，不跳步、不合并步骤；后期 / 发布按交接物预留，不提前假装完成。
2. **内容自产**：所有文本产物（brief / 诊断 / 大纲 / 小传 / 分场 / 台词 / 分镜说明等）由你或你委派的 agent 自身推理产出，经 `shortdrama_file_write` 落盘、`shortdrama_canvas_update` 挂节点；不存在"调用工具生成内容"。
3. **强制外包**：
   - 故事大纲 / 人物小传 / 分场 / 台词的写作，必须经 `task` 委派 `writer`；
   - 资产设计 / 分镜镜头设计 / 媒体任务提交，必须经 `task` 委派 `media-director`；
   - ComfyUI 工作流参数化 / 作业轮询 / 产物回写，必须经 `task` 委派 `comfyui-operator`；
   - 委派时给出明确交接物与依赖；委派结果回收后再向用户汇报，不把 task 内部过程当聊天主体。
4. **门纪律**：严格按八步确认点（0-a/0-b/0-c/0-d、1-a/1-b、2-a/2-b/2-c 及媒体阶段门）调 `shortdrama_gate_request`；确认点不减少；门未解除不继续下游。
5. **门恢复**：每个回合开始先 `shortdrama_canvas_get`；若存在与当前工作相关的 `status:'pending'` 门，用同一 gateId 重新调 `shortdrama_gate_request` 继续等待（工具会重挂到既有门，不会重复建门）。
6. **能力诚实**：不具备图像 / 视频 / 音乐 / 语音的直接生成能力；媒体只能经委派 + `comfyui.*` 工具由本地 / 局域网引擎产出；不得假装已生成或承诺公网云端生成。
7. **模型纪律**：只用配置的 ark 文本模型；不切换、不建议切换任何其他文本或媒体模型。
8. 输出：简洁、结构化中文；产物以引用 / 路径交付，不复制大段 JSON 入正文。

### 4.2 writer

1. 只做故事 / 剧本侧文本推理：大纲、小传、分场、台词；按 showrunner 交接物与依赖工作。
2. 内容自产并落盘：`shortdrama_file_write` 写产物（json + md 形态按各切片契约），`shortdrama_canvas_update` 更新节点状态；不臆造项目文件中不存在的设定，信息不足先读 (`shortdrama_file_read/list`)。
3. 不发门、不派 task、不提交媒体任务、不访问网络 / shell。
4. 产物 schema 沿用既有结构（StoryOutline / CharacterProfile / Scene / Dialogue，016 §4.3），不自行发明新 schema。

### 4.3 media-director

1. 负责第 3/4/5 步：资产需求与结构化文本、分镜 / 镜头设计；文本自产经 file.write 落盘、canvas.update 挂节点。
2. 媒体任务只经 `shortdrama_comfyui_queue/status` 提交与轮询，产物经 `shortdrama_asset_register` 登记；不声称工具之外的生成能力；引擎未接入（返回 INTERNAL / 023）时如实转述并给出下一步。
3. 引擎操作细节（工作流参数化、轮询、回写）委派 `comfyui-operator`；自己不做工作流参数拼装。
4. 不发门、不派 task、不做后期（6）/ 发布（7）。

### 4.4 comfyui-operator

1. 只做引擎操作：`shortdrama_comfyui_instances` 选实例、参数化工作流、`queue` 提交、`status` 轮询、产物登记 (`asset.register`)、画布回写 (`canvas.update`)；不做创意文本。
2. 不发门、不派 task、不访问 shell / 外网；实例地址来自设置（本地 / 局域网可配），不写死。
3. 作业失败 / 超时时返回如实的状态与可执行建议，不伪造产出。

## 5. 确认门跨重启恢复协议

### 5.1 GateBridge 行为变更（electron/gate/bridge.ts）

> **⚠️ 修订（2026-10-07，K8，见决策台账 D-004）**：本节第 4 条中关于 `rejected` 的部分已被 **feature-019 契约 §2.4** 取代——`rejected` 门允许以**同一 gateId** 重开（状态回退 pending）；**仅 `approved` 为终态**。其余条款不变。

1. `request(input)` 新语义：
   - canvas 中该 gateId 不存在 → 现有行为：upsert pending 门 → 挂 Promise → 通知 renderer。
   - canvas 中该 gateId 已存在且 `status:'pending'`、**无 live entry**（重启 / 重开后恢复路径）→ 不重复建门：新建 pending entry 挂 Promise，调 gate 监听转发，并返回该 Promise。
   - canvas 中该 gateId pending、**已有 live entry**（Agent 同回合重复请求）→ 直接返回该 live entry 的既有 Promise（idempotent attach），不再产生 INVALID_ARGUMENT。
   - canvas 中该 gateId 已 `approved/rejected` → `reject(INVALID_ARGUMENT)`（不得重开已裁决门）。
     - **〔2026-10-07 修订〕** 此条仅保留对 `approved` 的效力；`rejected` 按 feature-019 §2.4：以同一 gateId 重开为 pending（用新请求内容覆盖），可再次裁决，不新增门编号。
2. 新增 `recoverPending(): Promise<void>`：读 canvas，对每个 `status:'pending'` 且无 live entry 的门执行重挂（建 entry + 转发 gate 通知）；无 pending 门时静默返回。
3. `decide / settleAll` 既有行为不变；`settleAll` 仍用于项目切换前清理旧项目 live entry。

### 5.2 main 接线（electron/main.ts）

`project:open` 的 openProject 成功链顺序固定为：

```
gateBridge.settleAll() → canvasStore.reset() → gateBridge.recoverPending() → 返回结果
```

renderer 在 openProject 成功后即可收到恢复门的 `gate:changed` 推送（订阅者集合机制沿用 017）。

### 5.3 恢复后 Agent 链路

重启后旧工具调用栈不延续进程内 Promise；恢复保证：① 门不丢、不重、可裁决并落盘；② showrunner 下一回合经 §4.1-5 重新挂到同一门等待；③ 裁决结果作为后续推进依据。不做 opencode 子进程内部运行栈的透明续跑（超出 opencode 能力边界）。

## 6. runtime client 边界校验变更（electron/runtime/client.ts）

1. agent 白名单：`director`（旧链路）与 `showrunner`（新链路）二者之一；缺省按调用方传入链路口径，新链路显式传 showrunner。其余任何名字（含 writer / media-director / comfyui-operator）→ `INVALID_ARGUMENT`。
2. tools 校验按 agent 分组（入参 tools 只允许该组白名单的子集）：
   - `director`：沿用 `isDirectorDeclaredTool`（read/glob/grep + shortdrama_ 前缀旧集）。
   - `showrunner`：§3.1 中 6 个 MCP 物理 ID（不含 task；task 由 profile 常驻，不随请求 tools 传）。
3. listAgents：过滤规则由"仅 director"调整为返回 `director` 与 `showrunner` 两个 primary（并存过渡）；专职 subagent 不返回。022 旧壳下线时再收敛为仅 showrunner。
4. model / format / sessionId 校验规则不变。

## 7. 错误与安全

- 不新增错误码；恢复 / 重挂路径的错误归一到既有 `INVALID_ARGUMENT / GATE_TIMEOUT / INTERNAL`。
- ARK_MODEL 缺失 → UPSTREAM_AUTH_MISSING（不静默回退）。
- 安全面零变化：renderer 仍无 URL / 口令 / Key；不新增任何网络直连；MCP 层纯工具事实不变。

## 8. 测试契约

| 层 | 要求 |
|---|---|
| profile 静态（T1） | 4 文件齐全；frontmatter 含 §3 全部物理工具键与 mode/model；showrunner permission.task 三个 allow + `*` deny；专职均 task deny；frontmatter 无点号工具键 |
| 系统提示静态（T2） | showrunner 含：八步 0–7、内容自产、强制外包三条款、门纪律 / 门恢复、能力诚实；writer/media-director/comfyui-operator 各自"不发门 / 不派 task"条款；不得出现"调用工具生成 / 产出内容"旧 director 式措辞 |
| provider 安装（T3） | ARK_MODEL 存在 → 5 个 profile 全部落盘且占位符被替换；缺失 → UPSTREAM_AUTH_MISSING、无 profile 写出 |
| 门恢复（T4） | 磁盘 pending 门：request 重挂成功（不 reject、返回挂起 Promise、门仍只一条）；已有 live entry 时返回同一 Promise；已裁决门 request 拒绝；recoverPending 重挂并触发监听 |
| client 校验（T5） | showrunner + 白名单工具通过；director 旧规则通过；subagent 名作 agent 拒绝；showrunner 传越权工具拒绝；listAgents 只含 director/showrunner |
| 回归 | typecheck / 全量 test:run 全绿；旧 director 相关测试无回归；真机启动为人工验收项（B 类任务标 ~） |
