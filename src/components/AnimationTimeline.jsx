import React, { useEffect, useState } from "react";
import { Play, Square, Trash2 } from "lucide-react";
import { sampleKeyframes } from "../lib/timeline";

export default function AnimationTimeline({ object, update, playing, onPlay }) {
  const [time, setTime] = useState(0);
  const keys = object?.keyframes || [];
  const end = keys.at(-1)?.time || 0;
  const duration = Math.max(5, end, time);

  // Studio playback starts at zero and loops at the last keyframe.
  useEffect(() => {
    if (!playing) {
      setTime(0);
      return;
    }
    const start = performance.now();
    setTime(0);
    const timer = setInterval(() => {
      setTime(end > 0 ? ((performance.now() - start) / 1000) % end : 0);
    }, 50);
    return () => clearInterval(timer);
  }, [playing, end]);

  function seek(value) {
    setTime(value);
    const pose = sampleKeyframes(keys, value, false);
    if (pose)
      update({
        position: pose.position,
        rotation: pose.rotation,
        scale: pose.scale,
      });
  }

  function addKey() {
    const rounded = Math.round(time * 100) / 100;
    const key = {
      time: rounded,
      position: [...object.position],
      rotation: [...object.rotation],
      scale: object.scale,
    };
    update({
      keyframes: [...keys.filter((k) => k.time !== rounded), key].sort(
        (a, b) => a.time - b.time,
      ),
    });
  }

  return (
    <section className="animation-timeline" aria-label="Animation timeline">
      <div className="timeline-header">
        <div className="timeline-title">
          <strong>◆ &nbsp;Animation timeline</strong>
          <span>
            {object ? object.name : "Select a model to add keyframes"}
          </span>
        </div>
        <div className="timeline-actions">
          <button
            type="button"
            className="timeline-play"
            onClick={onPlay}
            aria-label={playing ? "Stop timeline playback" : "Play timeline"}
            title={playing ? "Stop playback" : "Play animation"}
          >
            {playing ? (
              <Square size={13} fill="currentColor" />
            ) : (
              <Play size={13} fill="currentColor" />
            )}
          </button>
          <label>
            Time{" "}
            <input
              aria-label="Keyframe time in seconds"
              type="number"
              min="0"
              max="300"
              step="0.1"
              value={Math.round(time * 100) / 100}
              disabled={!object || playing}
              onChange={(e) =>
                setTime(
                  Math.round(
                    Math.max(0, Math.min(300, Number(e.target.value) || 0)) *
                      100,
                  ) / 100,
                )
              }
            />{" "}
            <span>s</span>
          </label>
          <button
            type="button"
            className="timeline-save"
            onClick={addKey}
            disabled={
              !object ||
              playing ||
              (keys.length >= 100 && !keys.some((k) => k.time === time))
            }
          >
            ◆ <span>Save keyframe</span>
          </button>
        </div>
      </div>
      <div className="timeline-track-area">
        <div className="timeline-ruler">
          <span>0s</span>
          <span>{(duration / 2).toFixed(1)}s</span>
          <span>{duration.toFixed(1)}s</span>
        </div>
        <div className="timeline-track">
          <input
            aria-label="Scrub animation timeline"
            type="range"
            min="0"
            max={duration}
            step="0.01"
            value={time}
            disabled={!object || playing}
            onChange={(e) => seek(Number(e.target.value))}
          />
          {keys.map((key) => (
            <button
              type="button"
              key={key.time}
              className="timeline-marker"
              style={{ left: `${(key.time / duration) * 100}%` }}
              disabled={playing}
              onClick={() => seek(key.time)}
              aria-label={`Go to keyframe at ${key.time} seconds`}
              title={`${key.time.toFixed(2)}s`}
            >
              ◆
            </button>
          ))}
          <span
            className="timeline-playhead"
            style={{ left: `${(time / duration) * 100}%` }}
          />
        </div>
      </div>
      <div className="timeline-footer">
        <span>
          {!object
            ? "Select a model in the canvas to begin."
            : keys.length
              ? "Drag to scrub · Click a diamond to jump to a keyframe · Animation loops at the last key"
              : "Set a time, adjust the model’s transform, then save a keyframe. Add two or more to animate."}
        </span>
        {object && keys.length > 0 && (
          <div className="timeline-key-list">
            {keys.map((key) => (
              <span key={key.time}>
                <button
                  type="button"
                  disabled={playing}
                  onClick={() => seek(key.time)}
                >
                  ◆ {key.time.toFixed(2)}s
                </button>
                <button
                  type="button"
                  disabled={playing}
                  aria-label={`Delete keyframe at ${key.time} seconds`}
                  onClick={() =>
                    update({
                      keyframes: keys.filter((k) => k.time !== key.time),
                    })
                  }
                >
                  <Trash2 size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
