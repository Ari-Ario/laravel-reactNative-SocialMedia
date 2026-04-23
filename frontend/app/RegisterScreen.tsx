// app/RegisterScreen.tsx
import React, { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    Button,
    Alert,
    Platform,
    TouchableOpacity
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Localization from 'expo-localization';
import { SafeAreaView } from 'react-native-safe-area-context';

import FormTextField from "@/components/FormTextField";
import { register } from "@/services/AuthService";
import { Link, router } from 'expo-router';
import { setToken } from "@/services/TokenService"; // Add this import
import AuthContext from "@/context/AuthContext";
import { useContext } from "react";
import { useAppTheme } from "@/hooks/useAppTheme";
import { BackButton } from "@/components/ui/IconButton";
import { useTranslation } from "@/constants/i18n";

const RegisterUser: React.FC = () => {
    const { colors, activeScheme } = useAppTheme();
    const { t, isRTL } = useTranslation();
    const styles = getStyles(colors, activeScheme, isRTL);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [passwordConfirmation, setPasswordConfirmation] = useState("");
    const [errors, setErrors] = useState<any>({});
    const [loading, setLoading] = useState(false);

    const { setUser } = useContext(AuthContext);

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
                locale: Localization.getLocales()[0]?.languageCode || 'en',
            });

            if (response.token) {
                await setToken(response.token);
            }

            if (response.user) {
                setUser(response.user);
            }

            if (response.requires_verification && response.user_id) {
                router.push({
                    pathname: '/VerificationScreen',
                    params: {
                        userId: String(response.user_id),
                        email: email,
                        token: response.token,
                        user: JSON.stringify(response.user)
                    }
                });
            } else if (response.token && response.user.email_verified_at) {
                router.replace('/(tabs)');
            }

            setName("");
            setEmail("");
            setPassword("");
            setPasswordConfirmation("");

        } catch (e: any) {
            if (e.response?.status === 422) {
                setErrors(e.response.data.errors || {});
            } else if (e.response?.data?.message) {
                setErrors({ general: e.response.data.message });
            } else {
                setErrors({ general: t('error') });
            }
        } finally {
            setLoading(false);
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
                <Ionicons name="person-add-outline" size={40} color={colors.tint} />
            </View>

            <Text style={styles.title}>{t('create_account')}</Text>
            <Text style={styles.subtitle}>{t('register_subtitle')}</Text>

            <View style={styles.container}>
                <FormTextField
                    label={t('name') + ":"}
                    value={name}
                    onChangeText={(text) => setName(text)}
                    errors={errors.name}
                />

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
                    errors={errors.password}
                />

                <FormTextField
                    label={t('confirm_password') + ":"}
                    secureTextEntry={true}
                    value={passwordConfirmation}
                    onChangeText={(text) => setPasswordConfirmation(text)}
                    errors={errors.password_confirmation}
                />

                {errors.general && (
                    <Text style={styles.errorText}>{errors.general}</Text>
                )}

                <TouchableOpacity 
                    style={[styles.button, loading && { opacity: 0.7 }]} 
                    onPress={handleRegister}
                    disabled={loading}
                >
                    <Text style={styles.buttonText}>{loading ? t('registering') : t('register')}</Text>
                </TouchableOpacity>

                <View style={styles.loginLink}>
                    <Text style={{ color: colors.textSecondary }}>{t('already_account')}</Text>
                    <Link href="/LoginScreen" asChild>
                        <TouchableOpacity>
                            <Text style={styles.linkText}>{t('login_btn')}</Text>
                        </TouchableOpacity>
                    </Link>
                </View>
            </View>
        </SafeAreaView>
    );
};


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

export default RegisterUser;