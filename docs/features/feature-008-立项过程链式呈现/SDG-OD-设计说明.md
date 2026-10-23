# SDG-OD-设计说明 · feature-008 立项过程链式呈现

## 1. 方案总览

在 STAGE 0 立项视图三布局（empty / published / brief-error）顶部恒显一条链态条，将设计书 §2.6.8 的线性收敛链「① 选题诊断 → ② 故事前提 → 🚪 定案卡」镜像为过程可视：①② 以「已捕获口径」精确进度（x/6、x/5）呈现收敛度，🚪 镜像定案门状态并在待拍板时提供只读摘要。数据全部来自既有通道（canvas props + feature-005 capture 桥），纯订阅零写入。

## 2. 设计决策

### D1 呈现形态 = 顶部链态条（用户拍板①）

- **取舍**：备选「整体链式重排」（把 empty / published 主体改成横向链式布局）被否——published 双卡是 feature-003 已验收的结果呈现，重排 diff 面大且颠覆既有凭据；顶部链态条三态共用、双卡主体零 diff、改动面最小。
- **恒显语义**：「过程链」的价值恰在对话进行中（empty 态）——只在 published 显链无意义；故三布局同构挂载（含 brief-error：立项已发布仅文件不可读，链依旧成立）。
- **常驻元素不画成节点**（§2.6.8 L377）：创意输入框与已捕获口径区不进链态条；口径区由 CaptureBar 既有承载，链态条只消费其数据，一区一责。

### D2 进度口径 = 词表精确匹配（用户拍板②）

- **x/6、x/5 精确进度**：topic trim + 英文小写化后按契约 §1 词表精确匹配；x = 命中 canonical 键去重数（同 topic 覆盖更新不重复计）。
- **别名表构成**：英文 = showrunner.md L101 推荐词表逐字；中文 = select.ts `FIVE_ELEMENT_FIELDS` / `PREMISE_FIELDS` 标签 + 短别名（题材 / 平台 / 时长 / 基调 / 季边界）——与 published 双卡字段标签同源，用户在两处看到的措辞一致。
- **未命中计总数不计进度**：开放词表纪律（showrunner L101）不闭集校验，未命中条目不告警不纠正；`unmatchedCount` / `totalFacts` 纯函数返回但呈现层不显示（总数口径留 CaptureBar 区，链态条不抢「已捕获口径」职责）。
- **pending / confirmed 均计入**：进度 = 「已捕获」非「已确认」——确认语义由 CaptureBar 面板承载；链态条若混确认态会使同一事实在两区呈现不一致。

### D3 🚪 状态优先级与版本来源

- 优先级 `published > pending > rejected > idle`：briefNode done 即「已发布」——发布后 0-final 门对象残留（approved / 历史 rejected）不影响主态；再版走 commit 工具不发新门（showrunner L128），不存在 published 与新 pending 并存的合法路径，残留即历史。
- 版本双源：`published` → `state.version`（select.ts 已解析 briefNode.meta.version `'vN'→N`，失败 null）；`pending` → `gatePayloadVersion(payload)` 最小守卫（types.ts payload 为 unknown，showrunner L125 约定 `{ version, pendingMarks, changesFromPrevious }`，守卫失败降级为不显版本号而非报错）。
- **设计语 → 现状映射留痕**：§2.6.8 的「🚪 定案卡」在现状唯一对应物 = canvas.gates 中 gateId==='0-final' 的最后一个对象（select.ts 既有口径）；中栏节点是其镜像，非新数据源。

### D4 定案卡节点 = 状态镜像 + 只读摘要（用户拍板③）

