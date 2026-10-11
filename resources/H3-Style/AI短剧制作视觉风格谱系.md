# AI 短剧制作视觉风格谱系

- 定位：**风格目录数据 + 实测预览墙**（`AI短剧制作流程规范` 附录 J 的独立文档）；"怎么选"的**规则在规范附录 J·J.3**（本文不重复，防漂移）；配套人读版 `AI短剧制作视觉风格谱系.html`。
- 版本：2026-09-23 从规范拆分（规范附录 J 保留规则版）；谱系内小节沿用 J.0–J.4 编号（查找位置不变）。

## J.0 说明
- **本文版本：谱系 v1.46（2026-10-08；措辞修订：厘清主/备验证轴与主/辅角色轴，v1.45 见下）**。约定：谱系演进只改本文 + 自版本号递增（v1.x），不动规范版本号（规范附录 J 定位与 J.3 权威不变）；本文件承载 J.1/J.2/J.4 完整内容，小节编号沿用 J.0–J.4 防查找漂移。平台引用记「风格 ID + 谱系版本」（如 `A7 @ v1.46`，见《短剧Agent平台设计.md》§4.2 / §8.3）。
- 技术栈：**ComfyUI + Qwen-Image-2512（文生图 / 配套控制网）＋ MiniMax H3 系（fl2va / ref2va 视频 / Music3 配乐）**（均运行于 ComfyUI 原生工作流）。
- **谱系定位（2026-09-19 v1.43 重构）**：本谱系服务 **AI 漫剧（竖屏短剧）有效视觉范围**，按 **形态 × 画风两层**组织：形态层 = 行业四大制作形态（仿真人 / 2D 漫 / 3D 漫 / 沙雕漫，见 J.1）；画风层 = 各形态内主用画风（18 项）。2026-09-19 对照 2026 漫剧百强榜生态（仿真人 38%→58%、8 月 3D 漫 62 部成红果主流）重构，移除无市场美术向风格 14 项，不再列示。
- **主备标注（验证状态轴，v1.46 措辞修订）**：「主」= 已被真实项目（《安妮的夏天》）验证跑通的画风（11 项）；「备」= 已登记入谱、但**尚未经项目验证的主风格候选**（7 项：A 系年代胶片 / DV·CCD / 黑白电影、C 系美式卡通 / 扁平矢量、D 系奇幻童话 / 暗黑·哥特）——选「备」作主风格风险自担。**注意：主 / 备是验证状态，与「主风格 / 辅助风格」的使用角色无关，「备」≠ 辅助画风**。
- **视觉风格 = 三层共同决定**：① **提示词锚点 / 模型先验（主导，占 70%+）**——风格本体由锚点词确定（Qwen-Image 官方覆盖照片写实 → 印象派 → 动漫 → 极简，风格适应广）；② **采样参数（质感档）**——采样器 × 调度器 × 步数 × CFG 调节"干净/锐利、鲜活/胶片、柔和/低保真"等质感；③ **参考锁风格**——MiniMax H3 Ref2VA 以已定概念图锁定同风格动态一致性，或挂风格 LoRA。
- **可行度图例**：**● 高（原生）**＝ Qwen-Image 直出即达、无需额外资源；**● 中（需 LoRA/后期）**＝ 需社区 LoRA、ControlNet 或后期校色 / 排版辅助；**● 低（探索）**＝ 实验性质、效果波动，立项慎选。
- **立项选择（使用角色轴）**：选定 **1 个主风格**（家族 + 具体风格，全片唯一、任何时刻仅 1 个；候选含全部「主」「备」条目）＋ 可选 **1 个辅助风格**挂气氛（按剧情需要，如都市剧挂冷调悬疑气氛）。**辅助候选域封闭：仅 B 青春治愈系（清新生活流）与 D 类型氛围系（冷调悬疑 / 赛博科幻 / 神话国风 / 奇幻童话 / 暗黑哥特）**，从 J.1 跨形态氛围档中选，按规范 J.3 固化。
- **风格预览 / 立项确认一律走预览档（加速采样）**：出图 Lightning 4 步、视频 H3 turbo LoRA（8 步）或 FastH3 蒸馏 8 步——预览看风格方向足够（turbo / FastH3 不改变风格基调）；确认后正式产出走标准档（出图 J.2 完整质感配方、视频 20 步）。双档策略见规范附录 B 参数联动。

