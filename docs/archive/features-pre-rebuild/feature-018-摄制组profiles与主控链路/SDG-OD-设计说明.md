# SDG-OD 设计说明 · feature-018 摄制组 profiles 与主控链路

> 状态：**v1.0 待审批**
> 日期：2026-10-07
> 本文件说明实施侧设计决策：探针实证过程、模块改动映射、委派与门恢复的数据流、并存矩阵。
> 用户可见界面的重设计不在本包（022），本包仅保证新链路在数据 / 行为层成立。

---

## 1. 设计决策与实证过程

### 1.1 为什么必须先做真机探针

016 契约 §2 的工具白名单用逻辑名（`file.read` 等），但 opencode frontmatter 实际接收的工具键是**进程内工具 ID**。feature-008 时期 MCP 工具名为单词（`diagnose`），ID = `shortdrama_diagnose` 可直接推断；017 工具名带点号，归一化结果无法靠推断确定（点号可能保留、转下划线、或被 SDK 拒绝）。

探针设计（脚本在 /tmp，不污染仓库）：

```
fake OpenAI(4099, 记录请求中 tools[].function.name)
  ◀── chat completions ── opencode serve(4199)
                              ▲ remote MCP config
                              │
                     MCP 纯工具服务(4177, 017 真实代码)
```

结论：**`<server>_<tool>`，`.` → `_`**，11 个物理 ID 全部观测到（契约 §1）。同一方法验证 `permission.task` 白名单归一化正确。该映射已固化为契约条款，后续切片直接引用。

### 1.2 为什么保留旧 director 并装 5 个 profile

- 旧 App 的 prompt 显式带 `agent:'director'`；停止安装 director 会让旧链路在并存期立即失效，违背切片化迁移。
- opencode 允许同驻多个 primary，互不影响；showrunner 不设为 `default_agent`（旧会话继续走其自身存储的 agent），新链路由调用方显式指定。

### 1.3 门恢复为什么采用"重挂"而非"续栈"

opencode 子进程内，等待工具结果的调用栈随进程退出消失，重启后无法透明续跑——这是运行时能力边界，不应靠主进程侧 hack 伪装。可行且诚实的恢复语义：

- 门的**事实**（pending/裁决状态）以 canvas 为持久真相，重启不丢；
- 恢复的是"**等待裁决**"这个状态（重挂 Promise + 通知 renderer）；
- Agent 侧以"回合开始查 pending 门、同 gateId 再调 gate.request"完成链路重连（契约 §4.1-5 / §5.3）。

## 2. 模块改动映射

| 模块 | 改动性质 | 内容 |
|---|---|---|
| resources/opencode/agents/showrunner.md | 新增 | 主控 profile（契约 §3.1/§4.1） |
| resources/opencode/agents/writer.md | 新增 | 编剧（§3.2/§4.2） |
| resources/opencode/agents/media-director.md | 新增 | 媒体导演（§3.3/§4.3） |
| resources/opencode/agents/comfyui-operator.md | 新增 | 引擎操作员（§3.4/§4.4） |
| resources/opencode/agents/director.md | 不动 | 旧 profile 并存 |
| electron/runtime/provider.ts | 扩展 | profile 常量、泛化模板解析与安装函数、按 agent 物理 ID 白名单 |
| electron/gate/bridge.ts | 扩展 | request 重挂分支、recoverPending |
| electron/main.ts | 局部 | openProject 成功链接入 recoverPending |
| electron/runtime/client.ts | 局部扩展 | agent 白名单、分组 tools 校验、listAgents 双 primary |
| electron/runtime/manager.ts | 零 / 最小 | setupRuntimeFiles 返回结构变化时做兼容适配 |
| shared/types.ts | 不动 | 本包无 K1 |

## 3. 主控链路数据流

### 3.1 task 委派（前台）

