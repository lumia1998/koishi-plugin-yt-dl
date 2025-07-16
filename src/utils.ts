import { Context } from 'koishi'
import { Config } from './config'
import * as path from 'path'

export async function downloadVideo(ctx: Context, config: Config, url: string): Promise<string> {
  const endpoint = `${config.host}/api/v1/exec`

  const params = [
    '-f',
    'bestvideo[height<=720][ext=mp4][vcodec^=avc]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]',
  ]

  try {
    const response = await ctx.http.post<string>(endpoint, {
      url,
      params,
    })
    return response
  } catch (error: any) {
    ctx.logger('ytpdl').error(`Failed to start download for ${url}: ${error.message}`)
    throw new Error('发送下载请求失败')
  }
}

export interface ProcessResponse {
  id: string;
  progress: {
    process_status: number;
    percentage: string;
    speed: number;
    eta: number;
  };
  info: {
    url: string;
    title: string;
    thumbnail: string;
    resolution: string;
    size: number;
    vcodec: string;
    acodec: string;
    extension: string;
    original_url: string;
    created_at: any;
  };
  output: {
    Path: string;
    Filename: string;
    savedFilePath: string;
  };
  params: string[];
}

export async function pollDownloadState(ctx: Context, config: Config, processId: string): Promise<ProcessResponse> {
  const endpoint = `${config.host}/api/v1/running`
  let attempts = 0
  const maxAttempts = 120 // 10 minutes
  const pollInterval = 5000 // 5 seconds

  let lastKnownProcessState: ProcessResponse | null = null

  while (attempts < maxAttempts) {
    try {
      const response = await ctx.http.get<ProcessResponse[]>(endpoint)
      const process = response.find(p => p.id === processId)

      if (process) {
        lastKnownProcessState = process
        if (process.progress.process_status === 2) { // Completed
          return process
        }
        if (process.progress.process_status === 3) { // Error
          throw new Error(`下载失败: ${process.info?.title || '未知错误'}`)
        }
      } else if (lastKnownProcessState) {
        // Process is no longer in the running list, assume it's completed
        return lastKnownProcessState
      }
    } catch (error) {
      if (error instanceof Error) {
        ctx.logger('ytpdl').error(`Polling failed: ${error.message}`)
        throw error // re-throw the error to be caught by the caller
      }
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval))
    attempts++
  }

  throw new Error('下载超时')
}

export function extractVideoIds(text: string): string[] {
  // 正则表达式，用于匹配多种 YouTube 链接格式并提取视频 ID
  // 支持的格式:
  // - https://www.youtube.com/watch?v=VIDEO_ID
  // - https://m.youtube.com/watch?v=VIDEO_ID
  // - https://youtu.be/VIDEO_ID
  // - https://www.youtube.com/embed/VIDEO_ID
  // - 以及带有时间戳等参数的链接
  const youtubeRegex = /(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/g;
  
  const matches = text.matchAll(youtubeRegex);
  const videoIds = new Set<string>();
  
  for (const match of matches) {
    // match[1] 是正则表达式中捕获组的内容，即视频 ID
    if (match[1]) {
      videoIds.add(match[1]);
    }
  }
  
  return Array.from(videoIds);
}