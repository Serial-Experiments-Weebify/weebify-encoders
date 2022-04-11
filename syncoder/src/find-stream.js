const { ffmpegGetStreamLength } = require('./ffmpeg-util')
const { cyanBright, yellowBright } = require('chalk')


const UNSUPPORTED_SUB = ['hdmv_pgs_subtitle'];

//#region VIDEO SELECTION
//not sure this is needed

function findVideoStream(data) {
    console.info(cyanBright(`[VIDEO] picking the first (and hopefully only) video stream`));

    return data.streams.find(stream => stream.codec_type === 'video');
}

//#endregion VIDEO SELECTION

//#region AUDIO SELECTION

function findAudioStream(data, lang) {
    let audioStreams = data.streams.filter(stream => stream.codec_type === 'audio');
    console.info(cyanBright(`[AUDIO] Found ${audioStreams.length} audio streams`));

    audioStreams = audioStreams.filter(audioStream => audioStream.tags.language === lang);

    console.info(cyanBright(`[AUDIO] ${audioStreams.length} match language '${lang}'`));
    if (audioStreams.length == 0) {
        console.warn(yellowBright('[AUDIO] No audio streams left! Entering fallback mode.'));

        let audioStreams = data.streams.filter(stream => stream.codec_type === 'audio');
        let defaultAudio = audioStreams.find(stream => stream.disposition?.default > 0);

        return defaultAudio ?? audioStreams[0]

    } else if (audioStreams.length == 1) {
        console.info(cyanBright('[AUDIO] Returning last remaining stream'));
        return audioStreams[0];
    }

    console.warn(yellowBright('[AUDIO] Muliple audio streams remaining. Returning the first one. (Open an issue if you encounter problems)'));
    return audioStreams[0];

}

//#endregion AUDIO SELECTION

//#region SUBTITLE SELECTION

async function findSubStream(data, lang) {
    let subs = data.streams.filter(stream => stream.codec_type === 'subtitle');

    console.info(cyanBright(`[SUBS] Found ${subs.length} sub streams`));
    if (subs.length == 0) {
        console.warn(yellowBright('[SUBS] No sub streams found!'));
        return null;
    }

    subs = subs.filter(sub => !UNSUPPORTED_SUB.includes(sub.codec_name));
    console.info(cyanBright(`[SUBS] Found ${subs.length} supported sub streams`));
    if (subs.length == 0) {
        console.warn(yellowBright('[SUBS] No supported sub streams found!'));
        return null;
    }

    let langSubs = subs.filter(sub => sub.tags.language === lang);

    console.info(cyanBright(`[SUBS] ${langSubs.length} match language '${lang}'`));
    if (langSubs.length == 0) {
        console.warn(yellowBright('[SUBS] No sub streams left! Entering fallback mode.'));
        subs = subs.filter(sub => sub.tags.language === 'und' || sub.tags.language == null);

        console.info(cyanBright(`[SUBS] Found ${subs.length} fallback sub streams`));

        if (subs.length == 0) {
            console.warn(yellowBright(`[SUBS] No sub streams with language ${lang} or undefined.`));
            return null;
        } else if (subs.length == 1) {
            console.info(cyanBright('[SUBS] Returning last remaining stream'));
            return subs[0];
        }
    } else if (subs.length == 1) {
        console.info(cyanBright('[SUBS] Returning last remaining stream'));
        return langSubs[0];
    } else {
        subs = langSubs;
    }

    console.info(cyanBright(`[SUBS] picking longest sub stream`));
    const subStreamsWithLengths = await Promise.all(subs.map(async subStream =>
        ({ len: await ffmpegGetStreamLength(data.format.filename, subStream.index, 'srt'), stream: subStream })
    ));
    const longest = subStreamsWithLengths.reduce((prev, cur) => cur.len > prev.len ? cur : prev, { len: 0 });
    console.info(cyanBright(`[SUBS] selected stream ${longest.stream.index}`));

    return longest.stream;
}

//#endregion SUBITLE SELECTION

module.exports = {
    video: findVideoStream,
    audio: findAudioStream,
    sub: findSubStream
}