## J.1 总览（4 形态 × 18 画风）

**形态层（立项先选形态，题材 + 平台决定）**
| 形态 | 对应画风 | 适配题材 | 技术要点 |
|---|---|---|---|
| **仿真人** | A 写实影像系（6） | 都市 / 情感 / 霸总 / 年代 | Qwen + H3 最稳；R2V 锁音色与画风 |
| **2D 漫** | C 动画插画系（5） | 甜宠 / 古风 / 玄幻 / 规则怪谈 | R2V 锁画风；五官偶有偏移需多抽卡 |
| **3D 漫** | E·3D CG（1） | 玄幻 / 仙侠 / 末世 / 逆袭 | 2026 红果热榜主流形态；2026-09-19 实测：H3 三档稳定，Qwen 直出偏写实 / 仿真人，需 3D 质感 LoRA 或后期 |
| **沙雕漫** | C·美式卡通 / 扁平矢量（Q版表情包） | 喜剧 / 脑洞 | 复用 2D 漫画风；微动、表情包节奏 |
| 跨形态氛围档 | B 青春治愈系（1）＋ D 类型氛围系（5） | 甜宠 / 悬疑 / 科幻 / 古风 | 在选定画风上叠加氛围配方（J.2 质感档） |

**画风层（主风格选 1：候选含主/备全部；辅助风格 0–1：仅从上方跨形态氛围档 B/D 选）**
| 家族 | 风格（可行度） |
|---|---|
| **A 写实影像系**（仿真人形态 · 主3备3） | 拟真人·仿真人动漫「主」●高 / 数字电影写实「主」●高 / 胶片电影感「主」●高 / 年代胶片（千禧·90s·80s）「备」●高 / DV·CCD 数码复古「备」●高 / 黑白电影「备」●高 |
| **B 青春治愈系**（跨形态氛围档 · 主1） | 清新生活流「主」●高 |
| **C 动画插画系**（2D 漫形态 · 主3备2） | 日式动漫（赛璐璐·新海诚·吉卜力）「主」●高 / 韩漫·精致美型「主」●高 / 国漫·新中式插画「主」●高 / 美式卡通「备」●高 / 扁平矢量·低多边形「备」●高 |
| **D 类型氛围系**（跨形态氛围档 · 主3备2） | 冷调悬疑「主」●高 / 赛博·科幻「主」●高 / 神话国风「主」●高 / 奇幻童话「备」●高 / 暗黑·哥特「备」●高 |
| **E 材质工艺系**（3D 漫形态 · 主1） | 3D CG「主」●中 |

> 注（v1.43 谱系重构）：2026-09-19 按 AI 漫剧有效范围移除 14 项、不再列示——F 艺术绘画系全部（印象派·油画 / 水彩·水墨 / 版画·木刻 / 拼贴混合媒材）、E 系黏土·定格动画 / 像素·8bit / VHS·CRT 低保真 / 拼贴·图形设计、A 系纪实·街拍、B 系奶油糖果色 / 日系青春写真 / 暖调治愈（并入清新生活流变体）、C 系水彩绘本 / 手绘速写·素描；预览墙同步删除展示。

