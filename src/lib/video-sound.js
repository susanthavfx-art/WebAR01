// Call from the user gesture itself: browsers may reject unmuted autoplay.
export function playVideoWithSound(video) {
  video.muted = false;
  try {
    video.currentTime = 0;
    return Promise.resolve(video.play()).catch((error) => {
      video.muted = true;
      throw error;
    });
  } catch (error) {
    video.muted = true;
    return Promise.reject(error);
  }
}
