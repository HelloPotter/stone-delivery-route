# Stone Delivery Route

iPhone 优先的中文配送清单。客户简写搜索、肉/退/款圆标、手动排序、停一站分组、导航、防漏送和本地恢复。D1 保存客户与任务，使用版本检查阻止旧记录覆盖新进度。

## 开发

Node 22.13+，pnpm。安装依赖后运行 `pnpm dev`；生产构建 `pnpm build`。数据库迁移在 `drizzle/`，通过部署平台应用。初始43个客户来自 `data/customers.json`；首次运行载入，之后以云端数据为准。

代码托管在 GitHub；实际应用需要支持 Cloudflare Workers 与 D1 的运行环境，不能仅通过静态 GitHub Pages 执行云端保存。当前 Sites 部署仅供所有者访问；若将应用开放给其他人，必须先添加独立的用户授权和数据隔离。

## 验证

`node --experimental-strip-types --test tests/model.test.ts` 验证分组、模板重置、防漏送和坐标转换。`tsc --noEmit` 与生产构建验证类型和打包。

自动排序和Google道路里程预测未接入。iPhone实机长按拖动、后台回收恢复及主屏幕离线启动需实机验收。WebMCP只提供只读进度查询，尚无支持的验证环境。
