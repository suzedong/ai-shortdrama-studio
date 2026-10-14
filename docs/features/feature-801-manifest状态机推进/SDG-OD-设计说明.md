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
