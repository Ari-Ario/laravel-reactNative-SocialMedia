/**
 * usePushNotification.ts
 * Type-only barrel for TypeScript resolution.
 * Metro will pick usePushNotification.native.ts or usePushNotification.web.ts at runtime.
 */
export { usePushNotification } from './usePushNotification.native';
export type { PushNotificationHook } from './usePushNotification.native';
