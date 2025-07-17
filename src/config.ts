import { Schema } from 'koishi'

export interface Config {
  host: string
  debug: boolean
  tempDir: string
  autoParse: boolean
  parseInterval: number
  showError: boolean
}

export const Config: Schema<Config> = Schema.object({
  host: Schema.string().description('yt-dlp-webui 的地址和端口').default('http://127.0.0.1:3033').required(),
  debug: Schema.boolean().description('启用调试模式').default(false),
  tempDir: Schema.string().description('视频下载的临时目录').default('./temp'),
  autoParse: Schema.boolean().description('是否自动解析聊天中的 YouTube 链接').default(true),
  parseInterval: Schema.number().description('同一链接在多少秒内不再重复解析').default(180).min(1),
  showError: Schema.boolean().description('自动解析失败时是否发送错误提示').default(false),
})