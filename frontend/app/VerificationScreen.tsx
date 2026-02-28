// app/VerificationScreen.tsx
import React, { useState, useEffect, useRef, useContext, useMemo } from 'react';
import {
    View,
    Text,
    TextInput,
    Button,
    StyleSheet,
    Alert,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { router, useLocalSearchParams } from 'expo-router';
import { verifyEmailCode, resendVerificationCode } from '@/services/AuthService';
import { setToken } from '@/services/TokenService'; // Fixed: should be setToken not saveToken
import AuthContext from '@/context/AuthContext';
import { getToken } from '@/services/TokenService';

const VerificationScreen = () => {
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
            Alert.alert('Error', 'User ID not found');
            return;
        }

        const fullCode = code.join('');
        if (fullCode.length !== 6) {
            setMessage('Please enter all 6 digits');
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
                    'Success',
                    'Email verified successfully!',
                    [
                        {
                            text: 'Continue',
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
            setMessage(error.response?.data?.message || 'Verification failed. Please try again.');
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
            setMessage(error.response?.data?.message || 'Failed to resend code. Please try again.');
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
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.content}
            >
                <View style={styles.header}>
                    <Button
                        title="← Back"
                        onPress={() => router.push('/RegisterScreen')}
                        color="blue"
                    />
                </View>

                <View style={styles.formContainer}>
                    <Text style={styles.title}>Verify Your Email</Text>
                    <Text style={styles.subtitle}>
                        Enter the 6-digit code sent to:
                    </Text>
                    <Text style={styles.email}>{email}</Text>

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
                                onChangeText={(text) => handleCodeChange(text, index)}
                                onKeyPress={(e) => handleKeyPress(e, index)}
                                keyboardType="number-pad"
                                maxLength={1}
                                editable={!loading}
                                selectTextOnFocus
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
                        <Button
                            title={loading ? "Verifying..." : "Verify Email"}
                            onPress={verifyCode}
                            disabled={loading || code.join('').length !== 6}
                            color={code.join('').length === 6 && !loading ? "#007AFF" : "#CCCCCC"}
                        />
                    </View>

                    <View style={styles.buttonContainer}>
                        <Button
                            title={
                                resendLoading
                                    ? 'Sending...'
                                    : countdown > 0
                                        ? `Resend code in ${countdown}s`
                                        : "Didn't receive code? Resend"
                            }
                            onPress={handleResendCode}
                            disabled={resendLoading || countdown > 0}
                            color={!resendLoading && countdown === 0 ? "#007AFF" : "#CCCCCC"}
                        />
                    </View>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    content: {
        flex: 1,
    },
    header: {
        padding: 20,
        alignItems: 'flex-start',
    },
    formContainer: {
        flex: 1,
        padding: 30,
        justifyContent: 'center',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    errorText: {
        fontSize: 18,
        color: 'red',
        marginBottom: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 16,
        textAlign: 'center',
        color: '#666',
        marginBottom: 5,
    },
    email: {
        fontSize: 16,
        textAlign: 'center',
        fontWeight: '600',
        marginBottom: 40,
        color: '#333',
    },
    codeContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 30,
    },
    codeInput: {
        width: 45,
        height: 55,
        borderWidth: 2,
        borderColor: '#ddd',
        borderRadius: 10,
        textAlign: 'center',
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
    },
    codeInputFilled: {
        borderColor: '#007AFF',
        backgroundColor: '#f0f8ff',
    },
    buttonContainer: {
        marginBottom: 15,
    },
    message: {
        textAlign: 'center',
        marginBottom: 20,
        fontSize: 14,
        padding: 10,
        borderRadius: 5,
    },
    successMessage: {
        color: '#155724',
        backgroundColor: '#d4edda',
    },
    errorMessage: {
        color: '#721c24',
        backgroundColor: '#f8d7da',
    },
});

export default VerificationScreen;