```
用户 ──▶ showrunner
           │ canvas.get 读状态；自身推理拆解
           ├─(文本类写作)─ task(writer) ─▶ writer: file.read/list → 推理 → file.write + canvas.update ─┐
           ├─(媒体/镜头)── task(media-director) ─▶ 文本设计落盘                                       │
           │                              └─▶ task(comfyui-operator): comfyui.queue/status ─┐        │
           │                                                              asset.register ◀──┘        │
           ├─(确认点) gate.request ─ pending ─ GateCard ─ decide ─┐                                  │
           ◀──────────────── 委派结果 / 门结果回收，继续推进 ─────────────────────────────────────────┘
```

约束落点：

- showrunner 的 `permission.task`：`*` deny + 三个显式 allow → 模型看不到其他 subagent。
- 专职 profile 均 `task: deny` → 委派链只有一层，不会出现 subagent 再派 subagent。
- renderer 无法直接指定 subagent（client 校验 + 不向 renderer 返回专职 agent）。

### 3.2 门跨重启恢复

```
启动/重开项目 project:open
   ├─ settleAll      清理上一项目 live entry（GATE_TIMEOUT）
   ├─ canvasStore.reset()
   └─ recoverPending
         └ canvas.gates.filter(status==='pending' 且无 live entry)
               ├─ 建 entry（Promise 挂起）
               └─ gate 监听转发 ─▶ main 广播 gate:changed ─▶ renderer GateCard
用户裁决 ─▶ gate:decide ─▶ gate 状态落盘 + 广播 ─▶ entry.resolve
下一回合 showrunner canvas.get 见已裁决门 → 继续；若裁决前 Agent 先重连：
         gate.request(同 gateId) ─▶ 重挂到该 entry（不重建门）
```

## 4. GateBridge 请求状态转移（实现对照）

```
                    ┌──────────────────────────────────────────┐
                    │ gateId 在 canvas 的状态 / live entry 情况  │
                    └──────────────────────────────────────────┘
  不存在门            → upsert pending 门 + 新 entry + 通知       （原行为）
  pending · 无 entry  → 新 entry（重挂）+ 通知，不写门             （新增：恢复）
  pending · 有 entry  → 返回同一 Promise                          （新增：幂等）
  approved/rejected   → reject INVALID_ARGUMENT                   （收紧：禁止重开）
```

## 5. 并存矩阵

| 能力 | 旧链路（018 上线后） | 新链路 |
|---|---|---|
| 主控 agent | director（安装保留） | showrunner |
| 工具来源 | shortdrama_ 前缀旧工具（director.md 声明，随旧 MCP 已不存在 → 旧链路仅在旧 App 已固化流程下并存，不新增能力） | 11 纯工具物理 ID |
| listAgents 返回 | director | showrunner（两者都返回，022 收敛） |
| 门恢复 | 旧 feature-015 路径 | canvas + recoverPending |
| 删除时机 | 022 | — |

注：旧 MCP 业务工具在 017 已替换为纯工具，旧 director 所声明的 shortdrama_diagnose 等键不再有工具实体。并存期旧 director 的价值是**旧 App 已落盘会话与提示路径不被立即破坏**；旧流程的"发起新生成"能力实际已由新架构接管，这一状态在 022 随旧壳整体下线，不另做适配。

## 6. 测试设计

- T1/T2 以静态文本断言锁 frontmatter 与系统提示（防止措辞回退到"工具生成内容"）。
- T3 对 tmp userData 实跑安装：5 文件、占位符替换、缺 model 错误码。
- T4 在 tmp 项目磁盘图上构造 pending 门，验证四种 request 分支与 recoverPending 通知。
- T5 直接构造 PromptBody 走 client 校验（沿用 runtime-client.test.ts 既有 mock 模式扩展，不引真机网络）。

## 7. 不做事项（边界提醒）

- 不做 default_agent 切换、不做 opencode CLI 参数变更。
- 不做后台 subagent / 并行多 task。
- 不做 renderer 任何视觉改动；不新建 UI 文件。
