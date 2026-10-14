# docs/features — 现行任务包目录

> 每个任务包一个子目录：`feature-{三位数字}-{业务名}/`，内含 5 文件（需求规格 / 契约 / 任务清单 / 设计说明 / 变更记录），规范见 [AI-SDG-AI工具执行指令.md](../governance/AI-SDG-AI工具执行指令.md) §2。

## 0. 划分规则（2026-10-13 起 · 按项目模块重新划分）

任务包**以《短剧Agent平台设计.md》§0.1 八步业务闭环为模块边界**，编号百位 = 业务阶段段；跨阶段的横切机制归入 8xx 平台基础段。每段保留 99 个序号（x01–x99）。业务可感知阶段产物必须齐备，禁止合并或裁剪步骤（原则三）；同一技术组件可被多阶段复用，但不据此分包。

| 段 | 模块（八步） | 阶段产物（§0.1） |
|---|---|---|
| **0xx** | STAGE 0 立项 | 选题诊断（含六要素草案）/ 故事前提 / 立项定案卡 |
| **1xx** | STAGE 1 故事 | 故事大纲 / 人物小传 |
| **2xx** | STAGE 2 剧本分场 | 分场表 / 台词 / 分镜文字稿 |
| **3xx** | STAGE 3 资产 | 角色 / 场景 / 道具资产（资产中心） |
| **4xx** | STAGE 4 分镜 | 生产分镜表（镜号 / 景别 / 运镜 / 资产引用） |
| **5xx** | STAGE 5 镜头 | 逐镜生成与收片 |
| **6xx** | STAGE 6 后期 | 配音 / 配乐 / 时间线 / 剪辑 / 混音 |
| **7xx** | STAGE 7 发布 | 成片 / 切片 / 渠道交付 |
| **8xx** | 跨阶段平台基础 | 状态机 / 风格谱系 / 统一媒体引擎 / Harness / Skill 等横切机制 |

> 溯源标签沿用设计书：**[Design 原有] / [改编] / [自研新增]**，各包在需求规格首页标注。

## 1. 任务包总表（按模块）

### 0xx · STAGE 0 立项

| 包 | 业务 | 解决偏差 | 技术落点 | 溯源 | 状态 |
|---|---|---|---|---|---|
| [feature-001-立项模型重建](./feature-001-立项模型重建/) | 单定案门 `0-final` + ProjectBrief v2 版本化落盘 + brief.plan/publish/list 三工具 + showrunner 第 0 步重写 | B-01 / B-02 | `electron/brief/*`、`electron/gate/bridge.ts`、`shared/types.ts`、showrunner.md | 自研新增 | ✅ 已落地（2026-10-13） |
| [feature-002-立项后变更与影响评估](./feature-002-立项后变更与影响评估/) | 全字段可改 + diff + 依赖图反向追溯 + `影响清单.vN-vM.json` + 三选一动作 + 脏读 + 历史回滚（§2.6.6/2.6.7） | B-03 | `manifest.briefVersion`、产物 `parentReference{briefVersion,fields[]}`、`CanvasNode.dirty`（**K1**：扩 `shared/types.ts`）、`brief.impact.assess/commit` + `canvas.align` 三工具（共 22 工具，**K8**）、CanvasBoard 脏读黄条/角标 + StageNavPanel STAGE 0 徽标 | 自研新增 | ✅ 已落地（2026-10-14） |

### 1xx · STAGE 1 故事

| 包 | 业务 | 解决偏差 | 技术落点 | 溯源 | 状态 |
|---|---|---|---|---|---|
| feature-101-故事创作链（大纲+人物小传） | 大纲定稿 + 人物小传定稿；`CharacterProfile.id` 主键诞生；JSON 源 + MD 镜像双写；只读已定稿立项单 | 三阶段血缘已落地、**缺任务包**（反向补录） | `故事/故事大纲.json/.md`、`故事/人物小传.json/.md`、writer.md、file 工具 | 改编 | ⬜ 待反向补录（P1） |

