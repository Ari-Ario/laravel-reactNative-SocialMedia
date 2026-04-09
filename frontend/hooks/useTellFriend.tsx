import { useState, useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import { TellFriendModal } from '@/app/settings/TellFriend';

interface UseTellFriendProps {
    userId?: number;
    onShareComplete?: () => void;
}

export const useTellFriend = ({ userId, onShareComplete }: UseTellFriendProps = {}) => {
    const [isVisible, setIsVisible] = useState(false);

    const openTellFriend = useCallback(() => {
        setIsVisible(true);
    }, []);

    const closeTellFriend = useCallback(() => {
        setIsVisible(false);
        onShareComplete?.();
    }, [onShareComplete]);

    const TellFriendComponent = useCallback(() => {
        return (
            <TellFriendModal
                visible={isVisible}
                onClose={closeTellFriend}
                userId={userId}
            />
        );
    }, [isVisible, closeTellFriend, userId]);

    return {
        isVisible,
        openTellFriend,
        closeTellFriend,
        TellFriendComponent,
    };
};
