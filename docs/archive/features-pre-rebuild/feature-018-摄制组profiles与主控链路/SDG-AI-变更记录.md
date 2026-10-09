# SDG-AI 变更记录 · feature-018 摄制组 profiles 与主控链路

> 状态：**v1.2 已实施并通过真机验收**（自动验证全绿；2026-10-07 真机验收通过）
> 日期：2026-10-07
> 上游永久决策：[feature-016 SDG-AI-变更记录](../feature-016-架构重建总纲/SDG-AI-变更记录.md) D016 系列（已批准）
> 本记录登记 feature-018 落地所触发的卡口与"实施即过渡"事项。

---

## 一、卡口决策（本 Feature）

### D018-01 · K6 新增 Agent profile（4 个，016 已预批的具体化）

- **新增**：`showrunner`（primary，取代 director 的新主控）、`writer` / `media-director` / `comfyui-operator`（subagent）。
- 模板逐字采用契约 §3/§4；model 全部为 `ark/__ARK_MODEL_ID__`，启动注入机制沿用 feature-008。
- 委派关系固化为 showrunner `permission.task` 白名单（`*` deny + 三 allow），专职 agent 一律 task deny（单层委派）。
- 依据 016 D016 系列对摄制组角色与边界的预批；本包不新增第 5 个角色（后期 / 发布扩展位保持预留）。

### D018-02 · K4 运行时对象行为扩展

- GateBridge：request 增加"恢复重挂 / 幂等返回"分支，新增 `recoverPending()`；decide / settleAll 行为不变。
- provider.ts：安装函数由单 director 泛化为 5 profile；新增按 agent 分组的物理 ID 白名单常量。
- client.ts：agent 白名单加 showrunner、tools 按 agent 分组校验、listAgents 返回双 primary。
- 均为主进程内部行为，不引入新数据结构（复用 017 Canvas 门 / 节点模型）。

### D018-03 · K8 面变更评估

- **不新增 IPC、不新增推送通道、不删除 handle**：门恢复复用 017 的 `gate:changed` / `gate:decide` / canvas 订阅机制；仅在既有 `project:open` 成功链末尾加 recoverPending 调用。
- 结论：无 K8 破坏性面变更。

### D018-04 · K1 共享层评估

- 本包不改 shared/types.ts：所需 Canvas / CanvasGate 等类型已由 017 追加。无 K1 事项。

### D018-05 · K9 依赖约束

- 不引入任何新的第三方依赖；不升级 opencode（锁 1.18.34）；仅 Node 内置与既有模块。

### D018-06 · 收紧项登记

- 已裁决（approved/rejected）的门再次 gate.request → INVALID_ARGUMENT（此前同类冲突以 INVALID_ARGUMENT 拒绝，本次明确覆盖"已裁决"情形）。
- renderer 指定专职 agent 名 → client 拒绝 INVALID_ARGUMENT。
- 不新增错误码（归一到既有 INVALID_ARGUMENT / GATE_TIMEOUT / UPSTREAM_AUTH_MISSING / INTERNAL）。

## 二、硬边界确认

1. 八步闭环：showrunner 系统提示覆盖 0–7 完整步骤与全部确认点；后期 / 发布仅预留交接物。
2. 局域网 ComfyUI：profile 不写死实例地址 / 媒体模型；媒体动作只经 comfyui.* 纯工具；引擎真实客户端仍在 023。
3. 通道红线：4 个新 agent model 仅 ark；无其他文本 / 媒体模型字段。
4. 媒体零公网 / renderer 不直连：本包不新增任何出网路径与 renderer import。
5. 纯工具纪律：MCP 层零 LLM 事实不变；内容生成全部回归 Agent 自身推理。

## 三、实施即过渡事项（不作为永久决策）

| 过渡项 | 存在期 | 后续处置 |
|---|---|---|
| director 与 showrunner 双 primary、安装 5 profile | 018 → 022 | 022 删 director.md 及其安装 / 校验分支 |
| listAgents 返回 director + showrunner | 018 → 022 | 022 收敛为仅 showrunner |
| client 按 agent 双套工具校验 | 018 → 022 | 022 删 director 规则 |
| 门恢复仅重挂等待、不透明续跑调用栈 | 长期（运行时能力边界） | 如 opencode 后续支持运行栈恢复，另案评估 |
| ComfyUI 媒体动作仍为占位（client holder=null） | 018 → 023 | 023 注入真实客户端 |

## 四、历史关系

- 本包是 016 总纲的第二块实施：把 017 的纯工具基座接入 Agent 侧，形成"主控—专职—门"可运行链路，但不触发任何业务切片。
- 不重开既锁决策（opencode 1.18.34、loopback 控制面、随机内存口令、D-010 媒体终局）。
- 物理工具 ID 映射（契约 §1）为 2026-10-07 真机探针实证结果，后续 019–021 切片的 profile / 提示引用以此为准。

## 五、实施验证记录（2026-10-07）

- C1–C4：4 个 profile 创建于 `resources/opencode/agents/`，旧 director.md 未动。
- C5/C6：[provider.ts](../../../electron/runtime/provider.ts) 新增 AGENT_PROFILES / SHOWRUNNER_DECLARED_TOOLS / installAgentProfiles；模板解析泛化为 resolveAgentTemplatePath；installDirectorAgent 与旧返回字段保留兼容。
- C7：[bridge.ts](../../../electron/gate/bridge.ts) request 改为「live 幂等 → 否则 arm 后异步初始化」，已裁决门拒绝；新增 recoverPending。
- C8：[main.ts](../../../electron/main.ts) project:open 成功链固定 settleAll → reset → recoverPending。
- C9：[client.ts](../../../electron/runtime/client.ts) agent 双 primary 白名单、tools 按 agent 分组、listAgents 双 primary（showrunner tools 空 map 同样兜底）。
- C10：新增 [agent-profiles.test.ts](../../../src/test/agent-profiles.test.ts)（T1/T2）、[agent-profile-install.test.ts](../../../src/test/agent-profile-install.test.ts)（T3），更新 [gate-bridge.test.ts](../../../src/test/gate-bridge.test.ts)（T4）与 [runtime-client.test.ts](../../../src/test/runtime-client.test.ts)、[runtime-integration.test.ts](../../../src/test/runtime-integration.test.ts)（T5）。
- C11 结果：`npm run build:electron` 通过；`npm run typecheck` exit 0；`npm run test:run` → **52 文件 525 通过 / 1 跳过**。
- 真机验收（2026-10-07，用户指令「先做真机验收」），全部通过：
  1. 运行中·健康，端口 4096，v1.18.34；底部火山方舟已连接。
  2. listAgents 双 primary 并存（director + showrunner），三个 subagent 不暴露给 renderer。
  3. showrunner model = `ark/ark-code-latest`（占位符正确替换、无残留），tools 为 6 物理 ID；userData agents 目录 5 profile 全部落盘。
  4. 门跨重启恢复：向项目 project-20261007-022320-ad9b 的 canvas.json 种入一条 `status:"pending"` 门（gateId 0-a）→ 切换到项目 project-20261006-074558-jx9v → 切回；project:open 链执行 settleAll → reset → recoverPending。切回后经 DevTools 调 `window.api.gate.decide({gateId:'0-a',decision:'approved'})` 返回 `{ok:true}`（证明 live entry 已重挂，否则会抛 INVALID_ARGUMENT），canvas 门状态落盘为 approved，且门始终仅一条（无重复建门）。
  5. 验收后清理：删除人造 canvas.json（该项目原先无此文件），恢复原状。
- 无遗留项；feature-018 实施与验收闭环完成。
