# Bundled FFmpeg runtime

Optional Windows release binaries belong in this directory as:

- `ffmpeg.exe`
- `ffprobe.exe`

`electron-builder.yml` copies this directory to `${process.resourcesPath}/ffmpeg` through `extraResources`, keeping executable binaries outside `app.asar`.

Do not commit platform binaries here unless their distribution and licensing have been reviewed. Development and release builds can also use `NARRATIVEX_FFMPEG_PATH` / `NARRATIVEX_FFPROBE_PATH`, and the desktop runtime falls back to `ffmpeg` / `ffprobe` on `PATH`.
