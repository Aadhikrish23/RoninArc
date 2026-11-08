/** Neutral cover for games without art (inline, so it also works from file:// in the desktop app). */
export const PLACEHOLDER_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect width="320" height="180" fill="#2D3748"/><g fill="none" stroke="#718096" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"><rect x="110" y="62" width="100" height="56" rx="28"/><path d="M138 82v16M130 90h16"/><circle cx="180" cy="86" r="3" fill="#718096"/><circle cx="190" cy="96" r="3" fill="#718096"/></g></svg>`,
  );

/** Card art at the size cards use: IGDB's is already sized, and old RAWG links get its 600px crop. */
/** The same art large enough for a full-width banner: IGDB serves each image at several sizes. */
export const bannerImage = (url?: string | null) => url?.replace("/t_screenshot_big/", "/t_1080p/") ?? undefined;

export function coverImage(url?: string | null): string | undefined {
  if (!url) return undefined;
  return url.replace(/^(https:\/\/media\.rawg\.io\/media)\/(games|screenshots)\//, "$1/crop/600/400/$2/");
}
