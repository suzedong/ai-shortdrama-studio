# feature-001 立项模型重建 · 任务清单

> 执行依据：[需求规格](./SDG-RE-需求规格.md) + [契约](./SDG-RE-契约.md)。任务按顺序执行；每项给出改动面与自验方式。
>
> 卡口：本包修改 `shared/types.ts`（K1 共享层），已由用户在 2026-10-13 显式批准（「P0 任务包 + 直接开始编码」），决策留痕见 [SDG-AI-变更记录.md](./SDG-AI-变更记录.md) D-001。

## 0. 上下文加载清单（工作围栏）

- [x] `AGENTS.md` + `docs/governance/AI-SDG-AI工具执行指令.md`
- [x] `短剧Agent平台设计.md` §2.6（L116–347）、§7.1（L546–600）
- [x] 本包 `SDG-RE-需求规格.md` / `SDG-RE-契约.md`
- [x] `shared/types.ts`（全文）
- [x] `electron/mcp/tools.ts`、`electron/project/library.ts`、`electron/gate/bridge.ts`
- [x] `resources/opencode/agents/showrunner.md`
- [x] `src/studio/`：StudioApp / StudioViewer / CanvasBoard / StageNavPanel / GateCardView / ChatComposer / Stage0View
- [x] 受影响测试：orchestration / story-orchestration / script-orchestration / studio-flow / mcp-pure-tools（如存在）/ canvas-board

围栏外文件不动（main.ts / preload.ts / bridge.ts / canvas store / write-queue / archive / sandbox 本包零改动）。

## 1. 原子任务

### T1 · 共享层类型重建（K1）
- 改 [shared/types.ts](../../../shared/types.ts)：
  - 新增 `ProjectKind / StoryPremise / BriefStyle / BriefApprove / BriefChange / BriefMissingCode / BriefMissing / BriefPlan`（契约 §1、§2）。
  - 整体替换 `ProjectBrief` 为 v2；删除 `PreflightCheck`。
  - `GateId` 改为 `'0-final' | '1-a' | '1-b' | '2-a' | '2-b' | '2-c'`；`RevisionSource` 删 `'0-c' | '0-d'`。
  - 删除旧 `GateCard` 与 `ChatMessage.gate?`；`Stage` 保留加「历史骨架专用」注释；`CanvasGate.gateId` 注释更新。
  - `MessageKind` 中 `'preflight'` 旧项：检查消费面后删除（若无生产消费）；`'brief'` 保留（语义=立项单卡）。
- 自验：`tsc --noEmit`（或项目既有的 typecheck 脚本）通过；按报错清单修编译断点。
- AC：契约 §6 表格逐行落实；类型层不再出现 `0-a/0-b/0-c/0-d`。

### T2 · 立项纯逻辑：diff + 就绪校验 + 版本扫描
- 新增 `electron/brief/diff.ts`：`diffBrief(prev, draft): BriefChange[]`（契约 §5，纯函数）。
- 新增 `electron/brief/plan.ts`：
  - `evaluateBrief(draft): { missing: BriefMissing[]; pendingMarks: string[] }`（契约 §2）。
  - `listBriefVersions(): Promise<{versions; latestVersion; warnings}>`（正则 `^立项单\.v(\d+)\.json$` 扫项目根一层）。
  - `nextBriefVersion()` / `readLatestBrief()` 复用扫描结果。
- 自验：新增 `src/test/brief-plan.test.ts`（或 electron 侧既有测试目录约定，先看现有测试布局）覆盖：全空缺失码齐全、「待定」不阻塞但进 pendingMarks、platforms 空数组判缺、v1 diff 为空、v2 字段级 diff、版本号扫描与乱序/损坏文件。
- AC：AC2 的判定逻辑全部有单测。

### T3 · MD 镜像渲染
- 新增 `electron/brief/render-md.ts`：`renderBriefMd(brief: ProjectBrief): string`（契约 §4 固定区块）。
- 自验：单测断言 v1 标题、六要素 6 行、前提 5 行、口头拍板原话、「相对上一版改动」首版文案。

### T4 · MCP 工具注册（11 → 14）
- 改 [electron/mcp/tools.ts](../../../electron/mcp/tools.ts)：注册 `brief.plan` / `brief.publish` / `brief.list`，zod 入参严格按契约 §3；文件头注释工具数改 14。
- publish 要点：enqueue 串行；就绪失败 `BRIEF_NOT_READY`；verbal 缺原话 `INVALID_ARGUMENT`；版本号只信磁盘扫描；json+md 双写、目标已存在 `BRIEF_VERSION_EXISTS`、**不调 archiveExisting**；写后 `canvasStore.update` upsert `step-0-brief`（title/ref/meta.version）；不碰 manifest。
- 自验：扩展/新增 mcp 纯工具测试：plan 返回结构；publish v1 落两文件 + 画布节点；publish v2 不覆盖 v1（读回内容不变）；未就绪被拒；verbal 无 quote 被拒；重复节点 id upsert 不产生重复节点。
- AC：AC3、AC4、AC5。

