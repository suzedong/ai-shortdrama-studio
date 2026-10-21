# SDG-AI-变更记录 — feature-811 谱系面板全量真实化（B-41 收尾）

## D 节 · 决策记录

### D-001 建包登记（2026-10-20，已批准并实施闭环）

**背景**：偏差清单 B-41（《设计现状与偏差清单.md》L73）登记 VisualCatalog 谱系面板两项硬编码偏差，性质 ⬜ 待建包，建议动作：①TABS / 条目卡片数据驱动（style:catalog entries 消费，STYLES 硬编码表退役）；②对话内风格选项卡版本号真实化（style:catalog 版本）+ `STYLE_CATALOG_VERSION` 常量退役（ChatComposer 引用点与 chat-markdown.test.tsx 断言同步改写）。

**侦察实证（建包期已核原文）**：
- `VisualCatalog.tsx`：STYLES 18 条硬编码（L33-57）、TABS 5 行手写（L125-132）、`STYLE_CATALOG_VERSION='v1.46'`（L26-30，含 810 L1 自决留痕三注释块——随本包归并退役）、styleNameOf（L59-62）、FAMILIES（L18-24，全仓仅 STYLES 行消费，随 STYLES 安全退役）
- `ChatComposer.tsx`：L165 校验 / L215 查找 / L245 版本号三处引用点
- `Stage0View.tsx` L19-22 / `StudioViewer.tsx` L21-24：styleRefLabel 经 styleNameOf 查 STYLES
- `main.ts` L336-339：`style:catalog` 已返回 `{ version, count, entries }` 十键全返（810 落地），**数据面已备，主进程零 diff 可行**
- `LoadedStyleCatalog` 装载形态：注册表骨架（name 在注册表）& md 明细（version 在 md J.0）→ 真机验证限定改版本号+锚点词且须重启应用
- `StudioApp.tsx` L716：toast `family.split('·')[0]` 对无 '·' 的 familyLabel 天然降级 → StudioApp 零 diff
- `global.d.ts` L43-54：`StyleCatalogEntryDto` 十键已镜像 → store 零新类型面

**设计抉择（随包呈报，批准即生效）**：
1. 新建单点 store 缓存（D1），四组件消费；同步查询 + 懒 ensure 双层保纯函数语义（D2）
2. 家族标签口径 = `familyLabel`（J.1 权威词汇）；onAdopt payload 同步改传（D3，StudioApp 零 diff）
3. 弹层 anchorWords / textureRecipe 原文上屏（真实化红利）；visualTraits 不上屏（D4，防范围膨胀）
4. 三件套（STYLES / FAMILIES / STYLE_CATALOG_VERSION / styleNameOf / StyleEntry 接口）物理删除（D5）
5. dev-mock 自具 18 条演示表摆脱 import（D6）；810 差异工作流零 diff（D7）；测试注入 `_setStyleCatalogSnapshotForTest` + 三文件 prime（D8）

**卡口登记**：K1 / K8 / K9 **全零触发**（依据见 SDG-RE-契约.md 置顶卡口声明）。

**偏差登记**：本包实施收尾关闭 B-41（T9 翻 ✅）。

**溯源标签**：[Design 原有·形态对齐]（MiniMax Design 谱系面板形态对齐，底层以 style:catalog 数据驱动自研实现）。

**技术决策指针**：SDG-OD-设计说明.md §2 D1-D8。

## T 节 · 任务执行记录

