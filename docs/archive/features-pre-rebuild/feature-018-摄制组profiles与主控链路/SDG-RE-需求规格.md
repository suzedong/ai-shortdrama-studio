# SDG-RE 需求规格 · feature-018 摄制组 profiles 与主控链路

> 状态：**v1.0 待审批**
> 日期：2026-10-07
> 上游：[feature-016 SDG-RE-契约.md](../feature-016-架构重建总纲/SDG-RE-契约.md) §2 / §5 / §6（已批准）
> 前置：[feature-017 SDG-RE-契约.md](../feature-017-画布基座与纯工具层/SDG-RE-契约.md)（已实施，11 纯工具可用）

---

## 1. 背景与目标

feature-017 已把 MCP 层重写为 11 个零 LLM 纯工具，并落地画布 / 门 / 资产 / ComfyUI 设置基座。但当前 opencode 仍只安装 feature-008 的 `director` profile，其系统提示强制"业务产物必须调用 `shortdrama_*` 工具产出"——与新架构"**所有文本产物由 Agent 自身推理、经 file.write 落盘**"直接冲突。

本 Feature 的目标：

1. 按 016 契约 §2 落地摄制组 **1 主 + 3 专** profile：`showrunner / writer / media-director / comfyui-operator`。
2. 打通主控链路：`showrunner` 经 `task` 把文本写作委派 `writer`、把媒体与镜头工作委派 `media-director` / `comfyui-operator`；委派目标白名单化，无法调用未授权 agent。
3. 完成确认门**跨重启恢复**（017 过渡事项）：pending 门随 canvas 落盘，重启 / 重开项目后重新挂起并通知 renderer，裁决后链路可继续。
4. 运行时 client 的参数边界校验对接新 agent 与新工具物理 ID。

## 2. 范围

### 2.1 本包做

| # | 事项 |
|---|---|
| A | 新增 4 个 profile 模板（resources/opencode/agents/*.md），frontmatter 与系统提示逐字匹配本包契约 |
| B | provider 配置生成泛化：启动时渲染安装全部 profile（含旧 director 并存），`__ARK_MODEL_ID__` 启动注入机制不变 |
| C | GateBridge 支持 pending 门重挂（idempotent attach）与 `recoverPending()` 恢复入口；main 在重开项目后调用 |
| D | runtime client 边界校验：允许 agent = showrunner；按 agent 校验 tools 白名单；listAgents 返回新主控 |
| E | 测试：profile 静态断言、provider 安装、gate 恢复、client 校验 |

### 2.2 本包不做

- 不实现任何八步业务切片（立项 019、故事 020、剧本 021 各包做）。
- 不做 renderer 重建 / 不下线旧壳（022）：旧 App 与 `director` profile 继续保留并存。
- 不注入真实 ComfyUI 网络客户端（023）；`comfyui.queue/status` 占位语义不变。
- 不删除任何旧 IPC、旧 preload 键、旧类型、旧模板文件。
- 不实现后台 task（background subagent）策略，本包 task 均为前台等待。

## 3. 用户故事 / 验收场景

| ID | 场景 | 验收要点 |
|---|---|---|
| US-1 | 新会话以 showrunner 为主控：用户只看到一个主控对话 | listAgents 对外含 showrunner；showrunner 为 primary；3 专职为 subagent、不直接出现在对外选择面 |
| US-2 | showrunner 把故事大纲写作交给 writer | 系统提示含强制外包条款；`task` 仅可调用 writer/media-director/comfyui-operator；writer 自身不能再调 task |
| US-3 | 所有文本由 Agent 写出：showrunner/writer 经 shortdrama_file_write 落盘并 canvas.update 挂节点 | profile 工具白名单只含纯工具物理 ID；无任何"调用工具生成内容"条款 |
| US-4 | 应用重启 / 重开项目时存在未裁决门 | 重启后 pending 门重新出现在 GateCard（gate:changed），不丢门、不重复门；裁决后状态落盘、Agent 下一回合据此继续 |
| US-5 | showrunner 对同一 pending 门再次 gate.request（恢复回合） | 不被 INVALID_ARGUMENT 拒绝，而是重挂到既有 pending 门并继续等待裁决 |
| US-6 | renderer 试图指定 writer/media-director 为对话 agent | client 边界校验拒绝（INVALID_ARGUMENT），对外只能用主控 |
| US-7 | ARK_MODEL 缺失 | 新 profile 不安装，返回 UPSTREAM_AUTH_MISSING，不静默回退 mock；旧并存行为一致 |
| US-8 | 旧链路（director + 旧 App） | 本包上线后旧流程行为与测试无回归 |

## 4. 硬边界（不可破坏）

1. **八步闭环**：profile 提示必须覆盖 0→7 完整步骤，确认点不减少；后期 / 发布只预留不实现。
2. **局域网 ComfyUI**：任何 profile 不硬编码媒体模型 / 地址；媒体动作只经 `comfyui.*` 纯工具。
3. **通道红线**：所有 agent 的 model 只能是 `ark/__ARK_MODEL_ID__`；禁止出现其他图像 / 视频 / 音乐模型字段。
4. **纯工具纪律**：MCP 层零 LLM 的事实不因本包改变；本包只改 profile / client 校验 / 门恢复，不改工具纯职责。
5. **并存不删**：旧 director.md、旧 handle、旧 preload 键、旧类型一律保留。
