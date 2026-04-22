import { useState } from "react";
import { Platform, View, Text, StyleSheet, Button, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import FormTextField from "@/components/FormTextField";
import { login as loginApi } from "@/services/AuthService";
import { Link, useRouter } from 'expo-router';
import { useAuthStore } from "@/stores/useAuthStore";
import { useAppTheme } from "@/hooks/useAppTheme";
import { BackButton } from "@/components/ui/IconButton";

export default function LoginScreen() {
    const { colors } = useAppTheme();
    const router = useRouter();
    const authStore = useAuthStore();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [errors, setErrors] = useState<any>({});

    async function handleLogin() {
        setErrors({});
        try {
            console.log("🔐 [LoginScreen] Attempting login for:", email);
            const response = await loginApi({
                email,
                password,
                device_name: `${Platform.OS} ${Platform.Version}`,
            });

            // response.data contains { token, user }
            const userData = response.user || response.data?.user || response;
            const token = response.token || response.data?.token;

            if (!token || !userData) {
               throw new Error("Invalid login response: Missing token or user data");
            }

            // Centralized login in Zustand (automatically persists to storage)
            await authStore.login(userData, token);
            
            console.log("✅ [LoginScreen] Login successful, redirecting...");

            if (userData.email_verified_at === null) {
                router.push({
                    pathname: '/VerificationScreen',
                    params: { email: email }
                });
                return;
            }
            
            router.replace('/(tabs)');
        } catch (e: any) {
            console.error('❌ [LoginScreen] Login failed:', e);
            if (e.response) {
                if (e.response.status === 422) {
                    setErrors(e.response.data.errors || {});
                } else {
                    setErrors({ general: e.response.data.message || 'Server error' });
                }
            } else {
                setErrors({ general: e.message || 'Network error' });
            }
        }
    }

    return (
        <SafeAreaView style={[styles.wrapper, { backgroundColor: colors.background }]}>
            <View style={{ position: 'absolute', top: 10, left: 10, zIndex: 10 }}>
                <Link href={'/'} asChild>
                    <BackButton />
                </Link>
            </View>

            <View style={styles.container}>
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
                    keyboardType="default"
                    errors={errors.password}
                />

                <Button title="Login" onPress={handleLogin} />

                {errors.general && (
                    <Text style={[styles.errorText, { color: colors.error }]}>{errors.general}</Text>
                )}

                <Link href={'/ForgotPasswordScreen'} asChild>
                    <TouchableOpacity>
                        <Text style={[styles.buttonText, { color: colors.tint, fontSize: 16, marginTop: 10 }]}>Forgot Password</Text>
                    </TouchableOpacity>
                </Link>

                <View style={styles.loginLink}>
                    <Text style={{ color: colors.textSecondary }}>Don't have an account? </Text>
                    <Link href="/RegisterScreen" asChild>
                        <TouchableOpacity>
                            <Text style={[styles.linkText, { color: colors.tint }]}>Register</Text>
                        </TouchableOpacity>
                    </Link>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    container: {
        padding: 20,
        rowGap: 16,
        width: 300,
    },
    button: {
        marginBottom: 20,
    },
    buttonText: {
        textAlign: "center",
        fontSize: 22,
        fontWeight: '500',
    },
    errorText: {
        textAlign: 'center',
        marginTop: 10,
    },
    loginLink: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 20,
    },
    linkText: {
        fontWeight: '600',
    },
});