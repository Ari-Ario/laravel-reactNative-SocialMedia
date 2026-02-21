// components/ChatScreen/EnhancedMessageOptions.tsx
import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    Animated,
    Dimensions,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const { width, height } = Dimensions.get('window');

interface EnhancedMessageOptionsProps {
    visible: boolean;
    onClose: () => void;
    message: any;
    position: { x: number; y: number };
    onReply: () => void;
    onReact: (emoji: string) => void;
    onCopy: () => void;
    onForward: () => void;
    onReport: () => void;
    onDelete?: () => void;
    isCurrentUser: boolean;
}

const EMOJI_LIST = ['❤️', '😂', '😮', '😢', '👏', '🔥', '✅', '⭐', '🤔', '🎉'];

const EnhancedMessageOptions: React.FC<EnhancedMessageOptionsProps> = ({
    visible,
    onClose,
    message,
    position,
    onReply,
    onReact,
    onCopy,
    onForward,
    onReport,
    onDelete,
    isCurrentUser,
}) => {
    const slideAnim = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.8)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    tension: 50,
                    friction: 7,
                    useNativeDriver: true,
                }),
                Animated.spring(slideAnim, {
                    toValue: 1,
                    tension: 50,
                    friction: 7,
                    useNativeDriver: true,
                }),
            ]).start();

            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } else {
            fadeAnim.setValue(0);
            scaleAnim.setValue(0.8);
            slideAnim.setValue(0);
        }
    }, [visible]);

    const handleReact = (emoji: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onReact(emoji);
        onClose();
    };

    // Don't render anything if message is null
    if (!message) {
        return null;
    }

    // Calculate position to keep menu on screen
    const menuWidth = 280;
    const menuHeight = isCurrentUser ? 280 : 240;

    let menuX = position.x - menuWidth + 50;
    let menuY = position.y - 20;

    // Ensure menu stays within screen bounds
    if (menuX < 10) menuX = 10;
    if (menuX + menuWidth > width - 10) menuX = width - menuWidth - 10;
    if (menuY + menuHeight > height - 50) menuY = height - menuHeight - 50;
    if (menuY < 50) menuY = 50;

    const translateY = slideAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [20, 0],
    });

    return (
        <Modal
            transparent
            visible={visible}
            animationType="none"
            onRequestClose={onClose}
        >
            <TouchableOpacity
                style={StyleSheet.absoluteFillObject}
                activeOpacity={1}
                onPress={onClose}
            >
                <Animated.View
                    style={[
                        styles.container,
                        {
                            opacity: fadeAnim,
                            left: menuX,
                            top: menuY,
                            transform: [{ scale: scaleAnim }, { translateY }],
                        },
                    ]}
                >
                    {/* Message Preview */}
                    <View style={styles.messagePreview}>
                        <Text style={styles.previewSender}>
                            {message?.user_name || message?.user?.name || 'User'}
                        </Text>
                        <Text style={styles.previewText} numberOfLines={2}>
                            {message?.content || ''}
                        </Text>
                    </View>

                    {/* Quick Reactions */}
                    <View style={styles.quickReactions}>
                        <Text style={styles.reactionTitle}>Quick React</Text>
                        <View style={styles.emojiGrid}>
                            {EMOJI_LIST.map((emoji) => (
                                <TouchableOpacity
                                    key={emoji}
                                    style={styles.emojiButton}
                                    onPress={() => handleReact(emoji)}
                                >
                                    <Text style={styles.emoji}>{emoji}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                onReply();
                                onClose();
                            }}
                        >
                            <View style={[styles.actionIcon, { backgroundColor: '#4CAF5020' }]}>
                                <Ionicons name="arrow-undo" size={20} color="#4CAF50" />
                            </View>
                            <Text style={styles.actionText}>Reply</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                onCopy();
                                onClose();
                            }}
                        >
                            <View style={[styles.actionIcon, { backgroundColor: '#2196F320' }]}>
                                <Ionicons name="copy" size={20} color="#2196F3" />
                            </View>
                            <Text style={styles.actionText}>Copy</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                onForward();
                                onClose();
                            }}
                        >
                            <View style={[styles.actionIcon, { backgroundColor: '#9C27B020' }]}>
                                <Ionicons name="arrow-redo" size={20} color="#9C27B0" />
                            </View>
                            <Text style={styles.actionText}>Forward</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                onReport();
                                onClose();
                            }}
                        >
                            <View style={[styles.actionIcon, { backgroundColor: '#FF980020' }]}>
                                <Ionicons name="flag" size={20} color="#FF9800" />
                            </View>
                            <Text style={styles.actionText}>Report</Text>
                        </TouchableOpacity>

                        {isCurrentUser && onDelete && (
                            <TouchableOpacity
                                style={[styles.actionButton, styles.deleteButton]}
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                                    onDelete();
                                    onClose();
                                }}
                            >
                                <View style={[styles.actionIcon, { backgroundColor: '#FF6B6B20' }]}>
                                    <Ionicons name="trash" size={20} color="#FF6B6B" />
                                </View>
                                <Text style={[styles.actionText, styles.deleteText]}>Delete</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Arrow pointing to message */}
                    <View style={[styles.arrow, { left: 50 }]} />
                </Animated.View>
            </TouchableOpacity>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        width: 280,
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
    },
    arrow: {
        position: 'absolute',
        top: -8,
        width: 16,
        height: 16,
        backgroundColor: '#fff',
        transform: [{ rotate: '45deg' }],
        borderTopWidth: 1,
        borderLeftWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
        shadowColor: '#000',
        shadowOffset: { width: -2, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 4,
    },
    messagePreview: {
        backgroundColor: '#f8f9fa',
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
    },
    previewSender: {
        fontSize: 12,
        fontWeight: '600',
        color: '#007AFF',
        marginBottom: 4,
    },
    previewText: {
        fontSize: 14,
        color: '#333',
        lineHeight: 20,
    },
    quickReactions: {
        marginBottom: 16,
    },
    reactionTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#666',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    emojiGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    emojiButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#f8f9fa',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#f0f0f0',
    },
    emoji: {
        fontSize: 18,
    },
    actions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    actionButton: {
        flex: 1,
        minWidth: '45%',
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        borderRadius: 10,
        backgroundColor: '#f8f9fa',
        gap: 8,
    },
    deleteButton: {
        backgroundColor: '#FF6B6B10',
    },
    actionIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#333',
    },
    deleteText: {
        color: '#FF6B6B',
    },
});

export default EnhancedMessageOptions;