// app/RegisterScreen.tsx
import React, { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    Button,
    TouchableOpacity,
    Platform,
    Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import FormTextField from "@/components/FormTextField";
import { register } from "@/services/AuthService";
import { Link, router } from 'expo-router';
import { setToken } from "@/services/TokenService"; // Add this import
import AuthContext from "@/context/AuthContext";
import { useContext } from "react";

const RegisterUser: React.FC = () => {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [passwordConfirmation, setPasswordConfirmation] = useState("");
    const [errors, setErrors] = useState<any>({});
    const [loading, setLoading] = useState(false);

    const { setUser } = useContext(AuthContext); // Get setUser from context

    async function handleRegister() {
        setErrors({});
        setLoading(true);

        try {
            const response = await register({
                name: name,
                email: email,
                password: password,
                password_confirmation: passwordConfirmation,
                device_name: `${Platform.OS} ${Platform.Version}`,
            });

            console.log('Register response:', response);

            // Save the token from registration response
            if (response.token) {
                await setToken(response.token);
                console.log('Token saved during registration');
            }

            // Save the user to context
            if (response.user) {
                setUser(response.user);
                console.log('User saved to context:', response.user);
            }

            // Check if verification is required
            if (response.requires_verification && response.user_id) {
                console.log('Navigation params:', {
                    userId: response.user_id,
                    email: email,
                    token: response.token,
                    user: response.user // Pass user object too
                });

                // Navigate to VerificationScreen with all data
                router.push({
                    pathname: '/VerificationScreen',
                    params: {
                        userId: String(response.user_id),
                        email: email,
                        token: response.token,
                        user: JSON.stringify(response.user) // Stringify user object
                    }
                });
            } else if (response.token && response.user.email_verified_at) {
                // If auto-verified or no verification needed
                router.replace('/(tabs)');
            }

            // Reset form
            setName("");
            setEmail("");
            setPassword("");
            setPasswordConfirmation("");

        } catch (e: any) {
            console.error('Registration error:', e.response?.data);

            if (e.response?.status === 422) {
                setErrors(e.response.data.errors || {});
            } else if (e.response?.data?.message) {
                setErrors({ general: e.response.data.message });
            } else {
                setErrors({ general: 'Registration failed. Please try again.' });
            }
        } finally {
            setLoading(false);
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
                <Text style={styles.title}>Create Account</Text>

                <FormTextField
                    label="Name:"
                    value={name}
                    onChangeText={(text) => setName(text)}
                    errors={errors.name}
                />

                <FormTextField
                    label="Email address:"
                    value={email}
                    onChangeText={(text) => setEmail(text)}
                    keyboardType="email-address"
                    errors={errors.email}
                />

                <FormTextField
                    label="Password:"
                    secureTextEntry={true}
                    value={password}
                    onChangeText={(text) => setPassword(text)}
                    errors={errors.password}
                />

                <FormTextField
                    label="Confirm Password:"
                    secureTextEntry={true}
                    value={passwordConfirmation}
                    onChangeText={(text) => setPasswordConfirmation(text)}
                    errors={errors.password_confirmation}
                />

                <Button
                    title={loading ? "Registering..." : "Register"}
                    onPress={handleRegister}
                    disabled={loading}
                />

                {errors.general && (
                    <Text style={styles.errorText}>{errors.general}</Text>
                )}

                <View style={styles.loginLink}>
                    <Text>Already have an account? </Text>
                    <Link href="/Login" asChild>
                        <TouchableOpacity>
                            <Text style={styles.linkText}>Login</Text>
                        </TouchableOpacity>
                    </Link>
                </View>
            </View>
        </SafeAreaView>
    );
};


const styles = StyleSheet.create({
    wrapper: {
        backgroundColor: "#fff",
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        padding: 20,
        rowGap: 16,
        width: 300,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 20,
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

export default RegisterUser;