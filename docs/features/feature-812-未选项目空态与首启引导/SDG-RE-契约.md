# feature-812 未选项目空态与首启引导 · 契约

> 卡口：**K1 零触发**（不动 `shared/types.ts`）、**K8 零触发**（零新增 IPC / MCP 工具，仅消费既有 `listProjects` / `openProject` / `createProject`）、**K9 零触发**（零新依赖）。
> 本契约的"必须"项，实现不得偏离；未列项按现有实现保持不变。

## 1. 状态判定

### 1.1 唯一判定式

```
canvasLoaded = canvas.get() 首拉已回（.then / .catch 均置 true）
hasProject   = canvasLoaded && canvas.projectId !== ''
```

- `canvas` 取自 `window.api.canvas.get()` 首拉与 `canvas.onChange` 推送，二者共用同一 `Canvas` 形状；无项目时主进程兜底返回 `projectId: ''`（`main.ts` L790-805），故该判定与主进程口径一致。
- **加载中 ≠ 无项目**：首拉未回时 `canvas` 仍是模块级 `emptyCanvas`（`projectId: ''`），此时既不能认定"无项目"（会闪欢迎页），也不能放开对话（会形成"可发但必失败"的假可用，见 §4.4）。加载中与无项目**同样锁定对话**，仅中栏与提示文案不同。
- **禁止**为判定新增 IPC（不引入 `project:current`），**禁止**在 renderer 读磁盘。
- 判定只在 `StudioApp` 求值一次，向下以 props 传递，子组件不得各自再判。

### 1.2 判定消费点（全量清单）

| 位置 | 无项目时的行为 |
|---|---|
| 中栏主体 | 加载中渲染 loading 行；已加载且无项目渲染 `WelcomeView`（优先于 `centerView`） |
| 顶栏标题 | `projectTitle` 兜底为 `'未打开项目'` |
| 顶栏 stage-track | 八格全 `idle`；点击空操作 |
| 右栏对话 | `lockedReason` 非空（无项目 / 加载中均锁定，文案不同） |
| 右栏口径条 | 维持既有 `canvas.projectId ? <CaptureBar/> : null` |
| 底栏 | 不渲染 |
| `handleSend` | 立即返回错误，零副作用 |

## 2. 中栏 `WelcomeView`

### 2.1 挂载

```tsx
{!hasProject
  ? <WelcomeView onCreate={...} onOpen={...} />
  : centerView === 'stage0' ? <Stage0View .../> : <CanvasBoard .../>}
```

- 无项目时**不得**渲染 `Stage0View` / `CanvasBoard`，即使 `centerView === 'stage0'`。

### 2.2 Props

| Prop | 类型 | 语义 |
|---|---|---|
| `onCreate` | `() => void \| Promise<void>` | 主 CTA；由 `StudioApp` 实现为 `createProject(undefined)` → `openProject(dir)` |
| `onOpen` | `(dir: string) => void \| Promise<void>` | 列表项点击；由 `StudioApp` 实现为 `openProject(dir)` |

### 2.3 结构（顺序固定）

1. 标题区：`开始一部短剧`（h1）+ 一行说明（主控 Agent + 三个专职 Agent + 八步闭环）。
2. 主 CTA：`＋ 新建项目`——全宽按钮、`bg-violet`、白字；`busy` 时禁用并显示「创建中…」。
3. 分隔文本：`或打开已有项目`。
4. 最近项目列表：`window.api.listProjects()` → 按 `updatedAt` **降序** → 取前 **5** 条；每项显示首字色块、名称（空名兜底「未命名项目」）、相对时间；点击 `onOpen(p.dir)`；`busy` 时全部禁用并显示「打开中…」。
5. 空库态：列表为空时显示一行 `还没有项目，点上方「新建项目」开始。`
6. 错误条：`onCreate` / `onOpen` / `listProjects` 任一失败，`message` **原样上屏**（不翻译、不吞），主 CTA 保持可点。
7. 底部流程提示（muted 一行）：`0 立项 → 1 故事 → 2 分场 → 3 资产 → 4 分镜 → 5 镜头 → 6 后期 → 7 发布`。

### 2.4 失败降级

