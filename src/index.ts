import { Context, Schema, h } from 'koishi'
import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { exec, ExecException } from 'child_process'

// --- 类型定义 ---
declare module 'koishi' {
  interface Context {
    ffmpeg: { executable: string }
  }
}

export const name = 'yt-dlp'
export const inject = ['ffmpeg']

// --- 配置层 ---
export interface Config {
  ytDlpPath: string;
  tempPath: string;
  proxy: string;
  debug: boolean;
}

export const Config: Schema<Config> = Schema.object({
  ytDlpPath: Schema.path({
    filters: ['file'],
  }).default('./data/yt-dlp/yt-dlp').description('yt-dlp 可执行文件所在的路径。'),
  tempPath: Schema.string().default('./temp').description('下载和转码的临时文件存放目录。'),
  proxy: Schema.string().description('HTTP/HTTPS/SOCKS5 代理地址，留空则不使用。'),
  debug: Schema.boolean().default(false).description('启用后，将在 Koishi 日志中输出 yt-dlp 的详细日志。'),
})

// --- 核心逻辑 ---
export function apply(ctx: Context, config: Config) {
  const logger = ctx.logger(name);
  const YOUTUBE_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/g;

  // 创建临时目录
  const tempAbsolutePath = path.resolve(ctx.baseDir, config.tempPath);
  if (!fs.existsSync(tempAbsolutePath)) {
    fs.mkdirSync(tempAbsolutePath, { recursive: true });
  }

  // 注册中间件，监听消息
  ctx.middleware(async (session, next) => {
    // 首先执行 next()，避免阻塞其他插件
    await next();
    
    if (!session.content) return;

    // 重置正则表达式的 lastIndex
    YOUTUBE_REGEX.lastIndex = 0;
    const match = YOUTUBE_REGEX.exec(session.content);
    
    if (!match) return;

    const videoUrl = match[0];
    logger.info('检测到 YouTube 链接: %s', videoUrl);

    if (!ctx.ffmpeg?.executable) {
      logger.warn('ffmpeg 服务未找到，已跳过处理。');
      return;
    }

    const tempId = uuidv4();
    let downloadedPath: string | null = null;
    let remuxedPath: string | null = null;
    
    try {
      await session.send(h('quote', { id: session.messageId }) + '正在解析中...');
      
      // 1. 下载
      downloadedPath = await downloadWithYtDlp(videoUrl, tempId);
      if (!downloadedPath) throw new Error('使用 yt-dlp 下载失败。');

      // 2. 转封装
      remuxedPath = path.join(tempAbsolutePath, `${tempId}.mkv`);
      await remuxToMkv(downloadedPath, remuxedPath);
      
      // 3. 发送
      await session.send(h.video(remuxedPath));

    } catch (error) {
      logger.error('处理 YouTube 视频时发生错误: %s', error);
      await session.send('哎呀，处理视频时好像出错了... 😥');
    } finally {
      // 4. 清理
      if (downloadedPath) fs.promises.unlink(downloadedPath).catch(e => logger.error('清理原始文件失败: %s', e));
      if (remuxedPath) fs.promises.unlink(remuxedPath).catch(e => logger.error('清理转封装文件失败: %s', e));
    }
  });

  // --- 辅助函数 ---

  function downloadWithYtDlp(url: string, filename: string): Promise<string | null> {
    return new Promise((resolve) => {
      const outputTemplate = path.join(tempAbsolutePath, `${filename}.%(ext)s`);
      const args = [
        '-f "bv[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/best"',
        `--output "${outputTemplate}"`,
        config.proxy ? `--proxy ${config.proxy}` : '',
        `"${url}"`
      ].filter(Boolean).join(' ');
      
      const command = `"${config.ytDlpPath}" ${args}`;
      
      const child = exec(command, (error) => {
        if (error) {
          logger.error('yt-dlp 下载失败: %s', error);
          resolve(null);
        } else {
          // 假设下载的文件是 mp4
          resolve(path.join(tempAbsolutePath, `${filename}.mp4`));
        }
      });

      if (config.debug) {
        if (child.stdout) {
          child.stdout.on('data', (data) => {
            logger.info(`[yt-dlp] ${data}`);
          });
        }
        if (child.stderr) {
          child.stderr.on('data', (data) => {
            logger.warn(`[yt-dlp] ${data}`);
          });
        }
      }
    });
  }

  function remuxToMkv(inputPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const command = `"${ctx.ffmpeg.executable}" -y -i "${inputPath}" -c copy "${outputPath}"`;
      exec(command, (error: ExecException | null) => {
        if (error) {
          logger.error('FFmpeg 转封装失败: %s', error);
          reject(error);
        } else {
          logger.info('转封装成功: %s', outputPath);
          resolve();
        }
      });
    });
  }
}