import React, { useState } from 'react';
import {
    View,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Platform,
    KeyboardAvoidingView,
    ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { createShadow } from '@/utils/styles';

interface GuestJoinViewProps {
    space: any;
    onJoin: (name: string) => Promise<void>;
    onLogin: () => void;
    activityId?: string;
}

export const GuestJoinView: React.FC<GuestJoinViewProps> = ({ space, onJoin, onLogin, activityId }) => {
    const [name, setName] = useState('');
    const [isJoining, setIsJoining] = useState(false);

    const handleJoin = async () => {
        if (!name.trim()) return;
        setIsJoining(true);
        try {
            await onJoin(name.trim());
        } finally {
            setIsJoining(false);
        }
    };

    return (
        <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <View style={StyleSheet.absoluteFill}>
                <BlurView intensity={100} tint="light" style={StyleSheet.absoluteFill} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.card}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="people-circle" size={80} color="#007AFF" />
                    </View>

                    <Text style={styles.title}>Join as Guest</Text>
                    <Text style={styles.subtitle}>
                        {activityId 
                            ? `You've been invited to join a session in `
                            : `You've been invited to join `}
                        <Text style={styles.spaceName}>{space?.title || 'this space'}</Text>. 
                        Enter your name to participate.
                    </Text>

                    <View style={styles.inputWrapper}>
                        <Ionicons name="person-outline" size={20} color="#999" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Your Name"
                            value={name}
                            onChangeText={setName}
                            placeholderTextColor="#999"
                            maxLength={50}
                        />
                    </View>

                    <TouchableOpacity 
                        style={[styles.joinButton, !name.trim() && styles.joinButtonDisabled]}
                        onPress={handleJoin}
                        disabled={!name.trim() || isJoining}
                    >
                        {isJoining ? (
                            <ActivityIndicator color="#fff" size="small" />
                        ) : (
                            <>
                                <Text style={styles.joinButtonText}>Enter Space</Text>
                                <Ionicons name="arrow-forward" size={20} color="#fff" />
                            </>
                        )}
                    </TouchableOpacity>

                    <View style={styles.divider}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerText}>OR</Text>
                        <View style={styles.dividerLine} />
                    </View>

                    <TouchableOpacity style={styles.loginButton} onPress={onLogin}>
                        <Text style={styles.loginButtonText}>Sign in to your account</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 24,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 32,
        padding: 32,
        alignItems: 'center',
        width: '100%',
        maxWidth: 400,
        alignSelf: 'center',
        ...createShadow({
            width: 0,
            height: 12,
            opacity: 0.15,
            radius: 24,
            elevation: 12,
        }),
    },
    iconContainer: {
        marginBottom: 24,
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        color: '#1a1a1a',
        marginBottom: 12,
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 32,
    },
    spaceName: {
        fontWeight: '700',
        color: '#007AFF',
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f5f5f7',
        borderRadius: 16,
        paddingHorizontal: 16,
        marginBottom: 24,
        width: '100%',
        height: 56,
        borderWidth: 1,
        borderColor: '#e5e5ea',
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: '#1a1a1a',
        fontWeight: '500',
    },
    joinButton: {
        backgroundColor: '#007AFF',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 16,
        gap: 8,
        width: '100%',
        marginBottom: 24,
    },
    joinButtonDisabled: {
        backgroundColor: '#bfe0ff',
    },
    joinButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        marginBottom: 24,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#e5e5ea',
    },
    dividerText: {
        marginHorizontal: 12,
        color: '#999',
        fontSize: 12,
        fontWeight: '700',
    },
    loginButton: {
        paddingVertical: 12,
    },
    loginButtonText: {
        color: '#007AFF',
        fontSize: 16,
        fontWeight: '600',
    },
});
