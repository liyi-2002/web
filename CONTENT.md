# 内容维护

内容文件保存后可在本地预览；上线需要重新构建和部署。`draft: true` 的条目不会出现在页面、搜索或最近更新中，准备好后改为 `false`。

## 分享与手记

在 `src/content/blog/` 新建 Markdown 文件，例如 `my-first-note.md`：

```md
---
title: "文章标题"
description: "一段简短介绍"
section: notes
pubDate: 2026-11-27
tags: [随笔]
draft: true
---

这里开始写正文。
```

- `title`、`description`、`pubDate` 必填。
- `section` 用 `sharing` 表示分享，`notes` 表示手记；省略时归入手记。
- `updatedDate: 2026-11-28` 可选，用于记录更新日期。
- `heroImage` 可选，填写相对当前 Markdown 文件的本地图片路径。
- `tags` 可省略；`draft` 省略时视为正式内容。

文件名决定文章地址，例如上述文件发布后为 `/notes/my-first-note/`。建议使用简短英文文件名，发布后尽量保持不变。

## 摄影

将照片放到 `src/assets/photos/`（首次使用时新建目录）。在 `src/content/photography/` 新建一个 JSON 文件，每个文件对应一张照片：

```json
{
  "title": "照片标题",
  "image": "../../assets/photos/my-photo.jpg",
  "alt": "描述照片里实际可见的景物",
  "date": "2026-11-27",
  "description": "拍摄时的记录",
  "tags": ["风景"],
  "camera": "相机与镜头",
  "location": "拍摄地点",
  "draft": true
}
```

`title`、`image`、`alt`、`date` 必填；其余字段可省略，也可添加 `updatedDate`。`image` 相对于当前 JSON 文件，需指向真实存在的本地照片；若 JSON 放在子文件夹里，需相应调整路径。构建时会自动生成缩略图与浏览大图。

## 发布前

将已完成条目的 `draft` 改为 `false`，运行 `npm run check` 和 `npm run build`，再用 `npm run preview` 检查文章、搜索和照片浏览。最近更新按 `updatedDate` 排序，未填写时使用文章的 `pubDate` 或照片的 `date`。
