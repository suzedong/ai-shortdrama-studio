# feature-015 确认门非阻塞化与系统直做后置 · 变更记录

> 三分类：决策记录（永久）/ 实施记录（落地后补）/ 修订记录（决策稳定后清理）。

## 一、决策记录（卡口，永久保留）

### D-015-0 · 问题定性与方案分档（2026-11-01）

- 触发：真机对话流连续出现 `MCP error -32001: Request timed out`，Agent 反复「发门 → 超时 → 读画布 → 重挂」。
- 根因：`gate.request` 是阻塞等待用户裁决的工具，而 opencode 对 MCP 调用有 180s 硬超时（`SHORTDRAMA_MCP_TIMEOUT_MS`）。等人拍板必然超时，属结构性冲突而非偶发故障。
- 附带缺陷：每次超时重挂在 `GateBridge.pending` 留下永不清算的 entry（内存泄漏）。
- 方案分档：A 调超时（不治本）／B 改协议非阻塞／C 提示词规避（现状）。用户选 B，并进一步选「系统直做后置动作」的彻底版，依据 D-016「确定性操作由系统直做，不经 AI 对话」。

### D-015-1 · 三项口径拍板（2026-11-01 用户明示）

1. **0-final 发门时把结构化草案随门落盘**（`payload.draft`）——系统直发的唯一数据源。
2. **1-a~2-b 四门只由系统推进 manifest**，产物正文与画布节点仍由 Agent 落盘（正文只在 Agent 上下文，主进程无从获取，不塞门 payload）。
3. **保留口头拍板（verbal）通道**：`brief.publish` 工具不动，feature-807 四码防护原样生效。

### D-015-2 · 卡口性质：K8 触发，K1 不触发

- K8：既有 `gate.request` 返回契约由「阻塞至裁决」改为「立即返回 pending」；`0-final` 门 payload 增 `draft` 键。批准本包 5 文件即视为对该契约变更的显式批准。
- K1 不触发：`CanvasGate.payload` 类型本为 `unknown`，草案经 payload 携带；`gate:changed` 的 `execution` 是 IPC 推送体，不进 shared。
- 工具总数 29 不变、无新 IPC 通道、无新依赖。

### D-015-3 · 失败分类：草案问题回退 pending，执行故障保持 approved

- 草案缺字段 / 版本不符 / 风格非法 → 门授权内容本身不完整，回退 pending 让用户修正后重新发门。
- harness blocker / 磁盘异常 / manifest 乱序 → 门已合法授权，是执行故障，保持 approved 并推送原因，不走「撤销裁决」。
- 历史无草案**首版**门：点通过不直发，推送 `GATE_DRAFT_MISSING`，由 Agent 走保留的 `brief.publish(by:'gate')` 兜底；再版无草案门不得走该兜底。

### D-015-4 · 不做「裁决后自动唤起 Agent」

点按钮后 Agent 不自动续跑，由用户下一句话触发；门卡显示系统执行结果。自动唤起属另一机制（消息泵 / 主动推送），不在本包范围。

### D-015-5 · 首版直发，再版保留 commit（2026-11-01 用户拍板）

- 首版 v1：按钮通过后，系统校验草案与 harness，直接发布 `立项单.v1.json/md`、upsert `step-0-brief` 并推进 `brief-published`。
- 再版 v2+：按钮只确认草案与版本，系统不发布、不推进 manifest；Agent 下一轮读取 approved 后先呈报取消 / 仅标记 / 重生成三选一，再由 `impact.commit` 唯一发布、写影响清单并挂脏。
- 理由：避免系统直发与 Agent commit 双写两个版本，并保持再版影响评估基线及用户三选一裁决点不变。

## 二、实施记录（落地后补）

### I-015-1 · T1–T6 代码与定向验证（2026-11-01）

- 非阻塞协议：`gate.request` 立即返回 pending；`GateBridge` 删除跨调用等待 Promise，以 live 索引 + deciding 集合支持重开、恢复、幂等裁决和并发防重；项目切换 / 关窗只清 live，不触发后置动作。
- 系统后置：新增 `electron/gate/execute.ts`。首版直发、再版仅确认；`1-a~2-b` 固定映射推进 manifest；草案问题回退 pending，harness / 磁盘 / manifest 故障保持 approved 并推送 execution；历史无草案兜底仅限首版。
- 工具与界面：`0-final` 强制完整 `payload.draft`；复用既有 `gate:decide` / `gate:changed` 透传 execution；门卡展示成功、失败与继续提示，仅 pending 门显示口头拍板提示。工具总数 29、无新 IPC、shared/types.ts 零改动。
- Agent 职责：showrunner 发门即收尾；首版按钮路径不重复 publish / advance，再版仅三选一后 commit，四门不重复 advance；verbal 与历史首版兜底保留。其余三个 Agent 提示词未改。
- 定向测试：执行器 12/12、门桥 9/9、门卡 6/6、编排契约 13/13，合计 **40 passed / 0 failed**。全量回归与 typecheck 结果见 I-015-2。

### I-015-2 · 全量验证与 AC 自检（2026-11-01）

- 同步 feature-012 两处旧门卡文案断言后，定向回归 **2 文件 12 passed / 0 failed**；仅保留既有 React `act(...)` 警告，无行为失败。
- 先执行 `npx tsc -b` 重建 Electron 声明，再执行 `npm run typecheck`：门桥 / 执行器新增类型错误全部消失，恰好保留 **3 条历史基线**（canvas-zoom 2 条、runtime-client 1 条），本包零新增。
- 全量 `npm run test:run`：**78/78 文件通过，973 passed / 0 failed / 1 skipped（共 974）**。
- AC1–AC9 自动化与代码审查均满足：立即返回、首版直发 / 再版不双写、失败分类、四门映射、并发幂等、清场无后置、无跨调用等待 Promise、verbal 防护回归及全量验证均已覆盖；真机交互验收仍待用户执行，不记为真机闭环。
