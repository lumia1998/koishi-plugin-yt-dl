# koishi-plugin-ytpdl

Koishi 机器人框架的 youtube-dl 插件。

## 介绍

本插件通过调用 `yt-dlp-webui` 的 API 来下载 YouTube 视频。

## 部署

您需要先部署 `yt-dlp-webui` 服务。

```bash
docker pull marcobaobao/yt-dlp-webui
docker run -d -p 3033:3033 -v <your dir>:/downloads marcobaobao/yt-dlp-webui
```

请将 `<your dir>` 替换为您希望保存下载视频的本地目录。

## 使用

在 Koishi 中，您可以使用以下指令来下载视频：

```
ytdl [YouTube 视频链接]
```

例如：

```
ytdl https://www.youtube.com/watch?v=dQw4w9WgXcQ
```

## 配置

在插件配置中，您需要填写 `yt-dlp-webui` 服务的地址。

- **endpoint**: `yt-dlp-webui` 服务的 API 地址，例如 `http://localhost:3033`。
