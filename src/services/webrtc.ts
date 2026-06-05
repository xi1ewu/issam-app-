/**
 * WebRTC stub — all native calls removed so Metro can bundle this cleanly.
 * isWebRTCAvailable() returns false → MeetingScreen shows the info screen.
 * To add real calls later, integrate @livekit/react-native (has Expo plugin).
 */

import { endCallSignal } from './socket';

export type CallType = 'audio' | 'video';

export function isWebRTCAvailable(): boolean {
  return false;
}

export async function startCall(
  _remoteUserId: string,
  _roomId: string,
  _callType: CallType,
  _onRemoteStream: (stream: any) => void,
  _onEnded: () => void,
): Promise<any> {
  throw new Error('WebRTC not available in this build.');
}

export async function answerCall(
  _callerUserId: string,
  _roomId: string,
  _callType: CallType,
  _offer: any,
  _onRemoteStream: (stream: any) => void,
  _onEnded: () => void,
): Promise<any> {
  throw new Error('WebRTC not available in this build.');
}

export async function applyRemoteAnswer(_answer: any): Promise<void> {}
export async function addIceCandidate(_candidate: any): Promise<void> {}
export async function applyOfferAndAnswer(
  _callerUserId: string,
  _roomId: string,
  _offer: any,
): Promise<void> {}

export function endCall(remoteUserId: string, roomId: string): void {
  endCallSignal(remoteUserId, roomId);
}

export function setMuted(_muted: boolean): void {}
export function setVideoEnabled(_enabled: boolean): void {}
