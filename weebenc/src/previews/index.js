const fs = require('fs');
const { spawn } = require('child_process')
const { getPngBuffers } = require('./pngstream')
const ffmpeg = require('../common/ffmpeg')
const Jimp = require('jimp');

let n = 0;

genPreviews("/mnt/data/media/Anime/Neon\ Genesis\ Evangelion/\[CBM\]_Neon_Genesis_Evangelion_-_26_-_The_Beast_That_Shouted_Love_\[720p\]_\[E8B87982\].mkv", { height: 90, fps: 0.5 })

async function genPreviews(file, options) {
    const height = options?.height ?? 45;
    const fps = options?.fps ?? 1;

    const srcResolution = await ffmpeg.getResolution(file);
    const previewResolution = calculateResolution(srcResolution, { height });

    console.info(`Resized ${srcResolution} to ${previewResolution}`);

    const ffmpegArgs = ['-i', file, '-vf', `scale=${previewResolution[0]}:${previewResolution[1]},fps=${fps}`, '-c:v', 'png', '-f', 'image2pipe', '-']
    const frameExtractor = spawn('ffmpeg', ffmpegArgs);
    let currentImage = new Jimp(10 * previewResolution[0], 10 * previewResolution[1]);

    let xIndex = 0, yIndex = 0;
    let imgIndex = 0;

    return await getPngBuffers(frameExtractor.stdout, async (buffer, size) => {
        if (!buffer) { //empty buffer means end of stream
            await currentImage.writeAsync(`./out/preview_${imgIndex}.jpeg`);
            return;
        }

        const currentFrame = await Jimp.read(buffer);  //read the new frame and composite it onto the canvas
        currentImage.composite(currentFrame, xIndex * previewResolution[0], yIndex * previewResolution[1]);


        xIndex++; //increment position
        if (xIndex === 10) {
            xIndex = 0;
            yIndex++;
        }
        if (yIndex === 10) {
            const backup = currentImage;
            currentImage = new Jimp(10 * previewResolution[0], 10 * previewResolution[1]);
            yIndex = 0;

            await backup.writeAsync(`./out/preview_${imgIndex}.jpeg`);
            imgIndex++;
        }
    });
}

function calculateResolution(source, options) {
    let height = options?.height ?? 45;

    if (!Number.isInteger(height)) throw "Height must be an integer";

    const k = height / source[1];
    let width = Math.round(source[0] * k);

    if (width % 2 !== 0) width--; //keep the width even

    return [, height];
}