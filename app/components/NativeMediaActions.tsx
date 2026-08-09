"use client";

import { Camera, MediaTypeSelection } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
import { useState } from "react";

type NativeMediaActionsProps = {
  locale: "zh" | "en";
  remaining: number;
  disabled?: boolean;
  onFiles: (files: File[]) => void | Promise<void>;
};

async function mediaResultToFile(result: { webPath?: string; uri?: string }, index: number) {
  const source = result.webPath || result.uri;
  if (!source) throw new Error("The selected photo did not include a readable file path.");
  const response = await fetch(source);
  if (!response.ok) throw new Error("The selected photo could not be read.");
  const blob = await response.blob();
  return new File([blob], `anjurentals-native-${Date.now()}-${index}.jpg`, { type: blob.type || "image/jpeg" });
}

export default function NativeMediaActions({ locale, remaining, disabled = false, onFiles }: NativeMediaActionsProps) {
  const [native] = useState(() => Capacitor.isNativePlatform());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!native || remaining <= 0) return null;

  const choose = async (source: "camera" | "gallery") => {
    if (busy || disabled) return;
    setBusy(true);
    setError("");
    try {
      const results = source === "camera"
        ? { results: [await Camera.takePhoto({ quality: 90, targetWidth: 1800, targetHeight: 1800, correctOrientation: true, includeMetadata: false })] }
        : await Camera.chooseFromGallery({ mediaType: MediaTypeSelection.Photo, allowMultipleSelection: true, limit: remaining, quality: 90, targetWidth: 1800, targetHeight: 1800, correctOrientation: true, includeMetadata: false });
      const files = await Promise.all(results.results.slice(0, remaining).map((result, index) => mediaResultToFile(result, index)));
      await onFiles(files);
    } catch (selectionError) {
      const message = selectionError instanceof Error ? selectionError.message : "Photo selection failed.";
      if (!/cancel/i.test(message)) setError(locale === "zh" ? "无法读取照片，请重试或使用文件选择。" : message);
    } finally {
      setBusy(false);
    }
  };

  return <div className="native-media-actions field-span-2" aria-label={locale === "zh" ? "手机照片操作" : "Mobile photo actions"}>
    <button className="outline-button" type="button" disabled={disabled || busy} onClick={() => { void choose("camera"); }}>
      {busy ? (locale === "zh" ? "处理中…" : "Working…") : (locale === "zh" ? "拍照上传" : "Take photo")}
    </button>
    <button className="outline-button" type="button" disabled={disabled || busy} onClick={() => { void choose("gallery"); }}>
      {locale === "zh" ? "从相册选择" : "Choose from gallery"}
    </button>
    {error && <small className="native-media-error" role="alert">{error}</small>}
  </div>;
}
