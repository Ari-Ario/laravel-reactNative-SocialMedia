/**
 * usePlatformAudio.ts
 * Type-only barrel for TypeScript resolution.
 * Metro will pick usePlatformAudio.native.ts or usePlatformAudio.web.ts at runtime.
 */
export { usePlatformAudio } from './usePlatformAudio.native';
export type { PlatformAudioHook } from './usePlatformAudio.native';
