# SDG-RE 任务清单 · feature-018 摄制组 profiles 与主控链路

> 状态：**v1.2 已实施并通过真机验收**（自动验证全绿；2026-10-07 真机验收通过）
> 日期：2026-10-07
> 实施事实源：[SDG-RE-契约.md](./SDG-RE-契约.md)；条款编号（§1–§8）与契约一致。

---

## A. 任务总览（自底向上）

| # | 任务 | 产出 | 状态 |
|---|---|---|---|
| C1 | 新建 resources/opencode/agents/showrunner.md（frontmatter §3.1 + 系统提示 §4.1） | showrunner.md | [x] |
| C2 | 新建 writer.md（§3.2 + §4.2） | writer.md | [x] |
| C3 | 新建 media-director.md（§3.3 + §4.3） | media-director.md | [x] |
| C4 | 新建 comfyui-operator.md（§3.4 + §4.4） | comfyui-operator.md | [x] |
| C5 | provider.ts 泛化：agent profile 常量（5 文件 / 物理 ID 白名单分组）；模板路径解析按文件名 | provider.ts 修改 | [x] |
| C6 | provider.ts：installAgentProfiles（渲染全部 5 profile、占位符替换、缺 model 抛 UPSTREAM_AUTH_MISSING）；setupRuntimeFiles 编排更新 | provider.ts 修改 | [x] |
| C7 | gate/bridge.ts：request 三分支重挂语义（§5.1-1）；新增 recoverPending（§5.1-2） | bridge.ts 修改 | [x] |
| C8 | main.ts：project:open 成功链接入 settleAll→reset→recoverPending（§5.2） | main.ts 修改 | [x] |
| C9 | runtime/client.ts：agent 白名单 + 按 agent 分组 tools 校验 + listAgents 双 primary（§6） | client.ts 修改 | [x] |
| C10 | 新增 T1–T5 测试（§8 契约） | src/test/* | [x] |
| C11 | 全量自检：typecheck / test:run（已通过）；真机验收已通过（2026-10-07，见变更记录五） | 验证记录 | [x] |
| C12 | 回写变更记录与任务勾选 | SDG 文档 | [x] |

## B. 关键检查点（实施中必须满足）

1. C1–C4 完成后，profile frontmatter 必须与契约 §3 逐字一致（T1 静态断言兜底）。
2. frontmatter / client 中一律使用物理 ID（`shortdrama_` 前缀、下划线），禁止点号键。
3. C6 不得删除 / 改名旧 director 安装路径；旧 setupRuntimeFiles 调用方（manager.ts）签名兼容。
4. C7 修改为行为扩展：已裁决门仍拒绝；`decide / settleAll` 现有测试不回归。
5. C8 只改 openProject 成功链；不新增 / 不删除既有 handle。
6. C9 并存校验：旧 director 规则保持，新规则只对 showrunner 生效。
7. 不修改 shared/types.ts（本包无 K1 事项）。

## C. 验收门槛

| 门槛 | 标准 |
|---|---|
| 编译 | `npm run typecheck` exit 0 |
| 测试 | `npm run test:run` 全绿（除既有 1 skipped） |
| 静态护栏 | T1/T2 断言通过（物理 ID、强制外包条款、无旧"工具生成内容"措辞） |
| 回归 | feature-008/010/015 及旧 App 测试无新增失败 |
| 真机（人工） | 已通过（2026-10-07）：双 primary 并存、showrunner 6 物理工具/model 正确；构造 pending 门→切项目→切回，recoverPending 重挂成功、gate.decide 可裁决（approved 落盘）、门始终仅一条 |

## D. 风险与回退

- 风险：opencode 对旧版 tools-map（deprecated）支持在后续版本移除 → 缓解：本包不改锁定版本 1.18.34；升级版本属另案 K9。
- 风险：门恢复后 Agent 不自动续跑 → 已在契约 §5.3 明确边界（下一回合重挂），不视为缺陷。
- 回退：本包全部为新增文件 + 局部扩展；回退即移除 4 个新模板并还原 provider/bridge/main/client 四处局部修改，无数据结构迁移、无回滚负担。
