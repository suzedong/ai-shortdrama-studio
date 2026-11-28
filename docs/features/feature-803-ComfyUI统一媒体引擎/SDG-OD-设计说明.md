# feature-803 · ComfyUI 统一媒体引擎 — 设计说明

> **版本**：v1.1（2026-11-27）｜**状态**：实施中；现行媒体通道按 D-033 归一

## 1. 模块关系

```text
系统菜单 → AiServicePanel → ComfyServicePanel
                              │ settings:comfy:* IPC
                              ▼
                     应用级 settings（唯一实例事实源）
                              │
MCP comfyui.queue/status ────┤
                              ▼
                主进程唯一 ComfyEngine（setComfyClient）
                  ├─ workflow：清单 + API Format 映射
                  ├─ HttpComfyClient：五端点 + 超时
                  ├─ comfy-jobs.json：项目作业事实源
                  └─ registerAsset：现有资产索引唯一入口
```

renderer 不持有 ComfyUI fetch，MCP 不接触设置文件或资产索引细节。设置测试通过同一引擎的 transport 调用 `system_stats`，无项目依赖。

## 2. 设置与迁移

- 全局文件缺失时才尝试当前项目旧 `project.json.comfyInstances`；无当前项目按空数组处理。
- 迁移项逐条校验并规范 id/addedAt，非法项不静默进入新事实源；旧项目文件不改写，避免破坏性数据迁移。
- 全局文件一旦创建，旧字段不再参与读取。所有 upsert/remove 在全局写队列中重新读取最新文件，避免基于旧快照覆盖并发更新。
- 配置 JSON 损坏显式报 `COMFY_SETTINGS_CORRUPT`，不以空数组覆盖。

## 3. URL 与 HTTP

- 允许 loopback、RFC1918、链路本地、IPv6 ULA/链路本地、localhost、单标签局域网主机名及 `.local/.localhost`。
- 拒绝公网 IP/域名、凭据、query/hash、非 HTTP(S) 与无效端口。
- 每次 fetch 使用独立 AbortController；响应 JSON 必须是对象，prompt_id 必须非空。
- history 有记录时以远端状态为准；无记录时查 queue。running/pending 均只推进本地状态，不设置虚构百分比。

## 4. 工作流安全

- manifest 与 API JSON 分离：清单决定公开参数到节点的唯一映射，API JSON 是节点图。
- 加载时深拷贝，输入校验后逐键赋值；未映射节点、class_type 和其他 input 不改。
- 只允许清单内相对 `.json` 文件，resolve 后必须仍在工作流目录。
- 当前生产 manifest 仅注册 H3 Image，公开输入与 graph 映射以 feature-816 契约为准；视频 H3 与音乐 Music3 尚未注册生产工作流。测试夹具不得冒充真机生产映射。

## 5. 作业与幂等

- 引擎内 Promise 锁串行 queue/status，防止同 requestId 并发重复提交和重复收片。
- queue 先查 requestId；新作业持久化后提交远端，再保存 promptId。若进程在远端响应后崩溃，缺 promptId 的记录不自动重提，续查返回明确错误，避免重复生成。
- 请求指纹由 instanceId/workflowId/inputs 的稳定 JSON 得出；冲突 requestId 不覆盖旧作业。
- status 按作业中的 baseUrl 快照续查，因此禁用/删除实例不阻断既有作业；instanceId 不匹配仍拒绝。

## 6. 下载与登记

1. history 成功后收集全部 images，先验证数量及输出描述。
2. 状态置 downloading；逐张 GET /view，限制字节数并检查 content-type、扩展名与文件签名。
3. 已存在最终文件则复用，不覆盖；否则写 `.part`，完成后 rename。
4. 逐张调用 `registerAsset`，传 sourceJobId 和完整生成 meta。
5. 全部成功后一次性保存 completed + outputs；任何失败保存 error，不冒称远端取消。
6. completed 后直接返回本地输出；崩溃遗留的未完成记录重查时可复用已落盘文件，资产登记自身按 path+kind 幂等。

## 7. UI 状态

- 文本服务原表单保持默认页签和既有行为；ComfyUI 页签按需挂载，避免原面板测试/启动时额外请求。
- 列表行测试使用已保存地址，编辑器测试使用当前输入；测试不隐式保存。
- 删除必须行内二次确认；保存/测试期间禁用对应操作，错误保留面板和输入。

## 8. 测试策略

- settings/client/workflow 使用临时目录和注入 fetch/时钟，无局域网依赖。
- engine 使用内存 transport + 临时项目，覆盖重启新实例读取同一作业文件；资产登记走真实 `registerAsset`。
- UI 使用 Testing Library；dev mock 通过 spy 保证无 fetch。
- 真机项只记录挂起，不用 mock 结果替代。
