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
import { Ionicons } from '@expo/vector-icons';
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
    const [focusedIndex, setFocusedIndex] = useState<number | null>(0);
    const [loading, setLoading] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [countdown, setCountdown] = useState(0);

    const inputRefs = useRef<Array<TextInput | null>>([]);

    // Auto-redirect if already verified
    useEffect(() => {
        if (user?.email_verified_at) {
            console.log('User already verified, redirecting to tabs');
            router.replace('/(tabs)');
        }
    }, [user?.email_verified_at]);

    // Initialize user in context if available
    useEffect(() => {
        if (initialUser && setUser && (!user || user.id !== initialUser.id)) {
            setUser(initialUser);
            console.log('User initialized from params');
        }
    }, [initialUser]);

    useEffect(() => {
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
        if (loading) return;

        const numericText = text.replace(/[^0-9]/g, '');
        
        if (numericText.length > 1) {
            const pasteDigits = numericText.slice(0, 6).split('');
            const newCode = [...code];
            pasteDigits.forEach((digit, i) => {
                if (index + i < 6) {
                    newCode[index + i] = digit;
                }
            });
            setCode(newCode);
            
            const nextFocusIndex = Math.min(index + pasteDigits.length, 5);
            inputRefs.current[nextFocusIndex]?.focus();
            
            if (newCode.every(d => d !== '')) {
                verifyCode(newCode.join(''));
            }
            return;
        }

        const newCode = [...code];
        newCode[index] = numericText;
        setCode(newCode);

        if (numericText && index < 5) {
            focusNextInput(index);
        }

        if (newCode.every(digit => digit !== '') && index === 5) {
            verifyCode(newCode.join(''));
        }
    };

    const handleKeyPress = (e: any, index: number) => {
        if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
            focusPrevInput(index);
        }
    };

    const verifyCode = async (providedCode?: string) => {
        if (loading) return; // Critical: prevent double submission

        const fullCode = providedCode || code.join('');
        
        if (!userId) {
            Alert.alert(t('error'), 'User ID missing');
            return;
        }

        if (fullCode.length !== 6) {
            setMessage(t('enter_code_sent'));
            return;
        }

        setLoading(true);
        setMessage('');

        try {
            const config = token ? {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            } : {};

            console.log('Sending verification request...');
            const response = await verifyEmailCode(userId, fullCode, config);
            
            if (response.verified) {
                if (response.token) {
                    await setToken(response.token);
                }

                if (response.user && setUser) {
                    setUser(response.user);
                }

                // Immediate navigation for better UX, Alert as fallback/success indicator
                console.log('Verification success, navigating...');
                router.replace('/(tabs)');
                
                // Show alert only if navigation takes a moment
                setTimeout(() => {
                    Alert.alert(t('success'), t('verify_success'));
                }, 100);
            } else {
                setMessage(response.message || 'Verification failed');
            }
        } catch (error: any) {
            // Handle "already verified" or "code already consumed" which might return 400
            if (error.response?.status === 400 && user?.email_verified_at) {
                router.replace('/(tabs)');
                return;
            }

            console.error('Verification error:', error);
            setMessage(error.response?.data?.message || t('error'));
            setCode(['', '', '', '', '', '']);
            inputRefs.current[0]?.focus();
        } finally {
            setLoading(false);
        }
    };

    const handleResendCode = async () => {
        if (!userId || countdown > 0 || resendLoading) return;

        setResendLoading(true);
        setMessage('');

        try {
            const config = token ? {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            } : {};

            await resendVerificationCode(userId, config);
            setMessage('New verification code sent!');
            setCountdown(60);
            setCode(['', '', '', '', '', '']);
            inputRefs.current[0]?.focus();
        } catch (error: any) {
            setMessage(error.response?.data?.message || t('error'));
        } finally {
            setResendLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.wrapper}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.content}
            >
                <View style={styles.navHeader}>
                    <BackButton onPress={() => router.push('/RegisterScreen')} />
                </View>

                <View style={styles.headerSection}>
                    <View style={styles.headerIcon}>
                        <Ionicons name="shield-checkmark-outline" size={40} color={colors.tint} />
                    </View>
                    <Text style={styles.title}>{t('verify_email_title')}</Text>
                    <Text style={styles.subtitle}>{t('enter_code_sent')}</Text>
                    <Text style={styles.email}>{email}</Text>
                </View>

                <View style={styles.formContainer}>
                    <View style={[styles.codeContainer, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                        {[0, 1, 2, 3, 4, 5].map((index) => (
                            <TextInput
                                key={index}
                                ref={(ref) => inputRefs.current[index] = ref}
                                style={[
                                    styles.codeInput,
                                    code[index] ? styles.codeInputFilled : null,
                                    focusedIndex === index ? styles.codeInputFocused : null
                                ]}
                                value={code[index]}
                                onChangeText={(text) => handleCodeChange(text, index)}
                                onKeyPress={(e) => handleKeyPress(e, index)}
                                onFocus={() => setFocusedIndex(index)}
                                onBlur={() => setFocusedIndex(null)}
                                keyboardType="number-pad"
                                maxLength={Platform.OS === 'web' ? undefined : 1}
                                editable={!loading}
                                selectTextOnFocus
                                cursorColor={colors.tint}
                                selectionColor={colors.tint + '40'}
                                keyboardAppearance={activeScheme}
                            />
                        ))}
                    </View>

                    {message ? (
                        <View style={[
                            styles.messageBadge,
                            message.includes('sent') || message.includes('Success')
                                ? styles.successBadge
                                : styles.errorBadge
                        ]}>
                            <Text style={styles.messageText}>{message}</Text>
                        </View>
                    ) : null}

                    <TouchableOpacity
                        style={[
                            styles.button,
                            (loading || code.join('').length !== 6) && styles.buttonDisabled
                        ]}
                        onPress={() => verifyCode()}
                        disabled={loading || code.join('').length !== 6}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.buttonText}>{loading ? t('verifying') : t('verify_email_btn')}</Text>
                    </TouchableOpacity>

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
    const isDark = activeScheme === 'dark';
    return StyleSheet.create({
    wrapper: {
        flex: 1,
        backgroundColor: colors.background,
    },
    content: {
        flex: 1,
        paddingHorizontal: 20, // Slightly reduced horizontal padding
    },
    navHeader: {
        position: 'absolute',
        top: 10,
        [isRTL ? 'right' : 'left']: 16,
        zIndex: 10,
    },
    headerSection: {
        alignItems: 'center',
        marginTop: Platform.OS === 'web' ? 40 : 20,
        marginBottom: 32,
    },
    headerIcon: {
        width: 70, // Slightly smaller icon
        height: 70,
        borderRadius: 35,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
        borderWidth: 1,
        borderColor: colors.border,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
            },
            android: {
                elevation: 4,
            },
            web: {
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
            }
        }),
    },
    title: {
        fontSize: 26, // Slightly smaller title
        fontWeight: '900',
        color: colors.text,
        textAlign: 'center',
        marginBottom: 8,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 15,
        textAlign: 'center',
        color: colors.textSecondary,
        marginBottom: 4,
        lineHeight: 22,
    },
    email: {
        fontSize: 15,
        textAlign: 'center',
        fontWeight: '800',
        color: colors.text,
    },
    formContainer: {
        width: '100%',
        maxWidth: 400,
        alignSelf: 'center',
    },
    codeContainer: {
        flexDirection: 'row',
        justifyContent: 'center', // Centered for better responsiveness
        marginBottom: 32,
        gap: Platform.OS === 'web' ? 10 : 6, // Reduced gap for mobile
    },
    codeInput: {
        flex: 1,
        height: Platform.OS === 'web' ? 64 : 54, // Slightly shorter height
        maxWidth: 48, // Reduced maxWidth to fit iPhone XR (414px)
        borderWidth: 2,
        borderColor: colors.border,
        borderRadius: 14,
        textAlign: 'center',
        fontSize: 22, // Slightly smaller font
        fontWeight: '800',
        color: colors.text,
        backgroundColor: colors.surface,
        ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
    },
    codeInputFocused: {
        borderColor: colors.tint,
        backgroundColor: isDark ? colors.tint + '15' : colors.tint + '05',
    },
    codeInputFilled: {
        borderColor: colors.tint,
        color: colors.tint,
    },
    button: {
        backgroundColor: colors.tint,
        height: 54,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '800',
    },
    resendButton: {
        padding: 12,
        alignItems: 'center',
        marginTop: 8,
    },
    resendButtonDisabled: {
        opacity: 0.6,
    },
    resendButtonText: {
        color: colors.tint,
        fontSize: 14,
        fontWeight: '700',
    },
    messageBadge: {
        marginBottom: 20,
        padding: 12,
        borderRadius: 12,
        alignItems: 'center',
    },
    successBadge: {
        backgroundColor: colors.success + '15',
    },
    errorBadge: {
        backgroundColor: colors.error + '15',
    },
    messageText: {
        fontSize: 13,
        fontWeight: '700',
        textAlign: 'center',
        color: colors.text,
    },
});
}



export default VerificationScreen;