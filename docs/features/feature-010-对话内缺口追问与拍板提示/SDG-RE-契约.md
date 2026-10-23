# feature-010 契约：对话内缺口追问 chip 与发卡拍板提示（qh）

> **版本**：v1.0（2026-10-23）
> **上游**：feature-010 需求规格 v1.0（用户拍板表 §2 四项）
> **本文件性质**：实现层唯一逐字真值源；任何与本文档不符的实现视为偏差

---

## 1. 【追问选项】块协议（逐字真值表）

### 1.1 块格式

```
【追问选项】
候选答复文字一
候选答复文字二
【/追问选项】
```

| # | 规则 | 逐字判定 |
| :-- | :-- | :-- |
| R1 | 开标签 | 行首精确 `【追问选项】`（允许行内前导空白以外的任何字符；即 `^【追问选项】$` 在行首锚定，与【选项】既有识别同哲学） |
| R2 | 闭标签 | 行首精确 `【/追问选项】`；闭标签行之后仅允许空白字符（消息末尾锚定） |
| R3 | 块体行 | 每**非空行** trim 后整体即一条 chip 原文；**不经** OPT_LINE 编号解析；行内含编号字样（如 `1. xx`）也照原文收录 |
| R4 | 最少条数 | 非空行 ≥ 2；否则整块不识别，`chips` 为 undefined，消息原文原样显示 |
| R5 | 唯一性 | 一条消息至多一个选项类块（【选项】/【风格选项】/【追问选项】互斥）；若同现，以**最后出现且完整闭合**者为准（与 B-35 同哲学：单一末块语义） |
| R6 | 流式 pending | ① 已见行首开标签、未见闭标签 → pending（正文截至开标签前，不渲染不显示半截块文）；② 消息尾缀为开标签的前缀子串（如 `【追问`、`【追问选`）→ pending（tail 判定） |
| R7 | 与标签叠加 | 可与纪律 9 气泡标签同条并用（典型：【缺口追问】标签 +【追问选项】块）——标签经 parseChatLabel 先行剥离，块解析作用于剥离后正文 |

### 1.2 与既有块的互斥真值表

| 消息含块 | parseChatOptions 返回 |
| :-- | :-- |
| 仅【选项】完整块 | `{ options }`（chips undefined） |
| 仅【风格选项】完整块 | `{ options }`（带 styleId，chips undefined） |
| 仅【追问选项】完整块 | `{ chips }`（options undefined） |
| 任一不完整/负例 | 两者皆 undefined，原文原样 |

---

## 2. 纯函数契约（ChatComposer.tsx 内扩展）

### 2.1 parseChatOptions 签名（扩展现有函数，不新建）

```ts
function parseChatOptions(text: string): {
  rest: string;                       // 剥离块后的正文（块完整闭合时截至开标签前；pending 时截至开标签/半截标签前）
  options?: ParsedOption[];           // 既有：编号选项（不动）
  chips?: string[];                   // 新增：追问选项原文数组（≥2 条，trim 后）
  pending?: boolean;                  // 既有语义不变
}
```

### 2.2 扩展点逐处枚举（仅三处正则 + 一处解析分支 + 返回组装）

| 处 | 现状（行号为建包时快照） | 改动 |
| :-- | :-- | :-- |
| ① 闭标签正则（L148） | `/【\/(风格选项|选项)】$/` | 加 `追问选项` 备选 → `/【\/(风格选项|选项|追问选项)】$/` |
| ② 流式开标签正则（L174） | `/(^|\n)(【(风格选项|选项)】)/g` | 同步加 `追问选项` |
| ③ tail 半截判定（L187） | 既有 startsWith 链 | 加 `'【追问选项】'.startsWith(tail)` 分支 |
| ④ 块体解析分支 | 既有按块名分派 | 块名 === '追问选项' → 逐非空行 trim 收 `chips`；不经 OPT_LINE；`< 2` 行 → 整块不识别（rest 还原为原文，chips undefined） |
| ⑤ 返回组装 | 既有 `{ rest, options, pending }` | 加 chips 字段透传 |

### 2.3 依赖方向

```
ChatComposer.tsx（parseChatOptions / ChipRow / GateHint / 渲染消费点）
  ↑ 唯一生产代码 diff 文件；不引入新模块文件（组件与解析均内联于该文件，同 OptionCard 既有组织方式）
GateCardView.tsx 零改（qh 挂载于其 JSX 之后，不改其内部）
shared/types.ts 零改（K1 不触发）
```

