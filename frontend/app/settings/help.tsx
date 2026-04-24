// app/(settings)/HelpCenterScreen.tsx
import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    StatusBar,
    TextInput,
    Linking,
    Dimensions,
    Animated,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MotiView, AnimatePresence } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '@/components/ui/IconButton';
import { createShadow } from '@/utils/styles';
import Fuse from 'fuse.js';
import GlobalStyles from '@/styles/GlobalStyles';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/constants/i18n';

const { width } = Dimensions.get('window');

interface FAQ {
    question: string;
    answer: string;
    category: string;
    helpful: number;
}

const FAQItem = ({ faq, index, searchQuery }: { faq: FAQ; index: number; searchQuery: string }) => {
    const { t } = useTranslation();
    const { colors, activeScheme } = useAppTheme();
    const styles = getStyles(colors, activeScheme);
    const [isOpen, setIsOpen] = useState(false);
    const [helpful, setHelpful] = useState(faq.helpful);
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const rotateAnim = useRef(new Animated.Value(0)).current;

    const toggleOpen = () => {
        Animated.spring(scaleAnim, { toValue: 0.98, useNativeDriver: true, friction: 5 }).start();
        setIsOpen(!isOpen);
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 5 }).start();
        Animated.timing(rotateAnim, {
            toValue: isOpen ? 0 : 1,
            duration: 200,
            useNativeDriver: true,
        }).start();
    };

    const spin = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '180deg'],
    });

    const highlightText = (text: string, query: string) => {
        if (!query) return text;
        const regex = new RegExp(`(${query})`, 'gi');
        return text.split(regex).map((part, i) =>
            regex.test(part) ? `<mark>${part}</mark>` : part
        );
    };

    return (
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={toggleOpen}
                style={[styles.faqCard, isOpen && styles.faqCardOpen]}
            >
                <View style={styles.faqHeader}>
                    <View style={styles.faqHeaderLeft}>
                        <View style={styles.faqIcon}>
                            <Ionicons name="help-circle" size={20} color="#1063FD" />
                        </View>
                        <Text style={styles.faqQuestion}>{faq.question}</Text>
                    </View>
                    <Animated.View style={{ transform: [{ rotate: spin }] }}>
                        <Ionicons name="chevron-down" size={20} color="#666" />
                    </Animated.View>
                </View>

                <AnimatePresence>
                    {isOpen && (
                        <MotiView
                            from={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ type: 'timing', duration: 300 }}
                            style={styles.faqAnswerContainer}
                        >
                            <Text style={styles.faqAnswer}>{faq.answer}</Text>

                            <View style={styles.helpfulSection}>
                                <Text style={styles.helpfulLabel}>{t('help')}</Text>
                                <View style={styles.helpfulButtons}>
                                    <TouchableOpacity
                                        style={[styles.helpfulButton, helpful === 1 && { backgroundColor: activeScheme === 'dark' ? '#1b2e1b' : '#E8F5E9' }]}
                                        onPress={() => setHelpful(1)}
                                    >
                                        <Ionicons name="thumbs-up" size={14} color={helpful === 1 ? '#4CAF50' : colors.textSecondary} />
                                        <Text style={[styles.helpfulButtonText, helpful === 1 && { color: '#4CAF50' }]}>{t('save')}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.helpfulButton, helpful === 0 && { backgroundColor: activeScheme === 'dark' ? '#2e1b1b' : '#FFEBEE' }]}
                                        onPress={() => setHelpful(0)}
                                    >
                                        <Ionicons name="thumbs-down" size={14} color={helpful === 0 ? '#F44336' : colors.textSecondary} />
                                        <Text style={[styles.helpfulButtonText, helpful === 0 && { color: '#F44336' }]}>{t('logout')}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </MotiView>
                    )}
                </AnimatePresence>
            </TouchableOpacity>
        </Animated.View>
    );
};

