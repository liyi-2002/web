# LiYi's Channel

李毅的个人网站，记录学习、分享与生活。正式站点：[liyizju.com](https://liyizju.com/)。

## 四个栏目

| 栏目 | 地址 |
| --- | --- |
| 主页 | `/` |
| 分享 | `/sharing/` |
| 手记 | `/notes/` |
| 摄影 | `/photography/` |

目前各栏目以空白卡纸预留内容位置，后续逐步添加分享、手记和摄影作品。

## 页面体验

- 银河照片铺满背景，随鼠标移动产生细微视差。
- 白、橙、紫色粒子跟随鼠标，在移动中逐渐聚集。
- 栏目沿半圆轨道平滑切换，内容卡纸可以自由拖动。
- 页面适配桌面和手机，手机端的个人信息放在内容下方。

## 技术与运行

使用 **Astro + React + Three.js**：Astro 生成静态页面，React 组织背景组件，Three.js 实现照片视差；粒子与卡纸交互由 Canvas、TypeScript 和 CSS 完成。

本地运行需要 **Node.js ≥ 22.23.4**。在项目目录执行：

```sh
npm ci
npm run dev -- --background
```

构建并预览发布版本：

```sh
npm run build
npm run preview -- --background
```

推送到 `main` 分支后，GitHub Actions 会自动构建并部署到 GitHub Pages。
