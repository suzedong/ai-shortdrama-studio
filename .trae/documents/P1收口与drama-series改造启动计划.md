# P1 收口与 drama-series 改造启动计划

## Context

D-041／D-042 已确定 MiniMax 4.0.18 复刻基线、`drama-series` 主 Workflow、完整八步闭环、自定义文本服务、局域网 ComfyUI 媒体链路和无用户管理服务边界，但决策本身不授权产品代码、共享类型、接口或依赖变更。

用户已选择第一轮“先收口 P1”。现状是 P0 已完成，P1 切片 A—F 已闭环但 D-035／D-036 扩展退出门未通过；真实 Ark 的 AC17—AC21 仍只有受控 mock／自动化证据。文本双 Provider、ComfyUI 多实例、H3 Image、RunStore、GateBridge、revision CAS 等基础应直接复用，不重复建设，也不创建巨型复刻 Feature。

本次目标是先完成一个小而完整的真实运行补验 Change，再完成 `drama-series`／Workflow／Plan 的 P1 规格准备。若补验无产品缺陷，本轮不修改产品代码；后续恢复 UI、Diff 等改码 Change 逐项报批。

## 一、首个 Change：808 真实 Ark AC17—AC21 定向补验

### 1. 冻结范围与验收矩阵

主责 `feature-808-会话续聊（项目会话绑定与历史回放）`，`feature-830-测试与验收数据落点统一` 负责证据分级，`feature-817-可信工作台基础` 只同步真实界面结论。

在 808 的现有任务清单与变更记录中登记本轮 Change，逐项列出 AC、操作、预期、证据及通过判据；需求、契约和设计没有差异时不虚构重写。保留既有 AC16 与受控 mock 的通过记录，不把它们扩大解释为 AC17—AC21 已通过。

验收覆盖：

- **AC17**：同步拒绝、异步错误、正常 idle、会话 abort、runtime stop、SIGKILL／重启对账分别得到正确运行状态。
- **AC18**：重开保留真实消息、工具日志、OptionCard、pending Gate 与已落盘产物；请求数零自动增长，遗留活跃工具只显示已中断。
- **AC19**：孤儿 interrupted 运行明确显示提交结果未知；无运行记录的旧历史不伪装中断。
- **AC20**：未经点击不重试；pending Gate、活跃并发及非法状态拒绝；确认后生成新 messageID 与 retryOfMessageId，旧记录不变。
- **AC21**：runs 查询失败不阻断消息回放，损坏账本不得被覆盖；真实 messageID 替换乐观 ID，且不串项目或会话。

### 2. 复用现有实现执行真实补验

复用 `electron/runtime/run-store.ts` 的六态运行账本与首次加载对账、`electron/main.ts` 的人工重试与并发／Gate 拒绝、`electron/gate/bridge.ts` 的 pending 恢复，以及现有恢复卡、隔离 Electron 驱动和 `scripts/verify-runtime-interruption.cjs` 的故障采集方法。

使用真实 Electron + opencode + 火山方舟，不新增 Provider。运行环境使用隔离 HOME、`ASD_USER_DATA` 和 `project-accept-*` 合成工作区；沿用既有安全配置注入方式，不归档密钥、userData、真实用户项目、完整消息库或整个临时目录。

逐项保存脱敏结构化结果、必要截图、退出码、磁盘 JSON 摘要及证据索引。真实环境无法安全产生的故障保留受控证据，并明确标为真实项未通过；不得以 mock 结果冒充真实 Ark 验收。

### 3. 缺陷处理与证据回流

- 未发现产品缺陷：只更新 808／830／817 的实际证据与状态，不修改产品代码。
- 发现缺陷：立即暂停扩面，记录最小复现与影响范围，另提最小修复 Change；不得在本补验中顺手重构或增加接口。
- 只有全部真实验收项满足判据才更新对应 AC；P1 是否退出仍按 D-035／D-036 全部门项判断，不提前宣告通过。

## 二、P1 规格准备：drama-series 与通用执行骨架

补验采集可独立推进后，在既有包内完成纯规格 Change：

