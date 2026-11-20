# feature-801 manifest 状态机推进 · 设计说明

> 本包是**主进程数据/编排包**：新增 manifest 状态机模块、两个零 LLM MCP 工具与 showrunner 提示词纪律。**无新页面、无新视觉资产、无新 IPC、无新交互**。渲染端唯一动作是删除一个死组件（见 §1）。

## 1. UI 改动面

| 位置 | 改动 | 视觉验收 |
|---|---|---|
| [StageCanvas.tsx](../../../src/components/StageCanvas.tsx) | **整文件删除**（K1 连带清退：该组件 9 处引用待删的 `Stage` 类型） | 删除前 grep 确认全仓零 import；删除后应用任何界面无变化（死组件，从未被挂载） |

除上述删除外，renderer（`src/` 全部 studio/components）**零改动**。

## 2. 不新增视觉资产

- 无图标 / 配色 / 弹窗 / 状态徽章：manifest.status 不驱动任何界面元素。
- 左栏阶段轨道（StageNavPanel）与画布阶段感继续由 `canvas.json` 节点状态推导，**不消费** manifest.status（需求 §4.2 已显式排除「manifest.status 的 UI 消费」）。两套事实源保持解耦：画布是 Agent 工作可视化，manifest 是阶段状态指针。
- showrunner 的状态机纪律是**提示词层**改动（Markdown），无界面形态。

## 3. 不新增 IPC / preload

- 两工具只经 MCP（opencode 侧）对 Agent 可达，renderer 不直连：不经 main.ts 注册新 IPC、不改 preload 暴露面。与 feature-001 brief.* 工具同轨。

## 4. 视觉回归基线

- 本包无新增视觉回归项。
- 删除 StageCanvas 后跑既有渲染测试（canvas-board / studio-flow 等），除 HEAD 基线 11 个既有失败（studio-flow 10 例 + architecture「无 comfyui 字样」1 例）外不得出现因缺组件/缺类型导致的新失败。

## 5. D-037 归并后的责任分层（2026-11-19）

### 5.1 现行控制流

```text
规则完成判据 / 用户口头拍板（Agent 协议归 001）
        │
        ├─ 需要门卡 → gate.request：pending 快照 + 立即返回
        │                   ├─ 同 id pending / rejected 重发 → 覆盖为 pending
        │                   ├─ 0-final approved + 严格更高 version → 覆盖为 pending
        │                   ├─ reject → rejected（仅门态 + note）
        │                   └─ approve → gate.decide → applyGateDecision
        │                                      ├─ 0-final 首版：草案 / 版本 / 806 Harness 校验
        │                                      │   → 发布 + step-0-brief upsert + brief-published
        │                                      ├─ 0-final 再版：只确认，Agent 后续三选一 + impact.commit
        │                                      ├─ 1-a～2-b：固定 manifest 事件；产物仍由 Agent 落盘
        │                                      └─ gate:changed 推送 execution 成功 / 失败摘要
        │                                         （草案问题回退 pending；执行故障保持 approved）
        │
        └─ verbal / 历史无草案首版兜底 → 保留的 Agent 工具链（不得与按钮路径双写）
```

### 5.2 模块归属

| 能力 | 当前负责包 | 本包边界 |
| :-- | :-- | :-- |
| 门请求、pending 快照、裁决、后置执行、execution 摘要与版本化重开 | **801** | 本 Change 的主责面 |
| manifest 状态推进、固定事件映射、重复 decide 与 `already-there` 幂等 | **801** | 系统按钮路径不得由 Agent 双写 |
| Harness 校验规则、findings、校验工具 | **806** | 801 只消费结果；不得迁入规则或宣称接管 |
| 立项数据、0-final 业务草案与 Agent 定案协议 | **001** | 801 只负责通用门态和推进 |
| 门卡留存、影响摘要区与立项视图交互 | **013** | 801 不承接展示层 |
| readiness 芯片视觉 | **817**；点击与立项视图交互归 **013** | 801 只承接“提示不自动建门 / 发布”的行为约束 |

### 5.3 历史冲突的最小裁决

- 早期“阻塞等待 approved / 超时重挂”是历史方案，015 已改为非阻塞；当前架构保留 pending 覆盖重开，历史正文及当时验证结论不删改。
- 本包早期“Agent 在 approved 后另调 manifest.advance”的编排仅在系统直做按钮路径被 015 取代；verbal 与历史无草案首版兜底保留，状态机纯函数、事件枚举、单格推进和幂等设计不变。
- 012 的 0-final approved 严格新版本重开与 015 的覆盖重开共同构成现行边界：pending / rejected 可同 id 重开，其他 approved 门终态；execution 只表达成功 / 失败摘要，不是三态或 runId。
- 010 的就绪提示不能成为隐藏自动门；是否能直接拍板仍由 001 的立项协议判定，是否推进由 801 判定。

**本 Change 无新接口，仅文档归并；不新增实施任务或真机完成声明。**
