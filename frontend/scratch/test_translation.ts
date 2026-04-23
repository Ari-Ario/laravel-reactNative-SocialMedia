import { NOTIFICATION_TYPES } from '../stores/notificationStore';

// Simulating the logic in NotificationToast.tsx
const t = (key: string) => {
  // Mock translation dictionary
  const dict: Record<string, string> = {
    "space-invitation": "You are invited to a space",
    "new-message": "New message received",
    "new_notification_message": "You have a new alert"
  };
  return dict[key] || key;
};

const getLocalizedMessage = (item: any) => {
  if (typeof item.message === 'object') {
    return JSON.stringify(item.message);
  }

  const typeKey = item.type.toLowerCase().replace(/-/g, '_');
  const hyphenatedTypeKey = item.type.toLowerCase().replace(/_/g, '-');
  
  console.log('Testing type:', item.type);
  console.log('typeKey (underscored):', typeKey);
  console.log('hyphenatedTypeKey:', hyphenatedTypeKey);

  // Priority 1: Direct translation of the message string
  const translatedMsg = t(item.message);
  if (translatedMsg !== item.message) {
    console.log('Match found in Priority 1');
    return translatedMsg;
  }

  // Priority 2: Translation based on the notification type
  // Try underscored first
  const typeTranslation = t(typeKey);
  if (typeTranslation !== typeKey) {
    console.log('Match found in Priority 2 (underscored)');
    return typeTranslation;
  }
  
  // Try hyphenated
  const hyphenatedTypeTranslation = t(hyphenatedTypeKey);
  if (hyphenatedTypeTranslation !== hyphenatedTypeKey) {
    console.log('Match found in Priority 2 (hyphenated)');
    return hyphenatedTypeTranslation;
  }

  // Priority 3: Fallback
  console.log('Falling back to Priority 3');
  return item.message || t('new_notification_message');
};

const testNotifications = [
  { type: 'space-invitation', message: 'You have been invited' },
  { type: 'NEW_MESSAGE', message: 'Some raw message' },
  { type: 'unknown_type', message: 'Something happened' }
];

testNotifications.forEach(n => {
  console.log('Final localized message:', getLocalizedMessage(n));
  console.log('---');
});