### 2xx · STAGE 2 剧本分场

| 包 | 业务 | 解决偏差 | 技术落点 | 溯源 | 状态 |
|---|---|---|---|---|---|
| feature-201-剧本创作链（分场+台词+分镜文字稿） | 分场（`Scene.sceneNo` 主键诞生）/ 台词（speakerId 归角色、空镜 `''`+speakerName 兜底）/ 一期分镜文字稿（`dialogue=null`、`refs=[]`） | 三阶段血缘已落地、**缺任务包**（反向补录）；分镜文字稿与 401 同一文件两阶段演进（§3 裁决①） | `剧本/分场.json/.md`、`剧本/台词.json/.md`、`分镜/shotlist.json/.md`、writer.md | 改编 | ⬜ 待反向补录（P1） |

### 3xx · STAGE 3 资产

| 包 | 业务 | 解决偏差 | 技术落点 | 溯源 | 状态 |
|---|---|---|---|---|---|
| feature-301-资产中心与角色定妆 | 资产索引选定/沉淀（query/select/import/export 扩展）；角色卡 + 一致性配方（seed/参考图/提示词）；qwen-image B0 概念图/定妆 | B-06（资产） | `electron/asset/*` 扩展、`资产/asset.index.json`、`资产/角色/`、media-director.md、image.submit | 改编 | ⬜ 未建包（P3） |
| feature-302-场景与道具资产 | 场景图 / 道具图流水线；主风格一致性配方复用 | B-06（资产） | `资产/场景/`、`资产/道具/`、image.submit | 改编 | ⬜ 未建包（P3） |

### 4xx · STAGE 4 分镜

| 包 | 业务 | 解决偏差 | 技术落点 | 溯源 | 状态 |
|---|---|---|---|---|---|
| feature-401-生产分镜表 | 分镜文字稿 → 可生产分镜：启用资产引用 `refs[]`、景别 / 运镜 / 逐镜时长 / 台词对位；在 201 的 shotlist.json 同文件升级（§3 裁决①） | B-06（分镜） | `分镜/shotlist.json` 升级、分镜表 UI、writer/media-director.md | 改编 | ⬜ 未建包（P3） |

### 5xx · STAGE 5 镜头

| 包 | 业务 | 解决偏差 | 技术落点 | 溯源 | 状态 |
|---|---|---|---|---|---|
| feature-501-逐镜视频生成 | H3 工作流（B5 参考生视频 / B8 文生视频）；参考图编排、逐镜入队、多档位多版本 mp4、收片、断点续跑、单镜失败隔离；一致性 QC | B-06（镜头） | `镜头/<镜号>/`、video.submit、`electron/comfy/*`（依赖 803 引擎）、镜头 Agent | 改编 | ⬜ 未建包（P3） |

### 6xx · STAGE 6 后期

| 包 | 业务 | 解决偏差 | 技术落点 | 溯源 | 状态 |
|---|---|---|---|---|---|
| feature-601-声音通道（配音+配乐） | 一期 T2A 人机通道（配音任务文本：镜号/角色/台词/情绪/音色路径 → 豆包生成 → 网页上传对位，待配/已配清单防漏镜）；Music3 B9 配乐 / 音效 | B-06（后期·声音） | `声音/`、music.submit、声音 Agent | 自研新增 | ⬜ 未建包（P3） |
| feature-602-时间线与程序化剪辑 | timeline.json（采用版本 / 切点 / 字幕 / 音量 / 过渡）；edit.cut/subtitle/concat/mix/slice（MediaKit/FFmpeg）；引擎不剪辑红线 | B-06（后期·剪辑） | `时间线/timeline.json`、edit.* 工具、剪辑 Agent | 改编 | ⬜ 未建包（P3） |

### 7xx · STAGE 7 发布

