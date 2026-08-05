import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

let client: S3Client | null = null;

function config() {
  const endpoint = process.env.R2_ENDPOINT;
  const bucket = process.env.R2_BUCKET;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const publicUrl = process.env.R2_PUBLIC_URL?.replace(/\/+$/, "");
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey || !publicUrl) {
    throw new Error("R2 storage is not fully configured.");
  }
  return { endpoint, bucket, accessKeyId, secretAccessKey, publicUrl };
}

function r2Client() {
  if (client) return client;
  const { endpoint, accessKeyId, secretAccessKey } = config();
  client = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });
  return client;
}

function safeExtension(filename: string, contentType: string) {
  const extension = filename.toLowerCase().match(/\.(jpe?g|png|webp)$/)?.[1];
  if (extension) return extension === "jpeg" ? "jpg" : extension;
  return contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
}

export function publicUrlForKey(key: string) {
  const { publicUrl } = config();
  return `${publicUrl}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export async function createImageUpload(input: { filename: string; contentType: string; size: number; keyPrefix?: string }) {
  if (!ALLOWED_IMAGE_TYPES.has(input.contentType)) throw new Error("Only JPEG, PNG, and WebP images are supported.");
  if (!Number.isFinite(input.size) || input.size <= 0 || input.size > MAX_IMAGE_BYTES) throw new Error("Each image must be 8 MB or smaller.");
  const { bucket } = config();
  const keyPrefix = input.keyPrefix?.trim().replace(/^\/+|\/+$/g, "") || "listings";
  if (!/^[A-Za-z0-9/_-]+$/.test(keyPrefix)) throw new Error("The upload destination is invalid.");
  const key = `${keyPrefix}/${randomUUID()}.${safeExtension(input.filename, input.contentType)}`;
  const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: input.contentType });
  const uploadUrl = await getSignedUrl(r2Client(), command, { expiresIn: 900 });
  return { key, uploadUrl, publicUrl: publicUrlForKey(key), expiresIn: 900 };
}

export function isAgentPortraitKeyForUser(key: string, userId: string) {
  return key.startsWith(`agents/${userId}/`) && /^agents\/.+\/[a-f0-9-]{36}\.(jpg|png|webp)$/i.test(key);
}

export { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES };
