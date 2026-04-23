import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/constants/i18n';

interface PostMenuProps {
    visible: boolean;
    onClose: () => void;
    onDelete: () => void;
    onEdit: () => void;
    onReport: () => void;
    isOwner: boolean;
    anchorPosition?: { top: number; left: number };
}

export default function PostMenu({ 
    visible, 
    onClose, 
    onDelete, 
    onEdit, 
    onReport,
    isOwner,
    anchorPosition = { top: 0, left: 0 }
}: PostMenuProps) {
    const { colors } = useAppTheme();
    const { t, isRTL } = useTranslation();

    const styles = getStyles(colors, isRTL);

    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
            <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
                <View style={[
                    styles.menuContainer,
                    {
                        position: 'absolute',
                        top: Math.max(20, anchorPosition.top - 10),
                        left: isRTL ? Math.max(20, anchorPosition.left - 20) : Math.max(20, anchorPosition.left - 180),
                        backgroundColor: colors.surface,
                    }
                ]}>
                    {isOwner && (
                        <>
                            <TouchableOpacity 
                                style={styles.menuItem} 
                                onPress={onDelete}
                            >
                                <Ionicons name="trash-outline" size={20} color="red" />
                                <Text style={[styles.menuText, { color: 'red' }]}>{t('delete')}</Text>
                            </TouchableOpacity>
                            
                            <TouchableOpacity 
                                style={styles.menuItem} 
                                onPress={onEdit}
                            >
                                <Ionicons name="create-outline" size={20} color={colors.text} />
                                <Text style={[styles.menuText, { color: colors.text }]}>{t('edit')}</Text>
                            </TouchableOpacity>
                        </>
                    )}
                    
                    <TouchableOpacity 
                        style={styles.menuItem} 
                        onPress={onReport}
                    >
                        <Ionicons name="flag-outline" size={20} color={colors.text} />
                        <Text style={[styles.menuText, { color: colors.text }]}>{t('report')}</Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        </Modal>
    );
}

// export const PostMenu = React.memo(PostMenuBase); // Wait, this is a default export

const getStyles = (colors: any, isRTL: boolean) => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    menuContainer: {
        borderRadius: 10,
        width: 200,
        paddingVertical: 8,
        zIndex: 6000,
        borderWidth: 1,
        borderColor: 'rgba(150,150,150,0.1)',
    },
    menuItem: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    menuText: {
        marginLeft: isRTL ? 0 : 12,
        marginRight: isRTL ? 12 : 0,
        fontSize: 16,
        textAlign: isRTL ? 'right' : 'left',
    },
});