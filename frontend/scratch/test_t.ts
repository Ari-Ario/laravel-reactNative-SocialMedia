import { t } from '../constants/i18n';
import { useTranslationStore } from '../stores/translationStore';

async function test() {
  console.log('Current Locale:', useTranslationStore.getState().locale);
  console.log('T(new-message):', t('new-message'));
  console.log('T(new_notification):', t('new_notification'));
}

test();
