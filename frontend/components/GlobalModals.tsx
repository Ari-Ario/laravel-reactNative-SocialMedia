import { useProfileView } from '@/context/ProfileViewContext';
import ProfilePreview from '@/components/ProfilePreview';

export function GlobalModals() {
  const { profilePreviewVisible, profileViewUserId, setProfilePreviewVisible } = useProfileView();

  return (
    <ProfilePreview 
      userId={profileViewUserId}
      visible={profilePreviewVisible}
      onClose={() => setProfilePreviewVisible(false)}
    />
  );
}