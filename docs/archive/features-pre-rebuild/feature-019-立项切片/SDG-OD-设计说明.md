# SDG-OD · 设计说明 · feature-019 垂直切片·立项（第 0 步）

> 版本：v1.0（待用户签字）
> 日期：2026-10-07
> 依据：需求规格 / 契约；[feature-016 OD §6/§7](../feature-016-架构重建总纲/SDG-OD-设计说明.md)；feature-018 OD 主控链路。
> 本文只描述"怎么落地"，不新增需求。

---

## 1. 设计总览

新旧并存：`src/main.tsx` 挂一个顶层可切换容器，默认进入**新立项工作台 StudioApp**；StudioApp 内"返回旧版"切换到旧 `App`。旧 App 文件不重命名、不改其状态机；feature-022 时移除切换与旧 App。

```
main.tsx
└── RootSwitch（内存：view: 'studio' | 'legacy'）
    ├── StudioApp（新增，ErrorBoundary 包裹）
    │   ├── ProjectRail        左：项目/第0步信息（复用 ProjectSidebar 数据，只读）
    │   ├── CanvasBoard        中：渲染 Canvas nodes/edges（新 schemaVersion:2）
    │   └── ChatComposer       右/中：对话流 + 输入 + GateCard + StreamingText
    └── App（旧，保持原样）
```

新增文件集中在 `src/studio/`（与旧 `src/components`、`src/lib` 隔离），不改动旧模块。

## 2. 数据流（单向）

```
用户输入
  → ChatComposer: ensureRuntime + ensureSession
  → window.api.runtime.promptAsync({ sessionId, text, agent:'showrunner' })
        │
  opencode showrunner 自主执行
        │ file.write / gate.request / canvas.update（经 MCP 纯工具）
        ▼
  主进程 canvasStore / gateBridge
        ├── canvas:changed → window.api.canvas.onChange → CanvasBoard 重渲染
        ├── gate:changed   → window.api.gate.onChanged  → ChatComposer 挂 GateCard（gate.request Promise 挂起）
        └── runtime events → window.api.runtime.onEvent → StreamingText
                                   │
                          用户 GateCard 裁决
                                   ▼
                    window.api.gate.decide → 解除挂起 → showrunner 续跑
```

renderer 无隐藏指令：所有推进由 showrunner 自主 + 用户门裁决驱动（016 OD §6）。

## 3. 模块设计

### 3.1 StudioApp（容器）

- 挂载时：`canvas.get` 取初始画布；`canvas.subscribe`；注册 `canvas.onChange` / `gate.onChanged` / `runtime.onEvent`；卸载时全部退订。
- 顶层 state：`canvas: Canvas`、`pendingGate: CanvasGate | null`、`stream: StreamingTurn | null`（复用 `reduceRuntimeEvent` 归约，纯函数沿用，不改）。
- 项目切换：仍调 `project.openProject` 后由主进程 settleAll→reset→recoverPending；renderer 侧沿用旧 ProjectSidebar 的 `window.location.reload()` 路径（不新增 SPA 迁移，降低白屏面）。

### 3.2 CanvasBoard（画布）

- 依据 `canvas.nodes`（step==='0'）与 `canvas.edges` 渲染节点卡 + 连线（数据驱动的 edges，取代旧 StageCanvas 硬编码 LinkSvg）。
- 节点状态只取 CanvasNode.status；点击 done 节点可经既有 ProductViewer 打开其 `ref.path`（查看器复用，不改取数语义）。
- 不复用旧 StageCanvas（其为 props 旧 NodeStatus 模型）。

### 3.3 ChatComposer（对话 + 门）

