import { Context, h, Session } from 'koishi'
import { Config } from './config'
import { downloadVideo, pollDownloadState, extractVideoIds } from './utils'
import { promises as fs } from 'fs'
import * as path from 'path'

export const name = 'ytpdl'
export { Config }
export const inject = ['http']

async function handleDownload(session: Session, url: string, ctx: Context, config: Config) {
  const logger = ctx.logger('ytpdl')
  if (!session || !url) return

  if (config.debug) {
    logger.info(`Handling YouTube URL: ${url}`)
  }

  try {
    await session.send('正在请求下载...')
    const processId = await downloadVideo(ctx, config, url)
    if (config.debug) {
      logger.info(`Download process started with ID: ${processId}`)
    }

    const result = await pollDownloadState(ctx, config, processId)

    const encodedPath = encodeURIComponent(Buffer.from(result.output.savedFilePath).toString('base64'))
    const fileUrl = `${config.host}/filebrowser/v/${encodedPath}`
    if (config.debug) {
      logger.info(`Downloading video from correct URL: ${fileUrl}`)
    }

    const videoBuffer = await ctx.http.get(fileUrl, { responseType: 'arraybuffer' })

    await fs.mkdir(config.tempDir, { recursive: true })
    const filename = path.basename(result.output.savedFilePath)
    const tempFilePath = path.join(config.tempDir, filename)
    
    await fs.writeFile(tempFilePath, Buffer.from(videoBuffer))

    const absolutePath = path.resolve(tempFilePath)
    if (config.debug) {
      logger.info(`Sending video from temporary path: ${absolutePath}`)
    }
    await session.send(h.video(`file://${absolutePath}`))

    setTimeout(() => {
      fs.unlink(tempFilePath).then(() => {
        if (config.debug) {
          logger.info(`Deleted temporary file: ${absolutePath}`)
        }
      }).catch(err => {
        logger.error(`Failed to delete temporary file: ${absolutePath}`, err)
      })
    }, 3600 * 1000) // 1 hour

  } catch (error) {
    logger.error(error)
    // 在自动下载模式下，不发送错误消息以避免刷屏
    // if (error instanceof Error) {
    //   return session.send(`处理失败: ${error.message}`)
    // }
  }
}

export function apply(ctx: Context, config: Config) {
  const logger = ctx.logger('ytpdl')

  ctx.command('ytdl <url:string>', '下载 YouTube 视频')
    .action(async ({ session }, url) => {
      if (!session) return
      if (!url) return '请输入 YouTube 链接。'
      return handleDownload(session, url, ctx, config)
    })

  ctx.middleware(async (session, next) => {
    if (session.selfId === session.bot.selfId || !session.content) return next()

    // 如果是 ytdl 指令，则不进行自动处理
    if (session.content.startsWith('ytdl')) return next()

    const videoIds = extractVideoIds(session.content)

    if (videoIds.length > 0) {
      for (const videoId of videoIds) {
        const standardUrl = `https://www.youtube.com/watch?v=${videoId}`
        // 无需等待下载完成，以免阻塞后续消息处理
        handleDownload(session, standardUrl, ctx, config)
      }
    }

    return next()
  })
}