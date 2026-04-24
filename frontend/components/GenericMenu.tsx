import React from 'react';
import { Platform, View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/constants/i18n';
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
    const { isRTL } = useTranslation();

    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
            <TouchableOpacity 
                style={styles.overlay} 
                activeOpacity={1} 
                onPress={(e) => {
                    if (Platform.OS === 'web') {
                        // 🛡️ Robust propagation control for Web to prevent background interaction leaks
                        const nativeEvent = e.nativeEvent as any;
                        if (nativeEvent.stopPropagation) nativeEvent.stopPropagation();
                        if (nativeEvent.preventDefault) nativeEvent.preventDefault();
                    }
                    onClose();
                }}
            >
                <View
                    style={[
                        styles.menuContainer,
                        { 
                            backgroundColor: colors.surface,
                            top: anchorPosition ? anchorPosition.top - 12 : 100,
                            // Use absolute left for reliable cross-platform positioning
                            left: anchorPosition ? anchorPosition.left : (isRTL ? undefined : 20),
                            right: !anchorPosition && isRTL ? 20 : undefined,
                        }
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
                                style={[styles.menuItem, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
                                onPress={() => {
                                    item.onPress();
                                    onClose();
                                }}
                            >
                                <View style={[styles.itemContent, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                                    <Ionicons
                                        name={item.icon}
                                        size={20}
                                        color={item.destructive ? '#FF453A' : (item.color || colors.tint)}
                                    />
                                    <Text 
                                        style={[
                                            styles.menuText,
                                            { 
                                                color: item.destructive ? '#FF453A' : (item.color || colors.text),
                                                [isRTL ? 'marginRight' : 'marginLeft']: 12,
                                                textAlign: isRTL ? 'right' : 'left'
                                            }
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

const isMobileWeb = Platform.OS === 'web' && (
    (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches) ||
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        typeof navigator !== 'undefined' ? navigator.userAgent : ''
    )
);

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    menuContainer: {
        position: 'absolute',
        borderRadius: 12,
        width: 220,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: 'rgba(128,128,128,0.15)',
        ...createShadow({
            width: 0,
            height: 12,
            opacity: 0.3,
            radius: 16,
            elevation: 10,
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
        marginLeft: 0,
        transform: [{ translateX: -10 }],
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
