"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { generateCaption } from "@/lib/api";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 10 * 1024 * 1024;

type ImageUploadBlockProps = {
  onUseCaption: (caption: string) => void;
};

export default function ImageUploadBlock({
  onUseCaption,
}: ImageUploadBlockProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState("");
  const [caption, setCaption] = useState("");
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  async function handleFile(file?: File) {
    if (!file) return;

    setError("");
    setCaption("");

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Please upload a JPG, PNG, or WebP image.");
      return;
    }

    if (file.size > MAX_SIZE) {
      setError("Image must be under 10MB.");
      return;
    }

    const dataUrl = await readFileAsDataUrl(file);
    setPreview(dataUrl);
    setIsGenerating(true);

    try {
      const base64 = dataUrl.split(",")[1] ?? "";
      const generated = await generateCaption(base64, file.type);
      setCaption(generated);
    } catch {
      setError("Caption generation failed. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <section className="surface p-5 md:p-7">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="text-h2">Image</h2>
        {preview ? (
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() => inputRef.current?.click()}
          >
            Replace
          </button>
        ) : null}
      </div>

      <input
        ref={inputRef}
        className="hidden"
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        onChange={(event) => handleFile(event.target.files?.[0])}
      />

      {!preview ? (
        <button
          className={[
            "flex min-h-48 w-full flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed p-8 text-center transition",
            isDragging
              ? "border-[var(--accent-border)] bg-[var(--bg-dropzone-active)]"
              : "border-[var(--bg-border-2)] bg-[var(--bg-dropzone)]",
          ].join(" ")}
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            handleFile(event.dataTransfer.files[0]);
          }}
        >
          <span className="text-h3 mb-2">Drop image here or click to upload</span>
          <span className="text-sm">JPG / PNG / WebP · Max 10MB</span>
        </button>
      ) : (
        <div className="grid gap-5 md:grid-cols-[180px_1fr]">
          <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--bg-border)] bg-[var(--bg-elevated)]">
            <Image
              src={preview}
              alt="Uploaded preview"
              width={180}
              height={180}
              unoptimized
              className="aspect-square h-full w-full object-cover"
            />
          </div>
          <div>
            <p className="text-label mb-2">Generated caption</p>
            <div className="input-surface min-h-32 p-4 text-sm leading-7">
              {isGenerating ? (
                <span className="text-[var(--text-secondary)]">
                  Generating caption...
                </span>
              ) : (
                caption || (
                  <span className="text-[var(--text-tertiary)]">
                    Caption will appear here.
                  </span>
                )
              )}
            </div>
            <button
              className="btn btn-secondary mt-4"
              type="button"
              disabled={!caption}
              onClick={() => onUseCaption(caption)}
            >
              Use this caption ↓
            </button>
          </div>
        </div>
      )}

      {error ? (
        <p className="mt-3 rounded-[var(--radius-sm)] bg-[var(--error-muted)] px-3 py-2 text-sm text-[var(--error)]">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}
