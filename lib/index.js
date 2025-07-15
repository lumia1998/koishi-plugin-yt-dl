"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Config = exports.inject = exports.name = void 0;
exports.apply = apply;
const koishi_1 = require("koishi");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
const child_process_1 = require("child_process");
exports.name = 'yt-dlp';
exports.inject = ['ffmpeg'];
exports.Config = koishi_1.Schema.object({
    ytDlpPath: koishi_1.Schema.path({
        filters: ['file'],
    }).default('./data/yt-dlp/yt-dlp').description('yt-dlp 可执行文件所在的路径。'),
    tempPath: koishi_1.Schema.string().default('./temp').description('下载和转码的临时文件存放目录。'),
    proxy: koishi_1.Schema.string().description('HTTP/HTTPS/SOCKS5 代理地址，留空则不使用。'),
    debug: koishi_1.Schema.boolean().default(false).description('启用后，将在 Koishi 日志中输出 yt-dlp 的详细日志。'),
});
// --- 核心逻辑 ---
function apply(ctx, config) {
    const logger = ctx.logger(exports.name);
    const YOUTUBE_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/g;
    // 创建临时目录
    const tempAbsolutePath = path_1.default.resolve(ctx.baseDir, config.tempPath);
    if (!fs_1.default.existsSync(tempAbsolutePath)) {
        fs_1.default.mkdirSync(tempAbsolutePath, { recursive: true });
    }
    // 注册中间件，监听消息
    ctx.middleware(async (session, next) => {
        // 首先执行 next()，避免阻塞其他插件
        await next();
        if (!session.content)
            return;
        // 重置正则表达式的 lastIndex
        YOUTUBE_REGEX.lastIndex = 0;
        const match = YOUTUBE_REGEX.exec(session.content);
        if (!match)
            return;
        const videoUrl = match[0];
        logger.info('检测到 YouTube 链接: %s', videoUrl);
        if (!ctx.ffmpeg?.executable) {
            logger.warn('ffmpeg 服务未找到，已跳过处理。');
            return;
        }
        const tempId = (0, uuid_1.v4)();
        let downloadedPath = null;
        let remuxedPath = null;
        try {
            await session.send((0, koishi_1.h)('quote', { id: session.messageId }) + '正在解析中...');
            // 1. 下载
            downloadedPath = await downloadWithYtDlp(videoUrl, tempId);
            if (!downloadedPath)
                throw new Error('使用 yt-dlp 下载失败。');
            // 2. 转封装
            remuxedPath = path_1.default.join(tempAbsolutePath, `${tempId}.mkv`);
            await remuxToMkv(downloadedPath, remuxedPath);
            // 3. 发送
            await session.send(koishi_1.h.video(remuxedPath));
        }
        catch (error) {
            logger.error('处理 YouTube 视频时发生错误: %s', error);
            await session.send('哎呀，处理视频时好像出错了... 😥');
        }
        finally {
            // 4. 清理
            if (downloadedPath)
                fs_1.default.promises.unlink(downloadedPath).catch(e => logger.error('清理原始文件失败: %s', e));
            if (remuxedPath)
                fs_1.default.promises.unlink(remuxedPath).catch(e => logger.error('清理转封装文件失败: %s', e));
        }
    });
    // --- 辅助函数 ---
    function downloadWithYtDlp(url, filename) {
        return new Promise((resolve) => {
            const outputTemplate = path_1.default.join(tempAbsolutePath, `${filename}.%(ext)s`);
            const args = [
                '-f "bv[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/best"',
                `--output "${outputTemplate}"`,
                config.proxy ? `--proxy ${config.proxy}` : '',
                `"${url}"`
            ].filter(Boolean).join(' ');
            const command = `"${config.ytDlpPath}" ${args}`;
            const child = (0, child_process_1.exec)(command, (error) => {
                if (error) {
                    logger.error('yt-dlp 下载失败: %s', error);
                    resolve(null);
                }
                else {
                    // 假设下载的文件是 mp4
                    resolve(path_1.default.join(tempAbsolutePath, `${filename}.mp4`));
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
    function remuxToMkv(inputPath, outputPath) {
        return new Promise((resolve, reject) => {
            const command = `"${ctx.ffmpeg.executable}" -y -i "${inputPath}" -c copy "${outputPath}"`;
            (0, child_process_1.exec)(command, (error) => {
                if (error) {
                    logger.error('FFmpeg 转封装失败: %s', error);
                    reject(error);
                }
                else {
                    logger.info('转封装成功: %s', outputPath);
                    resolve();
                }
            });
        });
    }
}
