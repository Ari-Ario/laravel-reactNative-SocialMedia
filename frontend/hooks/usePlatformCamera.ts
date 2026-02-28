/**
 * usePlatformCamera.ts
 * Type-only barrel for TypeScript resolution.
 * Metro will pick usePlatformCamera.native.ts or usePlatformCamera.web.ts at runtime.
 */
export { usePlatformCamera } from './usePlatformCamera.native';
export type { PlatformCameraHook, CameraPermissions } from './usePlatformCamera.native';
