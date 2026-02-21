/**
 * Jitsi / 8x8 JaaS config.
 * Set NEXT_PUBLIC_JITSI_APP_ID to use 8x8 JaaS (e.g. vpaas-magic-cookie-xxx).
 * Otherwise uses NEXT_PUBLIC_JITSI_DOMAIN or meet.jit.si.
 */

const JITSI_APP_ID = process.env.NEXT_PUBLIC_JITSI_APP_ID || '';
const JITSI_DOMAIN_FALLBACK = process.env.NEXT_PUBLIC_JITSI_DOMAIN || 'meet.jit.si';

export const JITSI_DOMAIN = JITSI_APP_ID ? '8x8.vc' : JITSI_DOMAIN_FALLBACK;

/** Script URL for the Jitsi external API (JaaS uses 8x8.vc/appId/external_api.js). */
export const JITSI_SCRIPT_URL = JITSI_APP_ID
  ? `https://8x8.vc/${JITSI_APP_ID}/external_api.js`
  : `https://${JITSI_DOMAIN_FALLBACK}/external_api.js`;

/** Build the full room name for the API (JaaS: appId/roomName, else roomName). */
export function getJitsiRoomNameForApi(shortRoomName: string): string {
  return JITSI_APP_ID ? `${JITSI_APP_ID}/${shortRoomName}` : shortRoomName;
}

/** Build the meet link stored in DB (https://domain/roomPath). */
export function getJitsiMeetLink(shortRoomName: string): string {
  const path = JITSI_APP_ID ? `${JITSI_APP_ID}/${shortRoomName}` : shortRoomName;
  return `https://${JITSI_DOMAIN}/${path}`;
}

/** Room name to pass to JitsiMeeting/iframe. For JaaS, must be appId/roomName (tenant in URL); fixes old links that are 8x8.vc/room only. */
export function getJitsiRoomNameForMeeting(meetLink: string): string {
  try {
    const path = new URL(meetLink).pathname.replace(/^\/+|\/+$/g, '') || 'EduBlast';
    if (!JITSI_APP_ID) return path;
    if (path.includes('/')) return path; // already appId/room
    return `${JITSI_APP_ID}/${path}`;
  } catch {
    return JITSI_APP_ID ? `${JITSI_APP_ID}/EduBlast` : 'EduBlast';
  }
}

export function isJitsiAppIdSet(): boolean {
  return Boolean(JITSI_APP_ID);
}
