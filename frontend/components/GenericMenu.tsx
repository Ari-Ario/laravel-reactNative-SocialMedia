import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createShadow } from '@/utils/styles';
import { AnchorPosition } from '@/utils/layout';

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
    anchorPosition?: AnchorPosition;
}

export default function GenericMenu({
    visible,
    onClose,
    items,
    anchorPosition
}: GenericMenuProps) {
    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
            <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
                <View
                    style={[
                        styles.menuContainer,
                        anchorPosition ? {
                            top: anchorPosition.top + 15, // Standard offset from trigger
                            left: anchorPosition.left,
                        } : { top: 100, left: 20 } // Fallback
                    ]}
                >
                    {/* Pointer Arrow */}
                    {anchorPosition && (
                        <View
                            style={[
                                styles.pointer,
                                { left: anchorPosition.arrowOffset }
                            ]}
                        />
                    )}

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
        backgroundColor: 'rgba(0,0,0,0.1)',
        width: '100%',
        height: '100%',
    },
    menuContainer: {
        position: 'absolute',
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
    pointer: {
        position: 'absolute',
        top: -10,
        width: 0,
        height: 0,
        backgroundColor: 'transparent',
        borderStyle: 'solid',
        borderLeftWidth: 10,
        borderRightWidth: 10,
        borderBottomWidth: 10,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderBottomColor: 'white',
        marginLeft: -10, // Center on the peak
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
