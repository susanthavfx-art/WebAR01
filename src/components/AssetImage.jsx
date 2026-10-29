import React, { useEffect, useRef, useState } from "react";
import {
  assetThumbnail,
  assetThumbnailAsync,
  getAsset,
  MODEL_PLACEHOLDER,
} from "../lib/assets";
export default function AssetImage({ assetId, model, alt = "", ...props }) {
  const element = useRef(null),
    modelKey = JSON.stringify(model || null);
  const [preview, setPreview] = useState(() => ({
    id: assetId,
    src: assetThumbnail(assetId, model),
    state: "loading",
    error: "",
  }));
  useEffect(() => {
    let active = true,
      observer;
    setPreview({
      id: assetId,
      src: assetThumbnail(assetId, model),
      state: "loading",
      error: "",
    });
    const load = () =>
      assetThumbnailAsync(assetId, model)
        .then((src) => {
          if (active)
            setPreview({ id: assetId, src, state: "ready", error: "" });
        })
        .catch((error) => {
          if (active)
            setPreview({
              id: assetId,
              src: MODEL_PLACEHOLDER,
              state: "error",
              error: error.message,
            });
        });
    const asset = getAsset(assetId, model);
    if (
      asset.kind === "glb" &&
      !asset.thumbnailUrl &&
      "IntersectionObserver" in window
    ) {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            observer.disconnect();
            load();
          }
        },
        { rootMargin: "100px" },
      );
      observer.observe(element.current);
    } else load();
    return () => {
      active = false;
      observer?.disconnect();
    };
  }, [assetId, modelKey]);
  return (
    <img
      {...props}
      ref={element}
      loading="lazy"
      src={
        preview.id === assetId ? preview.src : assetThumbnail(assetId, model)
      }
      alt={alt}
      title={preview.error || props.title}
      data-model-status={preview.state}
      onError={() =>
        setPreview({
          id: assetId,
          src: MODEL_PLACEHOLDER,
          state: "error",
          error:
            "Thumbnail unavailable. Check the optional thumbnail filename.",
        })
      }
    />
  );
}
