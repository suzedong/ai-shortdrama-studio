# SDG-AI · 变更记录 · feature-019 垂直切片·立项（第 0 步）

> 状态：**v1.0 规格待用户签字**
> 日期：2026-10-07
> 说明：本记录按 SDG 变更三分类（新增 / 修改 / 删除）登记；实施前只记录"规划中的变更"，实施后回写实际结果与验证证据。

---

## 一、新增（规划）

| 对象 | 位置 | 说明 |
|---|---|---|
| RootSwitch / StudioApp / ErrorBoundary | `src/studio/`、`src/main.tsx` | 新立项工作台容器与顶层新旧切换（默认新，可回旧版） |
| CanvasBoard | `src/studio/` | 按 schemaVersion:2 Canvas nodes/edges 数据驱动渲染 |
| ChatComposer / GateCard 挂载 | `src/studio/` | 灵感输入、流式文本、对话流内门卡与裁决 |
| 编排 / renderer / 架构断言测试 | `src/studio/*.test.*` | 契约 §7 全部新增用例 |

零新增依赖、零新增 IPC。

## 二、修改（规划）

| 对象 | 位置 | 变更 | 卡口 |
|---|---|---|---|
| showrunner profile | `resources/opencode/agents/showrunner.md` | **仅正文**新增「第 0 步立项剧本」；frontmatter 不动 | feature-018 T1 静态断言须保持绿 |
| 渲染入口 | `src/main.tsx` | 挂 RootSwitch；旧 App 保留 | 旧 App 测试不回归 |
| GateBridge | `electron/gate/bridge.ts` | rejected 门可经**同一 gateId** 重开（回退 pending、覆盖请求内容）；approved 仍为终态 | K8，见决策台账 D-004；新增真实 Bridge 用例 |

`shared/types.ts` 不修改（无 K1）；MCP 工具 / preload / 主进程业务 handle 不修改（验收前）。

## 三、删除（规划 · K8 用户预批 · 验收后门控）

触发条件：需求 AC-1~AC-8 全绿（含真机验收）。

| # | 删除项 | 位置 |
|---|---|---|
| 1 | handle `idea:save` | `electron/main.ts` |
| 2 | handle `diagnosis:save` | `electron/main.ts` |
| 3 | 键 `saveIdea` / `saveDiagnosis` | `electron/preload.ts`、`src/global.d.ts` |
| 4 | 仅服务上述调用的立项引用 | `src/App.tsx` 调用点 |

显式保留：`project:*/workflow:*/chat:*/session:*/story:*/script:*/template:*` 及 runtime/canvas/gate/asset/settings 全部通道。

---

## 四、与上游契约的一致性

- 五层单向依赖、工具结果 `{ok}` 结构、门阻塞 / 恢复、错误码、安全契约：沿用 feature-016，未突破。
- 本包收窄 feature-016 任务清单对 019 删除范围的"等"字表述：019 仅删立项专属 4 项，其余随各自切片与 022 删除（已在需求 F4 / 契约 §6 明确，属对上游删除**时机与范围的细化**，不改变目标架构）。

## 五、实施验证记录（实施后回写）

- 规格签字：用户 2026-10-07 批准实施；门语义冲突经同日 K8 裁决（见决策台账 D-004）。
- typecheck：`npm run typecheck` exit 0（清理前后均 0 错误）。
- test:run：清理前 56 文件 540 通过（1 skipped）；清理后 56 文件 **537 通过（1 skipped）**——减少 3 个为已删 `saveIdea/saveDiagnosis` 的专属用例，其余测试不回归。
- build:electron：`tsc -p tsconfig.node.json && tsc -p tsconfig.preload.json` 通过。
- 真机四门验收：两轮真机完成。
  - 首轮（污染项目）：四门确认点不减少，rejected 意见被落实，但受 018 §5.1 所限门号出现 0-a2 / 0-b2；
  - 复测（干净项目 `project-20261007-165918-e303`）：gateId 恰为 **0-a / 0-b / 0-c / 0-d**；0-b rejected（note：集数压缩 24 集、单集 100 秒）后以**同一 gateId** 重开（canvas 上同一条记录经历 rejected→pending→approved），无后缀门；0-c 仅文本未出图；0-d 如实报告 ComfyUI blocked；brief.json/brief.md 在 0-d approved 后落盘；画布 3 节点 done、2 auto 边。
- 门控清理后自检：typecheck 0 错 + test:run 537 通过 + build:electron 通过（本文件第五节）。
- 遗留项：0-d 是否放行只读 `comfyui.instances/asset.list` 探测——用户裁决暂挂起，维持 §1.2 命名空间禁令（真机中模型尝试已被白名单拦截，未实际执行）；不影响本切片闭环。
