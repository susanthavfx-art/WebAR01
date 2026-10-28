`short.webm` is a synthetic one-second 64×64 VP8 test pattern, generated with:

```
ffmpeg -f lavfi -i 'testsrc=size=64x64:rate=12' -t 1 -c:v libvpx -pix_fmt yuv420p -an short.webm
```

It contains no third-party footage and is used to test local video publishing.
