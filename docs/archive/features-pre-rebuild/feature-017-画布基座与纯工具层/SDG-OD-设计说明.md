# SDG-OD 设计说明 · feature-017 画布基座与纯工具层

> 状态：**v1.0 待审批**
> 日期：2026-10-07
> 本 Feature 无终端用户可见新页面（不做 Renderer 重建）。本说明描述**地基内部结构、数据流时序、并存策略**，作为契约 §1/§5/§7/§9 的设计补充。界面形态的事实源仍是 [feature-016 SDG-OD](../feature-016-架构重建总纲/SDG-OD-设计说明.md)。

---

## 1. 设计总览：为什么这样切

新架构的第一块地基要同时满足三件事，且不影响仍在运行的旧应用：

1. **工具回归纯职责**——MCP 工具只做文件 / 画布 / 门 / 资产 / 引擎转发，零模型调用。
2. **单一工作态落盘**——`canvas.json` 成为唯一工作图，取代未来要删的 workflow 三态。
3. **写入安全且有序**——所有写共用一个队列、写前可归档、变更可广播。

```
                ┌──────────────┐
 Agent (MCP) ──► │  纯工具层     │── invoke ──┐
                │ file/canvas/ │            │
 Renderer ─IPC─►│ gate/asset/  │            ▼
                │ comfy        │     ┌──────────────┐
                └──────────────┘     │  主进程服务    │
                                     │ Store/Bridge/ │
                                     │ Index/Settings│
                                     └──────┬───────┘
                                     enqueue ▼  写前归档
                                  ┌──────────────────┐
                                  │ canvas.json /     │
                                  │ project.json /    │
                                  │ asset-index.json  │
                                  └──────────────────┘
```

## 2. 写入路径（单队列 + 归档）

所有写（新旧共用）经过同一个 `enqueue`：

```
file.write / canvas.update / gate.decide / asset.register / settings.upsert
        │
        ▼
enqueue(task)                     # 串行；单任务失败不阻塞队列
        │
        ├─ archiveExisting(file)  # 旧文件移入 版本/<base>.<stamp><ext>
        ├─ mkdir -p dirname
        ├─ writeFile（JSON 序列化）
        └─ 落盘成功 → 触发订阅广播
```

设计要点：

- 广播只在**落盘成功之后**，订阅者看到的图永远是磁盘最终态。
- 同批多文件写传同一个 `now`，归档时间戳一致（沿用既有规则）。
- 归档失败直接阻断写入（不做无备份覆盖）。

## 3. Canvas 数据流

### 3.1 读取（懒加载）

```
canvas.get / canvas:get
   │
   ▼
内存投影存在？ ── 是 ──► 返回
   │否
   ▼
读 canvas.json ── 成功 ──► 校验 schemaVersion=2 ──► 缓存并返回
   │缺失
   ▼
初始化空图（schemaVersion:2, nodes/edges/gates=[]）── enqueue 落盘 ──► 返回
```

### 3.2 节点 upsert + 自动边

```
canvas.update { nodes:[{id, step, kind, title, status, ref, linksTo:[...]}] }
   │
   ├─ 按 id upsert 节点（updatedAt 由 store 覆写）
   ├─ deriveAutoEdges(existing, upserts)
   │     └─ 对每个 node.linksTo 目标补 auto 边；e-<from>--<to>；(from,to) 去重
   ├─ enqueue 写 canvas.json（写前归档）
   └─ 广播 canvas:changed
```

`deriveAutoEdges` 是纯函数，不碰文件、不碰时间，输入确定则输出确定（可独立单测）。

### 3.3 项目切换

```
openProject(dir)
   ├─ canvasStore.reset()      # 丢弃旧内存投影
   ├─ gateBridge.settleAll()   # 旧项目 pending 门全部 GATE_TIMEOUT，无悬挂 Promise
   └─ 下次 get 按新项目重新懒加载
```

## 4. Gate 阻塞时序（单次运行内）

```
Agent                GateBridge              CanvasStore         Renderer
  │ gate.request ────►│                          │                    │
  │                   │ upsert pending gate ───►│ 写 canvas.json     │
  │                   │                          │ ── canvas:changed ─►
  │                   │ ── gate:changed ─────────┼──────────────────► │ 显示 GateCard
  │  ◄ Promise 挂起（不返回 opencode）                                │
  │                   │                          │                    │
  │                   │ ◄── gate:decide {decision,note} ──────────────│ 用户裁决
  │                   │ 写回门状态 ─────────────►│ 写盘+canvas:changed│
  │ ◄ {decision,note} │ resolve                  │                    │
  │ 继续推理                                                                   
```

要点：

- 门唯一阻塞点是 Bridge 内的 pending Promise；opencode 这一轮自然停在等待态，工具不主动与 opencode 交互。
- 同一 gateId 重复 request 直接拒绝，避免双 Promise。
- 应用关闭：`settleAll()` 把 pending Promise 全部 reject 为 `GATE_TIMEOUT`，工具层回错误结果，不残留。
- 跨重启恢复本包不做（018）；但门已随 canvas 落盘，事实不丢。

## 5. 文件目录（本包新增 / 使用）

```
project-<stamp>/
├── canvas.json                 # 【新】Canvas 单一工作态
├── project.json                # 【新】{projectId,title,comfyInstances[],updatedAt}
├── manifest.json               # 旧，保留
├── 资产/
│   └── asset-index.json        # 【新】AssetIndexItem[]
├── 立项/ 故事/ 剧本/ 分镜/        # 旧产物目录，保留
└── 版本/                        # 写前归档（canvas/project/asset 写入同样进此规则）
```

## 6. 并存策略（关键设计约束）

本 Feature 采用**新增并存、零删除**，保证旧应用全程可运行：

| 对象 | 新 | 旧 | 本包处置 |
|---|---|---|---|
| 工作态 | Canvas / canvas.json | WorkflowState / workflow.json | 双写双存，互不读对方 |
| 工具 | 11 纯工具 / registerPureTools | 8 生成工具 | 重写 tools.ts，旧工具删除（旧工具逻辑已被总纲判废，无外部引用） |
| IPC | canvas/gate/asset/settings 8 handle | project/session/chat/... ~27 handle | 旧 handle 全保留 |
| 类型 | 7 新类型 | Stage/NodeStatus/MessageKind 等 | 旧类型全保留 |
| UI | 无 | 现有全部界面 | 不改、不回归 |

为什么旧工具可以在本包直接删，而旧 IPC / 旧类型不能：8 个旧工具的唯一入口是 MCP server 的注册调用，随 tools.ts 重写一起替换，不被旧 IPC 或 renderer 引用；而旧 IPC / 类型仍被现有 App.tsx 直接引用，删除会破坏并存期编译与运行。

## 7. 静态可验证性（设计自带护栏）

1. tools.ts 源码静态扫描不含 `ark` / `prompts` / `chat(`（测试 T8）。
2. renderer 目录不出现对 `electron/` 新模块的 import（新能力仅 window.api）。
3. shared 改动可由 git diff 直接核对为"仅追加"。
4. 纯函数 edges.ts 的自动边结果对同一输入恒定（幂等测试）。

## 8. 本设计不覆盖（移交后续 Feature）

- Agent profile 与 task 委派、gate 跨重启恢复 → feature-018。
- 任一八步业务内容与确认门语义 → feature-019~021/024/025。
- 新 ChatStream / CanvasView / GateCard 组件与旧壳删除 → feature-022。
- ComfyUI 真实探活 / 提交 / 轮询、多实例打通 → feature-023。
