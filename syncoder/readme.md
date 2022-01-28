# syncoder

**NOTE: requires ffmpeg(and ffprobe) to be installed and in path**

The "v1" encoder. It selects the first video stream, the first japanese audio track, and the largest english subtitle track and encodes them into a h264/AAC .mp4 with burned subs.

The encoder settings can be changed in the `ffmpegEncode` function inside `ffmpeg-util.js`.

## Usage:

```bash
node . <input> <output>
```