import React, { useState, useContext } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Alert,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '@/hooks/useAppTheme';
import { BackButton } from '@/components/ui/IconButton';
import AuthContext from '@/context/AuthContext';
import { t, LANGUAGES, setLocale, Locale, useTranslation } from '@/constants/i18n';
import axios from '@/services/axios';
import { useToastStore } from '@/stores/toastStore';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';

const LanguageScreen = () => {
    const { colors, activeScheme } = useAppTheme();
    const { user, setUser } = useContext(AuthContext);
    const { t, isRTL } = useTranslation();
    const { showToast } = useToastStore();
    const [loading, setLoading] = useState<string | null>(null);
    const styles = getStyles(colors, activeScheme, isRTL);

    const handleLanguageSelect = async (code: string) => {
        if (loading || user?.locale === code) return;

        setLoading(code);
        try {
            await setLocale(code as Locale);

            // Update backend
            await axios.post('/update-preferences', { locale: code });

            // Update local user state
            if (user) {
                setUser({ ...user, locale: code });
            }

            const selectedLang = LANGUAGES.find(l => l.code === code);
            showToast(t('save'), 'success');

            // Wait a bit for the toast to be visible then go back
            setTimeout(() => {
                router.back();
            }, 500);

        } catch (e) {
            console.error('Failed to update language:', e);
            showToast(t('failed_update'), 'error');
        } finally {
            setLoading(null);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.header}>
                <BackButton onPress={() => { if (router.canGoBack()) router.back(); else router.replace("/(tabs)"); }} />
                <Text style={[styles.headerTitle, { color: colors.text }]}>{t('language')}</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <MotiView
                    from={{ opacity: 0, translateY: 20 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{ type: 'timing', duration: 500 }}
                >
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' }]}>
                        {t('select_language')}
                    </Text>

                    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        {LANGUAGES.map((lang, index) => {
                            const isSelected = (user?.locale || 'en') === lang.code;
                            const isLast = index === LANGUAGES.length - 1;

                            return (
                                <TouchableOpacity
                                    key={lang.code}
                                    style={[
                                        styles.languageItem,
                                        !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border + '40' }
                                    ]}
                                    onPress={() => handleLanguageSelect(lang.code)}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.languageInfo}>
                                        <Text style={[styles.nativeLabel, { color: colors.text, textAlign: isRTL ? 'right' : 'left' }]}>
                                            {lang.native}
                                        </Text>
                                        <Text style={[styles.englishLabel, { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' }]}>
                                            {lang.label}
                                        </Text>
                                    </View>

                                    {loading === lang.code ? (
                                        <ActivityIndicator size="small" color={colors.tint} />
                                    ) : isSelected ? (
                                        <View style={[styles.radioActive, { backgroundColor: colors.tint }]}>
                                            <Ionicons name="checkmark" size={14} color="white" />
                                        </View>
                                    ) : (
                                        <View style={[styles.radioInactive, { borderColor: colors.border }]} />
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </MotiView>
            </ScrollView>
        </SafeAreaView>
    );
};

function getStyles(colors: any, activeScheme: string, isRTL: boolean) {
    return StyleSheet.create({
        container: {
            flex: 1,
        },
        header: {
            height: 60,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
        },
        headerTitle: {
            fontSize: 18,
            fontWeight: '800',
            letterSpacing: -0.5,
        },
        scrollContent: {
            padding: 20,
        },
        sectionTitle: {
            fontSize: 13,
            fontWeight: '700',
            textTransform: 'uppercase',
            marginBottom: 16,
            marginLeft: 4,
            letterSpacing: 1,
        },
        card: {
            borderRadius: 20,
            borderWidth: 1,
            overflow: 'hidden',
        },
        languageItem: {
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 18,
        },
        languageInfo: {
            flex: 1,
        },
        nativeLabel: {
            fontSize: 16,
            fontWeight: '700',
            marginBottom: 2,
        },
        englishLabel: {
            fontSize: 13,
        },
        radioActive: {
            width: 24,
            height: 24,
            borderRadius: 12,
            justifyContent: 'center',
            alignItems: 'center',
        },
        radioInactive: {
            width: 24,
            height: 24,
            borderRadius: 12,
            borderWidth: 2,
        },
    });
}

export default LanguageScreen;
