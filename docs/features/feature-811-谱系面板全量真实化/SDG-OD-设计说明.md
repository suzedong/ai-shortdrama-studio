# SDG-OD-设计说明 — feature-811 谱系面板全量真实化（B-41 收尾）

## 1. 落点架构

```
resources/style/短剧视觉谱系.md  (J.0 version / J.2 条目明细)
        │  loader（主进程缓存，重启失效）
        ▼
electron/main.ts  style:catalog ── { version, count, entries } 十键 ── [810 既有，零 diff]
        │  IPC（window.api.styleCatalog）
        ▼
┌─────────────────────────────────────────────┐
│ src/studio/style-catalog-store.ts  [新建]    │
│  模块级快照 {status, version, entries}       │
│  ensure(force?) 单flight · useStyleCatalog   │
│  getStyleEntry / getStyleName 同步读         │
│  _setStyleCatalogSnapshotForTest 测试注入    │
└─────────────────────────────────────────────┘
        │ 订阅 / 同步读
        ▼
VisualCatalog(TABS·卡片·弹层)  ChatComposer(选项卡·校验·版本)
Stage0View(styleRefLabel·known)  StudioViewer(styleRefLabel)

退役：STYLES 18条硬编码 / StyleEntry 接口 / FAMILIES /
      STYLE_CATALOG_VERSION('v1.46' 含810留痕注释) / styleNameOf
保留：FAMILY_GRAD / PREVIEW_URL / VIDEO_URL / VID_TABS（静态资源映射）
零 diff：electron/** · shared/types.ts · global.d.ts · StudioApp.tsx
dev-mock-api.ts：DEMO_STYLE_CATALOG_ENTRIES 自具 18 条演示表（不再 import STYLES）
```

## 2. 关键决策

| # | 决策 | 理由 |
| :-- | :-- | :-- |
| D1 | **单点 store 缓存**，四组件不各自拉 IPC | 防重复调用与状态分叉；loader 主进程缓存语义在 renderer 侧镜像 |
| D2 | **同步查询（getStyleName）+ 懒 ensure 双层** | Stage0View / StudioViewer 的 `styleRefLabel` 是纯函数（render 期调用），不能 hook；同步读快照保纯函数语义，组件挂载懒 ensure 负责填充；快照未到时回退纯文本（与既有 E99 未收录路径同形态） |
| D3 | **家族标签口径 = `familyLabel`**（J.1 权威词汇，如 '写实影像系'），替代 `FAMILIES[...].split('·')[0]` 派生（'写实影像'）；onAdopt payload `family` 同改 | 数据驱动正果；StudioApp L716 toast `family.split('·')[0]` 对无 '·' 字符串天然降级为整串 → **StudioApp 零 diff 成立**（已核原文） |
| D4 | **弹层真实化红利**：anchorWords / textureRecipe 原文上屏；textureRecipe 空串 → 该块不显示；**visualTraits 不上屏** | md 明细终于可见；但 visualTraits 无对应 UI 槽位，上屏 = 新 UI 槽位 = 范围膨胀（契约 §6 越界行） |
| D5 | **三件套物理删除**非保留兼容 | 偏差清单 B-41 建议动作即「STYLES 硬编码表退役」；810 L1 自决留痕三注释块随常量一并归并进本包（需求规格 §1 已载） |
| D6 | **dev-mock 自具演示表**，不读真实谱系 | mock 是演示环境（`DEMO_` 前缀、版本 'v1.47' 故意区别于真实），与真实 md 解耦；摆脱 import 后 STYLES 才能物理删除 |
| D7 | **徽章同源 + diff/采纳走 810 直连**，本包零 diff | 810 已落地差异面板全链路；本包只动「目录数据从哪来」，不动「升级工作流怎么跑」 |
| D8 | **测试注入模式 `_setStyleCatalogSnapshotForTest`**：三文件（chat-markdown / studio-viewer / stage0-view）beforeEach prime；visual-catalog 走真实拉取路径（mock window.api） | jsdom 无 window.api；prime 后 `ensure(force=false)` 遇 `ok` 必须 no-op（否则挂载懒 ensure 覆盖测试快照——store 契约关键规则） |

## 3. 文件白名单

| 类别 | 文件 |
| :-- | :-- |
| 新增（2） | `src/studio/style-catalog-store.ts`；`src/studio/style-catalog-store.test.ts` |
| 修改（9） | `src/studio/VisualCatalog.tsx`；`src/studio/ChatComposer.tsx`；`src/studio/Stage0View.tsx`；`src/studio/StudioViewer.tsx`；`src/dev-mock-api.ts`；`src/studio/visual-catalog.test.tsx`；`src/studio/chat-markdown.test.tsx`；`src/studio/studio-viewer.test.tsx`；`src/studio/stage0-view.test.tsx` |
| 文档（4） | `docs/设计现状与偏差清单.md`（B-41 行）；`docs/features/README.md`（总表）；本包变更记录；（T8 真机记录） |
| **零 diff 红线** | `shared/types.ts`；`electron/**`；`src/global.d.ts`；`src/studio/StudioApp.tsx`；`resources/style/短剧视觉谱系.md`（T8 仅临时改动且必复原）；`tailwind.config.*`；`package.json`；`vite.config.*`；其余 47 个测试文件 |

## 4. 风险与边界

| 风险 | 边界 / 缓解 |
| :-- | :-- |
| jsdom 无 `window.api` → store 导入或 ensure 抛错 | store 模块零副作用；ensure 判空 → `unavailable` 不抛；选项回退纯文本（契约 §1.1 降级行 + 既有 E99 形态一致） |
| 快照未到时富选项暂退纯文本 | 仅首帧；懒 ensure 完成后重渲染恢复富选项；测试以 prime 规避时序 |
| 家族标签口径变化（'写实影像' → '写实影像系'）被误判回归 | 属真实化正果（D3）；组件测试断言同步改写；StudioApp toast 文案同步变化（split 降级为整串）已论证可接受 |
| dev-mock 演示表与真实谱系漂移 | 可接受：mock 即演示环境（D6）；版本号故意 'v1.47' 区分 |
| loader 主进程缓存致 md 改动不生效 | 操作前提：**改 md 后须重启应用**（需求规格 §4.2-9 明示；AC7 真机流程含重启步骤） |
| md 条目按名称关联注册表，改名称破坏装载 | AC7 限定临时改动 = **版本号 + 锚点词**，不改条目名称（任务清单 T8 红字） |