---

## 3. 组件契约

### 3.1 ChipRow（新增，内联于 ChatComposer.tsx）

**Props**：

```ts
function ChipRow({ chips, disabled, pickedChip, onPick }: {
  chips: string[];
  disabled: boolean;
  pickedChip?: string;   // 紧随用户消息 text.trim() 命中值
  onPick: (text: string) => void;
}): JSX.Element
```

**结构逐字**：

```tsx
<div className="mt-[6px] flex flex-wrap gap-[5px]" data-chat-chips>
  {chips.map((chip) => {
    const picked = pickedChip === chip;
    return (
      <button
        key={chip}
        type="button"
        data-chat-chip={chip}
        data-picked={picked || undefined}
        disabled={disabled}
        onClick={() => onPick(chip)}
        className={/* 见 §3.3 色值表 */}
      >{chip}</button>
    );
  })}
</div>
```

**交互语义**：

| 态 | 判定 | 表现 |
| :-- | :-- | :-- |
| 可点 | `!disabled`（= `!consumed`：非 busy 且为最后一条 items） | hover 紫底白字 |
| 禁用 | `disabled`（busy 或 index < items.length - 1） | `opacity-40`，不响应（button disabled 原生语义） |
| picked | `pickedChip === chip`（紧随 user 消息 `text.trim()` 全等） | 紫底白字；同组其余因 consumed 禁用 |

**点击路径**：`onPick = pickOption`（ChatComposer L549-554 既有：本体即 `onSend(参数)`，busy 拒点）——**零新增发送路径**；chip 原文即用户话语，落 capture.upsert 时 source:'user' quote 逐字（纪律 11 天然满足）。

### 3.2 GateHint（新增，内联于 ChatComposer.tsx）

**零 props 固定文案组件**：

```tsx
function GateHint(): JSX.Element {
  return (
    <div
      data-chat-gate-hint
      className="mt-[6px] rounded-[8px] border border-[#F6E6C4] bg-[#FFF9EC] px-2 py-1.5 text-[10px] leading-[1.6] text-[#9A7420]"
    >
      <div className="mb-[1px] flex items-center gap-1 text-[9.5px] font-extrabold">💡 拍板提示</div>
      直接说「行，就按这版发布」= 按钮拍板（系统记录原话与定案卡版本）
    </div>
  );
}
```

**触发条件（系统直做，零指令）**：渲染层 `pendingGate?.gateId === '0-final'` 为真时，紧随 GateCardView 之后渲染；其余 gateId / 无门 → 不渲染。

### 3.3 文案与色值汇总表（逐字）

| 位 | 属性 | 逐字值 | 来源 |
| :-- | :-- | :-- | :-- |
| ChipRow 容器 | class | `mt-[6px] flex flex-wrap gap-[5px]` | 对齐原型 .cr（L766 margin-top:6px；gap 5px 对齐 OptionCard 既有间距） |
| chip 未 picked | class | `rounded-full border border-[#DED9FB] bg-violet-soft px-2 py-[3px] text-[10px] font-bold text-[#5A4BC4] transition-colors hover:bg-violet hover:text-white disabled:cursor-default disabled:opacity-40 disabled:hover:bg-violet-soft disabled:hover:text-[#5A4BC4]` | 原型 .chip 逐值映射（font-size 10px / weight 700 / padding 3px 8px / radius 99px / 边 #DED9FB / hover 紫底白字） |
| chip picked | 追加/替换 | `border-violet bg-violet text-white`（disabled 态同持） | OptionCard picked 色同族（border-violet bg-violet text-white） |
| GateHint 容器 | class | 见 §3.2 逐字 | 原型 .qh（L766-772：#FFF9EC 底 / #F6E6C4 边 / #9A7420 文 / radius 8px / padding 6px 8px / font-size 10px / line-height 1.6） |
| qh 标题 | 文案 | `💡 拍板提示` | 原型 .qh-t 逐字（font-weight 800 / font-size 9.5px / gap 4px → 实现取 flex gap-1） |
| qh 正文 | 文案 | `直接说「行，就按这版发布」= 按钮拍板（系统记录原话与定案卡版本）` | [改编]：原型「行，开始讲故事吧」→ 纪律 8 真实口令（需求规格 §5.1） |

