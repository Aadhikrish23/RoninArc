import { useEffect, useState } from "react";
import { LATEST_RELEASE_API, VERSION } from "./config";

// One request per page load, shared by every place that shows the version.
let latest: Promise<string | null> | null = null;

function fetchLatest(): Promise<string | null> {
  latest ??= fetch(LATEST_RELEASE_API, { headers: { Accept: "application/vnd.github+json" } })
    .then((res) => (res.ok ? res.json() : null))
    .then((release) => {
      const tag = typeof release?.tag_name === "string" ? release.tag_name.replace(/^v/, "") : "";
      return /^\d+\.\d+\.\d+$/.test(tag) ? tag : null;
    })
    .catch(() => null);
  return latest;
}

/** The newest released version: the build's own until GitHub answers, and if it never does. */
export function useLatestVersion(): string {
  const [version, setVersion] = useState(VERSION);
  useEffect(() => {
    let live = true;
    fetchLatest().then((tag) => {
      if (live && tag) setVersion(tag);
    });
    return () => {
      live = false;
    };
  }, []);
  return version;
}
