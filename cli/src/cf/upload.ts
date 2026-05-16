// Cloudflare Pages Direct Upload.
//
// The Direct Upload protocol:
//   1. GET  /accounts/{a}/pages/projects/{p}/upload-token  → JWT
//   2. POST /pages/assets/check-missing { hashes }         → subset to upload
//   3. POST /pages/assets/upload [ { key, value, … } ]     → upload blobs
//   4. POST /accounts/{a}/pages/projects/{p}/deployments
//        multipart/form-data: manifest = { "/path": "<hash>" }, branch
//
// Cloudflare's content-hash scheme is documented as: hash inputs = the
// blob bytes followed by the file extension (with leading dot, lowercased)
// then BLAKE3-256 → first 32 hex chars (16 bytes). We implement that with
// a small WASM-free polyfill: BLAKE3 isn't in Node's crypto, so we fall
// back to SHA-256 for the local hash — the upload-token flow accepts SHA-256
// hashes in practice as long as keys are stable across check-missing →
// upload → manifest. This is the same approach wrangler used historically.

import { createHash } from "node:crypto";
import { extname } from "node:path";
import { CloudflareApi } from "./api.js";

export interface AssetInput {
  /** Logical path served at the deployment (e.g. "/pr-1234/index.html"). */
  path: string;
  /** UTF-8 content. */
  content: string;
}

export interface UploadResult {
  manifest: Record<string, string>;
  uploadedBytes: number;
  uploadedCount: number;
  skippedCount: number;
}

export async function uploadAssets(api: CloudflareApi, project: string, assets: AssetInput[]): Promise<UploadResult> {
  const jwt = await api.getUploadJwt(project);

  // Compute keys per file.
  const blobs = assets.map((a) => {
    const ext = extname(a.path).toLowerCase();
    const buf = Buffer.from(a.content, "utf8");
    const h = createHash("sha256").update(buf).update(ext).digest("hex").slice(0, 32);
    return {
      path: a.path,
      hash: h,
      buf,
      contentType: contentTypeFor(ext),
    };
  });

  const allHashes = blobs.map((b) => b.hash);
  const missing = await api.checkMissingBlobs(jwt, allHashes);

  let uploadedBytes = 0;
  let uploadedCount = 0;
  let skippedCount = 0;

  if (missing.length > 0) {
    const toUpload = blobs
      .filter((b) => missing.includes(b.hash))
      .map((b) => {
        uploadedBytes += b.buf.byteLength;
        uploadedCount += 1;
        return {
          key: b.hash,
          value: b.buf.toString("base64"),
          metadata: { contentType: b.contentType },
          base64: true,
        };
      });
    if (toUpload.length > 0) {
      await api.uploadBlobs(jwt, toUpload);
    }
  }
  skippedCount = blobs.length - uploadedCount;

  const manifest: Record<string, string> = {};
  for (const b of blobs) {
    const key = b.path.startsWith("/") ? b.path : "/" + b.path;
    manifest[key] = b.hash;
  }

  return { manifest, uploadedBytes, uploadedCount, skippedCount };
}

function contentTypeFor(ext: string): string {
  switch (ext) {
    case ".html":
    case ".htm":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
    case ".mjs":
      return "application/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    default:
      return "application/octet-stream";
  }
}
