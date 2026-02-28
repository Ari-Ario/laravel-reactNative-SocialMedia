import { useState, useContext } from "react";
import { View, Text, StyleSheet, Button, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import axios from "@/services/axios";
import FormTextField from "@/components/FormTextField";
import { login, loadUser } from "@/services/AuthService";
import { Link, router } from 'expo-router';
import AuthContext from "@/context/AuthContext";

export default function () {
    const { setUser } = useContext(AuthContext);

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [errors, setErrors] = useState("");

    async function handleLogin() {

        try {
            await login({
                email,
                password,
                device_name: `${Platform.OS} ${Platform.Version}`,
            });

            const user = await loadUser();
            setUser(user);
            console.log("send it to TABS");
            if (user.email_verified_at === null) {
                router.push({
                    pathname: '/VerificationScreen',
                    params: { email: email }
                });
                return;
            }
            router.push('/(tabs)');
        } catch (e: any) {
            console.error('Login failed:', e);                    // ← Add this!
            console.log('Full error:', e.message, e.code, e.config?.url);

            // if (axios.isAxiosError(e)) {
            if (e.response) {
                // Server responded (e.g. 422, 401, 500)
                console.log('Response error:', e.response.status, e.response.data);
                if (e.response.status === 422) {
                    setErrors(e.response.data.errors || {});
                } else {
                    setErrors({ general: e.response.data.message || 'Server error' });
                }
            } else if (e.request) {
                // No response received → network issue
                console.log('Network-level failure - request was:', e.request);
                setErrors({ general: 'Network error - check connection or server' });
            } else {
                // Something else (setup error)
                setErrors({ general: e.message || 'Unknown error' });
            }
            // } else {
            //     setErrors({ general: 'Unexpected error' });
            // }
        }
    }

    return (
        <SafeAreaView style={styles.wrapper}>
            <View>
                <Link href={'/'} asChild>
                    <TouchableOpacity style={styles.button}>
                        <Text style={styles.buttonText}>◀ Back to Homescreen</Text>
                    </TouchableOpacity>
                </Link>
            </View>

            <View style={styles.container}>

                <FormTextField label="Email address:"
                    value={email}
                    onChangeText={(text) => setEmail(text)}
                    keyboardType="email-address"
                    errors={errors.email}
                />

                <FormTextField label="Password:"
                    secureTextEntry={true}
                    value={password}
                    onChangeText={(text) => setPassword(text)}
                    keyboardType="default"
                    errors={errors.password}
                />

                <Button title="login" onPress={handleLogin} />

                {errors.general && (
                    <Text style={styles.errorText}>{errors.general}</Text>
                )}


                <Link href={'/ForgotPasswordScreen'} >
                    <Text style={styles.buttonText}>Forgot Password</Text>
                </Link>

                <View style={styles.loginLink}>
                    <Text>Don't have an account? </Text>
                    <Link href="/RegisterScreen" asChild>
                        <TouchableOpacity>
                            <Text style={styles.linkText}>Register</Text>
                        </TouchableOpacity>
                    </Link>
                </View>
            </View>
        </ SafeAreaView>
    )
}

const styles = StyleSheet.create({
    wrapper: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#fff',
    },
    container: {
        padding: 20,
        rowGap: 16,
        width: 300,
    },
    button: {
        top: 0,
        left: 0,
        width: '100%',
        textAlign: 'left',
        marginBottom: 20,
    },
    buttonText: {
        textAlign: "center",
        color: "blue",
        fontSize: 22,
        fontWeight: '500',
    },
    errorText: {
        color: 'red',
        textAlign: 'center',
        marginTop: 10,
    },
    loginLink: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 20,
    },
    linkText: {
        color: 'blue',
        fontWeight: '600',
    },
});