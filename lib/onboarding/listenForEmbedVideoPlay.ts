/** YouTube PlayerState.PLAYING */
const YT_PLAYING = 1;

function parseMessagePayload(data: unknown): Record<string, unknown> | null {
  if (typeof data === "string") {
    try {
      const parsed: unknown = JSON.parse(data);
      return typeof parsed === "object" && parsed !== null
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  if (typeof data === "object" && data !== null) {
    return data as Record<string, unknown>;
  }
  return null;
}

function isPlayingMessage(payload: Record<string, unknown>): boolean {
  if (payload.event === "play") return true;

  if (payload.event === "onStateChange" && payload.info === YT_PLAYING) return true;

  if (payload.event === "infoDelivery") {
    const info = payload.info;
    if (typeof info === "object" && info !== null && "playerState" in info) {
      return (info as { playerState?: number }).playerState === YT_PLAYING;
    }
  }

  return false;
}

/** Detect play inside a YouTube/Vimeo iframe (requires enablejsapi for YouTube). */
export function listenForEmbedVideoPlay(onPlay: () => void): () => void {
  const handler = (event: MessageEvent) => {
    const { origin } = event;
    if (
      origin !== "https://www.youtube.com" &&
      origin !== "https://www.youtube-nocookie.com" &&
      !origin.endsWith(".vimeo.com")
    ) {
      return;
    }

    const payload = parseMessagePayload(event.data);
    if (!payload || !isPlayingMessage(payload)) return;

    onPlay();
  };

  window.addEventListener("message", handler);
  return () => window.removeEventListener("message", handler);
}
