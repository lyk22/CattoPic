# 更新日志

此项目的所有重要更改都将记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

## [未发布]

### 新增

- **Worker CI 部署** — `worker/scripts/ci-write-wrangler.sh` 与 `pnpm run deploy:ci`，从 `WRANGLER_TOML_CONTENT` / `WRANGLER_TOML` 生成 `wrangler.toml`，便于 Cloudflare Workers Builds 等在仓库不提交 `worker/wrangler.toml` 的情况下部署。
- **D1 迁移** `worker/migrations/0003_api_keys_last_used_at.sql` — 若远程库里的 `api_keys` 表缺少 `last_used_at` 列可执行（避免出现 `validate-api-key` 返回 500 / `SQLITE_ERROR: no such column: last_used_at`）。
- **Cloudflare Queues 可选化** - R2 文件删除不再强制依赖 Cloudflare Queues。在 wrangler.toml 中设置 `USE_QUEUE = 'true'` 使用异步队列删除，设置为 `'false'` 则使用同步删除（无需付费 Queue 功能）。
- **ZIP 批量上传** - 支持通过 ZIP 压缩包批量上传图片
  - 使用 JSZip 在浏览器端解压
  - 分批处理（每批 50 张）防止内存溢出
  - 实时显示解压和上传进度
  - 支持为所有图片设置统一标签
  - 自动跳过非图片文件和超过 70MB 的文件

### 变更

- 上传表单偏好（压缩、过期时间、标签）通过 `app/utils/uploadCompressionPrefs.ts` 写入 `localStorage`，记录最后一次选择；单文件与 ZIP 共用，直至再次修改。
- 移除根布局底部「Create By 猫猫博客」署名链接。
- 当 WebP/AVIF 文件未生成/缺失时（例如超过 10MB 的上传），改用 Cloudflare Transform Images URL（`/cdn-cgi/image/...`）作为兜底输出方式。
- `/api/random` 改为 302 重定向到实际图片 URL（不再由 Worker 代理回源返回图片字节，Transform-URL 场景更稳定）。
- 关闭 Next.js 图片优化（图片已使用 Transform-URL 输出，无需再二次优化）。
- Transform-URL 参数改为严格按配置输出（不再附加额外参数；未设置最大尺寸时不强制 AVIF 缩放）。
- 管理页瀑布流列表引入 TanStack Virtual 虚拟渲染，保持大图库场景下 DOM 数量稳定。
- 上传页侧边栏（预览/结果）引入 TanStack Virtual 虚拟渲染，提升大批量场景下的滚动流畅度。
- UI 列表/网格统一使用 `/cdn-cgi/image/width=...` 请求缩略图，降低带宽与解码开销。
- `/api/images` 新增 `format` 后端筛选（`all|gif|webp|avif|original`），减少大图库场景下前端筛选与处理开销。
- 管理页单页加载数量从 24 提升到 60，减少滚动过程中的请求次数与抖动。
- 默认 `maxUploadCount` 调整为 50，并发上传数量统一调整为 5（含 AVIF）。

### 废弃

### 移除

### 修复

- 当 `R2_PUBLIC_URL` 未配置、仍为占位符或非法 HTTPS URL 时，上传接口返回明确错误（避免出现已成功写入 D1 后仍报笼统的 `Failed to parse URL`）。
- 单图上传：若在已写入 R2 之后 D1 保存元数据失败，会删除本次已上传的 R2 对象，避免出现「前端提示失败但桶里仍有文件」；上传失败时返回 HTTP 500 并带上底层错误信息便于排查。
- API Key 校验更新 `api_keys` 时不再使用 `RETURNING id`（旧版 D1 表若没有 `id` 列会报错 `no such column: id`），改为 `RETURNING key`。
- 规范化误写成带后缀路径 `/api` 的 Worker 根地址，避免请求打成 `/api/api/...`（此前会导致校验接口 404）。
- 统一 `/api/config` 与 API Key 校验使用的后端地址：两者均读取 `NEXT_PUBLIC_API_URL`，并支持构建期回退 `API_URL`；当客户端未内联公网变量时，校验会回退请求同源 `/api/config`。
- 校验与保存 API Key 前去除首尾空白，避免粘贴带入不可见空格导致校验失败。
- 修复 WebP 和 AVIF 图片的方向检测 - 现在会正确读取图片实际尺寸，而不是默认返回 1920x1080。
- 修复删除图片后上传页/管理页未及时刷新（TanStack Query 缓存 + recent uploads 列表导致需强刷）。
- 修复管理页「随机图 API 生成器」未能正确解析真实 API Base URL（改为从 `/api/config` 获取），仍输出占位链接 `https://your-worker.workers.dev` 的问题。
- 修复 `/api/images` 分页参数无边界问题，并统一对 `/api/images/:id` 的标签更新进行清洗/归一化处理。
- 修复管理页在未提供 API Key 时仍发起受保护接口请求的问题。
- 修复管理页虚拟瀑布流在生产构建中出现 React #301 无限重渲染崩溃的问题。
- 修复 `/favicon.ico` 请求返回 404（改为重定向到 `/static/favicon.ico`）。
- 修复未设置 API Key 时仍发送 `Authorization: Bearer null` 的问题。
- 统一清洗并校验标签路由参数（重命名/删除标签），拒绝非法标签名。
- 上传接口支持 multipart 使用 `image` 或 `file` 作为文件字段名。

### 安全

- 收紧标签清洗规则，避免标签管理相关接口出现意外字符输入。
