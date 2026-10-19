# SDG-OD-设计说明 · feature-810 谱系升级差异工作流

## 1. 落点架构

```
renderer                                        electron 主进程
──────────────────────────────────────────────────────────────────────
VisualCatalog
  ├ 头部徽章 ◄── style:catalog（新 IPC）──────► loadStyleCatalog()
  │   （删硬编码 STYLE_CATALOG_VERSION）         （feature-802 装载层零 diff）
  ├ 升级入口/差异面板 ◄── style:upgrade-diff ──► electron/style/upgrade.ts（新）
  │   （B-35 演示硬编码全替换）                    ├ 读当前项目最新立项单 style
  │   ├ 版本对 vX → vY                             ├ 版本逐字比对（=STYLE_VERSION_MISMATCH 语义）
  │   ├ 引用条目现况（含「已移除」→ blocking）      ├ 引用 ID 现况比对（loader 当前 catalog）
  │   └ J.3 变更记录（区间条目/未提供明细态）       └ J.3 解析（独立 try，失败不拖垮 loader）
  └ 采纳 ── updateBrief({style:{catalogVersion}}) ► brief:update（白名单 +1 键，K8）
      （前置校验：谱系未再升级；D-016 系统直写）      └ updateBriefFields 恒 mark（D-017 零 diff）
  忽略：关闭面板，零调用零写入
谱系 md：J.3「谱系变更记录」段（v1.46 空段骨架，§8.3 单回路维护格式延伸）
```

- **检测时机**：VisualCatalog 面板打开 / 项目切换时主动拉取——零新推送、零常驻角标，最小落地。
- **K1 零触发依据**：DTO 仅主进程/renderer 两端消费（无 MCP 工具消费），`electron/style/types.ts` 定义 + `global.d.ts` 镜像即可——feature-005 D5「三端消费镜像不可行」的反向适用。

## 2. 关键决策

| # | 决策 | 理由 |
|---|---|---|
| D1 | 差异双来源：引用条目现况比对 + J.3 变更日志 | 谱系升级覆盖旧版 md，逐字段 diff 工程上不可得；「现况 + 变更记录」覆盖 §8.3「提示差异」语义，且面板文案明示口径防误解 |
| D2 | J.3 段格式约定 + 本包仅落地空段骨架 | §8.3 维护单回路「AI 只改 md」的格式延伸——差异明细的事实在谱系文件一侧（单一事实源），平台只读；B-35 演示假数据（A7 备→主 / C6 锚点词）属虚构，写入真实谱系即污染 |
| D3 | 采纳 = 仅升版本号，复用 brief:update（白名单 +1 键） | §8.3 字面语义「人决定是否采纳」；「改风格→提示词重出」是改风格流程（另域未建包）；D-017 恒 mark 追溯机制零 diff 复用，立项单版本 +1 自带审计 |
| D4 | 忽略 = 关闭不持久化 | 版本差是客观事实，「已忽略到 vX」状态文件会让提示语义变复杂（何时重现？）；持续提示即 §8.3 本意，零新状态面 |
| D5 | 采纳前置校验（面板版本 vs 采纳时谱系版本） | 面板打开后谱系再升级的竞态：不校验则把项目采纳到一个又变旧的版本；校验拒绝 + 提示刷新，renderer 侧一次重取即可，零主进程改动 |
| D6 | blocking 语义衔接 style.validate | 引用 ID 已移除时采纳无意义（版本号升了但风格引用已失效）；禁用 + 提示重选，与 `STYLE_ID_UNKNOWN` 在 publish 就绪校验形成同一防线 |
| D7 | 检测时机 = 面板打开，不做常驻提示 | 谱系面板是差异的唯一消费场景；项目列表角标/启动检测属增强，包面控制排除 |
| D8 | TABS/条目卡片真实化排除（B-41） | 缺口 #2 的本体是「升级差异工作流」；面板全量数据驱动是另一独立缺口，混入会双倍包面——登记另立包 |

## 3. 文件白名单

**新增（3）**：`electron/style/upgrade.ts`、`src/test/style-upgrade.test.ts`、`src/studio/visual-catalog.test.tsx`
**修改（≤8）**：`electron/style/types.ts`、`electron/main.ts`、`electron/preload.ts`、`src/global.d.ts`、`src/studio/VisualCatalog.tsx`、`src/dev-mock-api.ts`、`src/test/brief-update.test.ts`（增用例不改既有断言）、`resources/H3-Style/AI短剧制作视觉风格谱系.md`（J.3 骨架）
**文档（4）**：本包 5 文件、`docs/features/README.md`、`docs/设计现状与偏差清单.md`（B-40/B-41）、`版本记录.md`
**零 diff 红线**：`shared/types.ts`、`electron/brief/*`、`electron/gate/*`、`electron/canvas/*`、`electron/style/loader.ts`、`electron/style/parse-md.ts`、`electron/style/catalog.ts`、`electron/mcp/tools.ts`、`resources/opencode/agents/*.md`、`tailwind.config.js`、`package.json`、其余既有测试文件

## 4. 风险与边界

| 风险 | 缓解 |
|---|---|
| J.3 段维护靠谱系维护者自觉（格式延伸无强制） | 解析失败/缺失只降级为「未提供明细」不阻塞主流程（版本对 + 引用现况仍在）；格式约定写进谱系 md 注释，维护单回路自然携带 |
| 演示面板替换后旧 data-catalog-* 凭据消失 | 契约 §4.2 新凭据全量登记；组件测试按新凭据断言；旧凭据无其他消费方（演示面板为 B-35 孤件） |
| `brief:update` 扩键被滥用于绕过风格校验 | `catalogVersion` 与既有键同级校验（typeof string）；采纳前置校验在 renderer；publish 就绪校验（STYLE_VERSION_MISMATCH/STYLE_ID_UNKNOWN）仍是最终防线 |
| 未立项项目打开谱系面板 | 空态返回（`noBrief`），面板提示「立项后可采纳」，不抛错不崩 |
