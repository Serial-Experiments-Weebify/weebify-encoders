# Weebify Encoders
Tools to optimize anime for playback in browsers.

## syncoder
A (relatively) simple Node.js script with one input and one output. It should handle just about any anime and spit out a web ready `.mp4` with burned subs. Sadly this approach doesn't really scale past ~20 minute 720p files (especially on slower connections). Originally made for [shitty-sync](https://github.com/MaticBabnik/shitty-sync).

## weebify
Currently in development, but here is the list of expected features:
- MPEG DASH (quality / language switching)
- WebVTT and/or ASS support
- youtube like seek previews