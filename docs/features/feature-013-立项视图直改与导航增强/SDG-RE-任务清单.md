# feature-013 立项视图直改与导航增强 · SDG-RE-任务清单

> **任务包**：`docs/features/feature-013-立项视图直改与导航增强/`
> **状态**：规格已建，**待用户批准后方可实施（铁律 1：No Spec, No Code）**；T1 起每一项执行前须先确认用户已批准本规格。
> **上游**：[SDG-RE-需求规格.md](./SDG-RE-需求规格.md) · [SDG-RE-契约.md](./SDG-RE-契约.md)
> **基线参照行**（承 feature-806 T7，2026-10-28 同日实测）：vitest **66 文件 / 761 passed / 0 failed / 1 skipped**；`tsc --noEmit` 恰 3 条（scripts/electron-smoke.mjs 1 + Stage3AssetHub.tsx 2）；MCP 工具 **28**；showrunner 白名单 **23**；契约三件套（contracts.test.ts 15 / canvas.contract.test.tsx 21 / smoke 8）全绿。**T1 必须复核实测，不承旧数**。

---

## T1 · 基线冻结与拍板确认（K1/K8 拍板落地）

- **做什么**：
  1. 与用户逐条确认需求规格 §3.4 决策点 1–5 拍板结果（重点：决策点 1 拍板 A/B/C；决策点 2 diagnosisDetail 是否直改），将拍板结论回填需求规格 §3.4「拍板」列与契约 §6 表（📝 修订注登记）。
  2. 复核 806 T7 基线并实测冻结：`pnpm vitest run`（期待 66 文件 761 passed / 0 failed / 1 skipped）、`npx tsc --noEmit`（恰 3 条已知）、`pnpm harness` 全绿、MCP 工具 28 / 白名单 23。若基线漂移（如 812 已先行落地）→ 停手报用户，以新实测为准更新本行与相关引用。
  3. 确认 feature-012 是否已存在（现不存在）；若已存在，核对 013 文件白名单与 012 无交集。
- **验收**：拍板结论全部回填；基线实测数字落入变更记录 T 节；漂移/冲突有用户裁决。
- **评审关注**：无拍板回填不动工；基线数字必须实测。

## T2 · K1 共享层扩模（仅拍板 A；拍板 B/C 时替换）

- **前置卡口**：**K1 决策已批**（改 `shared/types.ts` 视同共享层）。
- **做什么**：
  1. 按契约 §1.1 在 `shared/types.ts` 新增 `BriefL0` 接口；`ProjectBrief` / `BriefDraft` 各增 `l0?: BriefL0`（可选字段，向后兼容：存量 v1 立项单无 l0，读取处全部 `?.` 兜底）。
  2. `electron/brief/diff.ts` 命名空间表增 `l0.tags` / `l0.notes` → `impact: '低'`。
  3. 落盘与版本化链路（publish/draft 装配点）贯通 l0 字段：再版时全量正文含 l0；`立项单.vN.md` 头部增「标签 / 备注」两行（有值才渲染）。
  4. 写测试：diff l0 变更命中低级（不入清单、直接落盘）；旧版无 l0 立项单读取/再版不炸。
- **拍板 B/C 替换分支**：不改 types.ts / diff.ts；改为 manifest.json 扩字段（B）或新增 `立项元数据.json` sidecar + 读写工具（C）；测试改为对应存储的读写回归。diff/历史/回滚对 L0 不生效——此为 B/C 的已知代价，须用户拍板时明示接受。
- **验收**：tsc 恰 3（零新增）；新增测试绿；存量版本兼容测试绿。

## T3 · K8 直改通道扩键（主进程）

- **前置卡口**：**K8 决策已批**（`brief:update` 系统通道扩键，循 D-017/810 先例；不新增 IPC、不动 preload 桥签名）。
- **做什么**：
  1. `electron/brief/update.ts`：`BriefUpdatePatch` 扩契约 §2.1 键组（fiveElements 补 genre/tone/platforms；premise 五键组；diagnosisSummary；拍板 A 时 l0；拍板 D2-b 时 diagnosisDetail）。
  2. `electron/main.ts` L218-266 白名单同步扩键 + 服务端校验：字符串 trim 后非空（或允许显式清空，按字段定）、platforms/tags 逐元素非空；非法键/非法值 reject，错误文案与现状一致。
  3. 主流程复用现状骨架（diff → 就绪闸 → assess → 再版 → 恒 mark），**确认零改动**：批量 patch 一次调用 = 一次再版 + 一次评估。
  4. 写测试：各新键合法/非法用例；空 patch reject 现状不破；多键混合 patch 单次再版。
- **验收**：契约三件套全绿不破；新测试绿；preload/global.d.ts/dev-mock 零 diff（签名未变）。

## T4 · 立项视图 L1/L2 全字段直改（renderer 事一）

- **做什么**（全部落在 `Stage0View.tsx` 的 BriefEditPanel，样式复用现有控件类）：
  1. 五要素补三控件：题材（多文本 chip 编辑器）、基调（文本输入）、平台（多文本 chip 编辑器）——替换现状 FieldRow 只读展示（L398/L399/L406）。
  2. 故事前提卡①五键改控件：logline 文本域 + protagonist/goal/obstacle/stakes 文本输入；保留「修改立项…」展开按钮、009 确认色/「不可篡改」徽标与「AI 已填 N 项」计数逻辑不动。
  3. 风格卡② `mainStyleName`/`auxiliaryStyleName` 增文本输入（与 *Id 同卡）；诊断卡③ `diagnosisSummary` 改文本域（诊断依据保持只读）。
  4. 直改保存成功 → 调用方刷新立项数据（复用现状 loadBrief 链路），卡片随之重渲染（消弭 L588「重进项目后反映」现状提示）。
  5. 文案清理：删 L376 注释后半句、L453「题材」字样、L588 旧提示句；就绪红线段保持（仅措辞与「可点上方字段补齐」对齐）。
  6. 写测试：面板渲染计数（卡①1 按钮 + 5 控件、五要素全控件）；提交 patch 键集合正确；保存后刷新被调用；未发布项目面板不出现（现状红线）。
