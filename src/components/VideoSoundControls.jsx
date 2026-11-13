import React, { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { playVideoWithSound } from "../lib/video-sound";

function SoundButton({ object, getVideo, onError }) {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const currentVideo = useRef(null);
  useEffect(
    () => () => {
      if (currentVideo.current) currentVideo.current.muted = true;
    },
    [],
  );
  function report(message) {
    setError(message);
    onError?.(message);
  }

  function toggle() {
    const video = getVideo(object.id);
    if (!video) {
      report("Video is still loading. Please try again.");
      return;
    }
    currentVideo.current = video;
    setError("");
    if (enabled) {
      video.muted = true;
      setEnabled(false);
      return;
    }
    // playVideoWithSound is called synchronously inside the user's tap.
    const result = playVideoWithSound(video);
    setBusy(true);
    result
      .then(() => setEnabled(true))
      .catch(() => {
        setEnabled(false);
        report(
          "Could not play video sound. Tap again and check your device volume.",
        );
      })
      .finally(() => setBusy(false));
  }

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-label={`${enabled ? "Mute" : "Enable sound for"} ${object.name}`}
        aria-pressed={enabled}
        title={
          enabled ? "Mute video" : "Play video from the beginning with sound"
        }
      >
        {enabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
        <span>
          {enabled ? "Mute" : "Play sound"} · {object.name}
        </span>
      </button>
      {error && (
        <span className="video-sound-error" role="alert">
          {error}
        </span>
      )}
    </>
  );
}

export default function VideoSoundControls({
  objects,
  getVideo,
  onError,
  className = "",
}) {
  const videos = objects.filter(
    (object) => object.assetId === "media:video" && object.visible !== false,
  );
  if (!videos.length) return null;
  return (
    <div
      className={`video-sound-controls ${className}`}
      aria-label="Video sound controls"
    >
      {videos.map((object) => (
        <SoundButton
          key={`${object.id}-${object.video?.url}-${object.color || ""}`}
          object={object}
          getVideo={getVideo}
          onError={onError}
        />
      ))}
    </div>
  );
}