## J.2 明细（视觉特征 / 锚点词示例 / 质感配方 / 可行度）
**A 写实影像系（仿真人形态 · 人像真实感最强：Qwen-Image-2512 主打，适合真人剧感）**
| 风格 | 视觉特征 | 锚点词示例 | 质感配方 | 可行度 |
|---|---|---|---|---|
| 拟真人·仿真人动漫「主」 | 仿真人角色、贴近真人神态 / 微表情、立体感强、保留动漫美感；红果漫剧平台主推画风。**角色与场景/道具分两套锚点强度**（2026-09-19 安妮的夏天实测）：角色 Base 加动漫化锚点（动漫渲染、非真人照片、2D 动漫质感、二次元插画质感），场景/道具 Base 不加动漫化词、保持写实——角色是"动漫里的人"、场景是"真实环境"，角色放进场景不突兀 | realistic human-like anime, lifelike expression, cinematic（中文直译：仿真人动漫 / 拟真人） | Qwen-Image 系：预览档 Lightning 4步 / euler / normal / CFG 2.0；标准档 euler / normal / 20步 / CFG 2.5 | ●高 |
| 数字电影写实「主」 | 现代院线片、干净锐利、浅景深 | cinematic still, anamorphic, shallow depth of field | Qwen-Image 系：预览档 Lightning 4步 / euler / normal / CFG 2.0；标准档 euler / normal / 20步 / CFG 2.5 | ●高 |
| 胶片电影感「主」 | 柯达/富士胶卷色调、颗粒、高光溢出 | Kodak Gold / Portra, film grain, halation | Qwen-Image 系：预览档 Lightning 4步 / euler / normal / CFG 2.0；标准档 euler / normal / 20步 / CFG 2.5 | ●高 |
| 年代胶片（千禧·90s·80s）「备」| 时代滤镜、褪色、暖偏 | 2000s film still, faded, warm vintage | Qwen-Image 系：预览档 Lightning 4步 / euler / normal / CFG 2.0；标准档 euler / normal / 20步 / CFG 2.5 | ●高 |
| DV·CCD 数码复古「备」 | 低清、噪点、数码色偏、回忆感 | old DV camcorder, CCD sensor, video noise | Qwen-Image 系：预览档 Lightning 4步 / euler / normal / CFG 2.0；标准档 euler / normal / 20步 / CFG 2.5 | ●高 |
| 黑白电影「备」 | 去色、影调对比、经典叙事 | black and white, high contrast, film noir | Qwen-Image 系：预览档 Lightning 4步 / euler / normal / CFG 2.0；标准档 euler / normal / 20步 / CFG 2.5 | ●高 |

**B 青春治愈系（跨形态氛围档 · 甜宠日常清新质感，作画风 Base 叠加）**
| 风格 | 视觉特征 | 锚点词示例 | 质感配方 | 可行度 |
|---|---|---|---|---|
| 清新生活流「主」 | 明亮低饱和、柔光、干净 | bright, low saturation, soft light, airy | Qwen-Image 系：预览档 Lightning 4步 / euler / normal / CFG 2.0；标准档 euler / normal / 20步 / CFG 2.5 | ●高 |

**C 动画插画系（2D 漫形态 · 美式卡通 / 扁平矢量兼作沙雕漫）**
| 风格 | 视觉特征 | 锚点词示例 | 质感配方 | 可行度 |
|---|---|---|---|---|
| 日式动漫「主」 | 赛璐璐 / 新海诚 / 吉卜力 | anime, cel shading, Makoto Shinkai style / Ghibli | Qwen-Image 系：预览档 Lightning 4步 / euler / normal / CFG 2.0；标准档 euler / normal / 20步 / CFG 2.5 | ●高 |
| 韩漫·精致美型「主」 | 韩式动漫美学、五官精致高颜值、肤质通透、明快上色；红果甜宠 / 都市题材主流 | Korean manhwa style, refined beautiful face, glossy clean skin, webtoon（中文直译：韩漫 / 精致美型） | Qwen-Image 系：预览档 Lightning 4步 / euler / normal / CFG 2.0；标准档 euler / normal / 20步 / CFG 2.5 | ●高 |
| 国漫·新中式插画「主」 | 国风线条、淡雅设色 | Chinese animation, ink-wash accent | Qwen-Image 系：预览档 Lightning 4步 / euler / normal / CFG 2.0；标准档 euler / normal / 20步 / CFG 2.5 | ●高 |
| 美式卡通「备」 | 夸张造型、厚涂 | American cartoon, bold line, vibrant | Qwen-Image 系：预览档 Lightning 4步 / euler / normal / CFG 2.0；标准档 euler / normal / 20步 / CFG 2.5 | ●高 |
| 扁平矢量·低多边形「备」 | 几何色块、干净图形 | flat vector illustration, geometric, minimal | Qwen-Image 系：预览档 Lightning 4步 / euler / normal / CFG 2.0；标准档 euler / normal / 20步 / CFG 2.5 | ●高 |

