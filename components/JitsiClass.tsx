'use client';

import { useEffect, useState } from 'react';
import { JitsiMeeting } from '@jitsi/react-sdk';
import { JITSI_DOMAIN, isJitsiAppIdSet } from '@/lib/jitsi';

interface JitsiClassProps {
  roomName: string;
  userName: string;
  onLeave: () => void;
  /** When set, token API checks explorer 8-min limit for this session */
  sessionId?: string;
}

export default function JitsiClass({ roomName, userName, onLeave, sessionId }: JitsiClassProps) {
  const [jwt, setJwt] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);

  useEffect(() => {
    if (!isJitsiAppIdSet()) return;
    let cancelled = false;
    const body: { roomName: string; displayName: string; sessionId?: string } = { roomName, displayName: userName };
    if (sessionId) body.sessionId = sessionId;
    fetch('/api/jitsi-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.jwt) setJwt(data.jwt);
        if (!cancelled && data.error) setTokenError(data.error);
      })
      .catch((e) => {
        if (!cancelled) setTokenError(e?.message || 'Failed to get token');
      });
    return () => { cancelled = true; };
  }, [roomName, userName, sessionId]);

  if (tokenError) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black text-white p-4">
        <p className="text-red-400">{tokenError}</p>
        <button type="button" onClick={onLeave} className="rounded bg-red-600 px-4 py-2 text-sm hover:bg-red-700">
          Exit
        </button>
      </div>
    );
  }

  const showMeeting = !isJitsiAppIdSet() || jwt !== null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between bg-gray-900 px-4 py-2 text-white">
        <span>Live Class: {roomName.split('/').pop()?.split('-').slice(0, 2).join('-') ?? roomName}...</span>
        <button
          type="button"
          onClick={onLeave}
          className="rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
        >
          Exit Class
        </button>
      </div>

      <div className="h-full w-full flex-1">
        {showMeeting && (
          <JitsiMeeting
            domain={JITSI_DOMAIN}
            roomName={roomName}
            jwt={jwt || undefined}
            configOverwrite={{
              startWithAudioMuted: true,
              disableThirdPartyRequests: true,
              prejoinPageEnabled: false,
            }}
            interfaceConfigOverwrite={{
              TOOLBAR_BUTTONS: [
                'microphone',
                'camera',
                'chat',
                'raisehand',
                'tileview',
                'fullscreen',
                'hangup',
                'screenap',
              ],
              SHOW_JITSI_WATERMARK: false,
            }}
            userInfo={{
              displayName: userName,
              email: '',
            }}
            onApiReady={(externalApi) => {
              externalApi.on('videoConferenceLeft', () => {
                onLeave();
              });
            }}
            getIFrameRef={(iframeRef) => {
              if (iframeRef) {
                iframeRef.style.height = '100%';
                iframeRef.style.width = '100%';
              }
            }}
          />
        )}
        {!showMeeting && isJitsiAppIdSet() && (
          <div className="flex h-full items-center justify-center text-white">
            <p className="text-sm">Starting meeting...</p>
          </div>
        )}
      </div>
    </div>
  );
}
