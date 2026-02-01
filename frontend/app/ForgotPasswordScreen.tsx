import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import { Link, router } from 'expo-router';
import axios from '@/services/axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ForgotPasswordScreen() {
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
        <View style={styles.container}>
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>
                Enter your email to receive a reset code
            </Text>
            
            <TextInput
                style={styles.input}
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
            />
            
            {message ? <Text style={styles.message}>{message}</Text> : null}
            
            <Button
                title={loading ? "Sending..." : "Send Reset Code"}
                onPress={handleSendCode}
                disabled={loading}
            />
            
            <Link href="/Login" style={styles.link}>
                Back to Login
            </Link>
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
        marginBottom: 10,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        marginBottom: 30,
        textAlign: 'center',
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 12,
        marginBottom: 20,
        fontSize: 16,
    },
    message: {
        textAlign: 'center',
        marginBottom: 20,
        color: '#666',
    },
    link: {
        marginTop: 20,
        textAlign: 'center',
        color: 'blue',
    },
});