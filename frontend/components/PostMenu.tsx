import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createShadow } from '@/utils/styles';
import { GlobalStyles } from '@/styles/GlobalStyles';

interface PostMenuProps {
    visible: boolean;
    onClose: () => void;
    onDelete: () => void;
    onEdit: () => void;
    onReport: () => void;
    isOwner: boolean;
    anchorPosition?: { top: number; left: number }; // Add this prop
}

export default function PostMenu({ 
    visible, 
    onClose, 
    onDelete, 
    onEdit, 
    onReport,
    isOwner,
    anchorPosition = { top: 0, left: 0 } // Default position
}: PostMenuProps) {
    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
            <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
                {Platform.OS === 'web' && <View style={[StyleSheet.absoluteFill, styles.webBackdrop]} />}
                <View style={[
                  styles.menuContainer, 
                  GlobalStyles.popupContainer,
                  { 
                    position: 'absolute',
                    top: anchorPosition.top + 20,
                    left: Math.max(20, anchorPosition.left - 180),
                  }
                ]}>
                    {isOwner && (
                        <>
                            <TouchableOpacity 
                                style={styles.menuItem} 
                                onPress={() => { onClose(); onDelete(); }}
                            >
                                <Ionicons name="trash-outline" size={20} color="#FF453A" />
                                <Text style={[styles.menuText, { color: '#FF453A' }]}>Delete</Text>
                            </TouchableOpacity>
                            
                            <TouchableOpacity 
                                style={styles.menuItem} 
                                onPress={() => { onClose(); onEdit(); }}
                            >
                                <Ionicons name="create-outline" size={20} color="#3A7AFE" />
                                <Text style={styles.menuText}>Edit</Text>
                            </TouchableOpacity>
                        </>
                    )}
                    
                    <TouchableOpacity 
                        style={styles.menuItem} 
                        onPress={() => { onClose(); onReport(); }}
                    >
                        <Ionicons name="flag-outline" size={20} color="#EBEBF5" />
                        <Text style={styles.menuText}>Report</Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.38)',
    },
    webBackdrop: {
        backgroundColor: 'rgba(0,0,0,0.42)',
        backdropFilter: 'blur(6px)',
    } as any,
    menuContainer: {
        backgroundColor: '#1C1C1E',
        borderRadius: 18,
        width: 200,
        paddingVertical: 8,
        ...createShadow({
            width: 0,
            height: 8,
            opacity: 0.36,
            radius: 24,
            elevation: 20,
        }),
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    menuText: {
        marginLeft: 12,
        fontSize: 15,
        fontWeight: '500',
        color: '#EBEBF5',
    },
});