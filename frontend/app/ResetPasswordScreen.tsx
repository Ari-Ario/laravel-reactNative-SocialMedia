import React, { useState, useRef } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import axios from '@/services/axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ResetPasswordScreen() {
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
    // console.log('ResetPasswordScreen params:', params);
    // const email = AsyncStorage.getItem('reset_password_email') || params.email as string;
    
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
                router.replace('/Login');
            } else {
            Alert.alert('Success', 'Password reset successfully!', [
                { text: 'OK', onPress: () => router.replace('/Login') }
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
                <Text style={styles.title}>Enter Reset Code</Text>
                <Text style={styles.subtitle}>
                    Enter the 6-digit code sent to {email}
                </Text>
                
                <View style={styles.codeContainer}>
                    {[0, 1, 2, 3, 4, 5].map((index) => (
                        <TextInput
                            key={index}
                            ref={(ref) => inputRefs.current[index] = ref}
                            style={styles.codeInput}
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
                        />
                    ))}
                </View>
                
                {message ? <Text style={styles.message}>{message}</Text> : null}
                
                <Button
                    title={loading ? "Verifying..." : "Verify Code"}
                    onPress={verifyCode}
                    disabled={loading || code.join('').length !== 6}
                />
            </View>
        );
    } 
    
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Set New Password</Text>
            
            <TextInput
                style={styles.input}
                placeholder="New Password"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
            />
            
            <TextInput
                style={styles.input}
                placeholder="Confirm New Password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
            />
            
            {message ? <Text style={styles.message}>{message}</Text> : null}
            
            <Button
                title={loading ? "Resetting..." : "Reset Password"}
                onPress={resetPassword}
                disabled={loading}
            />
        </View>
    );

}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        justifyContent: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        marginBottom: 30,
        textAlign: 'center',
    },
    codeContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 30,
    },
    codeInput: {
        width: 45,
        height: 50,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        textAlign: 'center',
        fontSize: 20,
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 12,
        marginBottom: 15,
        fontSize: 16,
    },
    message: {
        textAlign: 'center',
        marginBottom: 20,
        color: '#666',
    },
});