# SDG-RE-任务清单 · feature-810 谱系升级差异工作流

> 执行顺序自上而下；每步完成立即勾记并回写变更记录。卡口预案见契约 §7。**批准前不触碰任何代码（铁律 1）。**

- [ ] **T1 基线实测冻结**：`npx tsc --noEmit`（预期仅 3 条历史基线）+ 全量测试（预期 53 文件 586 passed / 0 failed / 1 skipped），数字记入变更记录
- [ ] **T2 主进程**：`electron/style/types.ts` +DTO（契约 §1）；新建 `electron/style/upgrade.ts`（差异检测 + J.3 解析，契约 §1/§3）；`electron/main.ts` +2 handle（`style:catalog` / `style:upgrade-diff`）+ `brief:update` style 白名单 +1 键 `catalogVersion`（含 `BriefUpdatePatch` 类型同步）；`electron/preload.ts` +2 桥；`src/global.d.ts` DTO 镜像 + 桥声明
- [ ] **T3 谱系文件**：`resources/H3-Style/AI短剧制作视觉风格谱系.md` 增设 J.3 空段骨架（v1.46 节 + 格式约定注释；演示假数据不写入）
- [ ] **T4 renderer**：VisualCatalog 真实化 V1–V6（徽章 IPC 化 / 四态入口 / 差异面板真实数据 / 采纳前置校验 + 调用 / 忽略零调用 / 删演示硬编码与旧凭据）；`src/dev-mock-api.ts` 增补 style mock（catalog + upgrade-diff 多态）
- [ ] **T5 单测**：`src/test/style-upgrade.test.ts`（AC1–AC4）+ `src/studio/visual-catalog.test.tsx`（AC5）——恰净增 2；`brief-update.test.ts` 增补 `catalogVersion` 键用例（不改既有断言）
- [ ] **T6 全量回归**：typecheck 零新增；全量 passed 不减少、skip 不增、文件净增恰 2（AC6）
- [ ] **T7 真机目验**（AC7）：立项单 `catalogVersion` 改旧模拟 → 面板真实差异提示 → 采纳 → 立项单版本 +1 且版本号升、面板转已最新 → 再改旧 → 忽略 → 再开仍提示；截图存证
- [ ] **T8 治理收尾**：README 总表增 810 行；偏差清单 B-40 登记 + B-41（面板全量真实化）另立包登记；版本记录增行；变更记录闭环