export default function HelpCenterScreen() {
    const { t } = useTranslation();
    const { colors, activeScheme } = useAppTheme();
    const styles = getStyles(colors, activeScheme);
    const insets = useSafeAreaInsets();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState('all');
    const scrollY = useRef(new Animated.Value(0)).current;

    const faqs: FAQ[] = [
        { question: t('faq_q_app_guide'), answer: t('faq_a_app_guide'), category: "guide", helpful: 0 },
        { question: t('faq_q_spaces_types'), answer: t('faq_a_spaces_types'), category: "spaces", helpful: 0 },
        { question: t('faq_q_ai_assistant'), answer: t('faq_a_ai_assistant'), category: "spaces", helpful: 0 },
        { question: t('faq_q_schedule_activity'), answer: t('faq_a_schedule_activity'), category: "activities", helpful: 0 },
        { question: t('faq_q_privacy_vault'), answer: t('faq_a_privacy_vault'), category: "privacy", helpful: 0 },
        { question: t('faq_q_trust_score'), answer: t('faq_a_trust_score'), category: "privacy", helpful: 0 },
        { question: t('faq_q_storage_management'), answer: t('faq_a_storage_management'), category: "technical", helpful: 0 },
        { question: t('faq_q_dark_mode'), answer: t('faq_a_dark_mode'), category: "personalization", helpful: 0 },
        { question: t('faq_q_linked_devices'), answer: t('faq_a_linked_devices'), category: "security", helpful: 0 },
        { question: t('faq_q_report_content'), answer: t('faq_a_report_content'), category: "moderation", helpful: 0 },
        { question: t('faq_q_synchronicity'), answer: t('faq_a_synchronicity'), category: "features", helpful: 0 },
    ];

    const categories = [
        { id: 'all', label: t('all'), icon: 'apps' },
        { id: 'guide', label: t('tutorial'), icon: 'school' },
        { id: 'spaces', label: t('collaboration_spaces'), icon: 'people' },
        { id: 'activities', label: t('activities'), icon: 'calendar' },
        { id: 'privacy', label: t('privacy'), icon: 'lock-closed' },
        { id: 'security', label: t('profile_security'), icon: 'shield-checkmark' },
        { id: 'technical', label: t('storage'), icon: 'hardware-chip' },
        { id: 'personalization', label: t('personal'), icon: 'color-palette' },
        { id: 'moderation', label: t('moderation_panel'), icon: 'flag' },
        { id: 'features', label: t('upcoming_features'), icon: 'sparkles' },
    ];

    const fuse = new Fuse(faqs, {
        keys: ['question', 'answer', 'category'],
        threshold: 0.3,
    });

    const filteredFaqs = searchQuery
        ? fuse.search(searchQuery).map(result => result.item)
        : activeCategory === 'all'
            ? faqs
            : faqs.filter(faq => faq.category === activeCategory);

    const headerOpacity = scrollY.interpolate({
        inputRange: [0, 100],
        outputRange: [1, 0.9],
        extrapolate: 'clamp',
    });

    return (
        <View style={[styles.container, GlobalStyles.popupContainer]}>
            <StatusBar barStyle={activeScheme === 'dark' ? 'light-content' : 'dark-content'} />

            <LinearGradient
                colors={[colors.surface, colors.background]}
                style={[styles.header, { paddingTop: insets.top + 10 }]}
            >
                <BackButton onPress={() => router.back()} />
                <Text style={styles.headerTitle}>{t('help_center')}</Text>
                <View style={{ width: 40 }} />
            </LinearGradient>

            <Animated.ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                    { useNativeDriver: false }
                )}
                scrollEventThrottle={16}
            >
                <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }}>
                    <LinearGradient
                        colors={['#1063FD', '#0050CC']}
                        style={styles.heroSection}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <Text style={styles.heroTitle}>{t('help_center')}</Text>
                        <View style={styles.searchBar}>
                            <Ionicons name="search" size={20} color={colors.textSecondary} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder={t('search_placeholder')}
                                placeholderTextColor={colors.textSecondary}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                            {searchQuery !== '' && (
                                <TouchableOpacity onPress={() => setSearchQuery('')}>
                                    <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                                </TouchableOpacity>
                            )}
                        </View>
                        {searchQuery && (
                            <Text style={styles.searchResultText}>
                                {t('search')} {filteredFaqs.length}
                            </Text>
                        )}
                    </LinearGradient>

                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.categoryScroll}
                        contentContainerStyle={styles.categoryContainer}
                    >
                        {categories.map(cat => (
                            <TouchableOpacity
                                key={cat.id}
                                style={[
                                    styles.categoryChip,
                                    activeCategory === cat.id && styles.categoryChipActive
                                ]}
                                onPress={() => setActiveCategory(cat.id)}
                            >
                                <Ionicons
                                    name={cat.icon as any}
                                    size={14}
                                    color={activeCategory === cat.id ? '#fff' : colors.tint}
                                />
                                <Text style={[
                                    styles.categoryText,
                                    activeCategory === cat.id && styles.categoryTextActive
                                ]}>
                                    {cat.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    <View style={styles.faqSection}>
                        <Text style={styles.sectionTitle}>
                            {searchQuery ? t('search') : t('help_center')}
                        </Text>

                        {filteredFaqs.length === 0 ? (
                            <MotiView
                                from={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                style={styles.noResults}
                            >
                                <Ionicons name="search" size={48} color={colors.textSecondary + '40'} />
                                <Text style={styles.noResultsTitle}>{t('no_results_found')}</Text>
                                <Text style={styles.noResultsText}>
                                    {t('search_no_results_desc')}
                                </Text>
                            </MotiView>
                        ) : (
                            filteredFaqs.map((faq, index) => (
                                <FAQItem key={index} faq={faq} index={index} searchQuery={searchQuery} />
                            ))
                        )}
                    </View>

                    <View style={styles.contactSection}>
                        <Text style={styles.sectionTitle}>{t('contact')}</Text>
                        <View style={styles.contactRow}>
                            <TouchableOpacity
                                style={styles.contactCard}
                                onPress={() => Linking.openURL('mailto:support@zmzir.com')}
                            >
                                <LinearGradient
                                    colors={[colors.surface, colors.background]}
                                    style={styles.contactCardGradient}
                                >
                                    <View style={[styles.contactIcon, { backgroundColor: colors.tint + '15' }]}>
                                        <Ionicons name="mail" size={24} color={colors.tint} />
                                    </View>
                                    <Text style={styles.contactLabel}>{t('contact_support_email')}</Text>
                                    <Text style={styles.contactDescription}>{t('contact_support_desc')}</Text>
                                </LinearGradient>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.contactCard}
                                onPress={() => router.push('/(tabs)/chatbot')}
                            >
                                <LinearGradient
                                    colors={[colors.surface, colors.background]}
                                    style={styles.contactCardGradient}
                                >
                                    <View style={[styles.contactIcon, { backgroundColor: '#4CAF5015' }]}>
                                        <Ionicons name="chatbubbles" size={24} color="#4CAF50" />
                                    </View>
                                    <Text style={styles.contactLabel}>{t('ai_assistant_help')}</Text>
                                    <Text style={styles.contactDescription}>{t('ai_assistant_desc')}</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.footer}>
                        <Text style={styles.versionText}>
                            {t('app_version_build', { version: '2.4.0', build: '890' })}
                        </Text>
                        <View style={styles.linkRow}>
                            <TouchableOpacity onPress={() => Linking.openURL('https://zmzir.com/terms')}>
                                <Text style={styles.footerLink}>{t('privacy')}</Text>
                            </TouchableOpacity>
                            <Text style={styles.footerDot}>•</Text>
                            <TouchableOpacity onPress={() => Linking.openURL('https://zmzir.com/privacy')}>
                                <Text style={styles.footerLink}>{t('privacy')}</Text>
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity style={styles.feedbackButton} onPress={() => Linking.openURL('mailto:support@zmzir.com?subject=App%20Feedback&body=Hi%20Zmzir%20Team%2C%0A%0A')}>
                            <Text style={styles.feedbackText}>{t('feedback_msg')}</Text>
                        </TouchableOpacity>
                    </View>
                </MotiView>
            </Animated.ScrollView>
        </View>
    );
}

function getStyles(colors: any, activeScheme: string) {
    return StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingBottom: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        headerTitle: { fontSize: 22, fontWeight: '800', color: colors.text },
        backButton: {
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.surface,
            justifyContent: 'center',
            alignItems: 'center',
        },
        scrollContent: { paddingBottom: 100 },
        heroSection: {
            padding: 28,
            marginHorizontal: 20,
            marginTop: 10,
            marginBottom: 20,
            borderRadius: 30,
            ...createShadow({ opacity: 0.2, height: 8, radius: 16 }),
        },
        heroTitle: {
            fontSize: 24,
            fontWeight: '900',
            color: '#fff',
            marginBottom: 20,
        },
        searchBar: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface,
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderRadius: 25,
            gap: 8,
        },
        searchInput: {
            flex: 1,
            fontSize: 15,
            fontWeight: '500',
            color: colors.text,
            ...Platform.select({
                web: { outlineStyle: 'none' } as any
            }),
        },
        searchResultText: {
            color: 'rgba(255,255,255,0.8)',
            fontSize: 12,
            marginTop: 12,
            textAlign: 'center',
        },
        categoryScroll: {
            maxHeight: 50,
            marginBottom: 20,
        },
        categoryContainer: {
            paddingHorizontal: 20,
            gap: 8,
        },
        categoryChip: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface,
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 25,
            gap: 6,
        },
        categoryChipActive: {
            backgroundColor: colors.tint,
        },
        categoryText: {
            fontSize: 13,
            fontWeight: '600',
            color: colors.tint,
        },
        categoryTextActive: {
            color: '#fff',
        },
        faqSection: {
            paddingHorizontal: 20,
        },
        sectionTitle: {
            fontSize: 13,
            fontWeight: '800',
            color: colors.tint,
            textTransform: 'uppercase',
            letterSpacing: 1.5,
            marginBottom: 15,
        },
        faqCard: {
            backgroundColor: colors.surface,
            borderRadius: 20,
            padding: 18,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: colors.border,
            ...createShadow({ opacity: 0.05, radius: 8 }),
        },
        faqCardOpen: {
            borderColor: colors.tint,
            ...createShadow({ opacity: 0.1, radius: 12 }),
        },
        faqHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
        },
        faqHeaderLeft: {
            flexDirection: 'row',
            alignItems: 'center',
            flex: 1,
            gap: 10,
        },
        faqIcon: {
            width: 32,
            height: 32,
            borderRadius: 10,
            backgroundColor: colors.tint + '10',
            justifyContent: 'center',
            alignItems: 'center',
        },
        faqQuestion: {
            fontSize: 15,
            fontWeight: '700',
            color: colors.text,
            flex: 1,
            lineHeight: 20,
        },
        faqAnswerContainer: {
            marginTop: 15,
            borderTopWidth: 1,
            borderTopColor: 'rgba(0,0,0,0.05)',
            paddingTop: 15,
        },
        faqAnswer: {
            fontSize: 14,
            color: colors.textSecondary,
            lineHeight: 20,
        },
        helpfulSection: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 15,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: colors.border,
        },
        helpfulLabel: {
            fontSize: 12,
            color: colors.textSecondary,
        },
        helpfulButtons: {
            flexDirection: 'row',
            gap: 8,
        },
        helpfulButton: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 15,
            gap: 4,
            backgroundColor: colors.background,
        },
        helpfulButtonActive: {
            backgroundColor: '#E8F5E9',
        },
        helpfulButtonText: {
            fontSize: 11,
            color: '#999',
            fontWeight: '600',
        },
        noResults: {
            alignItems: 'center',
            paddingVertical: 40,
        },
        noResultsTitle: {
            fontSize: 16,
            fontWeight: '600',
            color: colors.text,
            marginTop: 12,
            marginBottom: 4,
        },
        noResultsText: {
            fontSize: 13,
            color: colors.textSecondary,
            textAlign: 'center',
        },
        contactSection: {
            paddingHorizontal: 20,
            marginTop: 20,
        },
        contactRow: {
            flexDirection: 'row',
            gap: 12,
        },
        contactCard: {
            flex: 1,
            borderRadius: 20,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: colors.border,
        },
        contactCardGradient: {
            padding: 20,
            alignItems: 'center',
        },
        contactIcon: {
            width: 56,
            height: 56,
            borderRadius: 28,
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 12,
        },
        contactLabel: {
            fontSize: 15,
            fontWeight: '800',
            color: colors.text,
            marginBottom: 4,
        },
        contactDescription: {
            fontSize: 11,
            color: colors.textSecondary,
        },
        footer: {
            marginTop: 60,
            alignItems: 'center',
            paddingBottom: 40,
        },
        versionText: {
            fontSize: 12,
            fontWeight: '700',
            color: colors.textSecondary + '60',
            marginBottom: 10,
        },
        linkRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            marginBottom: 15,
        },
        footerLink: {
            fontSize: 13,
            color: colors.tint,
            fontWeight: '700'
        },
        footerDot: {
            color: colors.textSecondary + '40',
            fontSize: 12,
        },
        feedbackButton: {
            paddingVertical: 8,
            paddingHorizontal: 16,
        },
        feedbackText: {
            fontSize: 12,
            color: colors.textSecondary,
            fontWeight: '600',
        },
    });
}