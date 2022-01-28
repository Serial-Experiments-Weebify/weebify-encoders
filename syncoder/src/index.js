const { magentaBright } = require("chalk");

const { ffprobe, ffmpegEncode, getDuration } = require('./ffmpeg-util')
const findStream = require('./find-stream')

async function main(args) {
    // get file info
    const data = await ffprobe(args[0]);
    //print out all streams
    console.log(magentaBright("Streams in source file:"));
    console.table(data.streams.map(stream => ({ type: stream.codec_type, codec: stream.codec_name, lang: stream.tags?.language ?? null, title: stream.tags?.title ?? stream.tags?.filename })))

    const streams = {
        video: findStream.video(data),
        audio: findStream.audio(data, 'jpn'),
        subtitles: await findStream.sub(data, 'eng')
    }

    if (streams.subtitles) {            //subtitle filter counts streams differently
        streams.subtitles.subIndex = 0;
        for (let i = 0; i < streams.subtitles.index; i++) {
            if (data.streams[i].codec_type === 'subtitle')
                streams.subtitles.subIndex++;
        }
    }

    console.log(magentaBright("Output streams:"));
    console.table(streams, ['index', 'tags']);

    ffmpegEncode(args[0], streams, await getDuration(args[0]), args[1]);
}

main(process.argv.slice(2));

//don't exit if inspector is attached
if (require('inspector').url()) {
    setInterval(() =>{}, 10e100)
}
