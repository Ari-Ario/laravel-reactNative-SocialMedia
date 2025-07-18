// components/PostMenu.tsx
import { View, Text, StyleSheet, TouchableOpacity, Modal, Alert, NativeSyntheticEvent, NativeTouchEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
                <View style={[styles.menuContainer, { 
                    position: 'absolute',
                    top: anchorPosition.top + 20, // Offset below the button
                    left: anchorPosition.left - 180, // Align to the right
                }]}>
                    {isOwner && (
                        <>
                            <TouchableOpacity 
                                style={styles.menuItem} 
                                onPress={onDelete}
                            >
                                <Ionicons name="trash-outline" size={20} color="red" />
                                <Text style={[styles.menuText, { color: 'red' }]}>Delete</Text>
                            </TouchableOpacity>
                            
                            <TouchableOpacity 
                                style={styles.menuItem} 
                                onPress={onEdit}
                            >
                                <Ionicons name="create-outline" size={20} color="black" />
                                <Text style={styles.menuText}>Edit</Text>
                            </TouchableOpacity>
                        </>
                    )}
                    
                    <TouchableOpacity 
                        style={styles.menuItem} 
                        onPress={onReport}
                    >
                        <Ionicons name="flag-outline" size={20} color="black" />
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
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    menuContainer: {
        backgroundColor: 'white',
        borderRadius: 10,
        width: 200,
        paddingVertical: 8,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    menuText: {
        marginLeft: 12,
        fontSize: 16,
    },
});