| 包 | 业务 | 解决偏差 | 技术落点 | 溯源 | 状态 |
|---|---|---|---|---|---|
| feature-701-成片交付与切片 | 成片 / 封面 / 切片导出；渠道规格校验；成片确认门。渠道一键分发列三期 | B-06（发布） | `成片/`、导出 UI、harness 渠道规格校验 | 改编 | ⬜ 未建包（P3） |

### 8xx · 跨阶段平台基础

| 包 | 业务 | 解决偏差 | 技术落点 | 溯源 | 状态 |
|---|---|---|---|---|---|
| [feature-801-manifest状态机推进](./feature-801-manifest状态机推进/) | 7 态 `initiating→story-outline→story-profiles→script-scenes→script-dialogue→script-storyboard→storyboard-done`，每次定稿读-改-写推进一格；先覆盖 STAGE 0-2，3-7 随各段包扩展；清退历史 10 态 `Stage` 骨架 | B-04 | `electron/project/manifest.ts`（读-改-写 + 纯函数跃迁）、manifest.get/advance 两工具（**共 16 工具**）、`electron/project/library.ts`、showrunner.md 定稿动作（**K1**：`shared/types.ts`）、删 `StageCanvas.tsx` | 自研新增 | ✅ 已落地（2026-10-13） |
| [feature-802-视觉风格谱系接入](./feature-802-视觉风格谱系接入/) | 系统级外部数据源接入：路径注册 / 版本跟踪 / 风格 ID+谱系版本引用 / 主辅选型；平台只消费不私改（§8.3，§3 裁决②重建） | B-05 | ✅ 已落地（2026-10-13）：`electron/style/` 五文件（types/catalog/parse-md/loader/validate）+ `style.catalog/get/validate` 三工具（共 19 工具）；代码内 18 ID 注册表与谱系 md v1.46 运行时交叉核对，版本号不硬编码；设计书 `style-catalog.ts` 单文件表述与五文件形态差异见 B-05 | 自研新增 | ✅ 已落地（2026-10-13） |
| feature-803-ComfyUI统一媒体引擎 | B0/B5/B8/B9 工作流模板装载 / 队列 / WebSocket 进度 / 收片；地址可配置 + 局域网多实例池；媒体零公网；renderer 不直连 | B-06 前置（§11 一期·5） | `electron/comfy/*`、engine.* 工具、comfyui-operator.md | 改编 | ⬜ 未建包（P2，媒体链前置） |
| [feature-804-Windows窗口标题栏](./feature-804-Windows窗口标题栏/) | 修复 `hiddenInset` 在 Windows 无窗口控制缺陷：外壳平台分支（darwin hiddenInset / win32·linux frame:false）+ 顶栏右侧自绘最小化/最大化·还原/关闭三按钮（46×32、关闭红 #C42B1C）+ 4 IPC 1 推送；macOS 零变化 | B-10 | `electron/window/chrome.ts`（纯函数）、`electron/main.ts`（window:* IPC）、preload/global.d.ts/dev-mock 三处同步、`src/studio/WindowControls.tsx`、StudioApp 顶栏集成（**K8**：新增 IPC 登记；无 K1） | 改编 | ✅ 已落地（2026-10-13，Windows 真机人工验收待执行） |
| feature-805-Skill体系 | Skill 检索 / 执行 / 沉淀 / 投稿；模板中心（二期） | §6 / §11 二期 | skill.* 工具 | Design 原有 | ⬜ 二期（暂不建包） |
| feature-806-Harness基础校验与确认门全链路 | 结构 / 内容 / 规格 / 一致性多轮校验；简报 / 定妆 / 分镜 / 整集 / 成片确认门卡片；校验不过不可确认（原 D-013 十五包方案的 804，因真机缺陷让位顺延 806，见决策台账 D-014） | B-06 配套（§9 / §11 一期·4） | harness.* 工具、`gate/bridge.ts` 门序扩展（1-a/1-b、2-a~2-c 及 3-7 门）、GateCardView | Design 原有 + 改编 | ⬜ 未建包（P2，可随阶段分批） |