| 场景 | 表现 |
|---|---|
| `listProjects` reject | 列表区替换为错误条；主 CTA 可用 |
| `createProject` reject | 错误条；`busy` 复位；不调用 `openProject` |
| `openProject` reject | 错误条；`busy` 复位；停留本页 |

## 3. 顶栏

### 3.1 标题

```ts
const projectTitle = hasProject ? (canvas.title || '未命名项目') : '未打开项目'
```

渲染保持 `短剧 Agent · {projectTitle}` 不变。

### 3.2 stage-track

- `hasProject === false` → 每一项 `state: 'idle'`（不出现 `cur` / `active` / `done`）。
- 点击 handler 首行：`if (!hasProject) return`——不 `setCenterView`、不 `setActiveStep`、不 `setLeftView`。

### 3.3 不禁用项

顶栏「视觉风格谱系」（`cat-entry`）与系统菜单「AI 服务设置」在无项目时**保持可点**：前者读 `resources/` 谱系与项目无关，后者是首启配 Key 的必经入口。

## 4. 右栏 `ChatComposer`

### 4.1 新增可选 Prop

```ts
lockedReason?: string | null
lockedHint?: string | null
```

- `lockedReason`：`null` / `undefined` = 不锁定（既有全部行为不变）；非空字符串 = 锁定，字符串本身即 placeholder 文案。
- `lockedHint`：锁定期间的空态说明；缺省按"未打开项目"表述。
- `StudioApp` 传值（唯一来源，禁止子组件自行判定）：

```ts
const composerLock = !canvasLoaded
  ? '正在载入项目…'
  : hasProject ? null : '先新建或打开项目再开始对话'
const composerLockHint = canvasLoaded ? null : '正在读取上次打开的项目，请稍候…'
```

### 4.2 锁定时必须全部成立

| # | 要求 |
|---|---|
| L1 | `textarea` `disabled` |
| L2 | `placeholder` = `lockedReason`（优先于 `aiDown` 文案）；加载中为「正在载入项目…」 |
| L3 | 发送按钮 `disabled`（**与草稿是否为空无关**：锁定时恒禁用，不得因输入内容而变亮） |
| L4 | `submit()` 首行 `if (lockedReason) return`（回车 / 点击 / 选项代发三入口同源） |
| L5 | 空态提示行 = `lockedHint ?? '还没有打开项目。先新建一个，或在左栏选择已有项目。'` |
| L6 | 模型选择器 `select` **不禁用**（`modelOptions` 为空时按既有规则禁用） |

### 4.3 不传递的行为

锁定**不影响**：`items` 回放渲染、`pendingGate` 门卡展示与裁决、`onStop`、`aiDown` 横幅与「重新检测」。

## 5. 底栏

```tsx
{hasProject && <footer className="...">…</footer>}
```

- 无项目时**整块不渲染**（C 拍板"只做隐藏"）。
- 有项目时底栏内容与现状**逐字一致**（含其硬编码项）——真实化不在本包。

## 6. 发送守卫

`handleSend` 函数体首行（在 `selectedModel` 校验**之前**）：

```ts
if (!canvas.projectId) {
  setError('请先新建或打开项目，再开始对话。')
  return
}
```

- 必须**零副作用**：不 `setSending`、不 `setItems`、不调 `runtime.status` / `runtime.start` / `createSession` / `promptAsync` / `activeSession`。
- `handleSend` 的 `useCallback` 依赖数组须加入 `canvas.projectId`。
- 该守卫对 `handleRealign` / `handleImpactBatch` 等经 `handleSend` 的模板消息链路同样生效（无项目时这些入口本身不可达，属纵深防御）。

## 7. 不变项（回归红线）

- `shared/types.ts` 零 diff；`package.json` 零 diff。
- IPC 通道数、MCP 工具数（29）不变。
- `electron/**` 零改动。
- `dev-mock-api.ts` 的 `projectId: 'anni'` 不变（浏览器演示态仍走"有项目"分支）。
- `CanvasBoard` / `Stage0View` / `ProjectNav` 零**逻辑**改动；`ProjectNav` 仅允许 `relativeTime` 加 `export`（供 WelcomeView 复用，不复制实现）。
- 既有测试 helper `emptyCanvas()` 的 `projectId: 'p1'` 不改。