- **验收**：AC1/AC3/AC4；组件测试绿；tsc 恰 3。

## T5 · L0 标签/备注落地（renderer 事二 + 模型接线）

- **依赖**：T2 完成（拍板 A）；拍板 B/C 时改为对应存储的读写接线。
- **做什么**：
  1. 卡④「标签」FieldRow → 多文本 chip 编辑器；其下新增「备注」多行文本域；初值取 `brief.l0`（缺省空）。
  2. patch 增 `l0: { tags?, notes? }` 键（拍板 A），随面板一次提交。
  3. 未发布项目：卡④标签/备注输入禁用 + 提示「立项发布后可直接修改」（与 L0 入模语义一致；项目名 rename 通道不受限）。
  4. 验收 AC2 双口径：再版后历史正文可溯（004 历史面板可见 v(N-1) 与 vN 的标签/备注差异）；diff 命中低级 → 影响清单**无**新增条目（直接落盘）。
  5. 写测试：l0 patch 组装；未发布禁用态；低级不入清单断言。
- **验收**：AC2；测试绿。

## T6 · 导航增强（renderer 事三）

- **做什么**：
  1. `StageNavPanel.tsx`：brief 节点增 hover 版本历史卡——onMouseEnter 首次懒调 `window.api.briefHistory(projectPath)`，会话内缓存；自定义绝对定位卡（非原生 title），列出版本号/时间/类型/方式/变更数（映射 BriefHistoryItem 现有字段，**不加 note**）；加载中/空态/未发布降级（不渲染卡，保现状 title）；与 confirm 弹层互斥（悬停他处即关）。
  2. 派生口径抽纯函数（如 `deriveBriefDisplay(project, brief)`）：返回 brief 节点版本/状态的单一事实源，StageNavPanel 与 StudioApp 共用；vN = max(节点 meta.version, dirty.latestBriefVersion) 逻辑从 L45-49 迁入。
  3. `StudioApp.tsx`：stage-track STAGE 0 `title` 改统计口径（L529）：「立项 vN · X 产物已对齐 · Y 待处理」；Y=0 显示「全对齐」变体；未发布降级「STAGE 0 · 立项」。取数全部来自已在 renderer 的 project 态，**零新 IPC/订阅**。
  4. 写测试：派生纯函数用例（vN 取大/未发布/全对齐）；tooltip 格式化三态；hover 卡渲染与降级。
- **验收**：AC5/AC6；测试绿；K8 零新通道复核。

## T7 · 全量回归

- **做什么**：`pnpm vitest run`、`npx tsc --noEmit`、`pnpm harness`、lint（若存在脚本）、构建（`pnpm build` 或等价）。
- **验收门（全部满足才算过）**：
  - vitest：通过数 ≥ 761 + 本包新增（写入 T 节实测）；**0 failed**；skipped = 1（不动 811 既有 skip；若 812 先落地为 2 则以 T1 冻结基线为准）。
  - tsc：恰 3 条已知（零新增）。
  - harness：0 错误（WARN 基线 ≤ 806 T7 记录值；增长须可解释）。
  - 契约三件套全绿；MCP 工具 = 28；白名单 = 23；零新依赖（package.json 零 diff）。

## T8 · 真机目验（桌面端）

- **做什么**（按需求规格 §5 AC7-AC9 逐项过）：启动桌面端 → 打开已发布项目 → 面板全字段直改（含标签/备注/故事前提/诊断结论）→ 保存 → 再版 toast/徽标/历史留痕/低级不入清单 → 左栏 hover 历史卡 → titlebar tooltip 统计与全对齐变体 → 点击 STAGE 0 切 v1.9 回归 → 未发布项目降级态。
- **验收**：AC7-AC9 全部目验通过；发现偏差 → 登记需求规格头部偏差表 + 修。

## T9 · 治理收尾

- **做什么**：
  1. 变更记录 T 节补全各任务实测与产出；如需 X 节修订（实施中与规格的偏差）逐条 📝 修订注。
  2. 反向同步检查（铁律 3）：规格与落地不一致处，按 L1/L2 裁决后同步改规格或改代码。
  3. 自查 806 包五文件无需联动（013 未改 806 机制；若 T1 发现 812 已改基线，此处补登记交叉引用）。
  4. 收尾清单：五文件齐、测试绿、卡口登记齐、用户验收。
- **验收**：治理件完整；用户确认收尾。

---

## 全景依赖

```text
T1（拍板+基线）─┬─> T2（K1 扩模，拍板 A）─> T3（K8 扩键）─> T4（事一）─┬─> T7 回归 ─> T8 目验 ─> T9 收尾
               └─（拍板 B/C 替换分支）───────────────────> T5（事二）─┘
                                        T6（事三，仅依赖 T1）─────────┘
```

- T6 与 T2-T5 无依赖，可并行；T5 依赖 T2/T3（l0 键入通道）。
- 任何任务触发未登记卡口或白名单外文件 → 立即停手报用户（铁律 1 / K10）。