## 2. 已落地平台基础（暂无任务包 · 反向补录可选）

下列骨架已随重建落地、当前无任务包，**不占用业务编号**；如后续需要规格留痕，按《指令》§7 反向补录建包（建议归入 8xx），不在近期路线内：

- **对话生成网关 runtime 单轨**（`electron/runtime/*`，14 错误码，无 Key 报 `UPSTREAM_AUTH_MISSING`）— §5.1
- **MCP 纯工具族**（`electron/mcp/*`：canvas / file / asset / comfyui / gate / brief / manifest，共 16 个）— §5.2
- **持久化与版本归档**（`electron/fs/*`：sandbox 白名单 / write-queue / archive 版本归档）、**项目库**（`electron/project/*`，含 manifest 7 态状态机，见 feature-801）
- **画布**（`electron/canvas/*`：canvas.json 节点模型）、**确认门桥**（`gate/bridge.ts` 三态）
- **Agent profiles**（`resources/opencode/agents/`：showrunner / director / writer / media-director / comfyui-operator）

## 3. 建包前裁决（已于 2026-10-13 拍板，见决策台账 D-013）

1. **STAGE 2 分镜文字稿 ↔ STAGE 4 生产分镜表 = 同一文件两阶段演进**：201 产出 `分镜/shotlist.json` 文字稿（一期空镜 `dialogue=null`、`refs=[]`，不排镜）；401 在同一文件上启用 `refs[]` / 景别 / 运镜 / 时长，升级为生产分镜。不设两个产物文件。
2. **B-05 取重建方案**：重建 `electron/style-catalog.ts`（CATALOG_VERSION + 风格 ID 校验，读 `resources/H3-Style/` 谱系源），feature-802 为落地包；平台只消费不私改谱系（D-005-6）。设计书 §7.1/§8.3 "当前实现"的表述在 802 落地时随实现对齐，不改口为"待落地"。
3. **K1 共享层扩展已知情**：002 与 801 改 `shared/types.ts`（`manifest.briefVersion` / 产物 `parentReference` / `CanvasNode.dirty` / 7 态 status、清退历史 `Stage` 10 态），各包建包时正式走 K1——先出字段方案、用户确认后记包内变更记录，再动代码。

## 4. 一期建设顺序（承接 §11 MVP 与偏差清单 §3）

- **P1 立项闭环补全**：~~801 状态机推进（B-04）~~ ✅ 已落地（2026-10-13）→ 002 立项后变更（B-03，依赖 K1 字段）；~~802 风格谱系（B-05，裁决②先行）~~ ✅ 已落地（2026-10-13）；101 / 201 反向补录（代码已落地，低成本固化）。
- **P2 媒体链前置**：803 ComfyUI 统一媒体引擎 → 806 Harness + 确认门（可分批；原 804 编号 2026-10-13 让位给 Windows 窗口标题栏缺陷修复包，D-014）。~~804 窗口标题栏~~ ✅ 已落地（2026-10-13，真机验收待执行），为独立缺陷修复，不占媒体链顺序。
- **P3 八步 3→7**：301 角色 → 302 场景道具 → 401 生产分镜 → 501 逐镜视频 → 601 声音 → 602 时间线剪辑 → 701 成片交付。

> 依赖原则：生成动作只读已定稿上游（§5.1 / §7.1）；分镜未定不排镜；301/501/601 的媒体调用统一收敛于 803 引擎，renderer 不直连 ComfyUI。

## 5. 归档与重建说明

旧 22 个 feature 包已作废并删除（2026-10-08 作废 D-005、2026-10-10 删除），说明见 [docs/archive/README.md](../archive/README.md)，历史见 git `ef4a175`，不作为实现依据。新包自 feature-001 起按本文件模块段编号；偏差与路线总览见 [docs/设计现状与偏差清单.md](../设计现状与偏差清单.md)。
