# feature-801 manifest 状态机推进 · 变更记录

> 三分类：决策记录（永久）/ 实施记录（落地后清理）/ 修订记录（决策稳定后清理）。

## 一、决策记录（K 卡口，永久保留）

### D-001 · K1 批准修改共享层 `shared/types.ts`（2026-10-13）

- **触发**：manifest 7 态状态机必须在共享层新增 `ManifestStatus / ManifestEvent / ManifestTick / ProjectManifest` 四类型，并删除历史 `Stage` 10 态联合、改 `UnlockData.downstream`，命中 K1（共享层修改须用户批准）。
- **批准方式**：任务包 5 文件建齐后在 K1 卡口呈报契约 §6 字段方案与 D-002~D-004 四项包级选型，AskUserQuestion 用户选定「批准，开始编码」，即视为对本包 K1 范围（含同轮 T1→T8 编码）的显式批准。
- **批准范围**（以 [契约 §6](./SDG-RE-契约.md) 为准）：
  1. 新增 `ManifestStatus`（7 态，逐字采用设计书 §7.1 L581-582）、`ManifestEvent`（6 事件）、`ManifestTick`、`ProjectManifest`；
  2. 删除 `Stage` 联合及其 L3-4 历史注释；
  3. `UnlockData.downstream: Stage[]` → `string[]`（该接口现全仓零消费，无行为波及；语义留待 feature-002 按 CanvasNode.id 重构）；
  4. 连带代码动作：library.ts 删 `initialNodes()` 并改写 createProject manifest 字面量；删除死组件 StageCanvas.tsx；tools.ts 注册两工具（14→16）；provider.ts showrunner 白名单 9→11。
- **不在批准范围**：`RevisionSource / GateId / NodeStatus / StepId / CanvasNode / Canvas / ProjectSession / MessageKind` 一律不动；gate/bridge、canvas store、事件投影、IPC、renderer（除删 StageCanvas）零改动。

### D-002 · 状态推进机制拍板：显式 MCP 工具，不做事件自动投影（2026-10-13）

- **候选**：① 新增显式工具 `manifest.advance`，由 showrunner 在定稿点调用；② 订阅 runtime 事件（EventProjector / gateBridge / canvasStore）自动投影推进。
- **选定 ①**。理由：
  1. 贴设计书原文——L554 manifest 是「阶段状态指针」、推进方式为「读-改-写」，显式工具是该原文的直接实现；
  2. 与门机制解耦——工具不校验门状态、不读 bridge（沿用 feature-001 brief.publish 边界），门被 reject 不产生推进，调用时机由 showrunner 纪律 + 编排测试约束；
  3. 可编排测试——每次推进是 Agent 脚本中可断言的一次工具调用（契约 §10 次序断言），自动投影则需伪造事件流、耦合投影内部；
  4. 不新增第二条写路径——画布投影/SSE 现有基础设施零改动。
- **影响**：新增工具 2 个（含只读 `manifest.get` 供恢复与查询，而非只加 advance）；provider 白名单按 feature-001 T5 先例补登。

### D-003 · `initiating` 语义与重复调用幂等拍板（2026-10-13）

- `initiating` 覆盖 STAGE 0 全程；仅立项单**首版**定稿（brief.publish 返回 `version===1`）后由 showrunner 调 `brief-published` 推进首格。立项后变更（v2+，feature-002 范畴）**不**推进、**不**重复留痕。
- 同一事件在 `to` 态重复调用 → 工具返回 `{ok:true, advanced:false, reason:'already-there'}`，**不写文件、不追加 tick**（契约 §2 纯函数判定）。showrunner 将 already-there 视为回合重入的正常情形；乱序返回 `MANIFEST_BAD_TRANSITION`、终态返回 `MANIFEST_TERMINAL`，必须向用户报告，不静默继续。
- 最后一格 `script-storyboard → storyboard-done` 对应 `storyboard-finalized`（2-c 门），随 feature-201 激活；本包只交付机制与 showrunner 预留语，不产分镜、不建 2-c 动作。

### D-004 · 旧 manifest 历史骨架字段处理拍板：读透传 / 不迁移（2026-10-13）

- 旧 12 骨架字段（phase/nodes/pendingGate/redoGate/storyRedo/scriptRedo/activeUnlock/activeDraft/feOverride/preflight/saved）：**新项目不写**（createProject 只产 §1 五字段）、**读时透传**（parseManifest 以 `...rest` 保留未知字段，类型层不声明）、**不做离线迁移**。
- 旧项目仅在首次成功 advance 时被整文件改写，届时历史字段作为未知字段继续留在文件中；不设 schemaVersion，新旧靠「是否存在 statusHistory 数组」运行时判定。
- 理由：历史字段经全仓 grep 确认除 createProject 写入与 listProjects 读 createdAt 外零消费，迁移无收益且违背「纯 JSON、无迁移脚本」的项目最小复杂度原则。

## 二、实施记录（过渡）

