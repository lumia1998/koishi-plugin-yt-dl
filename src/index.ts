import { Context, h, Session } from 'koishi'
import { Config } from './config'
import { downloadVideo, pollDownloadState, extractYouTubeUrls } from './utils'
import { promises as fs } from 'fs'
import * as path from 'path'

export const name = 'ytpdl'
export { Config }
export const inject = ['http']

async function handleDownload(session: Session, url: string, ctx: Context, config: Config, isAutoParse = false) {
  const logger = ctx.logger('ytpdl')
  if (!session || !url) return

  if (config.debug) {
    logger.info(`Handling YouTube URL: ${url}`)
  }

  try {
    if (isAutoParse) {
      await session.send('正在解析视频中...')
    } else {
      await session.send('正在请求下载...')
    }
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
    if (isAutoParse) {
      if (config.showError) {
        session.send('请使用ytdl [链接]下载视频，如果无法下载请更新yt-dlp-webui docker版本')
      }
      return
    }
    if (error instanceof Error) {
      return session.send(`处理失败: ${error.message}`)
    }
  }
}

export function apply(ctx: Context, config: Config) {
  const logger = ctx.logger('ytpdl')
  const lastProcessedUrls: Record<string, number> = {}

  ctx.command('ytdl <url:string>', '下载 YouTube 视频')
    .action(async ({ session }, url) => {
      if (!session) return
      if (!url) return '请输入 YouTube 链接。'
      return handleDownload(session, url, ctx, config, false)
    })

  ctx.middleware(async (session, next) => {
    if (session.userId === session.bot.selfId || !session.content) return next()

    const urls = extractYouTubeUrls(session.content)

    if (urls.length > 0) {
      for (const url of urls) {
        // 无需等待下载完成，以免阻塞后续消息处理
        handleDownload(session, url, ctx, config, true)
      }
    }

    return next()
  }, true)
}