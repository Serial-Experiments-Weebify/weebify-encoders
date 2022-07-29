const { magentaBright } = require("chalk");
const { program, InvalidArgumentError } = require("commander");
const { access } = require("fs/promises");
const fs = require("fs");
const { redBright } = require("chalk");

const { ffprobe, ffmpegEncode, getDuration } = require("./ffmpeg-util");
const findStream = require("./find-stream");

function vresCheck(input) {
    const parsedValue = parseInt(input, 10);

    if (isNaN(parsedValue)) {
        throw new InvalidArgumentError("Not a number");
    }
    if (parsedValue < 144 || parsedValue > 2160)
        throw new InvalidArgumentError(
            `${parsedValue} is not a valid vertical resolution.`
        );

    return parsedValue;
}

program
    .name("syncoder")
    .description("CLI to encode anime")
    .option("-d --dryrun", "Just output the ffmpeg command")
    .option("-u --upload", "Upload to S3")
    .command("encode")
    .argument("<input>")
    .argument("<output>")
    .option("-q, --quality <quality>", "vertical resolution", vresCheck, 720)
    .action(async function (input, output, c) {
        try {
            const a = await access(input, fs.constants.R_OK);
        } catch {
            console.log(
                redBright("Could not open the input file. Does it exist?")
            );
            process.exit(-1);
        }

        main(input, output, this.opts().quality);
    });

async function main(input, output, hres) {
    // get file info
    const data = await ffprobe(input);
    //print out all streams
    console.log(magentaBright("Streams in source file:"));
    console.table(
        data.streams.map((stream) => ({
            type: stream.codec_type,
            codec: stream.codec_name,
            lang: stream.tags?.language ?? null,
            title: stream.tags?.title ?? stream.tags?.filename,
        }))
    );

    const streams = {
        video: findStream.video(data),
        audio: findStream.audio(data, "jpn"),
        subtitles: await findStream.sub(data, "eng"),
    };

    if (streams.subtitles) {
        //subtitle filter counts streams differently
        streams.subtitles.subIndex = 0;
        for (let i = 0; i < streams.subtitles.index; i++) {
            if (data.streams[i].codec_type === "subtitle")
                streams.subtitles.subIndex++;
        }
    }

    console.log(magentaBright("Output streams:"));
    const streamTable = Object.entries(streams).map(([key, value]) => ({
        type: key,
        index: value.index,
        lang: value.tags?.language ?? "?",
        title: value.tags?.title ?? "?",
    }));
    console.table(streamTable);

    ffmpegEncode(input, streams, await getDuration(input), hres, output);
}

program.parse(process.argv);
//main(process.argv.slice(2));
