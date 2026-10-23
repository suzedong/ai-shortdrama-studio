# feature-009 · 前提卡分色 + 不可篡改水印 · 契约

> 版本：v1.0（2026-10-21）
> 本契约逐字锁定：判定规则、纯函数签名、组件 class/文案/凭据、diff 边界、测试构成。实施与验收以本契约为唯一事实源。

## 1. 判定规则（真值表逐字）

对 `PREMISE_FIELDS` 五键（leads / time / place / coreEvent / seasonBoundary，select.ts L110-116 表序）逐键判定：

- 命中集 S = facts 中 `matchChainTopic(f.topic)?.group === 'premise' && .key === 键` 的条目（词表复用 feature-008 契约 §1.2：leads=[leads,人物]、time=[time,时间]、place=[place,地点]、coreEvent=[coreevent,核心事件]、seasonBoundary=[seasonboundary,本季边界,季边界]；trim + 英文小写化精确匹配）；
- **S 中存在 status === 'confirmed' → 'human'**（人提供必 confirmed 缺省推导涵盖 source='user'；infer 后被确认亦算「人确认」，契合 §2.6.3 L184「人提供（或确认）」）；
- **S 非空且全 pending → 'ai'**（AI 先编的假版本）；
- **S 为空 → 'none'**（无事实来源记录，如系统直改通道写入；中性零标识）；
- 同键多条混合时 confirmed 优先（保守：人确认过即人确认事实，不逐值比对）；
- 六要素 topic / 未命中 topic 不进入任何 premise 命中集。

## 2. 纯函数签名（`src/studio/stage0/premise-facts.ts`，新建）

```ts
// feature-009 · 前提卡分色与不可篡改水印（纯函数层）
// 只消费 capture 事实（CapturedFact）；禁止 fs / window.api / Date / 随机；零 import 副作用（jsdom 安全）。
import type { ProjectBrief, CapturedFact } from '../../../shared/types'
import { matchChainTopic } from './chain'
import { PREMISE_FIELDS } from './select'

export type PremiseConfirmation = 'human' | 'ai' | 'none'

/** 前提五键 → 人确认/AI 拟稿/无记录（契约 §1 真值表；返回五键全覆盖，键 = PREMISE_FIELDS 表序） */
export function selectPremiseConfirmation(
  facts: CapturedFact[],
): Record<keyof ProjectBrief['premise'], PremiseConfirmation>
```

- 依赖方向：premise-facts.ts → chain.ts（matchChainTopic）+ select.ts（PREMISE_FIELDS）；chain.ts / select.ts 均零 diff、无循环依赖（chain.ts 对 select.ts 仅 type-only import）。

## 3. 组件契约（`src/studio/Stage0View.tsx` PublishedBody 卡②）

### 3.1 数据订阅

- PublishedBody 函数体内顶部新增：`const { facts } = useCaptureFacts()`（useCaptureFacts 自 Stage0Chain.tsx 导入，§4.2；loadError 不上屏——链态条已承载同错误，facts 缺省 [] → 全 none 静默降级）；
- `const confirmMap = useMemo(() => selectPremiseConfirmation(facts), [facts])`。

### 3.2 五键行（现 L524-527）逐字 diff 边界

行容器（现 `<div key={key} className="flex items-start gap-2 border-b border-[#F6F7FB] px-2.5 py-1.5 text-[11px] last:border-b-0">`）改为：

