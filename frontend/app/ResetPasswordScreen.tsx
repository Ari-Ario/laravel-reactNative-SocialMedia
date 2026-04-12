import React, { useState, useRef } from 'react';
import { Platform, View, Text, TextInput, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
import axios from '@/services/axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppTheme } from '@/hooks/useAppTheme';
import { Ionicons } from '@expo/vector-icons';

export default function ResetPasswordScreen() {
    const { colors, activeScheme } = useAppTheme();
    const styles = getStyles(colors, activeScheme);
    const params = useLocalSearchParams();
    const setEmail = async () => {
        const storedEmail = await AsyncStorage.getItem('reset_password_email');
        return storedEmail || (params.email as string);
    };
    const [email, setEmailState] = useState<string>('');
    React.useEffect(() => {
        setEmail().then(emailValue => {
            setEmailState(emailValue);
        });
    }, []);
    
    const [code, setCode] = useState(['', '', '', '', '', '']);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [resetToken, setResetToken] = useState('');
    const [step, setStep] = useState(1); // 1: Enter code, 2: Enter new password
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    
    const inputRefs = useRef<Array<TextInput | null>>([]);
    
    const verifyCode = async () => {
        const fullCode = code.join('');
        if (fullCode.length !== 6) {
            setMessage('Please enter 6-digit code');
            return;
        }
        
        setLoading(true);
        setMessage('');
        
        try {
            const response = await axios.post('/verify-reset-code', {
                email,
                code: fullCode
            });
            
            if (response.data.reset_token) {
                setResetToken(response.data.reset_token);
                setStep(2);
                setMessage('Code verified! Now set your new password.');
            }
        } catch (error: any) {
            setMessage(error.response?.data?.message || 'Invalid code');
            setCode(['', '', '', '', '', '']);
            if (inputRefs.current[0]) inputRefs.current[0].focus();
        } finally {
            setLoading(false);
        }
    };
    
    const resetPassword = async () => {
        if (newPassword.length < 8) {
            setMessage('Password must be at least 8 characters');
            return;
        }
        
        if (newPassword !== confirmPassword) {
            setMessage('Passwords do not match');
            return;
        }
        
        setLoading(true);
        setMessage('');
        
        try {
            const response = await axios.post('/reset-password', {
                reset_token: resetToken,
                password: newPassword,
                password_confirmation: confirmPassword
            });
            if (Platform.OS === 'web') {
                alert('Password reset successfully!');
                router.replace('/LoginScreen');
            } else {
            Alert.alert('Success', 'Password reset successfully!', [
                { text: 'OK', onPress: () => router.replace('/LoginScreen') }
            ]);
            }
        } catch (error: any) {
            setMessage(error.response?.data?.message || 'Failed to reset password');
        } finally {
            setLoading(false);
        }
    };
    
    if (step === 1) {
        return (
            <View style={styles.container}>
                <View style={styles.headerIcon}>
                    <Ionicons name="mail-unread-outline" size={40} color={colors.tint} />
                </View>

                <Text style={styles.title}>Enter Reset Code</Text>
                <Text style={styles.subtitle}>
                    Enter the 6-digit code sent to {email}
                </Text>
                
                <View style={styles.codeContainer}>
                    {[0, 1, 2, 3, 4, 5].map((index) => (
                        <TextInput
                            key={index}
                            ref={(ref) => inputRefs.current[index] = ref}
                            style={[
                                styles.codeInput,
                                code[index] ? styles.codeInputFilled : null
                            ]}
                            value={code[index]}
                            onChangeText={(text) => {
                                const numericText = text.replace(/[^0-9]/g, '');
                                const newCode = [...code];
                                newCode[index] = numericText;
                                setCode(newCode);
                                
                                if (numericText && index < 5) {
                                    inputRefs.current[index + 1]?.focus();
                                }
                                
                                if (newCode.every(d => d !== '') && index === 5) {
                                    verifyCode();
                                }
                            }}
                            keyboardType="number-pad"
                            maxLength={1}
                            placeholderTextColor={colors.textSecondary + '40'}
                            keyboardAppearance={activeScheme}
                        />
                    ))}
                </View>
                
                {message ? <Text style={styles.message}>{message}</Text> : null}
                
                <TouchableOpacity 
                    style={[styles.button, (loading || code.join('').length !== 6) && styles.buttonDisabled]} 
                    onPress={verifyCode} 
                    disabled={loading || code.join('').length !== 6}
                >
                    <Text style={styles.buttonText}>{loading ? "Verifying..." : "Verify Code"}</Text>
                </TouchableOpacity>

                <Link href="/ForgotPasswordScreen" asChild>
                    <TouchableOpacity style={styles.backButton}>
                        <View style={styles.linkRow}>
                            <Ionicons name="arrow-back" size={16} color={colors.tint} />
                            <Text style={styles.linkText}>Back to Email</Text>
                        </View>
                    </TouchableOpacity>
                </Link>
            </View>
        );
    } 
    
    return (
        <View style={styles.container}>
            <View style={styles.headerIcon}>
                <Ionicons name="lock-open-outline" size={40} color={colors.tint} />
            </View>

            <Text style={styles.title}>Set New Password</Text>
            <Text style={styles.subtitle}>Create a strong password for your account</Text>
            
            <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                    style={styles.input}
                    placeholder="New Password"
                    placeholderTextColor={colors.textSecondary + '70'}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry
                    keyboardAppearance={activeScheme}
                />
            </View>
            
            <View style={styles.inputWrapper}>
                <Ionicons name="checkmark-circle-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                    style={styles.input}
                    placeholder="Confirm New Password"
                    placeholderTextColor={colors.textSecondary + '70'}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    keyboardAppearance={activeScheme}
                />
            </View>
            
            {message ? <Text style={styles.message}>{message}</Text> : null}
            
            <TouchableOpacity 
                style={[styles.button, loading && styles.buttonDisabled]} 
                onPress={resetPassword} 
                disabled={loading}
            >
                <Text style={styles.buttonText}>{loading ? "Resetting..." : "Reset Password"}</Text>
            </TouchableOpacity>
        </View>
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
    codeContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 40,
    },
    codeInput: {
        width: 48,
        height: 64,
        borderWidth: 2,
        borderColor: colors.border,
        borderRadius: 12,
        textAlign: 'center',
        fontSize: 28,
        fontWeight: '800',
        color: colors.text,
        backgroundColor: colors.surface,
    },
    codeInputFilled: {
        borderColor: colors.tint,
        backgroundColor: colors.tint + '10',
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 16,
        paddingHorizontal: 16,
        marginBottom: 20,
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
        marginBottom: 24,
        color: colors.error,
        fontWeight: '600',
        paddingHorizontal: 20,
    },
    button: {
        backgroundColor: colors.tint,
        height: 56,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '800',
    },
    backButton: {
        marginTop: 24,
        alignItems: 'center',
    },
    linkRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    linkText: {
        fontSize: 15,
        fontWeight: '700',
        color: colors.tint,
    },
});
}