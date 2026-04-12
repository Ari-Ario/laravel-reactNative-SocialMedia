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

const { width } = Dimensions.get('window');

interface FAQ {
    question: string;
    answer: string;
    category: string;
    helpful: number;
}

const FAQItem = ({ faq, index, searchQuery }: { faq: FAQ; index: number; searchQuery: string }) => {
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
                                <Text style={styles.helpfulLabel}>Was this helpful?</Text>
                                <View style={styles.helpfulButtons}>
                                    <TouchableOpacity
                                        style={[styles.helpfulButton, helpful === 1 && { backgroundColor: activeScheme === 'dark' ? '#1b2e1b' : '#E8F5E9' }]}
                                        onPress={() => setHelpful(1)}
                                    >
                                        <Ionicons name="thumbs-up" size={14} color={helpful === 1 ? '#4CAF50' : colors.textSecondary} />
                                        <Text style={[styles.helpfulButtonText, helpful === 1 && { color: '#4CAF50' }]}>Yes</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.helpfulButton, helpful === 0 && { backgroundColor: activeScheme === 'dark' ? '#2e1b1b' : '#FFEBEE' }]}
                                        onPress={() => setHelpful(0)}
                                    >
                                        <Ionicons name="thumbs-down" size={14} color={helpful === 0 ? '#F44336' : colors.textSecondary} />
                                        <Text style={[styles.helpfulButtonText, helpful === 0 && { color: '#F44336' }]}>No</Text>
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
    const { colors, activeScheme } = useAppTheme();
    const styles = getStyles(colors, activeScheme);
    const insets = useSafeAreaInsets();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState('all');
    const scrollY = useRef(new Animated.Value(0)).current;

    const faqs: FAQ[] = [
        { question: "How do I make my account private?", answer: "Go to Settings > Privacy Vault and toggle 'Private Account' on. This limits your posts to approved followers only. You can also manage muted keywords and blocked users from the same section.", category: "privacy", helpful: 0 },
        { question: "How do I clear my local storage?", answer: "Navigate to Settings > Storage Manager. Tap 'Clear' in the Cache Management section. You can also configure auto-cleanup intervals (Monthly) and set media quality preferences.", category: "technical", helpful: 0 },
        { question: "Can I manage multiple devices?", answer: "Yes! In Settings > Linked Devices (Active Sessions), you can see all logged-in sessions, view device type (iOS, Android, Web), and revoke access remotely. Sessions update in real-time.", category: "security", helpful: 0 },
        { question: "How to report inappropriate content?", answer: "Tap the three-dot menu on any post, comment, or message and select 'Report'. Choose the reason and submit. Our AI moderation system reviews reports within 24 hours.", category: "moderation", helpful: 0 },
        { question: "How to enable dark mode?", answer: "Go to Settings > Account Identity > and look for theme preferences. You can choose between Light, Dark, or System default. Changes apply immediately across the app.", category: "personalization", helpful: 0 },
        { question: "What are Collaboration Spaces?", answer: "Spaces are persistent collaboration hubs that support real-time messaging, video/audio calls, whiteboards, polls, and AI-powered suggestions. Create a Space from the main + button on your home screen.", category: "features", helpful: 0 },
        { question: "How does the AI chatbot work?", answer: "The built-in AI Assistant understands natural language questions about Zmzir features. Access it via the Chatbot tab or from Help > AI Assistant. It's available 24/7 and learns from interactions.", category: "features", helpful: 0 },
        { question: "What is Synchronicity?", answer: "Synchronicity is Zmzir's collaborative matching system. It analyzes collaboration styles, synergy traits, and interaction patterns to suggest ideal collaborators and enhance teamwork in Spaces.", category: "features", helpful: 0 },
        { question: "How do broadcast lists work?", answer: "Broadcast lists (Settings > Broadcasts) let you send messages to multiple people simultaneously without creating a group chat. Each recipient sees messages as individual direct messages only.", category: "features", helpful: 0 },
        { question: "How do I star important messages?", answer: "Long-press any message in a Space or direct conversation and select 'Star'. All starred messages are accessible from Settings > Starred Messages for quick reference across all your devices.", category: "features", helpful: 0 },
        { question: "How does calling work across devices?", answer: "Zmzir supports audio and video calls within Spaces using WebRTC. Calls work on mobile browsers and native apps. For best quality, use a stable Wi-Fi connection. TURN relay servers ensure calls work even on restrictive networks.", category: "technical", helpful: 0 },
        { question: "How do I change my notification preferences?", answer: "Go to Settings and look for notification controls. You can toggle email and push notifications separately. Device-specific notification tokens are managed automatically per device.", category: "technical", helpful: 0 },
        { question: "What data does Zmzir store about me?", answer: "Zmzir stores your profile information (name, email, bio, social links), content (posts, stories, messages), and usage preferences. You can export or delete your account from Settings > Account Identity at any time.", category: "privacy", helpful: 0 },
    ];

    const categories = [
        { id: 'all', label: 'All', icon: 'apps' },
        { id: 'privacy', label: 'Privacy', icon: 'lock-closed' },
        { id: 'technical', label: 'Technical', icon: 'hardware-chip' },
        { id: 'security', label: 'Security', icon: 'shield-checkmark' },
        { id: 'moderation', label: 'Moderation', icon: 'flag' },
        { id: 'personalization', label: 'Personalization', icon: 'color-palette' },
        { id: 'features', label: 'Features', icon: 'sparkles' },
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
                <Text style={styles.headerTitle}>Support Center</Text>
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
                    {/* Hero Search Section */}
                    <LinearGradient
                        colors={['#1063FD', '#0050CC']}
                        style={styles.heroSection}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <Text style={styles.heroTitle}>How can we help?</Text>
                        <View style={styles.searchBar}>
                            <Ionicons name="search" size={20} color={colors.textSecondary} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search for help articles..."
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
                                Found {filteredFaqs.length} {filteredFaqs.length === 1 ? 'result' : 'results'}
                            </Text>
                        )}
                    </LinearGradient>

                    {/* Category Filters */}
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

                    {/* FAQ Section */}
                    <View style={styles.faqSection}>
                        <Text style={styles.sectionTitle}>
                            {searchQuery ? 'Search Results' : 'Frequently Asked Questions'}
                        </Text>

                        {filteredFaqs.length === 0 ? (
                            <MotiView
                                from={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                style={styles.noResults}
                            >
                                <Ionicons name="search" size={48} color={colors.textSecondary + '40'} />
                                <Text style={styles.noResultsTitle}>No results found</Text>
                                <Text style={styles.noResultsText}>
                                    Try different keywords or browse categories
                                </Text>
                            </MotiView>
                        ) : (
                            filteredFaqs.map((faq, index) => (
                                <FAQItem key={index} faq={faq} index={index} searchQuery={searchQuery} />
                            ))
                        )}
                    </View>

                    {/* Contact Section */}
                    <View style={styles.contactSection}>
                        <Text style={styles.sectionTitle}>Still need help?</Text>
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
                                    <Text style={styles.contactLabel}>Email Support</Text>
                                    <Text style={styles.contactDescription}>Response within 24h</Text>
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
                                    <Text style={styles.contactLabel}>AI Assistant</Text>
                                    <Text style={styles.contactDescription}>Instant answers 24/7</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Footer */}
                    <View style={styles.footer}>
                        <Text style={styles.versionText}>Application Version 2.4.0 (Build 890)</Text>
                        <View style={styles.linkRow}>
                            <TouchableOpacity onPress={() => Linking.openURL('https://zmzir.com/terms')}>
                                <Text style={styles.footerLink}>Terms of Service</Text>
                            </TouchableOpacity>
                            <Text style={styles.footerDot}>•</Text>
                            <TouchableOpacity onPress={() => Linking.openURL('https://zmzir.com/privacy')}>
                                <Text style={styles.footerLink}>Privacy Policy</Text>
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity style={styles.feedbackButton} onPress={() => Linking.openURL('mailto:support@zmzir.com?subject=App%20Feedback&body=Hi%20Zmzir%20Team%2C%0A%0A')}>
                            <Text style={styles.feedbackText}>✉️ Send Feedback</Text>
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
        borderBottomWidth:1,
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
        outlineStyle: 'none',
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