> Tailwind 语义色 `violet / violet-soft / line` 为工程既有 token（OptionCard、GateCardView 同源引用），不新增色板。

### 3.4 凭据族（测试断言唯一入口）

| 凭据 | 挂载 | 语义 |
| :-- | :-- | :-- |
| `data-chat-chips` | ChipRow 容器 div | chips 组存在性 |
| `data-chat-chip={原文}` | 每个 chip button | 单 chip 定位；值 = trim 后原文 |
| `data-picked` | picked chip button（未 picked 无此属性） | 选中态断言（每组恰一处或不出现） |
| `data-chat-gate-hint` | GateHint 容器 div | qh 存在性断言（三态） |

### 3.5 禁用串（建包前已 Grep 全 src 验证零匹配 ✅）

```
拍板提示 | 追问选项 | data-chat-chip | data-chat-gate-hint | ChipRow | GateHint
```

---

## 4. 挂载边界（逐文件 diff 清单）

### 4.1 `src/studio/ChatComposer.tsx`（唯一生产代码 diff 文件）

| # | 位置 | 改动 |
| :-- | :-- | :-- |
| 1 | parseChatOptions（L128-197 区） | §2.2 五处扩展点 |
| 2 | ChipRow 组件定义（OptionCard 定义之后） | §3.1 全文新增 |
| 3 | GateHint 组件定义 | §3.2 全文新增 |
| 4 | items 渲染消费点（L611-625 区） | `opt` 解构后：`<OptionCard …/>` 既有行之后平级新增 `{opt.chips && (<ChipRow chips={opt.chips} disabled={consumed} pickedChip={pickedChip} onPick={pickOption} />)}`；其中 `pickedChip = next?.role === 'user' ? next.text?.trim() : undefined`（与 pickedNum 同位推算） |
| 5 | 流式气泡消费点（L640-648 区） | `<OptionCard … disabled />` 之后平级新增 `{opt.chips && (<ChipRow chips={opt.chips} disabled onPick={pickOption} />)}`（只展不点，同 OptionCard 流式哲学） |
| 6 | GateCardView 流式气泡内挂载点（L651-653 区） | `<GateCardView … />` 之后新增 `{pendingGate?.gateId === '0-final' && <GateHint />}` |
| 7 | GateCardView 独立块挂载点（L668-675 区） | 同上条件，`<GateCardView … />` 之后新增 |
| 8 | demoChatItems（L298-368 区） | 追加 d9（§4.3 逐字） |

**零 diff 枚举**：文件头注释、ChatItem 接口、parseChatLabel、OPT_LINE、pickNumOf、OptionCard 全部逻辑与样式、GateCardView 相关既有行、组件 Props 签名（ChatComposer 默认导出签名不动——qh 触发依赖既有 pendingGate prop，零新增 props）。

### 4.2 `resources/opencode/agents/showrunner.md`（指令层 diff）

纪律 10（L93-97）增补第三种子块约定（新增段落，既有字句零改）：

```markdown
- 缺口追问快答 → 用【追问选项】…【/追问选项】块：每行一条候选答复纯文本（无编号），≥2 条，必须位于消息末尾；渲染为横向胶囊，用户点击即代发该行原文（原文即 quote，天然满足纪律 11 逐字引用）。通常与【缺口追问】气泡标签同条并用。开放式追问（候选无法枚举时）仍不用任何选项块。
```

**纪律 9 词表零改**（【缺口追问】为气泡标签、【追问选项】为块协议，命名空间分离，无冲突）。

### 4.3 demoChatItems 追加 d9（逐字）

```ts
{
  id: 'd9',
  role: 'agent',
  agent: 'showrunner',
  text: '【缺口追问】\n还缺**核心冲突**——男女主之间的主要阻力是什么？\n【追问选项】\n家族反对，门第差距\n前任回归，旧情未了\n身份秘密，真相将揭\n【/追问选项】',
},
```

注释行同步一句：`// d9：追问选项 chips 待答演示（末条可点；前条 picked 演示由 d6 承担，d9 本身不预置回答）`。

### 4.4 `src/studio/chat-chips.test.tsx`（新建，测试文件净增恰 1）

