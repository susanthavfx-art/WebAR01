#!/usr/bin/env bash
# Convert a VP9 WebM with alpha to a side-by-side H.264/AAC MP4.
# Requires ffmpeg built with libvpx, libx264 and the AAC encoder.
set -euo pipefail
if [ "$#" -ne 2 ]; then
  echo "Usage: $0 input-alpha.webm output-packed.mp4" >&2
  exit 2
fi
ffmpeg -hide_banner -y -c:v libvpx-vp9 -i "$1" \
  -filter_complex "[0:v]split=2[color][source];[source]alphaextract,scale=w='min(960,iw)':h='min(540,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,format=yuv420p[alpha];[color]scale=w='min(960,iw)':h='min(540,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,format=yuv420p[rgb];[rgb][alpha]hstack=inputs=2,format=yuv420p[out]" \
  -map '[out]' -map '0:a:0?' -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p \
  -c:a aac -b:a 128k -movflags +faststart "$2"
