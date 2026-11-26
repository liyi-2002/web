# LiYi's Channel

李毅的个人网站，正式域名为 [liyizju.com](https://liyizju.com/)。网站包含主页、分享、手记和摄影四个目录，使用静态页面部署到 GitHub Pages。

## 当前实现

- **Astro 7** 生成页面、Markdown/MDX 文章、RSS 和 sitemap。
- **React 19 + Three.js** 在独立背景组件中实现真实星空照片的轻微 2.5D 视差。背景以 Wellington 星空照片为素材，具有静态图片回退。
- **Canvas 2D** 绘制跟随鼠标的白、橙、紫色光点。
- **TypeScript + CSS** 实现目录圆弧切换和可拖动卡纸。四个目录都有独立静态地址，普通点击时在当前页面中切换内容。

当前首页、分享和摄影卡纸保留为空；手记在有文章时显示文章列表。项目没有访客记录或访问统计功能。

## 本地开发与预览

在 `my-blog` 目录执行命令。需要 **Node.js >=22.23.4** 和 **npm >=9.6.5**；依赖版本由 `package-lock.json` 锁定。

```sh
npm ci
npm run dev -- --background --host 127.0.0.1 --port 4321
```

开发地址通常为 [http://127.0.0.1:4321/](http://127.0.0.1:4321/)，以启动输出或 `status` 返回的地址为准。开发服务在后台运行：

```sh
npm run astro -- dev status
npm run astro -- dev logs
npm run astro -- dev stop
```

生成生产构建后，用独立端口预览实际发布文件：

```sh
npm run check
npm run build
npm run preview -- --background --host 127.0.0.1 --port 4322
```

构建输出在 `dist/`；预览地址通常为 [http://127.0.0.1:4322/](http://127.0.0.1:4322/)。修改源码后需要重新构建才能更新生产预览。

```sh
npm run astro -- preview status
npm run astro -- preview logs
npm run astro -- preview stop
```

如果已有后台服务，先检查 `status` 返回的地址。`dev` 和 `preview` 均通过 Astro 管理；相关命令见 [Astro CLI 文档](https://docs.astro.build/en/reference/cli-reference/)。本地服务用于开发和检查，正式网站由 GitHub Pages 提供静态文件。

## 内容与代码入口

| 位置 | 用途 |
| --- | --- |
| `src/pages/index.astro` | 主页 `/` |
| `src/pages/sharing/index.astro` | 分享 `/sharing/` |
| `src/pages/notes/index.astro` | 手记 `/notes/` |
| `src/pages/photography/index.astro` | 摄影 `/photography/` |
| `src/layouts/FolioLayout.astro` | 四个目录、个人信息、卡纸容器 |
| `src/styles/folio.css` | 页面布局与卡纸外观 |
| `src/scripts/folio.ts`、`src/scripts/tray-drag.ts` | 目录切换与卡纸拖动 |
| `src/scripts/particle-swarm.ts`、`src/scripts/particle-light.ts` | 光点运动与绘制 |
| `src/components/LandscapeBackdrop.astro` | 背景图片与 React 组件入口 |
| `src/scene/photographic-landscape.ts` | 照片背景的 Three.js 视差 |
| `src/consts.ts` | 站名与四个目录的名称、地址、标题、描述 |
| `src/components/BaseHead.astro` | canonical、搜索描述、Open Graph 与 RSS 发现链接 |
| `src/content.config.ts` | 文章字段校验 |
| `src/content/blog/` | Markdown/MDX 文章 |
| `public/landscape/` | 当前上线使用的背景图片 |

在 `src/content/blog/` 添加 `.md` 或 `.mdx` 文件即可创建文章。文章会出现在手记列表中，正文地址为 `/notes/<文件名>/`，并进入 `/rss.xml`。前置信息示例：

```yaml
---
title: My first note
description: A short summary of this note.
pubDate: 2026-11-27
# updatedDate: 2026-11-28
# heroImage: ../../assets/example.jpg
---
```

`title`、`description`、`pubDate` 为必填项；`updatedDate` 和 `heroImage` 可选。只把准备公开的文章放入此目录，构建会发布其中全部有效内容。

## 部署

`.github/workflows/deploy.yml` 在推送到 `main` 或手动触发时执行 `npm ci`、`npm run check`、`npm run build`，上传 `dist/` 并部署到 GitHub Pages。工作流使用 `pages` 并发组，将完整发布流程串行执行；正在运行的发布不会被新的推送取消。[GitHub 并发部署说明](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments)

仓库的 **Settings → Pages → Source** 应设为 **GitHub Actions**。当前自定义域名对应三处配置：

- `astro.config.mjs`：`site: 'https://liyizju.com'`。
- `public/CNAME`：`liyizju.com`。
- `public/robots.txt`：指向正式域名的 `/sitemap-index.xml`。

更换域名时同步更新这些文件、GitHub Pages 自定义域名设置与 DNS。自定义域名使用根路径，无需设置仓库名 `base`。[Astro 的 GitHub Pages 部署说明](https://docs.astro.build/en/guides/deploy/github/)

上线前应检查四个目录的直接访问、刷新、前进后退，以及 `/rss.xml`、`/sitemap-index.xml` 和 `/robots.txt`。本地构建不会自动发布；提交并推送到部署分支后才触发工作流。

## 本地素材归档

`asset-library/` 保存项目内的素材归档，未放入 `public/`、也未被源码导入的文件不会进入 Astro 构建产物：

- `asset-library/backgrounds/wellington/`：当前银河背景的原图。
- `asset-library/backgrounds/dolomites/`：备用夕阳雪山原图和桌面/手机 WebP。
- `asset-library/legacy/`：早期个人素材，保留供本地查阅。

`asset-library/` 已加入 `.gitignore`，仅在本地保存，不会随 Git 提交或网站构建发布。
