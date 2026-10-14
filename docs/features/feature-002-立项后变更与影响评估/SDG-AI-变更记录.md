# feature-002 立项后变更与影响评估 · 变更记录

> 三分类：决策记录（永久）/ 实施记录（落地后清理）/ 修订记录（决策稳定后清理）。

## 一、决策记录（K 卡口，永久保留）

### D-001 · K1 + K8 联合报批：三字段 + 三工具（待批准）

- **触发**：
  - **K1**：[shared/types.ts](../../../shared/types.ts) 三处改动——`ProjectManifest.briefVersion: number | null`；`CanvasNode.parentReference?: { briefVersion; fields[] }`（新增 `CanvasParentReference`）；`CanvasNode.dirty?: { sinceBriefVersion; latestBriefVersion; fields; severity; impactReport }`（新增 `CanvasDirty`）；另更新两条 002 待办注释（不改 RevisionSource/UnlockData 形状）。D-013-4 明示该 K1 字段方案须先行报批。
  - **K8**：新增 3 个零 LLM MCP 工具（19 → 22）：`brief.impact.assess`（20，只读预评估）、`brief.impact.commit`（21，v2+ 发布+影响清单+挂脏）、`canvas.align`（22，对齐清脏）；provider showrunner 白名单 14 → 17；canvas.update（既有工具）zod 开放 parentReference 入参、store 增血缘/脏字段保留语义。
- **批准方式**：任务包 5 文件建齐后，以 AskUserQuestion 呈报本 D-001 与 D-002~D-007 包级选型；用户选定「批准，开始编码」即视为对 K1 字段形状 + K8 工具范围（含同轮 T1→T9）的显式批准。批准前不触碰任何代码。
- **批准范围**（以 [契约](./SDG-RE-契约.md) 为准）：契约 §1 全部 K1 字段；§2 纯函数；§3 落盘形状（`影响清单.vN-vM.json`）；§4 三工具与 canvas.update 微调；§5 字段表纪律；§6 renderer 三标识；§7 登记面；§8 三个新错误码。
- **不在批准范围**：弹窗面板与交互按钮、产物内部 parentReference 强制、STAGE 1–7 自动重生成编排、RevisionSource 扩 0-final、30 天漂移提醒、清单 md、立项单 schema/diff 变更、IPC/preload、打包配置、其他 agent 文件。
- **状态**：✅ 已批准（2026-10-14 K1+K8 卡口 AskUserQuestion 四项全部选定推荐项；D-002~D-007 同轮获批，T1→T9 开始执行）。

### D-002 · parentReference 挂载位置拍板：CanvasNode，不强制产物内部（2026-10-14 拟定，待批）

- **冲突**：设计书 §2.6.7 追溯算法写「从 `project.manifest.json` 的 `nodes[*].parentReference` 出发」，脏读又写「产物内部 `parentReference`」；但 B-09 后事实是 manifest 无 nodes（7 态状态指针），节点在 canvas.json；产物 JSON 由 writer 经 file.write 自由写、平台不解析。
- **裁决**：血缘挂 `CanvasNode.parentReference`（契约 §1.2），由 showrunner 定稿时按字段表（契约 §5）声明；manifest.nodes 旧表述以 §7.1「字段契约以 shared/types.ts 为准」收口；产物内部 parentReference **不要求、不校验、不读取**。理由：平台唯一可强制的写点是 canvas 工具链；解析各产物内部会让平台与 STAGE 1–7 自由 JSON 形态强耦合。
- 差异记名：偏差清单 B-03 处理备注 + 本记录；不回改设计书。

### D-003 · 影响清单路径拍板：项目根 + ASCII 连字符（2026-10-14 拟定，待批）