### T5 · showrunner.md 重写
- 改 [showrunner.md](../../../resources/opencode/agents/showrunner.md)：
  - 门总纪律：STAGE 0 仅 `0-final` 一道；门序列表更新。
  - 第 0 步剧本按「入口反问（商业/纪念，先记可提取事实，不落盘不建门）→ ①选题诊断+六要素草案（对话态）→ ②故事前提对话收敛（`file.write` 写 `故事背景档案.md`）→ 视觉风格只引用谱系 ID+版本 → `brief.plan` 自检；未就绪继续追问、不发门 → 就绪发 `gate.request('0-final')`（卡文含六要素/前提/风格/待定点/相对上版改动）→ approved 后 `brief.publish({approve:{by:'gate'}})`；用户口头确认则携 `verbal.quote` 直接 publish」。
  - 第 1/2 步：必需输入由 `立项/brief.json` 改为「`brief.list` 取 latestVersion → `file.read 立项单.vN.json`」；旧 `立项/视觉风格.json` / `立项/diagnosis.json` 写法删除；step-1-outline 的 linksTo 保持指向 `step-0-brief`。
- 自验：全文 grep 无 `brief.json`、`0-a`~`0-d`、`立项/视觉风格.json`、`立项/diagnosis.json`；门序列与契约 §7 一致。
- AC：AC1、AC6、AC7。

### T6 · 渲染端适配
- [StudioViewer.tsx](../../../src/studio/StudioViewer.tsx)：`BriefView` 按 ProjectBrief v2 重写（项目性质 / 六要素 / 故事前提 5 项 / 主风格 ID@版本 / 辅助 / 诊断摘要 / 拍板方式与原话 / 相对上版改动）；删除 preflight、benchmarkSummary、旧 visualStyle 块的引用；`VisualStyleView` 保留。
- [CanvasBoard.tsx](../../../src/studio/CanvasBoard.tsx)：KIND_LABEL 中 `brief: '创意简报'` → `'立项单'`；STEP_LABEL 补 `'7'` 键（顺手修正缺键，仅限一行）。
- [StageNavPanel.tsx](../../../src/studio/StageNavPanel.tsx)：用户可见「创意简报」措辞（如存在）→「立项单」。
- [StudioApp.tsx](../../../src/studio/StudioApp.tsx)：KIND_BY_STAGE 维持 `'0':['brief']`；Stage0View 传参 `briefVer` 逻辑不变；仅在编译断点名要求时最小修改。
- dev-mock-api.ts：删除旧 ProjectBrief 形态 mock（preflight/benchmarkSummary）与旧 `gate` 假消息，造一份 v2 mock brief（含 meta.version）。
- Stage0View.tsx：静态壳**不接 IPC**（需求 §4.2）；仅当其 GATE_DIFF 等静态文案含旧门/旧字段时最小措辞更新。
- 自验：typecheck + 渲染测试通过；UI 文案 grep 无「创意简报」。
- AC：AC3 的画布呈现；需求 §4.1 术语对齐。

### T7 · 测试同步
- 重写 `src/studio/orchestration.test.ts`：STAGE 0 新编排——反问不建门、plan 未就绪不发门、就绪发唯一 `0-final`、approved → `brief.publish`（而非 fileWrite brief.json）、画布 `step-0-brief` done + meta.version；口头拍板等价路径一条用例。
- `story-orchestration.test.ts` / `script-orchestration.test.ts`：仅在引用 STAGE 0 门 id / brief.json 处改（预期 1-a/1-b、2-a/2-b 用例不动）。
- `studio-flow.test.tsx`：门卡挂载用例的 `'0-a'` → `'0-final'`（两处 decide 断言同步）。
- 其余引用（canvas-board.test.tsx 已用 `step-0-brief`/「立项单」，核对即可）。
- 自验：全量测试命令通过 + 全仓 grep 确认生产代码/提示词无旧门 id。
- AC：AC7。

### T8 · 治理文档收尾
- [设计现状与偏差清单.md](../../设计现状与偏差清单.md)：B-01、B-02 标 ✅（附本包链接与落盘约定）。
- [docs/features/README.md](../README.md)：登记 feature-001 状态（已落地 / 日期）。
- 本包 `SDG-AI-变更记录.md` 补实施记录闭环注记。
- AC：导航文档与磁盘实况一致。

## 2. 产出物清单

| 产出 | 位置 | 状态 |
|---|---|---|
| 立项 diff/校验/扫描 | `electron/brief/diff.ts`、`electron/brief/plan.ts` | ✅ |
| 立项单 MD 渲染 | `electron/brief/render-md.ts` | ✅ |
| MCP 工具 ×3 | `electron/mcp/tools.ts`（brief.plan/publish/list） | ✅ |
| 共享类型 v2 | `shared/types.ts` | ✅ |
| Agent 提示词 | `resources/opencode/agents/showrunner.md` | ✅ |
| 渲染端适配 | StudioViewer / CanvasBoard / StageNavPanel / dev-mock-api | ✅ |
| 测试 | brief 单测（新增）+ orchestration/studio-flow 改写 | ✅（studio-flow 10 例基线故障另挂账，见变更记录 T7） |
| 治理文档 | 偏差清单 B-01/B-02、features/README、变更记录 | ✅ |

## 3. 不做（防止越界）

- 不动 gate 机制、IPC、preload、main、canvas store、写队列/归档/沙箱。
- 不做 B-03 影响评估、B-04 manifest 状态机、B-05 谱系校验、Stage0View 接 IPC、口头 NLP。
- 不迁移历史 `立项/brief.json`，不删旧文件。
