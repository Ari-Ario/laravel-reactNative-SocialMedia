import { useState } from "react";
import { Platform, View, Text, StyleSheet, Button, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import FormTextField from "@/components/FormTextField";
import { login as loginApi } from "@/services/AuthService";
import { Link, useRouter } from 'expo-router';
import { useAuthStore } from "@/stores/useAuthStore";
import { useAppTheme } from "@/hooks/useAppTheme";
import { BackButton } from "@/components/ui/IconButton";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/constants/i18n";

export default function LoginScreen() {
    const { colors, activeScheme } = useAppTheme();
    const { t, isRTL } = useTranslation();
    const styles = getStyles(colors, activeScheme, isRTL);
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

            const userData = response.user || response.data?.user || response;
            const token = response.token || response.data?.token;

            if (!token || !userData) {
               throw new Error("Invalid login response: Missing token or user data");
            }

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
                    setErrors({ general: e.response.data.message || t('error') });
                }
            } else {
                setErrors({ general: e.message || t('error') });
            }
        }
    }

    return (
        <SafeAreaView style={styles.wrapper}>
            <View style={{ position: 'absolute', top: 10, [isRTL ? 'right' : 'left']: 10, zIndex: 10 }}>
                <Link href={'/'} asChild>
                    <BackButton />
                </Link>
            </View>

            <View style={styles.headerIcon}>
                <Ionicons name="log-in-outline" size={40} color={colors.tint} />
            </View>

            <Text style={styles.title}>{t('login_btn')}</Text>
            <Text style={styles.subtitle}>{t('login_subtitle')}</Text>

            <View style={styles.container}>
                <FormTextField 
                    label={t('email_address') + ":"}
                    value={email}
                    onChangeText={(text) => setEmail(text)}
                    keyboardType="email-address"
                    errors={errors.email}
                />

                <FormTextField 
                    label={t('password') + ":"}
                    secureTextEntry={true}
                    value={password}
                    onChangeText={(text) => setPassword(text)}
                    keyboardType="default"
                    errors={errors.password}
                />

                {errors.general && (
                    <Text style={styles.errorText}>{errors.general}</Text>
                )}

                <TouchableOpacity style={styles.button} onPress={handleLogin}>
                    <Text style={styles.buttonText}>{t('login_btn')}</Text>
                </TouchableOpacity>

                <Link href={'/ForgotPasswordScreen'} asChild>
                    <TouchableOpacity>
                        <Text style={styles.forgotPasswordText}>{t('forgot_password')}</Text>
                    </TouchableOpacity>
                </Link>

                <View style={styles.loginLink}>
                    <Text style={{ color: colors.textSecondary }}>{t('no_account')}</Text>
                    <Link href="/RegisterScreen" asChild>
                        <TouchableOpacity>
                            <Text style={styles.linkText}>{t('register')}</Text>
                        </TouchableOpacity>
                    </Link>
                </View>
            </View>
        </SafeAreaView>
    );
}

function getStyles(colors: any, activeScheme: string, isRTL: boolean) {
  return StyleSheet.create({
    wrapper: {
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
    container: {
        width: '100%',
        maxWidth: 400,
        alignSelf: 'center',
    },
    errorText: {
        textAlign: 'center',
        marginBottom: 10,
        color: colors.error,
        fontWeight: '600',
    },
    button: {
        backgroundColor: colors.tint,
        height: 56,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 16,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '800',
    },
    forgotPasswordText: {
        color: colors.tint,
        fontSize: 15,
        marginTop: 16,
        textAlign: isRTL ? 'right' : 'center',
        fontWeight: '700',
    },
    loginLink: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        justifyContent: 'center',
        marginTop: 24,
        gap: 8,
    },
    linkText: {
        fontWeight: '700',
        color: colors.tint,
        fontSize: 15,
    },
  });
}