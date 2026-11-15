# feature-803 · ComfyUI 统一媒体引擎 — 任务清单

> **版本**：v1.2（2026-11-14）｜**状态**：qwen-image 真机生成链路已通过，资产中心 UI 与第二实例行为待验收

## T1 规格与追溯

- [x] 建立五件标准任务包，登记 feature 内 K1/K2/K8/K9 决策。
- [x] 定点更新 `docs/features/README.md`，不改全局决策台账。

## T2 应用级设置

- [x] 实现全局配置读写、原子替换、旧项目配置一次迁移。
- [x] 实现完整字段与本地/私网 URL 校验，修复 upsert 校验旧值问题。
- [x] 保持 `requireInstance` 与实例 CRUD 对 MCP/IPC 可用。

## T3 设置 UI 与桥接

- [x] AI 服务设置增加文本服务 / ComfyUI 页签。
- [x] 实现实例列表、新增、编辑、启停、删除确认、逐项与未保存地址测试。
- [x] 同步 preload/global DTO、main IPC 与零网络 dev mock。

## T4 客户端与受控工作流

- [x] 实现真实五端点 HTTP 客户端、可注入超时、统一协议错误。
- [x] 实现版本化清单与 API Format 加载、qwen-image 限定和显式参数映射。
- [x] 添加空生产清单；无真实工作流时明确返回不可用。
- [x] 导入用户提供的 qwen-image 2512 Save API Format，注册受控生产清单并验证参数映射。

## T5 统一引擎与持久作业

- [x] 主进程创建并注入唯一引擎，设置测试与 MCP 共用。
- [x] queue/status 替换占位，固定 requestId/workflowId 契约。
- [x] 持久化作业、requestId 幂等、禁用实例限制与重启续查。
- [x] 安全下载、原子收片、幂等 `registerAsset` 与来源 meta。

## T6 自动化

- [x] 更新设置与 dev-mock 测试，覆盖 CRUD、迁移、URL、启停、无项目。
- [x] 新增 client/workflow/engine 测试，覆盖网络错误、映射、状态机、幂等与安全。
- [x] 新增 ComfyServicePanel 测试并更新 MCP 静态契约测试。

## T7 验证与交付

- [x] feature-803 专项测试、renderer 架构红线与资产索引回归通过。
- [ ] `npm run typecheck` 已执行；仅剩 `canvas-zoom.test.tsx` 2 条与 `runtime-client.test.ts` 1 条既有测试类型错误，非本包引入。
- [ ] `npm run test:run` 已执行：90 个文件中 88 通过、2 失败；1116 项中 1105 通过、10 失败、1 跳过。失败仅为既有 Agent profile CRLF/LF 断言，非本包引入。
- [ ] `npm run build` 已执行，仍被上述 3 条既有测试类型错误阻断；`npx vite build` 与 `npm run build:electron` 均成功。
- [x] 变更记录写明受影响文件、迁移、测试结果与未做项。

## 真机验收（不计为自动化完成）

- [x] 用户提供 localhost/私网实例地址及 qwen-image **Save API Format** JSON。
- [x] 导入生产清单后验证连接、一图生成、状态完成、文件存在、资产登记和重复查询一条资产（2026-11-14 真机通过）。
- [ ] 在资产中心 UI 目验该生成资产可见。
- [ ] 验证第二实例选择与禁用实例拒绝新任务。
