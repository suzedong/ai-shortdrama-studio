# SDG-OD-设计说明 · feature-820 一级入口与伪造状态收口

> 本包有 UI 变化且用户明确要求「所有可见一级入口都有真实行为、明确的未开放状态」。样式沿用现有 token（`text-ink` / `text-muted` / `border-line` / `bg-surface` / `bg-violet` / `bg-violet-soft` / `bg-warn` / `bg-bad` / `bg-ok`），不引入新色板。

## 1. 设计意图

底栏是**仪表盘**，不是装饰条。原先「全绿 + 固定端口 + 伪进度」传递的是「系统一切正常」的错觉；真实情况是文本服务、运行时、ComfyUI 三套系统各自可能独立异常。

本包的原则：**能读到就展示真实值，读不到就明说未读取，绝不代替系统宣称正常。**

## 2. 底栏版面

| 项 | 规格 |
| --- | --- |
| 容器 | `footer[data-statusbar]`，`h-9`，`border-t border-line bg-surface px-4 text-[10.5px] text-muted` |
| 分段 | 文本服务 → 竖线 → 运行时 → 竖线 → ComfyUI → 右侧 `画布更新于 HH:MM`（`ml-auto`） |
| 色点 | `h-1.5 w-1.5 rounded-full`；语义见契约 §1.2；绿点只授予 `runtime.state === 'running' && healthy` |
| 工具提示 | 文本槽位 `title="文本服务配置状态，不代表连通性"`；ComfyUI `title="ComfyUI 实例配置数量，非在线探测"` |
| 测试锚点 | `data-statusbar`、`data-status="text" / "runtime" / "comfy"` |

设计取舍：

- **文本服务用紫色点而非绿点**：`keyConfigured` 只说明配置齐全，不代表云端可达；用绿点会再次制造「在线」错觉。
- **ComfyUI 只报配置数量**：健康探测是主动网络请求（`settings:comfy:test`），每次进入工作台都发会把仪表盘变成探测负载；留待需要时单独设计。
- **更新时间取 `canvas.updatedAt`**：这是唯一真实的落盘时间戳，替代「2 分钟前自动保存」的伪相对时间。

## 3. 状态与数据流

```
hasProject=true
  └─ effect(hasProject, canvas.projectId)
       ├─ settings.ai.get() ──► summarizeActiveProvider() ──► footer.text
       ├─ runtime.status()  ──► footer.runtime ──► runtime.onStatusChange 持续更新
       └─ settings.comfy.list() ──► footer.comfy {enabled,total}
  每次 setState 前检查 alive；切项目/卸载 → offStatus()
```

- 三个槽位互相隔离（独立 try/catch），一个失败不拖累其余。
- 不轮询：运行时状态靠推送；ComfyUI 与文本服务只在项目切换时读一次。

## 4. 为什么服务商差异放在 `AiServicePanel.tsx`

初版把 `view.ark.model` / `provider === 'ark'` 直接写在 `StudioApp.tsx`，触发 `architecture.test.ts` C7（禁止 shell 非豁免文件出现服务商字面量）。修正方案：在豁免文件 `AiServicePanel.tsx` 增加纯函数 `summarizeActiveProvider(view)`，返回 `{ provider, label, model, configured, unconfiguredLabel }`；`StudioApp` 只消费该结构。

> 该调整不改变任何用户可见结果，只是把同一逻辑放到架构断言允许的位置；已在变更记录登记。

## 5. 左栏面板

| 面板 | 设计 |
| --- | --- |
| Skill 广场 | 顶部灰色说明行；类目 chips 由数据去重生成；卡片 meta 行追加中立灰 `未开放` 徽标；删除卡片底部死按钮 |
| 专业插件 | 顶部灰色说明行；每条右侧固定 `未开放` 徽标；删除开关控件与 `defaultOn` 数据 |
| 本地模型 | 两张卡：①「本地模型管理 + 未开放」+ 一句范围说明（下载 / 切换 / 显存管理未开放）；②「当前可用路径」两条 + 紫色描边按钮 `打开 AI 服务设置`（`data-local-models-settings`） |

## 6. 与既有界面的关系

| 区域 | 本包是否改动 |
| --- | --- |
| 中栏画布 / 立项视图 | 不改 |
| 右栏对话 / 模型选择 | 不改 |
| 顶栏 / 图标轨（除新增 `local` 页签） | 不改 |
| 底栏 | 全量重写为真实状态 |
| `AiServicePanel` | 仅新增导出纯函数，不改渲染 |

## D-037 现行归并设计：桌面窗口外壳（2026-11-19）

### 1. 平台结构与事件流

```text
macOS:   hiddenInset + 原生交通灯 + 既有工作区
Windows/Linux: frame:false + 46×32 px 自定义窗口控件 + no-drag 交互区

Renderer 控件
  → window:minimize / toggle-maximize / is-maximized / close
  → Main 操作或读取 BrowserWindow
  → window:maximize-changed(boolean)
  → Renderer 同步权威最大化状态
```

关闭按钮 hover 固定为 #C42B1C。窗口拖拽区与按钮命中区分离，所有可交互子元素使用 `no-drag`，避免拖拽层吞掉点击。

### 2. preload 构建链

`preload.js` 源码/构建入口 → 构建配置输出 CommonJS `preload.cjs` → 主进程加载该产物；`global.d.ts` 与模块写权随同一链路核对。该链路是窗口桥接可运行的组成，不得以构建目录中存在源文件代替产物检查。

### 3. 平台代价与冲突裁决

- Windows `frame:false` 不自动等价原生 Snap Layouts；恢复需另做悬浮命中、DPI、多屏和最大化边界设计，本包不宣称已覆盖。
- Windows ENV-02 已验收；macOS AC5 零变化回归继续挂起。
- feature-804 的「不做深色」只保留为历史范围，现行主题由 feature-817 管理。
- 本包原「零新增 IPC / 零 preload / 零 global.d.ts 变更」只限原入口 Change，不否定上述既有窗口外壳；D-037 不新增接口或产品验收声明。
