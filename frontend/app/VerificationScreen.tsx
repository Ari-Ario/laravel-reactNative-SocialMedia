// app/VerificationScreen.tsx
import React, { useState, useEffect, useRef, useContext, useMemo } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    Alert,
    KeyboardAvoidingView,
    Platform,
    TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '@/hooks/useAppTheme';
import { BackButton } from '@/components/ui/IconButton';

import { router, useLocalSearchParams } from 'expo-router';
import { verifyEmailCode, resendVerificationCode } from '@/services/AuthService';
import { setToken } from '@/services/TokenService'; // Fixed: should be setToken not saveToken
import AuthContext from '@/context/AuthContext';
import { getToken } from '@/services/TokenService';
import { useTranslation } from '@/constants/i18n';

const VerificationScreen = () => {
    const { colors, activeScheme } = useAppTheme();
    const { t, isRTL } = useTranslation();
    const styles = getStyles(colors, activeScheme, isRTL);
    const params = useLocalSearchParams();
    const { user, setUser } = useContext(AuthContext);

    // Parse all params with proper handling
    const getParamValue = (param: string | string[] | undefined): string => {
        if (!param) return '';
        if (Array.isArray(param)) return param[0] || '';
        return param;
    };

    const userIdStr = getParamValue(params.userId) || user?.id?.toString() || '';
    const userId = userIdStr ? parseInt(userIdStr) : null;
    const email = getParamValue(params.email) || user?.email || '';
    const token = getParamValue(params.token) || getToken();
    const userStr = getParamValue(params.user) || user ? JSON.stringify(user) : '';

    console.log('VerificationScreen params:', {
        userId,
        email,
        hasToken: !!token,
        hasUser: !!userStr
    });

    // Use useMemo to prevent recreation on every render
    const initialUser = useMemo(() => {
        if (!userStr) return null;
        try {
            return JSON.parse(userStr);
        } catch (e) {
            console.error('Failed to parse user object:', e);
            return null;
        }
    }, [userStr]); // Only recalculate when userStr changes

    const [code, setCode] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [countdown, setCountdown] = useState(0);

    const inputRefs = useRef<Array<TextInput | null>>([]);

    // Initialize user in context if available - FIXED DEPENDENCY
    useEffect(() => {
        console.log('useEffect running, initialUser:', initialUser);
        if (initialUser && setUser) {
            setUser(initialUser);
            console.log('User set from params:', initialUser);
        }
    }, [initialUser]); // Only depend on initialUser, not setUser

    useEffect(() => {
        // Start countdown for resend
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown]);

    const focusNextInput = (index: number) => {
        if (index < 5 && inputRefs.current[index + 1]) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const focusPrevInput = (index: number) => {
        if (index > 0 && inputRefs.current[index - 1]) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleCodeChange = (text: string, index: number) => {
        // Only allow numbers
        const numericText = text.replace(/[^0-9]/g, '');

        const newCode = [...code];
        newCode[index] = numericText;
        setCode(newCode);

        // Auto-focus next input
        if (numericText && index < 5) {
            focusNextInput(index);
        }

        // Auto-verify when all digits are entered
        if (newCode.every(digit => digit !== '') && index === 5) {
            verifyCode();
        }
    };

    const handleKeyPress = (e: any, index: number) => {
        if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
            focusPrevInput(index);
        }
    };

    const verifyCode = async () => {
        console.log('Verify button clicked, userId:', userId, 'token:', token);

        if (!userId) {
            Alert.alert(t('error'), 'User ID not found');
            return;
        }

        const fullCode = code.join('');
        if (fullCode.length !== 6) {
            setMessage(t('enter_code_sent'));
            return;
        }

        setLoading(true);
        setMessage('');

        try {
            // Add token to request headers if available
            const config = token ? {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            } : {};

            console.log('Calling verifyEmailCode with:', { userId, code: fullCode });
            const response = await verifyEmailCode(userId, fullCode, config);
            console.log('Verify response:', response);

            if (response.verified) {
                // Save the token if returned in response
                if (response.token) {
                    await setToken(response.token); // Fixed: use setToken
                    console.log('New token saved after verification');
                }

                // Update user in context with verified status
                if (response.user && setUser) {
                    setUser(response.user);
                    console.log('User updated after verification:', response.user);
                }

                Alert.alert(
                    t('success'),
                    t('verify_success'),
                    [
                        {
                            text: t('continue'),
                            onPress: () => {
                                console.log('Navigating to tabs');
                                router.replace('/(tabs)');
                            }
                        }
                    ]
                );
            } else {
                setMessage(response.message || 'Verification failed');
            }
        } catch (error: any) {
            console.error('Verification error:', error);
            console.error('Error response:', error.response?.data);
            setMessage(error.response?.data?.message || t('error'));
            // Clear code on error
            setCode(['', '', '', '', '', '']);
            inputRefs.current[0]?.focus();
        } finally {
            setLoading(false);
        }
    };

    const handleResendCode = async () => {
        console.log('Resend button clicked, userId:', userId, 'token:', token);

        if (!userId || countdown > 0) {
            console.log('Cannot resend: missing userId or countdown active');
            return;
        }

        setResendLoading(true);
        setMessage('');

        try {
            // Add token to request headers if available
            const config = token ? {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            } : {};

            console.log('Calling resendVerificationCode with userId:', userId);
            const response = await resendVerificationCode(userId, config);
            console.log('Resend response:', response);

            setMessage('New verification code sent!');
            setCountdown(60); // 60 seconds countdown
            setCode(['', '', '', '', '', '']);
            inputRefs.current[0]?.focus();
        } catch (error: any) {
            console.error('Resend error:', error);
            console.error('Error response:', error.response?.data);
            setMessage(error.response?.data?.message || t('error'));
        } finally {
            setResendLoading(false);
        }
    };

    // If no userId, show error
    // if (!userId) {
    //     return (
    //         <SafeAreaView style={styles.container}>
    //             <View style={styles.errorContainer}>
    //                 <Text style={styles.errorText}>Verification data missing</Text>
    //                 <Button 
    //                     title="Go Back" 
    //                     onPress={() => router.push('/VerificationScreen')} 
    //                 />
    //             </View>
    //         </SafeAreaView>
    //     );
    // }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.content}
            >
                <View style={{ position: 'absolute', top: 10, left: 10, zIndex: 10 }}>
                    <BackButton onPress={() => router.push('/RegisterScreen')} />
                </View>
                <View style={styles.formContainer}>
                    <Text style={styles.title}>{t('verify_email_title')}</Text>
                    <Text style={styles.subtitle}>
                        {t('enter_code_sent')}
                    </Text>
                    <Text style={styles.email}>{email}</Text>

                    <View style={[styles.codeContainer, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                        {[0, 1, 2, 3, 4, 5].map((index) => (
                            <TextInput
                                key={index}
                                ref={(ref) => inputRefs.current[index] = ref}
                                style={[
                                    styles.codeInput,
                                    code[index] ? styles.codeInputFilled : null
                                ]}
                                value={code[index]}
                                onChangeText={(text) => handleCodeChange(text, index)}
                                onKeyPress={(e) => handleKeyPress(e, index)}
                                keyboardType="number-pad"
                                maxLength={1}
                                editable={!loading}
                                selectTextOnFocus
                                keyboardAppearance={activeScheme}
                            />
                        ))}
                    </View>

                    {message ? (
                        <Text style={[
                            styles.message,
                            message.includes('sent') || message.includes('Success')
                                ? styles.successMessage
                                : styles.errorMessage
                        ]}>
                            {message}
                        </Text>
                    ) : null}

                    <View style={styles.buttonContainer}>
                        <TouchableOpacity
                            style={[
                                styles.button,
                                (loading || code.join('').length !== 6) && styles.buttonDisabled
                            ]}
                            onPress={verifyCode}
                            disabled={loading || code.join('').length !== 6}
                        >
                            <Text style={styles.buttonText}>{loading ? t('verifying') : t('verify_email_btn')}</Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={[
                            styles.resendButton,
                            (resendLoading || countdown > 0) && styles.resendButtonDisabled
                        ]}
                        onPress={handleResendCode}
                        disabled={resendLoading || countdown > 0}
                    >
                        <Text style={styles.resendButtonText}>
                            {resendLoading
                                ? t('sending')
                                : countdown > 0
                                    ? `${t('resend_code_in')} ${countdown}s`
                                    : t('didnt_receive_code')}
                        </Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

function getStyles(colors: any, activeScheme: string, isRTL: boolean) {
    return StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    content: {
        flex: 1,
    },
    header: {
        padding: 20,
        alignItems: 'flex-start',
    },
    backButton: {
        padding: 8,
    },
    backButtonText: {
        color: colors.tint,
        fontWeight: '700',
        fontSize: 16,
    },
    formContainer: {
        flex: 1,
        padding: 30,
        justifyContent: 'center',
    },
    title: {
        fontSize: 28,
        fontWeight: '900',
        color: colors.text,
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        textAlign: 'center',
        color: colors.textSecondary,
        marginBottom: 4,
    },
    email: {
        fontSize: 16,
        textAlign: 'center',
        fontWeight: '800',
        color: colors.text,
        marginBottom: 40,
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
    buttonContainer: {
        marginBottom: 20,
    },
    button: {
        backgroundColor: colors.tint,
        height: 56,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonDisabled: {
        opacity: 0.5,
        backgroundColor: colors.textSecondary,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '800',
    },
    resendButton: {
        padding: 12,
        alignItems: 'center',
    },
    resendButtonDisabled: {
        opacity: 0.6,
    },
    resendButtonText: {
        color: colors.tint,
        fontSize: 15,
        fontWeight: '700',
    },
    message: {
        textAlign: 'center',
        marginBottom: 24,
        fontSize: 14,
        padding: 12,
        borderRadius: 12,
        fontWeight: '600',
    },
    successMessage: {
        color: colors.success,
        backgroundColor: colors.success + '15',
    },
    errorMessage: {
        color: colors.error,
        backgroundColor: colors.error + '15',
    },
});
}

export default VerificationScreen;