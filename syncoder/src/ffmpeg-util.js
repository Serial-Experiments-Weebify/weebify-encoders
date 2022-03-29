const childProc = require('child_process');
const chalk = require('chalk');


function $(strings, ...values) {
    let command = '';

    strings.forEach((str, i) => {
        command += str + (values[i] ?? '');
    });

    return new Promise((resolve, reject) => childProc.exec(command, (error, stdout) => {
        if (error) reject(error);
        resolve(stdout);
    }))
}

async function ffprobe(file) {
    return JSON.parse(await $`ffprobe -v quiet -print_format json -show_format -show_streams "${file}"`);
}

async function getDuration(file) {
    return parseFloat(await $`ffprobe -i "${file}" -show_entries format=duration -v quiet -of "csv=p=0"`)
}

function ffmpegGetStream(file, index, format) {
    return childProc.spawn('ffmpeg', ['-i', file, '-map', `0:${index}`, '-f', format, '-'], {});
}
function ffmpegGetStreamLength(file, index, format) {

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
function ffEscape(text) {
    return `'${text.replace(/\'/g, "'\\''")}'`
}

function waitFor(object, event) {
    return new Promise(r => object.once(event, r))
}

const timeRegex = /time=\s{0,10}(\d{2})?:(\d{2})?:(\d{2})?.(\d{2})?/i
const fpsRegex = /(:?fps=\s{0,10}(\d*\.?\d*))/i
const speedRegex = /(:?speed=\s{0,10}(\d*\.\d*))/i

function parseTime(msg) {
    let match = msg.match(timeRegex)
    if (!match) return null;

    return parseInt(match[1]) * 3600 +
        parseInt(match[2]) * 60 +
        parseInt(match[3]) +
        parseFloat(`0.${match[4]}`);
}

async function ffmpegEncode(file, streamData, duration, outFile) {
    //? set yes to overwrite, some stdout settings, input file and faststart
    const baseArgs = ['-y', '-hide_banner', /*'-loglevel','16',*/ '-stats', '-i', file, '-movflags', '+faststart', '-brand', 'mp42'];
    //? point to video stream and select video codec
    const videoArgs = ['-map', `0:${streamData.video.index}`, '-c:v', 'libx264'];
    //? point to audio stream and select audio codec
    const audioArgs = ['-map', `0:${streamData.audio.index}`, '-c:a', 'aac'];


    const filters = ['format=yuv420p','scale=-1:720'];

    if (streamData.subtitles)
        filters.push(`subtitles=${ffEscape(ffEscape(file))}:si=${streamData.subtitles.subIndex}`);

    const filterArgs = ['-vf', filters.join(',')];

    //? set the output file format, some libx264 settings and output file name
    const encoderArgs = ['-f', 'mp4', '-crf', '23', '-preset', 'slow', '-tune', 'animation', '-bf', '2', '-g', '90', outFile];



    const args = [...baseArgs, ...videoArgs, ...audioArgs, ...filterArgs, ...encoderArgs];
    if (globalThis.verbose || true) //TODO: remove || true
        console.log(`command: \nffmpeg ${chalk.blackBright(args.join(' '))}`);

    if (globalThis.dryrun) return;
    
    const encoderProcess = childProc.spawn('ffmpeg', args, {});

    console.log('Redirecting output...\n')
    encoderProcess.stdout.pipe(process.stdout);
    encoderProcess.stderr.pipe(process.stderr);


    await waitFor(encoderProcess, "exit");
    console.log('exit');
}

module.exports = {
    $, ffmpegGetStreamLength, ffprobe, ffmpegEncode, getDuration
}