- **T1 基线冻结（2026-10-20）**：全量 **56 文件 638 passed / 0 failed / 1 skipped**；typecheck 恰 3 条历史基线（canvas-zoom.test.tsx×2 + runtime-client.test.ts×1）——与批准冻结值一致，红线冻结。
- **T2 store 新建**：[style-catalog-store.ts](../../../src/studio/style-catalog-store.ts)——模块级快照 + useSyncExternalStore；`ensureStyleCatalog(force?)` 懒加载单 flight（in-flight 复用 / ok 态 no-op / window.api 缺失 → unavailable 不抛）；`useStyleCatalog()` 首订阅懒 ensure；`getStyleEntry` / `getStyleName` 同步快照读（未到位 null 回退，保纯函数语义）；`_setStyleCatalogSnapshotForTest` 测试注入；零 import 副作用（jsdom 安全）。
- **T3 VisualCatalog 改造**：三件套（STYLES 18 条硬编码表 / StyleEntry 接口 / FAMILIES / STYLE_CATALOG_VERSION 含 810 L1 自决留痕三注释块 / styleNameOf）物理删除；`useStyleCatalog()` 接入，TABS 六家族计数与 18 条目卡片全量 entries 数据驱动（TABS label = `` `${id}系 ${familyLabel}` ``，计数实算）；面板头部版本号 = 快照 version（failed/unavailable → 「谱系不可用」）；弹层 anchorWords / textureRecipe 原文上屏（D4：visualTraits 不上屏防范围膨胀）；`onAdopt` payload 改传 `entry.familyLabel`（D3，StudioApp toast `split('·')` 天然降级零 diff）；FAMILY_GRAD / PREVIEW_URL / VIDEO_URL / VID_TABS 静态资源映射保留；810 升级差异工作流零 diff（D7）。
- **T4 三组件切换**：[ChatComposer.tsx](../../../src/studio/ChatComposer.tsx) 校验 / 查找 / 版本号三处切 store（删常量 import；version 空 → `@` 与版本段不渲染）；Stage0View / StudioViewer 的 styleRefLabel 改 `getStyleName` 同步查询（known 集合数据源切换，extra 前置兜底保留）。
- **T5 dev-mock 自具化**：`DEMO_STYLE_CATALOG_ENTRIES` 自具 18 条十键演示表（口径对齐主进程 STYLE_REGISTRY role / feasibility / 辅助候选 + J.2 锚点词），摆脱对已删 STYLES 的 import；`DEMO_STYLE_CATALOG_VERSION='v1.47'` 保留；`demoStyleUpgradeDiff` 闭环零 diff。
- **T6 单测**：style-catalog-store.test.ts 新增 6 例（契约 §5 六断言点）；visual-catalog / chat-markdown / studio-viewer / stage0-view 四测试文件改写（beforeEach prime 快照 `_setStyleCatalogSnapshotForTest`；chat-markdown 版本号断言来自 prime 值 `v9.99-test` 非常量；E99 未收录 ID 纯文本兜底保持）；测试文件净增恰 1（56 → 57）。
- **T7 全量回归（2026-10-20）**：**57 文件 648 passed / 0 failed / 1 skipped（649 total）**——638→648，+10 = store 6 + 811 describe 4；typecheck 恰 3 条历史基线零新增；Grep 静态验证 src 下 `STYLE_CATALOG_VERSION` / `STYLES` / `styleNameOf` / `FAMILIES` 零活引用。
- **T8 真机目验（2026-10-20，Electron 实机 + computer-use UIA）**：
  - **改动内容**：谱系 md（真实路径 `resources/H3-Style/AI短剧制作视觉风格谱系.md`，loader.ts `STYLE_DIR_NAME` / `STYLE_FILE_NAME` 权威；任务清单原文 `resources/style/短剧视觉谱系.md` 为旧称；改动前备份至 `%TEMP%\AI短剧制作视觉风格谱系.md.t8bak`）——J.0 版本行 v1.46→v1.47（parse-md `VERSION_RE` 仅捕获 `vX.YY` 格式，版本号合规递增）+ A7 条目锚点词列追加 `T8VERIFY`（不改条目名称）。
  - **同步目验（改动期，新进程）**：重启应用（loader 模块级缓存随进程失效）→ 面板头部版本号 **v1.47** ✅；TABS 实算计数（全部 18 / A 6 / B 1 / C 5 / D 5 / E 1）✅；A7 弹层锚点词含 `T8VERIFY` ✅、质感配方块上屏 ✅（截图 + AX 树双留证，temp 内联存证）。
  - **复原目验（再重启）**：md 备份覆盖复原（版本行回 v1.46，Select-String 核验）→ 重启 → 面板头部 **v1.46** ✅；A7 弹层锚点词 `realistic human-like anime, lifelike expression, cinematic（中文直译：仿真人动漫 / 拟真人）` 无 `T8VERIFY` ✅。**复原确认。**
  - **对话选项卡（对批准文本的执行偏差，明示）**：真机会话无现成风格选项卡可目验——opencode.db 全库字节检索：闭合块 `【/风格选项】` **零命中**；`【风格选项】` 6 处命中全部位于 agent reasoning 文本（showrunner 剧本「不反问」纪律下 agent 倾向把风格主推荐写进定案卡而非发选项块，驱动新对话亦无法确定性产出有机选项卡、且会污染项目会话与消耗真实 ARK 额度）。替代取证三点闭环：①选项卡与面板消费**同一 store 同一快照同一 version 字段**（ChatComposer `useStyleCatalog()` → `{entry.name} · {entry.id} @ {catalog.version ?? '…'}`）；②浏览器 dev-mock 演示会话（d8 风格选项块，`npm run dev:renderer` 等价物 + Playwright）真机渲染：`拟真人·仿真人动漫 · A7 @ v1.47` / `年代胶片（千禧·90s·80s） · A3 @ v1.47` / `清新生活流 · B1 @ v1.47`（@ 后 = store 快照 version）+ 40px 缩略图 + 主·已验证 / 备·风险自担徽标（截图 `%TEMP%\t8-chat-option-card-2026-10-20T13-14-38-780Z.png`）；③单测 chat-markdown.test.tsx 断言 `A7 @ v9.99-test`（prime 快照直证版本号渲染点）。版本号 / 锚点词与 md 双向同步由面板目验闭环证明；选项卡版本号渲染点由「同一 store + dev-mock 渲染 + 单测」三点闭环。
  - **辨析留痕**：应用标题栏「视觉风格谱系 vX」按钮显示项目立项时固化的 brief.catalogVersion（记录值），不随 md 实时变化——设计使然，非本包改造目标；「谱系当前已是最新」钮 disabled 属 802/810 既有行为。
- **T9 治理收尾（2026-10-20）**：本记录 T/X 节回填；偏差清单 B-41 行翻 ✅ 已解决；README 总表 811 行翻 ✅ 已落地；呈报用户验收。

## X 节 · 修复记录

零修复——T1-T8 全程未触发代码修复（T7 一次通过；T8 目验改动均作用于谱系数据文件且已复原确认）。
