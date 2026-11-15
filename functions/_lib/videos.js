// Latest YouTube Shorts for the "Короткі відео" block on /uk/. The channel's public RSS feed needs
// no API key and lists the 15 newest uploads. The cards are rendered into the HTML on the server
// (not by client JS), so search engines index the video titles together with the page.
// TikTok and Instagram have no keyless feed, so those channels are only linked from the page.
// No onRequest* export here, so Cloudflare Pages doesn't treat this file as a route.

import { escapeHtml } from "./community.js";

const YT_CHANNEL_ID = "UCCOie4oVNn7rvJ9b8HLBJ5A"; // youtube.com/@AtomTranslate
const FEED_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${YT_CHANNEL_ID}`;
const FEED_CACHE_SECONDS = 3600;
const FEED_TIMEOUT_MS = 2500;
export const VIDEO_LIMIT = 6;

const XML_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decodeXml(value) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return String.fromCodePoint(code);
    }
    return XML_ENTITIES[e.toLowerCase()];
  });
}

function tag(xml, name) {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return m ? decodeXml(m[1]).trim() : "";
}

// Resolves to [{ id, title, published }], newest first. Any upstream problem resolves to []
// so the page still renders (the block then shows only the channel buttons).
export async function fetchLatestVideos() {
  try {
    const res = await fetch(FEED_URL, {
      cf: { cacheTtl: FEED_CACHE_SECONDS, cacheEverything: true },
      signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const videos = [];
    for (const [, entry] of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
      const id = tag(entry, "yt:videoId");
      if (!/^[\w-]{11}$/.test(id)) continue;
      videos.push({ id, title: tag(entry, "title"), published: tag(entry, "published") });
      if (videos.length === VIDEO_LIMIT) break;
    }
    return videos;
  } catch {
    return [];
  }
}

const PLAY_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5-11-6.5Z" fill="currentColor"/></svg>';

export function renderVideoCards(videos) {
  return videos
    .map((v) => {
      const title = escapeHtml(v.title);
      return `<a class="video-card" href="https://www.youtube.com/shorts/${v.id}" target="_blank" rel="noopener">
          <span class="video-thumb"><img src="https://i.ytimg.com/vi/${v.id}/hqdefault.jpg" alt="${title}" loading="lazy" width="480" height="360"><span class="video-play">${PLAY_ICON}</span></span>
          <span class="video-title">${title}</span>
        </a>`;
    })
    .join("\n        ");
}
