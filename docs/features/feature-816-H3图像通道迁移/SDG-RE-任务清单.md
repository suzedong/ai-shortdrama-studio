# feature-816 · H3 图像通道迁移 · 任务清单

> 日期：2026-11-14；执行以获批计划和契约为准

## A. 治理与规格

- [x] A1 用户拍板“方案与生产一起改”“Qwen 专有能力全部停用并归档”。
- [x] A2 登记 D-033 / K7，同步 AGENTS、根设计、HTML 镜像、决策索引和版本记录。
- [x] A3 建立 feature-816 标准五文件，冻结 K1/K2/K3/K7/K8/K9、输入契约、归档与验收标准。
- [x] A4 更新 features README 状态、写权与关联关系，不改写 feature-803/815 历史。

## B. 参考方案

- [x] B1 重写官方模板基准库总览：图像 H3 Image、视频 H3、音乐 Music3，Qwen 退出全部现行路由。
- [x] B2 对 45 份模板按组标明生产已启用 / 参考保留未接入 / 归档禁用，保留原始文件。（原阶段事实；后续 C1 仅在 `_ref_官方模板` 内局部取代保留约束。）
- [x] B3 修正 UI/API/生产执行件边界、兼容图差异与真实验证状态。
- [x] B4 同步 HTML 镜像及内嵌数据。

## C. 生产迁移

- [x] C1 原字节归档 Qwen graph，manifest 撤销旧 ID，仅注册 H3 Image。
- [x] C2 新增 H3 Image 本地兼容 API graph，固定三项权重、官方采样和 SaveImage 输出。
- [x] C3 修改 workflow loader：H3 白名单、字符串受控值映射、四项输入和旧字段拒绝。
- [x] C4 同步 MCP 描述与 comfyui-operator；不新增工具/IPC/依赖/UI。

## D. 自动化与回归

- [x] D1 更新 workflow 测试：H3/Qwen 白名单反转、四项映射、8 画幅、默认参数和非法输入。
- [x] D2 校验固定权重、无云/视频/Qwen 生成节点、ConditioningZeroOut 与 SaveImage 拓扑、源 graph 不变。
- [x] D3 更新 engine/MCP fixture 与断言，覆盖旧 Qwen pending 仅续查、旧 ID 不可新提交。
- [x] D4 回归设置页、dev mock、feature-815 元数据和 VisualCatalog。
- [x] D5 执行 Comfy/MCP/style 专项、typecheck、全量测试、Electron/Vite build、git diff --check，单列既有基线。

## E. 真机与封闭

- [x] E1 再验 `lan-4090` system_stats/object_info、执行节点、三项权重、8 画幅与 MP 0.1–16。
- [x] E2 经生产引擎以固定 requestId、中文 prompt、固定 seed、9:16、4 MP 提交一次 H3 任务。
- [x] E3 验证 completed、有效图像、9:16 与约 4 MP 取整尺寸、资产登记；保存 job/prompt/路径证据。
- [x] E4 验证旧 Qwen ID 拒绝、新投不改投；历史 Qwen 资产与 feature-815 元数据仍可读。
- [x] E5 清理一次性 runner/临时文件，回写五文件、D-033、features README 和版本记录。

## F. C1 参考库清理与封闭

- [x] F1 在五文件登记用户授权、局部取代关系、目标结构、失败停止条件与验收项。
- [x] F2 在工作区外生成 27 删除 / 27 移动清单及移动前 SHA256，校验互斥、并集 54、无覆盖或目录逃逸。
- [x] F3 移动 27 份 H3/Music3 保留件，验证 27/27 SHA256 一致且 JSON 可解析。
- [x] F4 按明确路径删除 27 份 Qwen 参考件，移除确认已为空的旧目录。
- [x] F5 更新 Markdown 总览并同步 HTML：18 UI + 9 API、7 用途域、新路径和删除禁用口径。
- [x] F6 校验索引与磁盘一一对应、链接/锚点有效，逐项审查 Qwen 残留语义。
- [x] F7 回写 C1 完成证据、D-033 终局状态、features README 和新编年条目，复核版本条目数。
- [x] F8 清理工作区外临时清单，执行 scoped diff、边界检查与 `git diff --check`。

## G. C1 三类参考件后续清理（2026-11-15）

- [x] G1 登记用户原话“p_h3 fast pika_h3都不要”及“三类全部删除”确认，冻结 8 个明确路径、19 份最终基线与保护边界。
- [x] G2 预检当前 27 份 JSON 与 8 个删除目标，记录其余 19 份保留件 SHA256 / 字节数及生产归档哈希。
- [x] G3 按明确路径删除 2 份 P-H3、3 份 FastH3/FastVideo、3 份 Pika H3 UI 参考件，不使用通配符或内容匹配。
- [x] G4 先更新 Markdown 总览，再同步 HTML：19 份 JSON、10 UI + 9 API、7 用途域，移除三类现行索引与补充路由。
- [x] G5 校验 19/19 保留件哈希与 JSON、8 个路径不存在、双索引与磁盘一致，以及链接、锚点、HTML 结构和残留语义。
- [x] G6 复核生产归档、历史项目作业/资产与 feature-815 媒体未受影响，回写 D-033 终局状态、features README 和新编年条目。
- [x] G7 封闭本轮 AC 与变更记录，清理临时清单，执行 scoped status / diff 与 `git diff --check`；不创建 Git commit。

## H. C2 新增 H3 API 文生图参考件登记（2026-11-15）

- [x] H1 登记用户新增 `api_image_minimax_h3_t2i.json`，冻结 20 份当前基线、文件哈希和参考-only 边界。
- [x] H2 先更新 Markdown 总览，再同步 HTML：第四节增加该 API 文件，当前为 20 份 JSON、10 UI + 10 API、7 用途域。
- [x] H3 更新 D-033 终局状态和 features README 当前口径，保留 C1 与编年中的 19 份历史快照。
- [x] H4 校验 20/20 JSON、双索引、链接/锚点/HTML 结构、生产归档与 scoped diff，封闭 AC18–AC20；不创建 Git commit。

## I. C3 Qwen 生产归档删除（2026-11-15）

- [x] I1 登记用户“请帮我整理目录并删除 qwen 相关文件”及“删除生产归档”确认，冻结唯一精确路径、删除前哈希、未入 Git 不可恢复提示与无第二人复核事实；初稿聚合哈希登记笔误已按删除前原始输出校正。
- [x] I2 先更新 A 类规格与 Markdown 总览，再删除唯一 Qwen 生产归档，仅在确认为空后移除 `_archive`；文件进入系统回收站，未使用通配符，未删除历史资产或合法 `qwen3vl` 组件。
- [x] I3 同步 HTML 总览、Feature 五文件、D-033 终局状态和 features README；历史 C1/C2 记录与编年快照不改，本 C3 不新增项目编年或决策条目。
- [x] I4 20/20 参考 JSON、生产 manifest/graph 与保护边界哈希、Qwen 命名文件清零、双索引/HTML 结构均通过；专项 109/109 通过，全量 10 项失败及 typecheck 当前 3 项无关错误已单列。scoped diff 已审阅，全量 `git diff --check` 通过，仅既存 LF→CRLF 提示；未创建 Git commit。

## 停止条件

任一执行节点或权重缺失、OOM、超时、输出异常时，对应真机项保持未完成并记录错误；禁止以 Qwen、视频权重或云节点替代。C3 删除目标或保护边界与冻结清单不符时停止，不扩大删除范围。