- **镜像不审批**：批准 / 驳回单点仍在右栏 GateCardView——中栏 🚪 零按钮，与 feature-003 GatePendingStrip「镜像条无按钮」先例同哲学；摘要提示行「批准 / 驳回在右栏门卡操作」把用户引回单点。
- **摘要内容 = question 全文**：showrunner L125 规定 question 必须是人读定案卡（六要素 + 前提 + 风格 + pendingMarks + changesFromPrevious），故浮层不再渲染 payload 结构件（零重复呈现）。
- **点击切换、非悬停**：悬停触发在触屏 / 触控板场景不可达且易误触；点击 chip 切换与平台既有折叠交互（BackgroundMd 折叠区）一致。不做外点 / Esc 关闭——chip 切换等价，防误触（feature-007 D7 同哲学）。
- **浮层不推布局**：链态条与滚动区均为绝对定位，摘要浮层取 `absolute` 白卡 z-20 覆盖滚动区上方，避免展开时顶距重算与三布局分支复杂化。

### D5 测试桩例外 = installFileRead 恰 2 行叠加（唯一既有测试 diff）

- **问题**：stage0-view.test.tsx `installFileRead` 整体替换 `window.api = { fileRead }`，无 capture 两桥；Stage0Chain 挂载后既有组件用例必崩。
- **取舍**：备选 A「生产代码可选链守卫（`window.api.captureList?.()`）」被否——preload 与 dev-mock 均必有该桥，守卫只为历史测试桩服务，属「为不可能场景加防御」坏味道（且 CaptureBar 等既有消费方均无守卫，口径不一）；备选 B「installFileRead 叠加 2 行空 facts 桩」被选——生产代码保持直接调用（CaptureBar 同模式），测试桩补齐在唯一受影响文件的单一助手内（恰 2 行），studio-flow / session-continue / window-titlebar-integration / realign-confirm 四文件已自带同款空桩零 diff。
- **空 facts 桩的语义后果**：既有用例中链态条呈现「未开始 / 未开始 / 未就绪|待拍板|被驳回（随 gates 夹具）」——不触碰任何既有断言（禁用串已避碰，见契约 §3.3）。

### D6 chain.ts 独立模块（不并入 select.ts）

select.ts 头注释明示「只投影 canvas 已落盘事实」；facts 来自 capture 桥、非 canvas 事实——并入会破坏该模块的数据边界。新建 `stage0/chain.ts`（同目录、同纯函数纪律：禁 fs / window.api / Date / 随机），`selectChainNodes` 以 `Stage0State` 为入参消费 select.ts 导出，两纯函数层组合不耦合。

### D7 布局参数与文案体系

- 链态条 `top-[38px] h-[46px]`（Header 38px 之下），滚动区顶距 38→84（38+46）；三布局同参数，避免态间跳动。
- 视觉同族：白底 85% 半透明 + backdrop-blur + 底边线（Header L230 同族）；节点 chip 圆标序号 + 名称 + 徽标 pill；pending 徽标与 GatePendingStrip 同 violet 族，rejected 红、final / published 绿、idle 灰。
- 文案禁用串（契约 §3.3）兜底既有断言零碰撞：不用「立项单 vN」（L370 计数 1 断言）、「选题诊断结论」（L354 否定断言）、「待定」（L397 计数断言）、「立项定案门被驳回」（L321 正则断言）等逐字串。

## 3. 数据流

```
已捕获口径.json ──(captureList 首拉 / capture:changed 推送)──▶ useCaptureFacts.facts
                                                                      │ 纯
canvas props ──▶ selectStage0State（feature-003 既有）──▶ Stage0State  │ 函
                                                                      ▼ 数
                                            selectChainNodes(state, facts) ──▶ ChainNodes
                                                                      │
                                             gate0.question（pending 时摘要正文）
                                                                      ▼
                                                 Stage0Chain 渲染（零写入）
```

## 4. 偏差关闭路径

《设计现状与偏差清单.md》B-43 行登记「§2.6.8 线性收敛链过程呈现缺失」（设计依据 §2.6.8 L368-381；现状实证 Stage0View 四态无链）；本包实施收尾随 T9 翻 ✅ 已闭环。