- 设计书写 `立项/影响清单.vN→v(N+1).json`。实况：立项单自 feature-001 起即在项目根（`立项单.vN.json`，§7.1 L555 目录树同口径），「立项/」子目录从未存在。
- 裁决：落项目根 `影响清单.vN-vM.json`（如 `影响清单.v2-v3.json`）：① 与立项单同目录，列举/回溯简单；② 箭头 `→` 换 ASCII `-`，规避 Windows 文件系统与 resolveInside 沙箱/opencode 工具链 Unicode 文件名风险。不建 `立项/` 子目录（避免为单一文件造目录且与立项单分离）。形态差异记名，不回改设计书。

### D-004 · 三选一中「一键重生成」的本包语义拍板（2026-10-14 拟定，待批）

- 冲突：设计书语义是 commit 后平台执行重生成；但 STAGE 3–7 无代码（B-06），STAGE 1–2 亦无编排器，本包无法真正“一键”。
- 裁决：regenerate 与 mark 两类决策在 commit 中**都先挂脏**；commit 返回 `regenerate[]` 工作队列，showrunner 串行委派重生成、每个定稿后调 canvas.align 清脏推进版本。即“一键”=一次决策 + Agent 队列执行，平台不内置编排器。未生成节点不在清单（其首次定稿直接挂新版血缘）。自动编排器留待 STAGE 1–2 包或后续编排包。

### D-005 · 交互承载拍板：三选一走对话，不做 renderer 弹窗（2026-10-14 拟定，待批）

- 裁决：影响评估呈现与三选一由 showrunner 在对话中完成（与 feature-001 定案门同一承载模式）；renderer 本包只做被动标识（脏角标 / `vN ⚠️k` / 纯文本黄条），无按钮无 IPC。设计书面板草图待 renderer↔主进程通道包承接。理由：renderer 无 MCP 调用通道，弹窗需要新增整条 IPC 链，超出 B-03 缺口。

### D-006 · 分级映射与 kind/diagnosisSummary 归类拍板（2026-10-14 拟定，待批）

- high = premise.* / style.mainStyleId / style.catalogVersion / fiveElements.aspectRatio（默认 regenerate）；medium = episodeCount / episodeDuration / genre / tone / platforms / auxiliaryStyleId / **kind** / **diagnosisSummary**（默认 mark）；low 级别保留但现状零字段命中（立项模型无 L0；项目名在 .session.json）。
- catalogVersion 归 high：与 mainStyleId 成对，版本漂移即风格基线漂移（802 语义）。kind 归 medium：商业/纪念影响受众与基调表达但非叙事核心。diagnosisSummary 归 medium：诊断案例与提示词参考，不影响已生成叙事结构。

### D-007 · 脏态与既有 invalidated 正交、commit 画布单次写盘（2026-10-14 拟定，待批）

- dirty 不改 status（恒保持 done）、不灰显；invalidated（红/opacity-60/硬失效）语义不动，两态可共存于不同节点、互不转换。
- commit 内多节点挂脏 + brief 节点 upsert 合并为**一次** canvasStore persist（一次 canvas.json 归档），通过新增的画布批量变更入口实现；publish 共享主体改为返回节点 patch 由外层统一落画布。
- manifest 再版只推进 briefVersion/updatedAt，不追加 statusHistory（再版不是阶段推进事件）；v1 publish 同机制写 briefVersion=1，状态机推进仍只由 Agent 在 v1 调 manifest.advance。

## 二、实施记录（过渡）

- 2026-10-14：建包前调研完成（跨上下文两会话）——版本化立项链路（plan/diff/render-md/publish handler）、manifest 7 态与 parseManifest 容错、canvas upsert 整体替换语义、19 工具注册面、provider 白名单、showrunner/writer 纪律、renderer 版本 badge 与 invalidated 渲染点、静态契约测试（agent-profiles/mcp-pure-tools/runtime-*）、802 包五文件写法先例；测试基线核实 302/7/12 + typecheck 7。
- 2026-10-14：任务包 5 文件建立（需求规格 / 契约 / 设计说明 / 任务清单 / 本记录）。K1/K8 未批准前不触碰任何代码。

## 三、修订记录

（落地后回填；预期含：feature-001/801 交叉指针登记、设计书两处形态差异在偏差清单的记名位置。）
