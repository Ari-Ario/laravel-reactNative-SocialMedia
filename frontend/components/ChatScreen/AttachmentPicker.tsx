import React from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Pressable,
    Platform,
    Alert,
} from 'react-native';
import { MotiView } from 'moti';
import { Ionicons } from '@expo/vector-icons';
import { createShadow } from '@/utils/styles';

export interface AttachmentPickerProps {
    isVisible: boolean;
    onClose: () => void;
    onSelectAction: (action: string) => void;
}

const ActionBtn: React.FC<{ icon: string; label: string; color: string; onPress: () => void }> = ({
    icon, label, color, onPress,
}) => (
    <TouchableOpacity
        style={styles.actionBtn}
        onPress={onPress}
        activeOpacity={0.6}
    >
        <MotiView
            from={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 15 }}
        >
            <View style={[styles.actionIcon, { backgroundColor: color }]}>
                <Ionicons name={icon as any} size={28} color="#fff" />
            </View>
        </MotiView>
        <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
);

const AttachmentPicker: React.FC<AttachmentPickerProps> = ({
    isVisible,
    onClose,
    onSelectAction,
}) => {
    if (!isVisible) return null;

    return (
        <View style={styles.container}>
            {/* Backdrop for dismissal */}
            <Pressable style={styles.backdrop} onPress={onClose} />

            <MotiView
                from={{ translateY: 300, opacity: 0 }}
                animate={{ translateY: 0, opacity: 1 }}
                exit={{ translateY: 300, opacity: 0 }}
                transition={{ type: 'spring', damping: 20, stiffness: 100 }}
                style={styles.sheet}
            >
                <View style={styles.handle} />
                <View style={styles.grid}>
                    <ActionBtn icon="document-text" label="Document" color="#7F66FF" onPress={() => onSelectAction('document')} />
                    <ActionBtn icon="camera" label="Camera" color="#FF4567" onPress={() => onSelectAction('camera')} />
                    <ActionBtn icon="images" label="Gallery" color="#BF59CF" onPress={() => onSelectAction('gallery')} />
                    <ActionBtn icon="location" label="Location" color="#02B558" onPress={() => onSelectAction('location')} />
                    <ActionBtn icon="person" label="Contact" color="#009DE2" onPress={() => onSelectAction('contact')} />
                    <ActionBtn icon="bar-chart" label="Poll" color="#00A884" onPress={() => onSelectAction('poll')} />
                </View>
            </MotiView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 1000, // Large enough to cover screen
        justifyContent: 'flex-end',
        zIndex: 999,
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'transparent',
    },
    sheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingHorizontal: 16,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
        paddingTop: 12,
        ...createShadow({ width: 0, height: -4, opacity: 0.1, radius: 12, elevation: 12 }),
    },
    handle: {
        width: 38,
        height: 4,
        backgroundColor: '#E0E0E0',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 24,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
        paddingHorizontal: 8,
    },
    actionBtn: {
        width: '33.33%', // 3 columns for 6 icons
        alignItems: 'center',
        marginBottom: 24,
        gap: 8,
    },
    actionIcon: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        ...createShadow({
            width: 0,
            height: 3,
            opacity: 0.12,
            radius: 6,
            elevation: 3,
        }),
    },
    actionLabel: {
        fontSize: 12,
        fontWeight: '500',
        color: '#4B4B4B',
        textAlign: 'center',
    },
});

export default AttachmentPicker;
