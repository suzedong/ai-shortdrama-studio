# feature-803 · ComfyUI 统一媒体引擎 — 任务清单

> **版本**：v1.3（2026-11-15）｜**状态**：历史 qwen-image 真机生成链路已通过；三端口 H3 API 级串行落卡已验，资产中心 UI 与应用内第二实例 / 禁用行为待验收
>
> **现行指引（2026-11-15 校准）**：本文件保留 2026-11-14 的 Qwen 实施与真机历史，不作为现行图像通道依据。生产图像已由 feature-816 / D-033 迁移为 MiniMax H3 Image；后续统一任务与多实例验收按 Parity 矩阵 P2 执行，不得据此恢复 Qwen。

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
- [x] `npm run typecheck` 已执行；仅剩 `canvas-zoom.test.tsx` 2 条与 `runtime-client.test.ts` 1 条既有测试类型错误，非本包引入。
- [x] `npm run test:run` 已执行：90 个文件中 88 通过、2 失败；1116 项中 1105 通过、10 失败、1 跳过。失败仅为既有 Agent profile CRLF/LF 断言，非本包引入。
- [x] `npm run build` 已执行，仍被上述 3 条既有测试类型错误阻断；`npx vite build` 与 `npm run build:electron` 均成功。勾选仅表示命令已执行，不表示全量全绿。
- [x] 变更记录写明受影响文件、迁移、测试结果与未做项。

## 真机验收（不计为自动化完成）

- [x] 用户提供 localhost/私网实例地址及 qwen-image **Save API Format** JSON。
- [x] 导入生产清单后验证连接、一图生成、状态完成、文件存在、资产登记和重复查询一条资产（2026-11-14 真机通过）。
- [x] 2026-11-15 对 8000 / 8001 / 8002 串行提交独立 H3 Image API 任务，requestId / promptId / 运行队列 / completed 历史匹配，目标实例显存显著变化且非目标实例稳定，三个 320×320 PNG 下载及 SHA256 校验通过；`allPassed: true`，见 [validation.json](../../verification/gpu-placement-2026-11-15/validation.json)。本项仅为**直连 API 级逐端口落卡**，不经过生产 `ComfyEngine`，不封闭 AC-9 的应用内验收。
- [ ] 取得主机侧 `nvidia-smi`、GPU UUID、端口 → PID 证据，核验 OS 级物理 GPU 编号；启动参数声明与 API `cuda:0` 不作替代。
- [ ] 在资产中心 UI 目验该生成资产可见。
- [ ] 经应用内生产引擎验证第二实例选择与禁用实例拒绝新任务，并复核作业恢复和资产登记。
- [ ] 验证三路并发、GPU 过载 / 资源争用与单实例故障隔离。