**D 类型氛围系（跨形态氛围档 · 在选定画风上叠加氛围配方）**
| 风格 | 视觉特征 | 锚点词示例 | 质感配方 | 可行度 |
|---|---|---|---|---|
| 冷调悬疑「主」 | 蓝灰冷调、阴影、紧张 | cold blue tone, moody shadows, thriller | Qwen-Image 系：预览档 Lightning 4步 / euler / normal / CFG 2.0；标准档 euler / normal / 20步 / CFG 2.5 | ●高 |
| 赛博·科幻「主」 | 霓虹、高对比、未来 | cyberpunk, neon, sci-fi, high contrast | Qwen-Image 系：预览档 Lightning 4步 / euler / normal / CFG 2.0；标准档 euler / normal / 20步 / CFG 2.5 | ●高 |
| 奇幻童话「备」 | 梦幻光效、超现实 | fantasy, fairytale, magical light | Qwen-Image 系：预览档 Lightning 4步 / euler / normal / CFG 2.0；标准档 euler / normal / 20步 / CFG 2.5 | ●高 |
| 暗黑·哥特「备」 | 暗调、戏剧光、华丽 | gothic, dark, dramatic chiaroscuro | Qwen-Image 系：预览档 Lightning 4步 / euler / normal / CFG 2.0；标准档 euler / normal / 20步 / CFG 2.5 | ●高 |
| 神话国风「主」 | 水墨韵、东方幻想 | Chinese mythology, oriental fantasy, ink | Qwen-Image 系：预览档 Lightning 4步 / euler / normal / CFG 2.0；标准档 euler / normal / 20步 / CFG 2.5 | ●高 |

**E 材质工艺系（3D 漫形态 · 2026 红果热榜主流形态；2026-09-19 实测：H3 三档稳定，Qwen 直出偏写实 / 仿真人，需 3D 质感 LoRA 或后期）**
| 风格 | 视觉特征 | 锚点词示例 | 质感配方 | 可行度 |
|---|---|---|---|---|
| 3D CG「主」 | 皮克斯 / 游戏渲染、体积光 | 3D render, Pixar style, game CG, subsurface | Qwen-Image 系：预览档 Lightning 4步 / euler / normal / CFG 2.0；标准档 euler / normal / 20步 / CFG 2.5 | ●中 |

## J.3 立项选择规则（权威在规范）

**规则全文见《AI短剧制作流程规范》附录 J·J.3**（先选形态 → 选主/辅画风 → 定质感档 → 固化锚点词 → 定案全链路同步 R10），本文不重复——防双份漂移，改规则只改规范。

## J.4 风格预览墙（实际生成效果 · 主画风）

各主画风用本套技术栈实际跑出的样张（人读展示见 `AI短剧制作视觉风格谱系.html` 同节）：左侧竖图 = 概念预览，下方三段视频 = 同一镜头的三档采样结果——**标准 20 步**（成片基准）/ **turbo 8 步**（打样最快）/ **FastH3**（快速出片带原生音频）。

- **素材位置**：`resources/H3-Style/_style_preview/`（项目资源库内，随应用资源打包/迁移；备画风不入墙，移除项文件已清）；
- **生成脚本**：`_tools/STYLE_preview/`（`_gen_style_preview_*.py` 出图 + `run_style_video_*.py` 出三档视频，仅远程 Windows 使用，工具源/副本，见规范附录 B 模板库段）；
- **档位体系**：三档即规范附录 B「视频三档体系」（标准 20 / turbo 8·4 / FastH3 8）；预览看风格方向用加速档即可，确认后正式产出走标准档（J.0）；
- **家族覆盖**：A 写实影像系（A1–A6 主画风）、B 青春治愈系、C 动画插画系（主画风）、D 类型氛围系（主画风）、E 材质工艺系（E1 3D CG）——与 J.1/J.2 谱系对应，备画风不入墙。

**各主画风实测参数（从 PNG 元数据提取，2026-09-21）**：

