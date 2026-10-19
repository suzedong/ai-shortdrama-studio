# SDG-OD-设计说明 · feature-004 立项单历史与回滚

## 1. 落点架构

```
renderer                                   electron 主进程
─────────────────────────────────────────────────────────────
StudioViewer (brief)                       electron/brief/
  └ [查看历史] brief-history-entry          ├─ plan.ts   listBriefVersions ─┐复用（零 diff）
  └ BriefHistoryView（新）                  ├─ diff.ts   diffBrief ─────────┤
     ├ 版本列表  ◄── brief:history ───────► ├─ history.ts（新）getBriefHistory
     ├ 两栏 diff ◄── brief:version-read ──► │                readBriefVersion(+diffToLatest)
     └ 回滚确认  ◄── brief:rollback ──────► ├─ rollback.ts（新）rollbackBrief
                                            │     └ 编排复刻 update.ts：enqueue{
                                            │         publishBriefFiles → 画布 upsert → manifest 指针 }
                                            ├─ publish.ts publishBriefFiles ─┘复用（零 diff）
                                            └─ main.ts +3 handle / preload.ts +3 桥
```

- **通道定性（D-016）**：三条 IPC 均为系统直改/直读通道，与 Agent 的 brief.* MCP 工具族平行，互不修改；回滚不经过定案门（门管 Agent 发布，系统原位编辑与回滚属用户直操作，与 brief:update 同权）。
- **回滚语义**：发布新版而非时光倒流。`立项单.v(N+1)` 的业务字段逐字段 = vK；`version/publishedAt/approve/changesFromPrevious` 为新版自身元数据；approve.note 记「回滚自 vK」使历史列表可辨识。
- **diff 方向**：`diffToLatest = diffBrief(vK, 最新)`——from 恒为选中历史版值、to 恒为最新版值，摘要条读作「vK → 最新」。

## 2. 关键决策

| # | 决策 | 理由 |
|---|---|---|
| D1 | 入口落 StudioViewer brief 视图，不动对话内定案卡 | 查看历史是查看动作，查看器是自然落位；定案卡形态属门体系（806 范畴） |
| D2 | 右栏恒为最新版，不做任意两版互比 | 设计原文即「vN vs v(N+1)」语义；任意对比为增强切片，避免本包膨胀 |
| D3 | 回滚复用 publishBriefFiles 而非新写发布路径 | 版本号分配/防覆盖/双写/changesFromPrevious 单点事实源；回滚与正常发布的落盘形状零差异 |
| D4 | 回滚后不做影响清单面板 | 002 脏读黄条（parentReference.briefVersion）已自动覆盖下游提示；assess/commit 工具链保持 Agent 通道原样 |
| D5 | changeCount 逐版读全文提取 | 版本数为个位数量级、文件 KB 级；不换 listBriefVersions 零改动的红线 |
| D6 | DTO 落 window.api 类型镜像，不进 shared/types.ts | ProjectBrief/BriefChange 已在 shared 且不变；新增 DTO 仅 IPC 面消费，同 808 先例，K1 零触发 |

## 3. 文件白名单

**新增（5）**：`electron/brief/history.ts`、`electron/brief/rollback.ts`、`src/studio/BriefHistoryView.tsx`、`src/test/brief-rollback.test.ts`、`src/studio/brief-history.test.tsx`
**修改（≤6）**：`electron/main.ts`、`electron/preload.ts`、window.api 类型声明文件、`src/studio/StudioViewer.tsx`、`src/dev-mock-api.ts`、（如需）`src/studio/CanvasBoard.tsx`（dirtyFieldLabel 抽共享后的 import 改点）
**文档（4）**：本包 5 文件、`docs/features/README.md`、`docs/设计现状与偏差清单.md`（B-37）、`版本记录.md`

## 4. 风险与边界

| 风险 | 处置 |
|---|---|
| 回滚期间 Agent 正在对话中发布新版（并发） | 写队列串行化既有保证；版本号以磁盘扫描为准，后发者顺位 +1，不覆盖 |
| 用户回滚后 Agent 上下文仍引用旧版号 | 可接受：Agent 侧 brief.plan/list 以磁盘为准自愈；画布脏读提示用户 |
| 历史版 schema 漂移（v1 老形状） | readBriefVersion 原样透传 + ProjectBrief 运行时读取沿用 Stage0View 既有容错（UNSUPPORTED_SHAPE 凭据态），不静默修补 |
| diff 字段标签缺失（新字段未登记 dirtyFieldLabel） | 标签回退字段路径原文，不阻断渲染 |
