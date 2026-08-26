import { DeleteObjectsCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_CACHE_CONTROL = "public, max-age=31536000, immutable";
const LISTING_IMAGE_VARIANTS = new Set(["display", "thumbnail"]);

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

function safeKeyPrefix(value: string | undefined, fallback = "listings") {
  const keyPrefix = value?.trim().replace(/^[/]+|[/]+$/g, "") || fallback;
  if (!/^[A-Za-z0-9/_-]+$/.test(keyPrefix)) throw new Error("The upload destination is invalid.");
  return keyPrefix;
}

function validateUpload(input: { contentType: string; size: number }) {
  if (!ALLOWED_IMAGE_TYPES.has(input.contentType)) throw new Error("Only JPEG, PNG, and WebP images are supported.");
  if (!Number.isFinite(input.size) || input.size <= 0 || input.size > MAX_IMAGE_BYTES) throw new Error("Each image must be 8 MB or smaller.");
}

export function publicUrlForKey(key: string) {
  const { publicUrl } = config();
  return `${publicUrl}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export async function createImageUpload(input: { filename: string; contentType: string; size: number; keyPrefix?: string }) {
  validateUpload(input);
  const { bucket } = config();
  const keyPrefix = safeKeyPrefix(input.keyPrefix);
  const key = `${keyPrefix}/${randomUUID()}.${safeExtension(input.filename, input.contentType)}`;
  const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: input.contentType, CacheControl: IMAGE_CACHE_CONTROL });
  const uploadUrl = await getSignedUrl(r2Client(), command, { expiresIn: 900 });
  return { key, uploadUrl, publicUrl: publicUrlForKey(key), contentType: input.contentType, cacheControl: IMAGE_CACHE_CONTROL, expiresIn: 900 };
}

export async function createListingImageUploads(input: {
  filename: string;
  variants: Array<{ variant: "display" | "thumbnail"; contentType: string; size: number }>;
  keyPrefix?: string;
}) {
  if (input.variants.length !== 2 || new Set(input.variants.map((item) => item.variant)).size !== 2 || input.variants.some((item) => !LISTING_IMAGE_VARIANTS.has(item.variant))) {
    throw new Error("A listing image needs one display file and one thumbnail file.");
  }
  input.variants.forEach(validateUpload);
  const { bucket } = config();
  const keyPrefix = safeKeyPrefix(input.keyPrefix);
  const assetId = randomUUID();
  const uploads = await Promise.all(input.variants.map(async (item) => {
    const key = `${keyPrefix}/${assetId}/${item.variant}.${safeExtension(input.filename, item.contentType)}`;
    const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: item.contentType, CacheControl: IMAGE_CACHE_CONTROL });
    const uploadUrl = await getSignedUrl(r2Client(), command, { expiresIn: 900 });
    return { variant: item.variant, key, uploadUrl, publicUrl: publicUrlForKey(key), contentType: item.contentType, cacheControl: IMAGE_CACHE_CONTROL, expiresIn: 900 };
  }));
  return { assetId, uploads };
}

export async function deleteObjectKeys(keys: string[]) {
  const uniqueKeys = [...new Set(keys.map((key) => key.trim()).filter(Boolean))];
  if (!uniqueKeys.length) return;
  const { bucket } = config();

  for (let index = 0; index < uniqueKeys.length; index += 1_000) {
    const chunk = uniqueKeys.slice(index, index + 1_000);
    await r2Client().send(new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: true },
    }));
  }
}

export async function deleteObjectPrefix(prefix: string) {
  const { bucket } = config();
  const safePrefix = safeKeyPrefix(prefix);
  let continuationToken: string | undefined;

  do {
    const page = await r2Client().send(new ListObjectsV2Command({ Bucket: bucket, Prefix: `${safePrefix}/`, ContinuationToken: continuationToken }));
    await deleteObjectKeys((page.Contents || []).flatMap((item) => item.Key ? [item.Key] : []));
    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuationToken);
}

export function isAgentPortraitKeyForUser(key: string, userId: string) {
  return key.startsWith(`agents/${userId}/`) && /^agents\/.+\/[a-f0-9-]{36}\.(jpg|png|webp)$/i.test(key);
}

export function isProfileAvatarKeyForUser(key: string, userId: string) {
  return key.startsWith(`profiles/${userId}/`) && /^profiles\/.+\/[a-f0-9-]{36}\.(jpg|png|webp)$/i.test(key);
}

export { ALLOWED_IMAGE_TYPES, IMAGE_CACHE_CONTROL, MAX_IMAGE_BYTES };
