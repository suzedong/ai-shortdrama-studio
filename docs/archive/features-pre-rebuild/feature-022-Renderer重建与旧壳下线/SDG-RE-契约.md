# SDG-RE 契约 · feature-022 Renderer 重建与旧壳下线

> 状态：**v1.1 已验收**
> 日期：2026-10-08
> 验收日期：2026-10-08（C9 真机验收通过，见变更记录 E-022-02）
> 本契约定義本切片唯一新增接口 `file:read` 与旧壳删除白名单；其余 IPC / 类型全部沿用 feature-017~021，**不改 `shared/types.ts`**。

---

## 1. 复用的既有契约（不改动）

| 契约 | 来源 | 说明 |
| :-- | :-- | :-- |
| `runtime:*`（start/stop/status/session/prompt/event subscribe） | 017/018 | 签名与错误信封不变 |
| `canvas:get / subscribe / unsubscribe` + `canvas:changed` 推送 | 017 | 不变 |
| `gate:decide` + `gate:changed` 推送 | 017/018 | 门语义 pending/rejected/approved 不变 |
| `project:list / create / open` | 存量 | FR-3 直接复用，签名不变 |
| `settings:comfy:*`、`asset:list`、`app:config-status` | 存量 | 保留原样 |

## 2. 新增 IPC：`file:read`（唯一新增，D-022-01 签字后生效）

```
invoke('file:read', { path: string }) → { ok: true, content: string, format: 'json' | 'md' }
                                     | { ok: false, error: { code, message } }
```

| 规则 | 约定 |
| :-- | :-- |
| 解析基准 | `path` 为相对当前项目目录的相对路径（即 `node.ref.path` 原样） |
| 白名单 | 仅 `.json` / `.md` 扩展名；其余拒绝 `FORBIDDEN_FORMAT` |
| 沙箱 | 解析后绝对路径必须落在当前项目目录内；`../` 逃逸、绝对路径越界拒绝 `PATH_ESCAPE` |
| 上限 | 文件 >1MB 拒绝 `TOO_LARGE` |
| 不存在 | 返回 `NOT_FOUND`，renderer 呈现提示态不报错崩潰 |
| 无项目 | 当前无打开项目时拒绝 `NO_PROJECT` |
| 写能力 | **无**。只读；写产物永远是 agent 侧 MCP `file.write` |

实现位置：`electron/main.ts` 新增 handle，路径解析与校验优先复用 `electron/fs` 既有工具；preload 暴露 `fileRead({ path })`；`global.d.ts` 同步类型。

## 3. 新壳组件契约

| 组件 | 文件 | 职责边界 |
| :-- | :-- | :-- |
| StudioApp | `src/studio/StudioApp.tsx` | 唯一容器：订阅 runtime/canvas/gate；三栏布局；持有 viewer 打开态（`nodeId` 或 null） |
| ProjectNav | `src/studio/ProjectNav.tsx`（新） | 项目列表/新建/打开；不持有业务状态，打开后由 `canvas:changed` 驱动刷新 |
| CanvasBoard | `src/studio/CanvasBoard.tsx`（改） | 增 `onOpenNode(node)` 可选回调；节点有 `ref.path` 时可点击（视觉 hover 态）；其余渲染逻辑不动 |
| ChatComposer / GateCardView | 既有 | 不改行为，仅布局落位右栏 |
| StudioViewer | `src/studio/StudioViewer.tsx`（新） | 只读：经 `file:read` 取内容，JSON 美化（`JSON.stringify(_, null, 2)`）/ MD 按纯文本等宽渲染；关闭返回画布；无编辑、无保存 |

组件命名映射 016 OD 概念：ChatComposer≈ChatStream、CanvasBoard≈CanvasView、GateCardView≈GateCard、StudioViewer≈Viewer——**不重命名既有文件**。

## 4. 旧壳删除白名单（代码，FR-5）

白名单之外一律不动；白名单内一律删净（含专属测试）。

**入口与容器**：`src/App.tsx`、`src/studio/RootSwitch.tsx`