- 2026-10-13：任务包 5 文件建立（需求规格 / 契约 / 任务清单 / 设计说明 / 本记录）。K1 未批准前不触碰任何代码。
- 2026-10-13：K1 卡口经 AskUserQuestion「批准，开始编码」通过（D-001 批准方式即本条），T1→T8 一次授权。
- 2026-10-13：T1 [shared/types.ts](../../../shared/types.ts) 落地——新增 4 类型、删 `Stage` 及其历史注释、`UnlockData.downstream` 改 `string[]`；T2 新增 [manifest.ts](../../../electron/project/manifest.ts)（跃迁表 + 纯函数 `advanceStatus` 三返回 advanced/already-there/bad-transition/terminal + parseManifest 容错 + 单 enqueue 读-改-写），[library.ts](../../../electron/project/library.ts) createProject 改 7 态形状、删 `initialNodes()` 与 11 个骨架字段；`manifest-state.test.ts` 21 例全绿。
- 2026-10-13：T3 [tools.ts](../../../electron/mcp/tools.ts) 注册 manifest 第七族两工具（14→16）：get 返回 `{manifest}`；advance zod 6 事件枚举，bad-transition/terminal 映射 `MANIFEST_BAD_TRANSITION`/`MANIFEST_TERMINAL`，无激活项目经 `activeDir()` 包装映射 `NO_ACTIVE_PROJECT`；`mcp-manifest-tools.test.ts` 8 例（落盘/幂等不写/乱序/终态/无项目/非法事件）全绿。
- 2026-10-13：T4 白名单三层同步——[provider.ts](../../../electron/runtime/provider.ts) showrunner 集合 9→11；agent-profiles 静态测试（点号键白名单改 5 键、9→11 物理工具）、runtime-client 放行用例、runtime-integration 字母序清单各同步。
- 2026-10-13：T5 删 `src/components/StageCanvas.tsx`（删前文件名+组件名双 grep 零 import，删后 `\bStage\b`/StageCanvas/initialNodes 三 grep 零生产残留）；`tsc -b tsconfig.node.json` 重建后 typecheck 仅剩 7 条本包未触碰文件的基线错误（dev-mock-api L217、CanvasBoard L789 ×2、VisualCatalog ×4），本包零新增。
- 2026-10-13：T6 [showrunner.md](../../../resources/opencode/agents/showrunner.md) 按契约 §7 九行落地——frontmatter tools/permission 各加两键；职责纪律第 8 条「状态机纪律」；第 0/1/2 步恢复段加 manifest.get + status→续跑位置对照；publish v1 后两路径（门批准/口头拍板）各接 brief-published，明示 v2+ 不调；1-a/1-b/2-a/2-b 四收尾各接对应 advance；新增第 2 步第 7 条 2-c 预留（不产分镜、不发门、不调 storyboard-finalized）。grep 自验六事件名仅出现在指定位置。
- 2026-10-13：T7 `orchestration.test.ts` 新增 5 例契约断言（全链 5 事件次序且晚于对应门末次 gate.request、双 rejected 仍恰 4 事件零额外、未就绪/单次 0-final rejected 零 advance、v2 两路径零 advance、partial 至 1-b 恰 3 事件），全文件 11 例全绿。
- 2026-10-13（实施说明 · LF 归一）：agent-profiles 静态测试的 frontmatter 解析正则只认 LF，而 Windows 工作区 4 个被测 profile（showrunner/writer/media-director/comfyui-operator）检出为 CRLF（git 仓内本为 LF，无 .gitattributes 归一属性），导致 8 例中 7 例在**本机基线即失败**（经 `git stash -u` 还原 HEAD 对照复现确认，非本包引入）。将 4 文件工作区归一为 LF / UTF-8 无 BOM（对 git index 无内容 diff），8 例全绿；director.md 不在被测清单，未动。
- 2026-10-13（**全量验证结论**）：`npm run test:run` = **249 passed / 7 skipped / 12 failed（28 文件）**。12 个失败经 stash HEAD 同机对照全部为基线既有，本包零新增、零扩大：studio-flow.test.tsx 10 例、architecture.test.tsx 1 例（feature-001 记录的既有 11 例），另查明 fs-sandbox.test.ts 1 例（POSIX 风格 `/tmp/...` 在 Windows `path.sep='\\'` 下 resolve 越界，跨平台既有缺陷）与 runtime-integration T8-1/T8-2 套件 1 例（依赖本机真 opencode serve 环境）此前在本机记录中漏记，本次补登。本包净增 34 个通过用例（manifest-state 21 + mcp-manifest-tools 8 + orchestration 5），另 agent-profiles 7 例随 LF 归一转绿。
- 2026-10-13：T8 治理收尾——features/README 801 行标 ✅（技术落点补 manifest.ts/16 工具/Stage 清退）、§2 工具数 14→16 与画布条改 canvas.json 节点模型；偏差清单 B-04/B-09 标 ✅、渲染器清单删 StageCanvas；feature-001 变更记录加 R-001 交叉指针；本记录闭环。

## 三、修订记录

- 2026-10-13：feature-001 契约 §3.2 第 7 条 / D-003「publish 不推进 manifest.status」联动修订已按契约 §11 落定——publish 工具代码零改动，首版定稿推进由 showrunner 随后显式调 `manifest.advance({event:'brief-published'})` 完成（仅 v1）；交叉指针已记入 [feature-001 变更记录 R-001](../feature-001-立项模型重建/SDG-AI-变更记录.md)。
- 2026-10-14（feature-002 联动）：本包 D-001 批准建立的 `ProjectManifest` 类型被 [feature-002](../feature-002-立项后变更与影响评估/) 经其 K1 追加**单字段** `briefVersion?: number`（最新已发布立项版本指针），§1 五字段形状、7 态跃迁表、读-改-写与 tick 机制零改动；再版（v2+）不触发 `brief-published` 的 D-003 口径由 feature-002 showrunner 再版六步剧本兑现。交叉指针：[feature-002 变更记录](../feature-002-立项后变更与影响评估/SDG-AI-变更记录.md)、[偏差清单 B-03](../../设计现状与偏差清单.md)。