- **808 主责**：定义 Workflow Definition、Plan、Stage、Work Item、Run／Attempt 的逻辑职责、生命周期、幂等、重试、Replan、崩溃恢复及与现有 Session／Run 的映射；`drama-series` 显式覆盖 STAGE 0—7。
- **827 协同**：定义 Proposal 引用、目标 revision、CAS、统一写安全与确定性系统迁移边界。
- **828 协同**：定义 Plan／Work Item 聚合读模型、资源版本引用和项目打开后的恢复可见性，不复制运行事实。
- **817 协同**：定义阶段进度、忙碌、失败、未决 Gate、重试与恢复卡的展示契约。

规格必须保留：v2 仅作内部骨架；v3 Resource／Version 只选择性吸收；文本仍固定火山方舟／LM Studio 配置；图片／视频／音乐经主进程／MCP 到局域网 ComfyUI；不建设用户管理服务；其他 Workflow 和在线能力不自动获得实施授权。

本轮只写逻辑契约与后续 K1／K8 候选清单，不修改 `shared/types.ts`，不实现执行器，不新增 IPC／MCP，不增加 P1 退出门，也不把规格完成写成八步闭环或 Parity 通过。

## 三、后续独立 Change（本次不直接实施）

1. **823 revision 冲突 Diff**：补五类包文档，定义磁盘版／待提交版、文本 Diff、重载、另存副本、显式覆盖与选择追溯；新 DTO、IPC、preload 和 UI 逐项过 K8 后再改码。
2. **823 手动连线**、**整理快照撤销／重做**：分别立项为包内 Change，不夹带页历史、跨页引用或归档迁移。
3. **聚焦与结果定位**：明确画布聚焦、资产事件及对话结果定位接缝后单独实施。
4. **轻量通知**：先裁决负责 Feature，再定义持久化、已读状态和结果深链，不擅自塞入 823／828。
5. P1 退出后再进入 P2 媒体入口；H3 视频、Music3 与通用 Workflow 执行器不得借本轮提前实施。

## 关键文件

- `docs/features/feature-808-会话续聊（项目会话绑定与历史回放）/SDG-RE-任务清单.md`
- `docs/features/feature-808-会话续聊（项目会话绑定与历史回放）/SDG-AI-变更记录.md`
- `docs/features/feature-808-会话续聊（项目会话绑定与历史回放）/SDG-RE-需求规格.md`
- `docs/features/feature-808-会话续聊（项目会话绑定与历史回放）/SDG-RE-契约.md`
- `docs/features/feature-808-会话续聊（项目会话绑定与历史回放）/SDG-OD-设计说明.md`
- `docs/features/feature-830-测试与验收数据落点统一/` 及 `docs/verification/` 的现有证据入口
- `docs/features/feature-827-打开事务与写安全/`、`feature-828-项目库与启动恢复/`、`feature-817-可信工作台基础/`
- `electron/runtime/run-store.ts`、`electron/main.ts`、`electron/gate/bridge.ts`
- `docs/design/MiniMax Design全面复刻开发计划.md`、`docs/design/MiniMax Design Parity影响矩阵.md`

## 验证

1. 补验前确认工作区和既有证据基线，保留当前未提交文档修改，不回滚历史差异。
2. 按 AC17—AC21 执行真实 Ark 定向场景，逐项记录 PASS／FAIL／真实环境未覆盖，不沿用旧计数。
3. 串行执行 `npm run test:run`、`npm run typecheck`、`npm run build`，避免既有 Vitest 端口竞争；失败时按本轮引入与既有问题分开报告。
4. 执行 `npm run check:docs` 和 `git diff --check`，检查新增／变更证据链接及包文档一致性。
5. 最终只按真实证据更新 AC 和阶段状态；不宣称 P1、P2、Workflow、八步闭环、Parity 或真机全量验收通过。

## 明确边界

- K1 冻结：不改 `shared/types.ts`。
- 不新增或修改 IPC／preload／MCP；如缺陷修复或后续 Diff 必需，另走 K8。
- 默认零新增依赖；任何依赖或 Agent profile 变更另走 K9。
- 不修改真实项目数据，不提交 Git。
- 不新增 Provider、媒体模型、用户管理、账号、团队、支付或云同步能力。