```tsx
<div
  key={key}
  className={`flex items-start gap-2 border-b border-[#F6F7FB] px-2.5 py-1.5 text-[11px] last:border-b-0${conf === 'human' ? ' bg-[#F2FBF6]' : conf === 'ai' ? ' bg-[#FDF8EE]' : ''}`}
  data-stage0-premise-row={key}
  data-stage0-premise-confirmation={conf}
>
  <span className="mt-px w-[58px] shrink-0 text-[10px] font-semibold text-[#9AA0B5]">{label}</span>
  <LeafValue value={brief.premise[key]} />
  {conf !== 'none' && (
    <span
      className={conf === 'human'
        ? 'ml-auto shrink-0 rounded-full border border-[#B9E8D2] bg-[#E7F8F0] px-1.5 py-px text-[9.5px] font-bold text-[#1E9E66]'
        : 'ml-auto shrink-0 rounded-full border border-[#F0E2C0] bg-[#FBF3E2] px-1.5 py-px text-[9.5px] font-bold text-[#B07E2A]'}
      data-stage0-premise-seal
    >{conf === 'human' ? '不可篡改' : 'AI 拟稿'}</span>
  )}
</div>
```

- `conf = confirmMap[key]`；label span 与 LeafValue 本体零 diff；
- 五键字段容器（现 L522 `<div className="rounded-md border border-line">`）加 overflow-hidden → `<div className="overflow-hidden rounded-md border border-line">`（首尾行底色圆角正确性，一词 diff）。

### 3.3 背景档案标题行（现 L538）逐字 diff 边界

button 内 `<span className="text-[#A6ABC0]">{bgOpen ? '▾' : '▸'}</span>故事背景档案.md` 之后追加：

```tsx
<span
  className="ml-auto shrink-0 rounded-full border border-[#B9E8D2] bg-[#E7F8F0] px-1.5 py-px text-[9.5px] font-bold text-[#1E9E66]"
  data-stage0-background-seal
>不可篡改</span>
```

- 徽标与 bg.phase 无关：折叠区存在（bg.phase !== 'absent'）即挂（档案整体即人确认事实集，§2.6.3；读取失败态档案事实性不因此贬损）；
- button accessible name 变为含「不可篡改」——既有断言 `getByRole('button', { name: /故事背景档案/ })` 为正则匹配，不碰撞。

### 3.4 文案与色值汇总（逐字）

| 用途 | 文案 | 行底色 | 徽标 class（rounded-full border px-1.5 py-px text-[9.5px] font-bold 之外的部分） |
|---|---|---|---|
| human 行 / 档案徽标 | 不可篡改 | bg-[#F2FBF6] | ml-auto shrink-0 border-[#B9E8D2] bg-[#E7F8F0] text-[#1E9E66]（与「已定稿」「门批准入」同族绿） |
| ai 行 | AI 拟稿 | bg-[#FDF8EE] | ml-auto shrink-0 border-[#F0E2C0] bg-[#FBF3E2] text-[#B07E2A]（琥珀系） |
| none 行 | （无徽标） | （无追加） | — |

### 3.5 凭据族

| 凭据 | 位置 | 值 |
|---|---|---|
| data-stage0-premise-row | 五键行容器 | leads / time / place / coreEvent / seasonBoundary |
| data-stage0-premise-confirmation | 同行容器 | human / ai / none（恒输出） |
| data-stage0-premise-seal | 行尾徽标 | 无值（human/ai 时存在） |
| data-stage0-background-seal | 背景档案标题行徽标 | 无值 |

### 3.6 禁用串（新文案防既有断言碰撞，建包前 Grep 已验证全 src 零匹配）

「不可篡改」「AI 拟稿」及凭据族 data-stage0-premise-row / -confirmation / -seal / -background-seal——实施完成后 T6 复查既有断言侧零碰撞（既有断言不含新串，新断言不引既有串做精确匹配）。

## 4. 挂载边界

### 4.1 Stage0View.tsx（本包唯一生产代码 diff 文件）

- import 段：追加 `useCaptureFacts`（from './Stage0Chain'）与 `selectPremiseConfirmation`（from './stage0/premise-facts'）+ useMemo（react 既有 import 扩展）；
- PublishedBody 函数体顶部：§3.1 两行；
- 卡②五键行容器 + 字段容器：§3.2；
- 背景档案标题行：§3.3；
- 其余全部零 diff：卡① / 编辑态 BriefEditPanel / 定案区 / 版本区 / empty 三态 / Header / 链态条挂载区（feature-008）/ BackgroundMd / LeafValue。

### 4.2 Stage0Chain.tsx（一词 diff）

- L15 `function useCaptureFacts()` → `export function useCaptureFacts()`；hook 本体与组件呈现零 diff；文件头注释可附一行「// feature-009：useCaptureFacts 导出供 Stage0View PublishedBody 复用（前提卡分色订阅）」。

## 5. 测试契约

`src/studio/stage0-premise-facts.test.tsx` 新建（**净增恰 1：59 → 60**；既有测试文件全零 diff）：

- **组① 纯函数 selectPremiseConfirmation**（真值表 AC1）：
  1. 空 facts → 五键全 none 且键全覆盖（leads/time/place/coreEvent/seasonBoundary）；
  2. source='user'（confirmed）→ 对应键 human；
  3. source='infer' + status='confirmed' → human（「人提供（或确认）」）；
  4. source='infer' + status='pending' → ai；
  5. 同键 confirmed+pending 混合 → human（confirmed 优先）；
  6. 中文别名（'人物'/'本季边界'/'季边界'）→ 命中对应键；
  7. trim + 大小写（' Leads '）→ 命中 leads；
  8. 六要素 topic（'题材'/'集数'）→ 五键全 none 不打扰；
  9. 未命中 topic → 五键全 none 不打扰。
- **组② Stage0View 集成**（renderView published 态；installViewApi 复刻 stage0-chain.test.tsx 模式：fileRead 路由 + capture 两桥内存 mock + StrictMode + _setStyleCatalogSnapshotForTest 单条 A7 prime）：
  1. facts 全空 → 五行 data-stage0-premise-confirmation="none"、无 seal、行 class 无底色追加；
  2. user/confirmed facts → human 行：「不可篡改」seal + bg-[#F2FBF6] + confirmation="human"；
  3. infer+pending → ai 行：「AI 拟稿」seal + bg-[#FDF8EE] + confirmation="ai"；
  4. 混合共存：human/ai/none 三态行同卡并存各归其色；
  5. 背景档案区：data-stage0-background-seal 上屏 + 点击展开正文零回归（既有交互模式）；
  6. capture emit 联动：emit 新增 confirmed fact → 对应行 ai → human 翻转（AC4）。
- **既有测试零 diff 依据**：stage0-view.test.tsx 经 008 T5 已埋 captureList 空 facts + onCaptureChanged 空退订桩 → PublishedBody 订阅返回空 facts → 五键全 none → 无 seal 无底色 → 全部既有断言天然兼容；stage0-chain.test.tsx 与本包零交集。
