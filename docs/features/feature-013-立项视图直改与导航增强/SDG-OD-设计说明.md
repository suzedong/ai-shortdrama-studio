# SDG-OD-设计说明 · feature-013 立项视图直改与导航增强

> **上游**：[SDG-RE-需求规格.md](./SDG-RE-需求规格.md)（§3.4 决策点呈报表）· [SDG-RE-契约.md](./SDG-RE-契约.md)
> **性质**：本文件给出方案设计与取舍理由；**决策点 1/2 等标「待拍板」处，以用户拍板为最终结论**，拍板后回填需求规格 §3.4。

## 1. 落点架构

```
 立项视图 v1.9（Stage0View · BriefEditPanel，已发布项目）
 ┌────────────────────────────────────────────────────────┐
 │ 卡① 故事前提  logline/protagonist/goal/obstacle/stakes  │ 五控件（现只读）
 │ 卡② 风格      mainStyle/auxiliaryStyle 各 Id+Name       │ +2 控件
 │ 卡③ 诊断      diagnosisSummary 可改 / diagnosisDetail 读 │ 推荐 D2-a
 │ 卡④ 项目      项目名(改名通道) + 标签 chip + 备注文本域   │ L0 入模（K1）
 │ 五要素        kind/集数/时长/画幅(已有) + 题材/基调/平台   │ +3 控件
 └──────────────┬─────────────────────────────────────────┘
                │ 批量 patch 一次提交（D-016 系统直改，零对话）
                ▼
 brief:update（electron/main.ts L218-266，K8 白名单扩键）
                ▼
 updateBriefFields 骨架零改动：diffBrief → 就绪闸 → assessImpact
   → publishBriefFiles（再版 vN+1，approve.by='ui'，双写 .md）
   → 影响清单恒 mark（l0.* 命中低级 → 不入清单直接落盘，002 §L48 落地）
   → manifest 推进 → 画布单次写挂脏（CanvasDirty.markedAt）
                │ canvas:changed（既有推送，零新 IPC）
                ▼
 ┌─ StageNavPanel：brief 节点 ✓ vN ⚠k（现状）
 │   + hover 版本历史卡（复用 004 brief:history，懒加载+会话缓存）
 └─ StudioApp stage-track：title「立项 vN · X 已对齐 · Y 待处理」
     （vN 与左栏同源：deriveBriefDisplay 纯函数单一事实源）
```

## 2. 关键决策

| # | 决策 | 理由 |
|---|---|---|
| D1 | **L0 标签/备注模型归属：推荐 A——入立项单 v2 模型**（`BriefL0 { tags?: string[]; notes?: string }`，`ProjectBrief`/`BriefDraft` 增 `l0?`，触 K1）；备选 B 入 manifest.json、C 独立 sidecar `立项元数据.json` | ① 设计书 §2.6.6 L264 将 L0 与 L1/L2 并列「全字段可改」且触发入口=立项视图再版语义，L0 是立项单内容而非项目元数据；② 002 需求规格 L48 明示「备未来 L0 落地」——入模即启用低级「直接落盘」，分级表从空转有了命中字段，设计闭环；③ 入模后 004 历史/diff/回滚自动覆盖 L0 留痕（零增量机制），B/C 均失去版本化追溯；④ 项目名例外留 `.session.json`（B-19 project:rename 通道不搬家，不入模）。B/C 代价：diff/历史/回滚对 L0 不生效，与 §2.6.6「hover 历史含 L0 变更」冲突 |
| D2 | **字段分层直改控件表**：逐字段控件形态见 §2.1 明细；**诊断结论类推荐 D2-a——仅 diagnosisSummary 直改、diagnosisDetail（诊断依据）保持只读** | diagnosisSummary 是结论性短文本（影响面已在 002 归「中」级）；diagnosisDetail 是 AI 诊断过程依据，直改会使「依据」与「结论」脱钩且文本长、无再版增益；保留一块只读区也维持视图的信息分层 |
| D3 | **直改与影响评估衔接：沿用现状，零新机制**——面板批量 diff 一次提交 = 一次 updateBriefFields = 一次再版 + 一次复算 + 恒 mark | update.ts 骨架（合并 patch→diff→就绪闸→assess→再版→清单→画布挂脏）已是批量语义；任何「逐字段即时保存」都会放大版本数与评估次数，违背 §2.6.7 一次再版一次评估的设计 |
| D4 | **titlebar tooltip 统计口径：与左栏同数同源**：Y=dirty 节点数（=左栏 ⚠k 总和）；X=done+parentReference 且非 dirty 且非 brief 节点数；vN 由 `deriveBriefDisplay` 纯函数派生（max(节点 meta.version, dirty.latestBriefVersion)），StageNavPanel/StudioApp 共用；Y=0 显示「全对齐」变体（设计书 L306）；未发布降级现状文案 | 两套口径必然漂移（左栏 ⚠2 而 tooltip 写 3 即信任崩塌）；取数全在 renderer 已有 project 态，零新 IPC/订阅（K8 最小扩面） |
| D5 | **故事前提直改与 009 衔接：人经面板直改即 human 语义**——patch 落 premise.* 时由 update 通道按现状数据流推进，009 分色/徽标零 diff，仅面板侧加控件；「不可篡改」徽标语义不变（指 AI 生成后未经人确认态的标识，不阻止人改） | 009 的 human/ai 确认色数据流已就绪；面板直改与对话改落同一模型同一追溯（D-016 双通道同一数据模型） |
| D6 | **版本历史 hover 卡：复用 004 `brief:history`，自定义 hover 卡**——原生 title 无法承载列表；懒加载 + 会话内缓存；列版本号/时间/类型/方式/变更数（BriefHistoryItem 现有字段全集映射，note 不入卡）；加载中/空态/未发布三态降级 | 004 三 IPC 三端（preload/global.d.ts/dev-mock）已备，零新通道；左栏节点空间紧凑，卡内只列单行五要素 |
| D7 | **平台/题材等数组字段不新增枚举闭集校验**——白名单仅做 string[] 逐元素非空校验，枚举兜底交 806 harness SPEC_FIELD_ENUM | 枚举表属 806 校验域；通道层重复闭集 = 两套口径；D-016 标尺：能写表单校验的系统做，但同一规则只做一个落点 |
| D8 | **未发布项目降级：面板不出现（现状红线不动），卡④标签/备注禁用态仅存在于已发布后** | L0 入模即随版本化，未发布无版本可溯；项目名 rename 通道不受此限（.session.json 路径独立） |

