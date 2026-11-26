# 素材来源与第三方说明

核查日期：2026-11-27。这里记录可核实的来源，不构成全网代码排重或法律保证。

## 当前发布的摄影素材

- 银河背景与分享图：**Luca Calderone**，[Unsplash 原图页面](https://unsplash.com/photos/a-night-sky-filled-with-lots-of-stars-ar2wBygqRQc)。页面明确适用 [Unsplash License](https://unsplash.com/license)，允许免费用于商业及非商业网站。原图只做尺寸缩放和 WebP 压缩；页面效果由 CSS 和 Three.js 叠加。详细来源随网站保存在 `public/licenses/wellington-stars.txt`。
- 备用夕阳雪山：**Marek Piwnicki**，[Unsplash 原图页面](https://unsplash.com/photos/golden-light-illuminates-rugged-snow-capped-mountains-during-sunset-mac7AaETQX0)，同样适用 Unsplash License。目前只保存在本地 `asset-library/backgrounds/dolomites/`，未发布。

## 代码与模板

项目从 [Astro Blog Starter](https://github.com/withastro/astro/tree/main/examples/blog) 开始开发；初始模板注明设计源于 [Bear Blog](https://github.com/HermanMartinus/bearblog/)。保留这项来源说明，不将整个项目宣称为完全从零原创。

Astro、Astro React integration、React、React DOM、Scheduler、Three.js 的原始许可文本与版本由 `scripts/write-license-notices.mjs` 在构建前从已安装包生成，随网站发布到 `/licenses/runtime-libraries.txt`。其他开发与构建依赖的具体版本见锁文件，许可保留在各自包内。

## 视觉参考与核查范围

设计迭代参考过 Sasshi 的纸张与留白、Orchestrated 的粒子运动。当前核心实现使用 DOM/SVG 圆弧轨道、Pointer Events 拖拽及 Canvas 光点。

对 [Sasshi 固定版本](https://github.com/qzz0518/sasshi/tree/944b5e825ce53be4df5ab770afa86ba363dc63f7) 的 App、Shell、layout、app.css 与当前相关实现进行了有限对照，未发现直接引入其核心代码或素材的证据。该项目的 [AGPL-3.0 许可证](https://github.com/qzz0518/sasshi/blob/944b5e825ce53be4df5ab770afa86ba363dc63f7/LICENSE) 不应被当作可无条件复制的模板许可。

本地 Git 历史未覆盖所有本次新增代码，也未对所有参考网站作完整源码比对，因此不能据此证明每一段代码都没有其他来源。后续引入实际第三方代码或素材时，应记录来源并保留其要求的声明。

## 图标与字体

当前 `favicon.svg` 是本项目直接用基础路径绘制的 LI 字母与星点，不使用第三方图标素材。页面调用访客设备已有的新罗马、行楷或后备字体，不打包或下载商业字体文件。

来源无法核实的旧图标、桌面底图与旧分享图已从发布资源删除；个人旧素材只保存在不参与构建、被 Git 忽略的本地归档内。
