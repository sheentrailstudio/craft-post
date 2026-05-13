"use client";

import { useRef } from "react";
import { AspectRatio, MediaAttachment } from "@/hooks/useEditor";

type MediaZoneProps = {
  media: MediaAttachment | null;
  error: string | null;
  onAddFiles: (files: FileList) => void;
  onClear: () => void;
  onAspectRatioChange: (ratio: AspectRatio) => void;
};

const ratios: AspectRatio[] = ["1:1", "4:5", "9:16", "16:9"];

export default function MediaZone({
  media,
  error,
  onAddFiles,
  onAspectRatioChange,
  onClear,
}: MediaZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function openPicker() {
    inputRef.current?.click();
  }

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (event.target.files) onAddFiles(event.target.files);
    event.target.value = "";
  }

  return (
    <section className="surface p-4 md:p-5">
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
        multiple
        onChange={handleChange}
      />

      {media ? (
        <div>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h1 className="text-h3">Media</h1>
            <button className="btn btn-ghost px-3 py-2" type="button" onClick={onClear}>
              Clear
            </button>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-1">
            {media.items.map((item) => (
              <div
                key={item.id}
                className="media-thumb"
                style={{ aspectRatio: ratioToCss(media.aspectRatio) }}
              >
                {item.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.url} alt={item.file.name} />
                ) : (
                  <video src={item.url} muted playsInline />
                )}
              </div>
            ))}
            {media.items[0]?.kind === "image" && media.items.length < 10 ? (
              <button className="media-add-more" type="button" onClick={openPicker}>
                + Add more
              </button>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {ratios.map((ratio) => (
              <button
                key={ratio}
                className={
                  ratio === media.aspectRatio
                    ? "ratio-button ratio-button-active"
                    : "ratio-button"
                }
                type="button"
                onClick={() => onAspectRatioChange(ratio)}
              >
                {ratio}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <button className="media-empty" type="button" onClick={openPicker}>
          Add media
        </button>
      )}

      {error ? <p className="mt-3 text-sm text-[var(--error)]">{error}</p> : null}
    </section>
  );
}

function ratioToCss(ratio: AspectRatio) {
  return ratio.replace(":", " / ");
}