### 2.1 D2 字段分层直改控件明细（逐字段）

| 层级 | 字段 | 现状（Stage0View） | 本包控件形态 | patch 键 |
|---|---|---|---|---|
| L0 | 项目名 | 卡④ FieldRow 只读 + 「改名」按钮 | **维持**（project:rename 通道，不入模） | — |
| L0 | 标签 tags | 卡④ FieldRow 只读（**无模型**，L0 标签现状不落盘） | 多文本 chip 编辑器（增删 chip） | `l0.tags`（拍板 A） |
| L0 | 备注 notes | **不存在**（无模型无 UI） | 卡④新增多行文本域 | `l0.notes`（拍板 A） |
| L1 | kind 类型 | 下拉（已有） | 维持 | `kind` |
| L1 | episodeCount 集数 | 数字输入（已有） | 维持 | `fiveElements.episodeCount` |
| L1 | episodeDuration 时长 | 数字输入（已有） | 维持 | `fiveElements.episodeDuration` |
| L1 | aspectRatio 画幅 | 选择（已有） | 维持 | `fiveElements.aspectRatio` |
| L1 | genre 题材 | FieldRow 只读（L398） | 多文本 chip 编辑器 | `fiveElements.genre` |
| L1 | tone 基调 | FieldRow 只读（L406） | 文本输入 | `fiveElements.tone` |
| L1 | platforms 平台 | FieldRow 只读（L399） | 多文本 chip 编辑器 | `fiveElements.platforms` |
| L2 | premise.logline | 卡①只读 | 多行文本域 | `premise.logline` |
| L2 | premise.protagonist / goal / obstacle / stakes | 卡①只读 | 文本输入 ×4 | `premise.*` |
| L2 | style.mainStyleId / auxiliaryStyleId | 选择（已有） | 维持 | `style.*Id` |
| L2 | style.mainStyleName / auxiliaryStyleName | 只读展示 | 文本输入 ×2（与 Id 同卡） | `style.*Name` |
| L2 | diagnosisSummary | 只读（L426-431） | 多行文本域 | `diagnosisSummary` |
| L2 | diagnosisDetail | 只读（L432-438「恒只读」注释） | **保持只读**（推荐 D2-a）；拍板 D2-b 则文本域 | （D2-b 时 `diagnosisDetail`） |

### 2.2 与 002/004 的数据流关系

- **002（影响评估）**：本包不碰 diff/assess/classify 算法，仅做两件事——① diff 命名空间表增 `l0.tags`/`l0.notes` → 低级（002 L48 预留路径启用）；② 新直改字段走既有命名空间（fiveElements.genre 等已有 Δ 定义，分级不变：题材/平台/基调/诊断结论=中，premise/style=高）。评估骨架零 diff。
- **004（版本历史/回滚）**：L0 入模后自动进入版本化全量正文，history/version-read/rollback 三 IPC 零 diff；hover 卡仅新消费 `brief:history` 既有返回。回滚一版即 L0 一并回滚——这是拍板 A 的附带语义，须在 AC 目验中验证。

## 3. 文件白名单

见 [SDG-RE-契约.md](./SDG-RE-契约.md) §4（新增 / 修改 / 文档 / 零 diff 红线四类表），实施不得越表。

## 4. 风险与边界

| 风险 | 边界与缓解 |
|---|---|
| 拍板 B/C 导致 L0 失去版本化追溯 | 需求规格 §3.4 已明示代价；用户拍板即视为接受；规格中 AC2 双口径按拍板分支裁剪（📝 修订注） |
| 全字段直改放大误触再版（每次保存 = 新版本） | D3 批量一次提交约束 + 面板「保存修改」显式动作（非失焦即存）；toast 明示版本号 |
| premise 直改与 009「不可篡改」语义被误读 | 徽标语义在 D5 钉死（标识 AI 未确认态，不锁人改）；UI 文案不加「不可修改」字样 |
| 数组字段脏数据（空串 chip）入模 | 通道层逐元素非空校验 + 面板控件层去空白 chip；harness 枚举兜底不变 |
| 存量 v1 立项单无 l0 读取炸 | `l0?` 可选 + 全链路 `?.` 兜底 + T2 兼容测试（旧版读取/再版断言） |
| tooltip 与左栏口径漂移 | D4 单一纯函数同源派生 + 组件测试锁三态文案；禁止两处各自算 |
| hover 卡与 confirm 弹层/节点点击互斥失效 | hover 卡仅 mouseenter/leave 生命周期，不抢焦点；点击节点行为现状零 diff |
| 基线漂移（812/012 先行落地） | T1 实测冻结，不承 806 旧数；漂移即停手报用户更新基线行 |
| K1 拍板 A 后 types.ts 被顺势扩改他项 | K1 呈报范围 = 仅 `BriefL0` + 两处 `l0?`；任何额外字段改动即越界，停手呈报 |
