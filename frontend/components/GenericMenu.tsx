import React from 'react';
import { Platform, View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/hooks/useAppTheme';
import { createShadow } from '@/utils/styles';
import { AnchorPosition } from '@/utils/layout';

export interface MenuItem {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    onPress: () => void;
    color?: string;
    destructive?: boolean;
    badge?: number;
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
    const { colors } = useAppTheme();

    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
            <TouchableOpacity 
                style={styles.overlay} 
                activeOpacity={1} 
                onPress={onClose}
            >
                {Platform.OS === 'web' && (
                    <View style={[StyleSheet.absoluteFill, styles.webBackdrop]} />
                )}
                <View
                    style={[
                        styles.menuContainer,
                        { backgroundColor: colors.surface },
                        anchorPosition ? {
                            top: anchorPosition.top + 15,
                            left: anchorPosition.left,
                        } : { top: 100, left: 20 }
                    ]}
                >
                    {anchorPosition && (
                        <View
                            style={[
                                styles.pointer,
                                {
                                    left: anchorPosition.arrowOffset,
                                    borderBottomColor: colors.surface
                                }
                            ]}
                        />
                    )}

                    {items.map((item, index) => {
                        return (
                            <TouchableOpacity
                                key={`${index}-${item.label}`}
                                style={styles.menuItem}
                                onPress={() => {
                                    item.onPress();
                                    onClose();
                                }}
                            >
                                <View style={styles.itemContent}>
                                    <Ionicons
                                        name={item.icon}
                                        size={20}
                                        color={item.destructive ? '#FF453A' : (item.color || colors.tint)}
                                    />
                                    <Text 
                                        style={[
                                            styles.menuText,
                                            { color: item.destructive ? '#FF453A' : (item.color || colors.text) }
                                        ]}
                                    >
                                        {item.label}
                                    </Text>
                                </View>
                                {item.badge !== undefined && item.badge > 0 && (
                                    <View style={styles.badgeContainer}>
                                        <Text style={styles.badgeText}>
                                            {item.badge > 99 ? '99+' : item.badge}
                                        </Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </TouchableOpacity>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.38)',
        width: '100%',
        height: '100%',
        zIndex: 9999,
    },
    webBackdrop: {
        backgroundColor: 'rgba(0,0,0,0.42)',
        ...Platform.select({
            web: {
                backdropFilter: 'blur(6px)',
            }
        })
    } as any,
    menuContainer: {
        position: 'absolute',
        borderRadius: 18,
        width: 220,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: 'rgba(128,128,128,0.1)',
        ...createShadow({
            width: 0,
            height: 8,
            opacity: 0.36,
            radius: 24,
            elevation: 20,
        }),
        zIndex: 10000,
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
        borderBottomColor: '#1C1C1E',
        marginLeft: -10,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    itemContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    menuText: {
        marginLeft: 12,
        fontSize: 15,
        fontWeight: '500',
    },
    badgeContainer: {
        backgroundColor: '#FF3B30',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '700',
    },
});