| 风格 | 采样器 | 调度器 | 步数 | CFG | 提示词锚点 | 参数版本 |
|---|---|---|---|---|---|---|
| A1 数字电影写实 | euler | normal | 20 | 2.5 | 现代院线片质感，干净锐利，浅景深，cinematic still, anamorphic, shallow depth of field | 标准档 ✅ |
| A2 胶片电影感 | euler | normal | 20 | 2.5 | 柯达/富士胶卷色调，细腻颗粒，高光溢出，Kodak Gold / Portra, film grain, halation | 标准档 ✅ |
| A7 拟真人仿真人动漫 | euler | normal | 20 | 2.5 | 仿真人动漫/拟真人，贴近真人神态微表情，立体感强，保留动漫美感，realistic human-like anime | 标准档 ✅ |
| B1 清新生活流 | euler | normal | 20 | 2.5 | 明亮低饱和，柔光，干净通透，bright, low saturation, soft light, airy | 标准档 ✅ |
| C1 日式动漫 | euler | normal | 20 | 2.5 | 赛璐璐动漫风，新海诚/吉卜力动画电影质感，anime, cel shading, Makoto Shinkai style | 标准档 ✅ |
| C2 国漫新中式插画 | euler | normal | 20 | 2.5 | 国漫新中式插画，水墨点缀，东方线条，Chinese animation, ink-wash accent, guofeng | 标准档 ✅ |
| C7 韩漫精致美型 | euler | normal | 20 | 2.5 | 韩漫/精致美型，韩式动漫美学，五官精致高颜值，肤质通透，Korean manhwa style | 标准档 ✅ |
| D1 冷调悬疑 | euler | normal | 20 | 2.5 | 冷调悬疑氛围，蓝灰冷色调，阴影厚重，紧张感，cold blue tone, moody shadows | 标准档 ✅ |
| D2 赛博科幻 | euler | normal | 20 | 2.5 | 赛博科幻氛围，霓虹光效，高对比，窗外未来都市，cyberpunk, neon lights, futuristic | 标准档 ✅ |
| D5 神话国风 | euler | normal | 20 | 2.5 | 神话国风氛围，东方幻想意境，水墨晕染，缥缈仙气，Chinese mythology, oriental fantasy | 标准档 ✅ |
| E1 3DCG | euler | normal | 20 | 2.5 | 3D CG 渲染质感，皮克斯/游戏 CG 风，次表面散射，细腻光滑，3D render, Pixar style | 标准档 ✅ |

> **注意**：所有风格预览图已用标准档（euler/normal/20步/2.5，Qwen-Image 官方推荐）重新生成（2026-09-21）。
>
> **记录页要求（2026-09-21 补充）**：
> - STAGE3 记录页里的每张图都要显示生成参数（采样器、步数、CFG、seed）
> - 参数从 PNG 元数据里自动提取，不要手写
>
> **⚠️ 常见坑（2026-09-21 实测）**：
> 1. **采样器不要混用 SDXL**：Qwen-Image 只支持 `euler`，不要用 `dpmpp_2m_sde`、`euler_ancestral` 等 SDXL 采样器，否则会出问题（头发乱、脸变形）
> 2. **提示词锚点词要够强**：比如"拟真人仿真人动漫"要写全（"动漫渲染、非真人照片、2D 动漫质感、二次元插画质感"），不能只写"仿真人动漫"，否则出来的是纯写实照片。**⚠️ 不要写"赛璐璐上色"**——赛璐璐 = 2D 平涂 + 粗黑线，是 2D 动漫感太强、轮廓线太粗的主因（2026-09-21 安妮的夏天实测：去掉"赛璐璐上色"后，粗黑轮廓线变细、皮肤质感真实化、光影立体，效果显著改善）。保留"写实光影"即可。
> 3. **改脚本参数要小心**：用 sed 替换的时候容易把脚本代码里的关键词（比如 `steps`、`cfg`）也替换了，改完要检查一下
> 4. **参数统一**：所有风格预览图统一用标准档（euler/normal/20步/2.5），不要有的用 Lightning 4步/2.0，有的用标准档
