import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { getPublicVideoShareMeta, PublicVideoShareMeta } from "../services/videoService";

const DEFAULT_WEB_ORIGIN = "https://www.lumilearnapp.com";
const APP_STORE_URL = "https://apps.apple.com/app/id6743999003";

function webOrigin(): string {
  return (process.env.PUBLIC_WEB_ORIGIN || DEFAULT_WEB_ORIGIN).replace(/\/$/, "");
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtmlText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildVideoShareLandingHtml(
  videoId: string,
  meta: PublicVideoShareMeta | null
): { html: string; statusCode: number } {
  const canonical = `${webOrigin()}/video/${videoId}`;

  if (!meta) {
    const title = "Lumi — Video";
    const desc = "This video is unavailable or private.";
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtmlText(title)}</title>
  <link rel="canonical" href="${escapeHtmlAttr(canonical)}" />
  <meta property="og:title" content="${escapeHtmlAttr(title)}" />
  <meta property="og:description" content="${escapeHtmlAttr(desc)}" />
  <meta property="og:url" content="${escapeHtmlAttr(canonical)}" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary" />
</head>
<body>
  <p>${escapeHtmlText(desc)}</p>
  <p><a href="${escapeHtmlAttr(APP_STORE_URL)}">Get Lumi on the App Store</a></p>
</body>
</html>`;
    return { html, statusCode: 404 };
  }

  const ogTitle = `${meta.ownerName} on Lumi`;
  const ogDescription =
    (meta.caption || meta.subject || "Watch on Lumi").slice(0, 300) || "Watch on Lumi";

  const imageTag = meta.thumbnailUrl
    ? `<meta property="og:image" content="${escapeHtmlAttr(meta.thumbnailUrl)}" />
  <meta name="twitter:card" content="summary_large_image" />`
    : `<meta name="twitter:card" content="summary" />`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtmlText(ogTitle)}</title>
  <link rel="canonical" href="${escapeHtmlAttr(canonical)}" />
  <meta property="og:title" content="${escapeHtmlAttr(ogTitle)}" />
  <meta property="og:description" content="${escapeHtmlAttr(ogDescription)}" />
  <meta property="og:url" content="${escapeHtmlAttr(canonical)}" />
  <meta property="og:type" content="video.other" />
  ${imageTag}
  <meta name="apple-itunes-app" content="app-id=6743999003, app-argument=${escapeHtmlAttr(encodeURIComponent(canonical))}" />
</head>
<body>
  <p><strong>${escapeHtmlText(meta.ownerName)}</strong></p>
  <p>${escapeHtmlText(meta.caption || "")}</p>
  <p><a href="${escapeHtmlAttr(APP_STORE_URL)}">Open in Lumi (App Store)</a></p>
</body>
</html>`;

  return { html, statusCode: 200 };
}

export default async function videoShareWebRoutes(fastify: FastifyInstance) {
  fastify.get<{ Params: { videoId: string } }>("/video/:videoId", async (request: FastifyRequest<{ Params: { videoId: string } }>, reply: FastifyReply) => {
    const { videoId } = request.params;
    const meta = await getPublicVideoShareMeta(videoId);
    const { html, statusCode } = buildVideoShareLandingHtml(videoId, meta);

    return reply
      .status(statusCode)
      .header("Content-Type", "text/html; charset=utf-8")
      .header("Cache-Control", "public, max-age=300")
      .send(html);
  });

  fastify.get("/.well-known/assetlinks.json", async (_, reply) => {
    const packageName = process.env.ANDROID_PACKAGE_NAME || "com.herlop.lumilearn";
    const raw = process.env.ANDROID_APP_LINK_SHA256 || "";
    const sha256_cert_fingerprints = raw
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const payload =
      sha256_cert_fingerprints.length > 0
        ? [
            {
              relation: ["delegate_permission/common.handle_all_urls"],
              target: {
                namespace: "android_app",
                package_name: packageName,
                sha256_cert_fingerprints,
              },
            },
          ]
        : [];

    return reply
      .header("Content-Type", "application/json")
      .header("Cache-Control", "public, max-age=3600")
      .send(payload);
  });
}
