import { Schema } from 'koishi'

export interface Config {
  host: string
  debug: boolean
  tempDir: string
}

export const Config: Schema<Config> = Schema.object({
  host: Schema.string().description('ytpdl 的地址和端口').default('http://127.0.0.1:3033').required(),
  debug: Schema.boolean().description('启用调试模式').default(false),
  tempDir: Schema.string().description('视频下载的临时目录').default('./temp'),
})