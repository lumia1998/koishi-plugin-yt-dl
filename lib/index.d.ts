import { Context, Schema } from 'koishi';
declare module 'koishi' {
    interface Context {
        ffmpeg: {
            executable: string;
        };
    }
}
export declare const name = "yt-dlp";
export declare const inject: string[];
export interface Config {
    ytDlpPath: string;
    tempPath: string;
    proxy: string;
    debug: boolean;
}
export declare const Config: Schema<Config>;
export declare function apply(ctx: Context, config: Config): void;
