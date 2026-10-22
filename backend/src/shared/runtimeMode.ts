/**
 * The same backend runs in two places:
 *  - local (default): inside the desktop app, one PC, offline-first; may link to the cloud and sync.
 *  - cloud (CLOUD_MODE=true): RoninArc Cloud, many users, serving the phone app and PCs' sync.
 */
export const isCloud = () => process.env.CLOUD_MODE === "true";

/** Where this PC's backend reaches RoninArc Cloud (local mode). Unset: sync isn't offered. */
export const cloudApiUrl = () => (process.env.CLOUD_API_URL || "").replace(/\/+$/, "") || undefined;