- 消息列表：用户气泡 + showrunner 流式文本（turnText）+ GateCard（内嵌，位置随 `gate:changed` 到达点）。
- GateCard：字段渲染自 `CanvasGate`（question/options）；确认→`gate.decide(approved)`，否决→可带 note→`gate.decide(rejected)`。
- 输入：发送时 `agent:'showrunner'`；showrunner 6 物理工具由 client.ts 已校验，renderer 不传 tools（用服务端 profile 声明）。
- 门挂起期间输入框行为：允许继续输入但不强制（Agent 该轮停在等待，裁决后续跑）；不做前端锁死以外的业务推断。

### 3.4 ErrorBoundary

- 新增最小类组件（`componentDidCatch` + `getDerivedStateFromError`），包住 StudioApp；异常显示可展示文案 + "重试/返回旧版"。
- 针对调研确认的白屏隐患（无任何 ErrorBoundary、render 期对损坏数据无守卫）做兜底；不借机给旧模块加防御代码。

## 4. showrunner profile 增补

- 仅在 `showrunner.md` **正文**新增「## 第 0 步立项剧本」小节，内容 = 契约 §2 的门序、落盘路径、挂节点动作、rejected 同 id 重试、第 0 步不用 task / 不触媒体。
- **不改 frontmatter**：frontmatter 的 tools/permission 被 feature-018 T1 静态逐字断言保护。
- profile 经 `installAgentProfiles` 既有机制渲染（模板读取按文件名，正文改动自动生效），不改 provider.ts。

## 5. 关键决策与权衡

| 决策 | 选择 | 理由 / 放弃项 |
|---|---|---|
| 新链路落点 | 新建 src/studio + 视图切换 | 不动旧重状态机，避免在 022 前引爆 1785 行回归；放弃"改造 App.tsx"（风险与 022 职责重叠） |
| 新旧切换 | 内存开关，默认新 | 零新增 IPC、可逆；放弃持久化默认项（default_agent 不做，018 §7） |
| 项目切换 | 沿用 reload | 复用已验证恢复链，规避 SPA 迁移竞态；白屏由 ErrorBoundary 兜底 |
| 门合格判定 | renderer 不判定，仅展示 | 业务真相在 Agent/产物；放弃在前端复刻旧 harness 规则 |
| 0-c 视觉 | 只文本不出图 | 第 0 步不触媒体、ComfyUI 在 023；放弃生成参考图 |
| 清理 | 验收后仅删 4 项立项专属 | 旧壳故事/剧本仍依赖其余 IPC；收窄 016"等"字表述 |

## 6. 并存影响矩阵

| 旧物 | 019 期间 | 验收后（F4） |
|---|---|---|
| 旧 App / 旧状态机 | 保留、可返回 | 保留（022 删） |
| `idea:save` / `diagnosis:save` + preload 键 | 保留（新链路不用） | **删** |
| `project:*/workflow:*/chat:*/session:*/story:*/script:*` | 保留 | 保留 |
| runtime/canvas/gate IPC | 新链路使用 | 保留 |
| showrunner frontmatter | 不动 | 不动 |
| shared/types.ts | 不改 | 不改 |

## 7. 测试落地

- 编排（opencode 侧以 mock runtime + 工具调用记录）：门序/顺序/重试/不触媒体/brief 与节点。
- renderer：`src/studio` 组件测试（RTL）：发送、流式、GateCard、裁决、画布更新、切换、ErrorBoundary。
- 复用既有 `reduceRuntimeEvent` / `turnText`，不重复测其内部。
- 真机：dev 下跑一次完整四门，验收后清理人造项目数据。

## 8. 风险

1. 真机 ark 下 Agent 未严格按门序（靠 prompt 约束，非强约束）→ 以编排测试 + 真机验收取证；若偏离，仅在 profile 正文强化，不在工具侧加业务逻辑（保持工具零 LLM/零业务）。
2. 项目切换白屏为旧壳既存问题 → 新工作台 ErrorBoundary 兜底；旧壳根因不在本包深挖（022 下线）。
3. 清理后旧 App 立项路径残留引用 → F4 删除限定为仅 saveIdea/saveDiagnosis 调用点，删后 typecheck/test 兜底。