**旧组件**（`src/components/`）：`ChatPanel.tsx`、`GateCard.tsx`、`ProductViewer.tsx`、`ProjectSidebar.tsx`、`BackgroundArchive.tsx`、`IdeaEditDialog.tsx`、`PreflightCard.tsx`、`ReferenceImages.tsx`、`StyleCatalogPage.tsx`、`messages/` 整目录、`runtime/` 整目录，及以上专属测试（`ChatPanel.test.tsx`、`GateCard.test.tsx`、`ProductViewer.test.tsx`、`StyleCatalogPage.test.tsx`、`feature005-ui.test.tsx`、`feature006-canvas.test.tsx`）

**旧 lib**（`src/lib/`）：`workflow.ts`、`gates.tsx`、`replay.ts`、`revision.ts`、`candidates.ts`、`superseded.ts`、`deriveFiveElements.ts`、`preflight.ts`、`viewer.ts`、`messages.ts`、`ref-images.ts`、`styleCatalogView.ts` 及各自专属测试
> 保留：`chat-runtime.ts`、`runtime-types.ts`（新链路在用，不动）。

**App 级旧测试**：`src/App.catalog.test.tsx`、`src/App.error-envelope.test.tsx`、`src/App.restore.test.tsx`、`src/App.revision.test.tsx`、`src/feature006-ui.test.tsx`、`src/test/gates.test.tsx`、`src/test/preflight.test.ts`、`src/test/ref-images.test.ts`、`src/test/styleCatalogView.test.ts`、`src/test/runtime-mock.ts`（删除前 grep 确认无新链路引用，有则先改引用再删）

**主进程旧模块**：`electron/session.ts`、`electron/prompts.ts`、`electron/style-catalog.ts`（删除前 grep 确认无存量 import；有残留引用先解耦再删）

## 5. 旧 IPC 删除白名单（FR-6）

| 删除 handle | 说明 |
| :-- | :-- |
| `project:save` | 旧壳立项快照 |
| `session:start / session:current / session:read-finalized` | 旧壳会话 |
| `chat:append / chat:load / chat:clear` | 旧壳对话持久化 |
| `archive:save / archive:read` | 背景档案 |
| `workflow:save / workflow:load` | 旧壳工作流快照 |
| `template:save / template:list` | 模板（随功能删除） |

同步删除 `preload.ts` 对应暴露与 `global.d.ts` 对应类型；保留 handle 一行不动。

## 6. 行为契约（转正后）

1. **启动**：`main.tsx → ErrorBoundary → StudioApp`；无 RootSwitch、无"返回旧版"。
2. **恢复**：启动经 `canvas:get` 恢复画布；`pendingFromCanvas` 恢复 pending 门；对话区为空（D-022-02）。
3. **项目切换**：`project:open` 后主进程重挂项目上下文，`canvas:changed` 推送新画布；renderer 清空对话区与 viewer 态。
4. **门**：行为与 019-021 验收态完全一致；本切片不改 `gate:decide` 语义。
5. **viewer**：同一时刻至多一个；切项目/重启即关闭。

## 7. 测试契约

| 层 | 断言 |
| :-- | :-- |
| `file:read` 单测（主进程侧或集成） | 正常读 json/md；逃逸/越界/非法扩展名/超限/不存在/无项目六类拒绝 |
| `studio-flow.test.tsx` 扩展 | 三栏渲染；项目列表渲染与打开调用；节点点击开 viewer；viewer 内容来自 `file:read` mock |
| `architecture.test.ts` | 自动覆盖 studio 新增文件（目录扫描既有机制），无需改断言 |
| 真机（AC-6） | 0→2 步全链路：门齐、rejected 同 id 重开、产物落盘、重启恢复 pending 门 |

## 8. 异常与边界

- `project:list` 为空 → 左栏呈现"新建项目"引导态。
- `project:open` 失败 → 左栏就地错误提示，不崩潰、不退出当前项目。
- `file:read` 任何拒绝 → viewer 内提示态（错误 message），不弹系统对话框。
- canvas 推送与 `canvas:get` 竞态：以推送为准（既有语义，沿用）。
