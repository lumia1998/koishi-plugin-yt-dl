# koishi-plugin-yt-dlp

[

![npm](https://img.shields.io/npm/v/koishi-plugin-yt-dlp.svg)

](https://www.npmjs.com/package/koishi-plugin-yt-dlp)

一个 Koishi 插件，可以自动检测聊天消息中的 YouTube 链接，并下载、转封装、发送视频。

## ✨ 功能

- **自动检测**: 无需任何指令，自动识别聊天中的 YouTube 链接 (包括 `youtube.com` 和 `youtu.be`)。
- **自动处理**: 自动完成 `下载 -> 转封装为 mkv -> 发送视频 -> 清理临时文件` 的全套流程。
- **高度可配置**: 支持自定义 `yt-dlp` 的路径和代理，完美适配 Docker 等特殊运行环境。
- **依赖集成**: 与 `koishi-plugin-ffmpeg` 无缝协作，实现高效的视频转封装。

## 依赖

- **yt-dlp**: 必须拥有 `yt-dlp` 可执行文件。您可以在插件配置中手动选择其路径。
- **koishi-plugin-ffmpeg**: 必须安装 v1.1.0 或更高版本，用于视频转封装。

## ⚙️ 配置

| 配置项 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `ytDlpPath` | `path` | `./data/yt-dlp/yt-dlp` | `yt-dlp` 可执行文件的路径。您可以在 Koishi 控制台中通过文件浏览器来选择。 |
| `tempPath` | `string` | `./temp` | 下载和转码的临时文件存放目录。 |
| `proxy` | `string` | | HTTP/HTTPS/SOCKS5 代理地址，留空则不使用。 |
| `debug` | `boolean` | `false` | 启用后，将在 Koishi 日志中输出 yt-dlp 的详细日志。 |

## 📝 License

[MIT](./LICENSE).