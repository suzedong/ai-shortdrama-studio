# feature-829 · 创作页历史与跨页正式引用 — 设计说明

> 版本：v1.0（2026-11-19 冻结）｜对应：[需求规格](./SDG-RE-需求规格.md)、[契约](./SDG-RE-契约.md)

## 1. 设计依据

本包无独立视觉稿，不新造设计系统。行为依据为 Parity 影响矩阵 §1.2“页历史为浏览器前进/后退”及 §1.3“跨页正式引用需要产物 ID＋版本，源产物再版只挂脏实际引用者”；视觉沿用 feature-823 已冻结的 CanvasBoard 管理条、节点卡、菜单、黄条和 canvas/surface/line/ink/muted/violet/warn/bad token。参考产品闭源代码、商标、私有素材和云状态均不使用。

## 2. 页历史状态机

```text
当前活动 target（持久化）
        │ 新导航成功
        ▼
截断 currentIndex 之后 → append target → currentIndex=末尾
        │
        ├─ back：向旧项找第一个仍存在的 target → active.set → 提交索引
        └─ forward：向新项找第一个仍存在的 target → active.set → 提交索引
```

历史栈与索引为 CanvasBoard 组件内状态，组件在项目工作期持续挂载。用联合 target key 去重，不能只用 pageId，因为同页可含多个画布。活动 target 仍完全由 Canvas props 决定，不复制第二份活动状态；历史只记录导航轨迹。

导航 IPC 进行中禁用历史按钮，避免快速点击造成响应乱序。失败不提交索引。删除目标的清理采用“导航时跳过失效项”，不把已删除节点重新创建，也不改写业务 revision。

## 3. 正式引用模型

引用节点是目标页中的轻量节点，不是源产物副本，也不生成跨页边：

```text
源页 / 源画布 / 源节点
  id = artifactId
  meta.version = 源版本
              ▲
              │ reference { artifactId, version, source }
目标页 / 目标画布 / 引用节点（独立 nodeId，同一 ref.path）
```

复制动作只形成 renderer 内存 draft，因此不会在用户真正粘贴前修改源节点或 Canvas。粘贴由一次 `reference.create` 命令完成，源身份读取、目标节点创建、revision/receipt 和原子落盘在同一主进程队列中提交。

引用只允许一页到另一页的直接引用，不允许引用另一个引用节点，避免链式解析和循环。source target 与 artifactId 共同定位源，version 始终固定为创建时版本。

## 4. 再版扫描

`canvas.update` 先按原规则 merge 固定文档，再比较更新前后同 ID 节点的非空 meta.version。对每个实际版本变化，以完整 source target + artifactId 扫描所有文档。仅匹配且固定版本落后的引用节点获得 latestVersion/markedAt；其他节点不做泛化脏传播。

reference 属系统管理字段，merge 时从输入剥离并保留旧值，避免 MCP 全量写入无意清除或手工伪造 latestVersion。引用创建不通过 MCP merge 开后门。

本包不复制源内容。引用查看仍读取 ref.path 当前文件，因此固定版本是血缘与脏提示依据，不是内容快照或回滚能力。

## 5. UI 与可访问性

- 后退、前进使用既有 ChevronLeft/ChevronRight 图标，位于页 tabs 前，紧凑 24px 工具按钮；禁用时降低透明度并提供 title。
- 引用节点在现有 meta.version 区域附近显示“引用 vN”；源再版时使用 warn 色“源已至 vM”及顶部黄条。原有立项 dirty 黄条保持独立，二者可同时存在。
- 菜单只新增必要项：“复制正式引用”“粘贴正式引用”“打开源产物”。粘贴位置由菜单客户端坐标经画板 rect/pan/zoom 转为世界坐标。
- 源定位复用 changeTarget 与 onOpenNode；先成功持久化活动目标，再打开查看器，避免查看器与背景页不一致。
- 全部动作支持键盘，状态不只靠颜色表达；沿用现有 focus/disabled/error 样式，不新增 overlay 或布局面板。

## 6. 验证策略

store 测试直接检查完整 Canvas JSON、revision/receipt、幂等重放和精确脏传播；组件测试驱动 tabs、历史按钮、菜单与源定位。dev-mock 只用于组件行为，不替代真实主进程验证。

真实 Electron 使用隔离项目：创建第二页、形成 A→B→A 导航并回退/前进；在 A 创建版本化源节点，到 B 粘贴正式引用；经真实 canvas.update 改源版本，确认只有 B 的引用节点挂脏；完整重启后确认固定引用和活动目标恢复、历史栈重置，再执行打开源产物。保存 DOM/IPC/JSON 结构化结果、renderer 异常和截图。
