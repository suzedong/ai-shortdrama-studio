# SDG-AI 变更记录 · feature-016 架构重建总纲

> 状态：**v1.0 待审批**
> 日期：2026-10-07
> 本记录为**决策记录（永久保留）**：登记本次架构重建触发的卡口与预批事项。
> 用户审批本总纲（NotifyUser 确认）即视为对下列"预批项"的一次性授权；"实施前再停"项不在此列。

---

## 一、卡口决策登记（K 卡口）

| 序号 | 卡口 | 事项 | 结论意向 | 授权方式 |
|---|---|---|---|---|
| D016-01 | **K1** | 修改共享层 `shared/types.ts`：新增 Canvas/CanvasNode/CanvasEdge/CanvasGate/StepId/ComfyInstance/AssetIndexItem；弃用 WorkflowState/NodeStatus/ToolResultEnvelope 相关类型 | **新增 + 弃用，最小化；保留既有产物结构类型** | 总纲批准即预批；实施 feature-017 时按契约 §4.3 落地 |
| D016-02 | **K3** | 旧系统弃用/替换：director 强制外包模式、App.tsx 重状态机、旧业务 IPC、8 个生成型 mcp 工具 | **替换（重建），非沿用**；旧物在对应切片验收后删除 | 总纲批准即预批（用户已明确"可删了重建"） |
| D016-03 | **K4** | 新增顶层业务实体：Canvas（画布聚合：节点/边/门）、ComfyInstance、AssetIndexItem | **新增**，作为新架构核心模型 | 总纲批准即预批 |
| D016-04 | **K6** | 新增模块：主进程 CanvasStore、纯化 mcp 工具集、摄制组 profile；后期/发布阶段预留 agent（post-operator） | **本期新增前三项**；post-operator 仅预留，立项时另停 | 前三项预批；**post-operator 实施前再停** |
| D016-05 | **K8** | 破坏旧接口契约：删除 ~27 个旧业务 handle/preload 键；ToolResultEnvelope 改为 `{ok,...}` 统一结果 | **破坏旧契约**，按切片分批删除 | 总纲批准即预批；删除动作在新切片 DoD 通过后 |
| D016-06 | **K9** | 不新增运行时/框架核心依赖（沿用 opencode-ai/@opencode-ai/sdk 1.18.34、Electron/React/Tailwind 现栈） | **不引入新核心依赖** | 无新依赖，不触发；如实施期确需，另行暂停 |
| D016-07 | **K5** | 术语变化：Stage 十节点 → StepId 八步；director → showrunner 等 | 以契约 §2/§4 为准 | 总纲批准即认可；命名规范若需独立文档另议 |

## 二、硬边界确认（不可破坏，用户既已拍板）

1. 八步闭环完整，每步有产物，不合并/裁剪。
2. 本地/局域网可配、多实例 ComfyUI（补 Design 缺口）。
3. 图像 qwen-image / 视频 H3 / 音乐 Music3 全部经 ComfyUI 权重推理，媒体零公网；出公网仅文本 ark。
4. renderer 不直连 opencode / ComfyUI。

## 三、与历史决策的关系

- 沿用 feature-008：opencode 1.18.34、仅 loopback、随机 Basic 口令仅内存、client-only、SSE 六事件投影。
- 沿用 D-010 媒体通道终局。
- **反转/取代**：feature-001~015 中"renderer 状态机驱动 + mcp 工具内部调 ark 生成"的实现路线；产物 schema 类型本身不推翻（继续复用）。
- feature-016 保守重构旧案（`.trae/documents/feature-016-director直出重构.md`）作废，以本总纲为准（编号 016 由本总纲承接）。

## 四、修订轨迹

| 日期 | 版本 | 说明 |
|---|---|---|
| 2026-10-07 | v1.0 | 初版总纲决策登记，待用户审批 |
