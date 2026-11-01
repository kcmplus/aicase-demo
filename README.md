# POPOMO 独立前端演示项目

从现有用户端完整复制，包含手机壳编辑器及设备演示页。可以使用当前 `aicase-demo` 独立仓库开发，不依赖原后端、数据库、环境变量或管理后台。原项目保持原样。

## 启动

需要 Node.js 20+，无需安装依赖。在此文件夹执行：

```sh
npm run dev
```

- 用户端：http://127.0.0.1:4175/
- 设备演示：http://127.0.0.1:4175/device.html
- 更换端口：`PORT=4180 npm run dev`
- 静态打包：`npm run build`，将 `dist/` 部署到静态服务器的根目录或子目录（包括 GitHub Pages）。
- 验证：`npm test`

## 演示交互

选款／上传照片 → 编辑文字与图案 → 选择机型 → 确认模拟订单 → 查看二维码 → 页面内的站点演示 → 模拟打印与取件。My orders 支持历史订单、未打印修改和取消。刷新可恢复数据。

登录填写任意格式有效的邮箱，点击获取验证码，再输入 **123456**；不会发送邮件。每个本地账号赠送 3 次 AI 演示额度，订阅演示为 $5.99 / 15 次；打印为 $9.90。AI 约 4.5 秒完成，返回所选风格的预置样片，不会转换上传照片。所有支付、续订操作均为本地模拟。

顶部「重置演示」清空此演示的账号、订单、照片和草稿。账号、额度和订单只在当前浏览器保存，不支持真实跨设备同步。独立设备页沿用原有样例队列，可用页面中的样例按钮体验；手机下单后的流程通过用户端 “Try the station demo” 演示。

## 修改入口

| 位置 | 内容 |
| --- | --- |
| `storefront/simple-app.js` | 用户端页面、编辑器和主要交互 |
| `storefront/simple.css`、`editor-workspace.css` | 页面和编辑器样式 |
| `storefront/ai-view.js`、`ai-interactions.js` | AI 页面与交互 |
| `storefront/demo/catalog.js` | 演示价格、额度、风格及案例 |
| `storefront/demo/api.js` | 本地账号、订单、订阅和 AI 状态模拟 |
| `storefront/demo/toolbar.js` | 演示提示与重置入口 |
| `storefront/device-app.js`、`device-service.js` | 设备页和样例队列 |
| `storefront/assets/` | 独立完整素材及许可证 |

数据请求保留原接口的数据格式，通过各 service 模块的 `demoFetch` 在浏览器内处理；静态服务器不代理 API。照片和演示记录存于独立 IndexedDB 数据库，其他状态使用演示专属本地存储键。`mode: live`、`server: true` 等内部字段仅为兼容原页面状态逻辑，不表示连接真实服务。

本项目只抽离用户端与设备端；Vue 管理后台继续位于原仓库 `frontend/admin`。

## GitHub Actions 与 Pages

仓库：https://github.com/kcmplus/aicase-demo

`.github/workflows/pages.yml` 在推送到 `main`、向 `main` 提交 PR 或手动运行时自动测试、构建并校验静态资源。构建产物 `frontend-demo` 保留 14 天。PR 仅验证；`main` 成功后自动部署 GitHub Pages。

首次配置：在 GitHub 仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。然后推送 `main` 或在 Actions 页面手动运行工作流。无需配置额外 Secret。

预期访问地址：https://kcmplus.github.io/aicase-demo/ （以 Actions 部署输出为准）

本地执行同样的检查：

```sh
npm test
npm run build
npm run verify:build
```

构建时将素材地址转换为相对路径，同时保留图片优化；设备页二维码返回当前站点目录，适配 GitHub Pages 的仓库子路径。
