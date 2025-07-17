import { Context } from 'koishi'
import { Config } from './config'
import * as path from 'path'

export function extractYoutubeUrls(text: string): string[] {
  // 参考用户提供的 Python 正则表达式，适配 JavaScript
  // 这个正则表达式可以匹配多种 YouTube 域名和路径结构
  const youtubeUrlPattern = /(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com)(\/watch\?v=|\/embed\/|\/v\/|\/shorts\/|\/live\/|\/playlist\?list=|\/channel\/|\/user\/)?([a-zA-Z0-9_-]{11,})([^#&\n\r ]*)/g;

  const matches = text.match(youtubeUrlPattern);
  
  // 使用 Set 去重
  if (matches) {
    return Array.from(new Set(matches));
  }
  
  return [];
}

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