见 §5 测试契约。

### 4.5 治理文件（T9 实施）

- `docs/设计现状与偏差清单.md`：B-45 新行落表翻 ✅（内容 = 本包两组件；状态 ✅ 2026-10-23）；
- `docs/features/README.md` 0xx 段增 feature-010 索引行；
- 本包变更记录 T 序列回填。

**其余全部文件零 diff**（K1/K8/K9 不触发；package.json 依赖零新增；vite/tsconfig 零改）。

---

## 5. 测试契约（chat-chips.test.tsx，新建唯一文件）

### 组① 解析纯函数例（parseChatOptions 经 ChatComposer 渲染间接断言，或直接经导出路径断言——以不改动现有导出面为优先，走渲染层断言）

> 实现取向：parseChatOptions 现状为已导出纯函数（chat-markdown.test.tsx L6 本就 import 直调；建包时误记为「模块内私有未导出」，T2 留痕、T9 勘误本行）。**本包不新增导出**（保持导出面零 diff），解析行为经纯函数直调 + ChatComposer 渲染层凭据双轨断言（与 chat-markdown.test.tsx 既有测法同哲学）。

| # | 输入消息 | 断言 |
| :-- | :-- | :-- |
| 1-1 | 完整块：正文 +【追问选项】+ 三行 +【/追问选项】（消息末尾） | `data-chat-chips` 存在；`data-chat-chip` 恰 3 个且值逐字 = 三行 trim 原文；气泡正文不含块原文、不含开/闭标签 |
| 1-2 | 负例：仅 1 行 | 无 `data-chat-chips`；原文（含标签行）原样显示 |
| 1-3 | 负例：行内含 `1. 前缀`编号字样 | 仍按原文收录（值含 `1. 前缀`）——验证不经 OPT_LINE |
| 1-4 | 负例：块后还有非空正文 | 无 `data-chat-chips`；原文原样显示 |
| 1-5 | 流式 pending：有开标签无闭标签 | 无 `data-chat-chips`；正文截至开标签前（不显示半截块文） |
| 1-6 | 流式 pending：尾缀半截开标签（`【追问`） | 同上 |
| 1-7 | 与【缺口追问】标签同条 | 标签正常剥离渲染（`data-chat-label` 既有断言哲学），chips 同时正常渲染 |

### 组② ChatComposer 集成例

| # | 场景 | 断言 |
| :-- | :-- | :-- |
| 2-1 | 待答 chips（agent 末条）+ 点击第 2 个 chip | onSend 被调 1 次，参数逐字 = 第 2 个 chip 原文（非编号、非索引） |
| 2-2 | busy（sending=true） | 全部 chip disabled（`opacity-40` 类 + disabled 属性）；点击不触发 onSend |
| 2-3 | 非末条（agent chips 后还有消息） | 同上禁用 |
| 2-4 | 已答 picked：agent(chips: 甲/乙/丙) + user(「乙」) | `data-picked` 恰 1 处且位于「乙」chip；同组全部 disabled |
| 2-5 | 用户回复文字与任何 chip 均不全等 | 无 `data-picked` |
| 2-6 | qh 三态：pendingGate.gateId='0-final' | `data-chat-gate-hint` 存在且文案逐字 = §3.2 |
| 2-7 | qh 三态：pendingGate.gateId=其他（如 '3-assets'） | 无 `data-chat-gate-hint` |
| 2-8 | qh 三态：pendingGate=undefined | 无 `data-chat-gate-hint` |
| 2-9 | 流式气泡内 chips（stream.text 含完整块） | `data-chat-chips` 存在且全部 disabled（只展不点） |
| 2-10 | 既有【选项】块回归：同文件内验证编号块渲染不受影响 | OptionCard 既有凭据（`data-chat-options` / `data-chat-option`）行为不变（抽查 1 例，防扩展点①②误伤） |

### 既有测试零 diff 依据

- chat-markdown.test.tsx / stage0-view.test.tsx / chat-liveness.test.tsx 等全部既有测试：本包不改其断言对象行为（OptionCard / parseChatLabel / GateCardView 既有路径零 diff），故零 diff 成立；
- 测试文件数 60 → **61（净增恰 1）**；typecheck 恰 3 条历史基线（canvas-zoom.test.tsx ×2 + runtime-client.test.ts ×1）零新增。
