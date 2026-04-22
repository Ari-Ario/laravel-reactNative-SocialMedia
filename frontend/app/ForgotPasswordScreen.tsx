import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, router } from 'expo-router';
import axios from '@/services/axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/hooks/useAppTheme';
import { BackButton } from '@/components/ui/IconButton';

export default function ForgotPasswordScreen() {
    const { colors, activeScheme } = useAppTheme();
    const styles = getStyles(colors, activeScheme);
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    
    const handleSendCode = async () => {
        if (!email) {
            setMessage('Please enter your email');
            return;
        }
        
        setLoading(true);
        setMessage('');
        
        try {
            const response = await axios.post('/forgot-password', { email });
            await AsyncStorage.setItem('reset_password_email', email);

            if (response.data.message) {
                // Navigate to reset code screen
                router.push({
                    pathname: '/ResetPasswordScreen',
                    params: { email }
                });
            }
        } catch (error: any) {
            setMessage(error.response?.data?.message || 'Failed to send reset code');
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <SafeAreaView style={styles.container}>
            <View style={{ position: 'absolute', top: 10, left: 10, zIndex: 10 }}>
                <Link href="/LoginScreen" asChild>
                    <BackButton />
                </Link>
            </View>

            <View style={styles.headerIcon}>
                <Ionicons name="key-outline" size={40} color={colors.tint} />
            </View>

            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>
                Enter your email address to receive a secure reset code
            </Text>
            
            <View style={styles.inputWrapper}>
                <Ionicons name="mail-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                    style={styles.input}
                    placeholder="Email"
                    placeholderTextColor={colors.textSecondary + '70'}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                />
            </View>
            
            {message ? <Text style={styles.message}>{message}</Text> : null}
            
            <TouchableOpacity 
                style={[styles.button, loading && { opacity: 0.7 }]} 
                onPress={handleSendCode} 
                disabled={loading}
            >
                <Text style={styles.buttonText}>{loading ? "Sending..." : "Send Reset Code"}</Text>
            </TouchableOpacity>
            
        </SafeAreaView>
    );
}

function getStyles(colors: any, activeScheme: string) {
  return StyleSheet.create({
    container: {
        flex: 1,
        padding: 24,
        justifyContent: 'center',
        backgroundColor: colors.background,
    },
    headerIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'center',
        marginBottom: 24,
        borderWidth: 1,
        borderColor: colors.border,
    },
    title: {
        fontSize: 28,
        fontWeight: '900',
        color: colors.text,
        marginBottom: 8,
        textAlign: 'center',
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 16,
        color: colors.textSecondary,
        marginBottom: 32,
        textAlign: 'center',
        lineHeight: 24,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 16,
        paddingHorizontal: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: colors.border,
        height: 56,
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        height: '100%',
        color: colors.text,
        fontSize: 16,
        fontWeight: '600',
    },
    message: {
        textAlign: 'center',
        marginBottom: 20,
        color: colors.error,
        fontWeight: '600',
    },
    button: {
        backgroundColor: colors.tint,
        height: 56,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '800',
    },
    backLink: {
        marginTop: 24,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    linkText: {
        fontSize: 15,
        fontWeight: '700',
        color: colors.tint,
    },
});
}