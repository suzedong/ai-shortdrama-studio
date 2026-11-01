# SDG-RE-任务清单 · feature-006 选题诊断公开数据检索

> 执行顺序自上而下；每步完成立即勾记并回写变更记录。卡口预案见契约 §6。**批准前不触碰任何代码（铁律 1）。**

- [x] **T0 探测定案**：按契约 §1 P1–P3 探测 opencode 内置 web 工具可用性；结论与证据回写变更记录 T0 节，定案 A（白名单放行）或 B（自建工具，契约 §2.2 补登后实施）——**定案 B**（2026-10-19）
- [x] **T1 基线实测冻结**：`npx tsc --noEmit`（恰 3 条历史基线）+ 全量测试（53 文件 586 passed / 0 failed / 1 skipped），数字已记入变更记录（2026-10-19）
- [x] **T2 通道落地**：方案 B 已落地——`electron/mcp/tools.ts` +2 工具（25→27）+ showrunner 白名单 +2 + frontmatter +2 + 静态护栏 25→27；契约 §2.2 已补登填实（2026-10-20）
- [x] **T3 指令层**：showrunner.md step 3 修订（S1 检索触发 / S2 检索词脱敏 / S3 来源标注 / S4 失败降级）；feature-001 变更记录 R-007 回写（2026-10-20）
- [x] **T4 单测**：`agent-profiles.test.ts` 真键表扩表（showrunner 含检索、其余三组不含）；方案 B 增 `web-tools.test.ts`（恰净增 1，14 例定向全绿）（2026-10-20）
- [x] **T5 全量回归**：typecheck 恰 3 条历史基线零新增（dist-electron 声明产物重建后）；54 文件 600 passed / 0 failed / 1 skipped——passed 不减少、skip 不增、测试文件恰净增 1（AC5）（2026-10-20）
- [x] **T6 真机目验**（AC4/AC6）：商业类真实触发 `shortdrama_web.search` ×3（S4 真实触发降级，诊断卡五区块 + 卡尾附录齐）；纪念类默认不检索 + 附录标注原因；四道闸全验，截图 41 张存证（2026-10-20）
- [x] **T7 治理收尾**：README 总表增 006 行；偏差清单 B-39 登记；版本记录增行；变更记录闭环（2026-10-20 全项完成：006 行翻 ✅ + MCP 工具族 10 族 27；B-39 登记并关闭；版本记录 2026-10-20 条目新增；变更记录 T0–T6 + X 节零修复标注闭环）
- [x] **T8 网络治理规格**：登记 Bing 国内站、主进程系统代理、opencode 子进程环境、私网直连和原生失败提示；保持工具 DTO/IPC/shared/依赖零 diff（2026-11-01）
- [x] **T9 搜索源与网络通道实施**：`parseBingResults` 替换 DDG 解析（`b_algo`/h2/a + 摘要，零 Key）；新增 `electron/network.ts` 的 `publicFetch`（公网 Electron net.fetch 走系统代理，loopback/私网/链路本地/.local/单标签直连）；ark 与 MCP web 工具接入；`ensureRuntime` 按当前 provider URL `resolveProxy`，`buildChildEnv` 覆写 HTTP(S)_PROXY/NO_PROXY，DIRECT 清除宿主污染（2026-11-01）
- [x] **T10 失败系统提示**：公网连接异常触发主进程原生 `dialog.showMessageBox`；区分"未启用（DIRECT）"与"已启用（代理 URL）"两文案；DIRECT 且为已知境外域名给启用代理指引，代理仍失败提示检查节点/绕过规则；任意 URL 不做物理国家断言；错误文案脱敏；HTTP 非 2xx 不弹窗、仍走原 MCP 错误信封（2026-11-01）
- [x] **T11 测试与真机验收**：新增 `src/test/network.test.ts`（19 测：通道判定/PROXY 解析/子进程环境/失败文案/脱敏）；web-tools 改 Bing fixture（15 测）；runtime-manager 增代理环境测试（共 19 测）；ark 5 测全绿。真机：cn.bing.com 直连 97857 字节 / 10 个 b_algo / 无验证页，生产解析器得 8 条有效直链与解码摘要。全量回归 76 文件 921 passed / 0 failed / 1 skipped；`tsc -p tsconfig.node.json` 与 tsconfig.preload.json 均 0 退出；typecheck 恰 3 条存量基线零新增（2026-11-01）
- [x] **T12 反向同步**：实测结果、偏差与变更记录已回填；package.json、package-lock.json、shared/types.ts、IPC/preload/DTO 零 diff；feature-014 D-023 已登记（2026-11-01）
