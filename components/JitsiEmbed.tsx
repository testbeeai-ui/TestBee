"use client";

import { useEffect, useRef, useState } from "react";
import { JITSI_DOMAIN, JITSI_SCRIPT_URL, getJitsiRoomNameForMeeting, isJitsiAppIdSet } from "@/lib/jitsi";

export function isJitsiLink(meetLink: string | null): boolean {
  if (!meetLink) return false;
  try {
    const url = new URL(meetLink);
    return url.hostname === JITSI_DOMAIN || url.hostname === "meet.jit.si" || url.hostname === "8x8.vc";
  } catch {
    return false;
  }
}

export function getJitsiRoomName(meetLink: string): string {
  const url = new URL(meetLink);
  return url.pathname.slice(1).replace(/^\/+/, "") || "EduBlast";
}

interface JitsiEmbedProps {
  meetLink: string;
  displayName?: string;
  className?: string;
  /** When set, token API checks explorer 8-min limit for this session */
  sessionId?: string;
}

type JitsiAPI = (domain: string, options: {
  roomName: string;
  parentNode: HTMLElement;
  width: string | number;
  height: string | number;
  userInfo?: { displayName?: string };
  jwt?: string;
  configOverwrite?: Record<string, unknown>;
  interfaceConfigOverwrite?: Record<string, unknown>;
}) => { dispose: () => void };

declare global {
  interface Window {
    // @ts-expect-error -- duplicate declaration across files is intentional
    JitsiMeetExternalAPI?: JitsiAPI;
  }
}

function is8x8Link(link: string): boolean {
  try {
    return new URL(link).hostname === "8x8.vc";
  } catch {
    return false;
  }
}

export function JitsiEmbed({ meetLink, displayName, className = "", sessionId }: JitsiEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<{ dispose: () => void } | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [jwt, setJwt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const needJwt = isJitsiAppIdSet() && is8x8Link(meetLink);

  useEffect(() => {
    if (!needJwt) return;
    let cancelled = false;
    const roomName = getJitsiRoomNameForMeeting(meetLink);
    const body: { roomName: string; displayName: string; sessionId?: string } = {
      roomName,
      displayName: displayName || "Participant",
    };
    if (sessionId) body.sessionId = sessionId;
    fetch("/api/jitsi-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.jwt) setJwt(data.jwt);
        if (!cancelled && data.error) setError(data.error);
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message || "Failed to get token");
      });
    return () => { cancelled = true; };
  }, [needJwt, meetLink, displayName, sessionId]);

  useEffect(() => {
    if (!meetLink || !isJitsiLink(meetLink)) {
      queueMicrotask(() => setError("This meeting link cannot be embedded."));
      return;
    }
    if (typeof window === "undefined") return;
    if (window.JitsiMeetExternalAPI) {
      queueMicrotask(() => setScriptReady(true));
      return;
    }
    const sel = 'script[src="' + JITSI_SCRIPT_URL + '"]';
    if (document.querySelector(sel)) {
      const check = () => {
        if (window.JitsiMeetExternalAPI) setScriptReady(true);
        else requestAnimationFrame(check);
      };
      check();
      return;
    }
    const script = document.createElement("script");
    script.src = JITSI_SCRIPT_URL;
    script.async = true;
    script.onload = () => setScriptReady(true);
    script.onerror = () => setError("Failed to load video meeting.");
    document.body.appendChild(script);
    return () => { script.remove(); };
  }, [meetLink]);

  useEffect(() => {
    if (!scriptReady || !containerRef.current || !window.JitsiMeetExternalAPI) return;
    if (needJwt && jwt === null) return;
    const roomName = getJitsiRoomNameForMeeting(meetLink);
    try {
      const options: Parameters<typeof window.JitsiMeetExternalAPI>[1] = {
        roomName,
        parentNode: containerRef.current,
        width: "100%",
        height: "100%",
        userInfo: { displayName: displayName || "Participant" },
        configOverwrite: { startWithAudioMuted: false, startWithVideoMuted: false },
        interfaceConfigOverwrite: { SHOW_JITSI_WATERMARK: false },
      };
      if (jwt) options.jwt = jwt;
      const api = window.JitsiMeetExternalAPI(JITSI_DOMAIN as string, options);
      apiRef.current = api;
    } catch (e) {
      queueMicrotask(() =>
        setError(e instanceof Error ? e.message : "Failed to start meeting."),
      );
    }
    return () => {
      if (apiRef.current) {
        apiRef.current.dispose();
        apiRef.current = null;
      }
    };
  }, [scriptReady, meetLink, displayName, needJwt, jwt]);

  if (error) {
    return (
      <div className={"flex items-center justify-center rounded-xl bg-muted/50 p-6 text-destructive " + className}>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className={"relative min-h-[400px] w-full overflow-hidden rounded-xl bg-black " + className} style={{ height: "70vh" }}>
      <div ref={containerRef} className="absolute inset-0 h-full w-full" />
      {(!scriptReady || (needJwt && jwt === null && !error)) && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/80 text-muted-foreground">
          <p className="text-sm">{needJwt && !jwt && !error ? "Getting meeting token..." : "Loading meeting..."}</p>
        </div>
      )}
    </div>
  );
}
