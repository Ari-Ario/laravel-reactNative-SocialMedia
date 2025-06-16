// contexts/ProfileViewContext.tsx
import React, { createContext, useContext, useState } from 'react';

interface ProfileViewContextType {
  profileViewUserId: string | null;
  setProfileViewUserId: (id: string | null) => void;
  profilePreviewVisible: boolean;
  setProfilePreviewVisible: (visible: boolean) => void;
}

const ProfileViewContext = createContext<ProfileViewContextType | undefined>(undefined);

export const ProfileViewProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [profileViewUserId, setProfileViewUserId] = useState<string | null>(null);
  const [profilePreviewVisible, setProfilePreviewVisible] = useState(false);

  return (
    <ProfileViewContext.Provider 
      value={{ 
        profileViewUserId, 
        setProfileViewUserId,
        profilePreviewVisible,
        setProfilePreviewVisible
      }}
    >
      {children}
    </ProfileViewContext.Provider>
  );
};

export const useProfileView = () => {
  const context = useContext(ProfileViewContext);
  if (!context) {
    throw new Error('useProfileView must be used within a ProfileViewProvider');
  }
  return context;
};