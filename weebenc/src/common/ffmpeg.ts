import childProc from "child_process";
import { EventEmitter } from "node:events"

export function $(strings: TemplateStringsArray, ...values: any[]): Promise<string> {
    let command = '';

    strings.forEach((str, i) => {
        command += str + (values[i] ?? '');
    });

    return new Promise((resolve, reject) => childProc.exec(command, (error, stdout) => {
        if (error) reject(error);
        resolve(stdout);
    }))
}

export async function ffprobe(file: string): Promise<any> {
    return JSON.parse(await $`ffprobe -v quiet -print_format json -show_format -show_streams "${file}"`);
}

export  async function getDuration(file: string) {
    return parseFloat(await $`ffprobe -i "${file}" -show_entries format=duration -v quiet -of "csv=p=0"`)
}

export async function getResolution(file: string): Promise<[number,number]> {
    let vStream = JSON.parse(await $`ffprobe "${file}" -select_streams v:0 -show_entries stream=width,height -of json`)?.streams?.[0];

    if (typeof vStream?.width === 'number' && typeof vStream?.height === 'number') {
        return [vStream.width, vStream.height];
    }
    throw "Could not get resolution";
}

export function ffmpegGetStream(filePath: string, index: number, format: string) {
    return childProc.spawn('ffmpeg', ['-i', filePath, '-map', `0:${index}`, '-f', format, '-'], {});
}

export function ffmpegGetStreamLength(file: string, index: number, format: string): Promise<number> {

    const p = ffmpegGetStream(file, index, format);
    let l = 0;
    return new Promise((resolve, reject) => {
        p.stdout.on('data', chunk => {
            l += chunk.length;
        })
        p.on("exit", () => {
            resolve(l);
        })
    })
}


/**
 * FFmpeg adopts the following quoting and escaping mechanism, unless explicitly specified. The following rules are applied:
 * * ‘'’ and ‘\’ are special characters (respectively used for quoting and escaping). In addition to them, there might be other special characters depending on the specific syntax where the escaping and quoting are employed.
 * * A special character is escaped by prefixing it with a ‘\’.
 * * All characters enclosed between ‘''’ are included literally in the parsed string. The quote character ‘'’ itself cannot be quoted, so you may need to close the quote and escape it.
 * * Leading and trailing whitespaces, unless escaped or quoted, are removed from the parsed string. * 
 * @link https://ffmpeg.org/ffmpeg-utils.html#Quoting-and-escaping FFmpeg docs
 * @param {string} text the string to escape 
 * @returns {string} escaped string
 */
export function ffEscape(text: string) {
    return `'${text.replace(/\'/g, "'\\''")}'`
}

export function waitFor(object: EventEmitter, event: string) {
    return new Promise(r => object.once(event, r))
}

const timeRegex = /time=\s{0,10}(\d{2})?:(\d{2})?:(\d{2})?.(\d{2})?/i
const fpsRegex = /(:?fps=\s{0,10}(\d*\.?\d*))/i
const speedRegex = /(:?speed=\s{0,10}(\d*\.\d*))/i

/**
 * Gets the video time from ffmpeg's '-stats' output
 * @param msg message from process
 * @returns number of seconds
 */
export function parseTime(msg:string) {
    let match = msg.match(timeRegex)
    if (!match) return null;

    return parseInt(match[1]) * 3600 +
        parseInt(match[2]) * 60 +
        parseInt(match[3]) +
        parseFloat(`0.${match[4]}`);
}