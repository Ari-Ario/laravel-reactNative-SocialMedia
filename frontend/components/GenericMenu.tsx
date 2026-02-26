import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createShadow } from '@/utils/styles';

export interface MenuItem {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    onPress: () => void;
    color?: string;
    destructive?: boolean;
}

interface GenericMenuProps {
    visible: boolean;
    onClose: () => void;
    items: MenuItem[];
    anchorPosition?: { top: number; left: number };
}

export default function GenericMenu({
    visible,
    onClose,
    items,
    anchorPosition = { top: 0, left: 0 }
}: GenericMenuProps) {
    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
            <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
                <View style={[styles.menuContainer, {
                    position: 'absolute',
                    top: anchorPosition.top + 20,
                    left: Math.max(10, anchorPosition.left - 180), // Prevent going off-screen left
                }]}>
                    {items.map((item, index) => (
                        <TouchableOpacity
                            key={index}
                            style={styles.menuItem}
                            onPress={() => {
                                onClose();
                                item.onPress();
                            }}
                        >
                            <Ionicons
                                name={item.icon}
                                size={20}
                                color={item.destructive ? '#FF3B30' : (item.color || '#333')}
                            />
                            <Text style={[
                                styles.menuText,
                                { color: item.destructive ? '#FF3B30' : (item.color || '#333') }
                            ]}>
                                {item.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </TouchableOpacity>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.2)', // Slightly dim background
        justifyContent: 'center',
        alignItems: 'center',
    },
    menuContainer: {
        backgroundColor: 'white',
        borderRadius: 12,
        width: 220,
        paddingVertical: 8,
        ...createShadow({
            width: 0,
            height: 4,
            opacity: 0.15,
            radius: 12,
            elevation: 8,
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
    },
});
