// app/settings/TellFriend.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    ScrollView,
    TextInput,
    Image,
    Platform,
    Alert,
    ActivityIndicator,
    Share,
    Linking,
    Dimensions,
    Animated,
    StatusBar,
    KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import * as Contacts from 'expo-contacts';
import * as MailComposer from 'expo-mail-composer';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { createShadow } from '@/utils/styles';
import AuthContext from '@/context/AuthContext';
import { fetchUserByEmail, followUser, sendEmailInvitation } from '@/services/UserService';
import getApiBaseImage from '@/services/getApiBaseImage';
import { useProfileView } from '@/context/ProfileViewContext';
import SearchService from '@/services/ChatScreen/SearchServiceChat';

const { width } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

interface Contact {
    id: string;
    name: string;
    phoneNumbers?: Array<{ number: string }>;
    emails?: Array<{ email: string }>;
    imageAvailable?: boolean;
    image?: any;
}

interface SocialLink {
    platform: string;
    url: string;
    icon: string;
    color: string;
}

const SOCIAL_PLATFORMS: SocialLink[] = [
    { platform: 'WhatsApp', url: 'https://wa.me/', icon: 'logo-whatsapp', color: '#25D366' },
    { platform: 'Telegram', url: 'https://t.me/share/url?url=', icon: 'logo-telegram', color: '#0088cc' },
    { platform: 'Twitter', url: 'https://twitter.com/intent/tweet?text=', icon: 'logo-twitter', color: '#1DA1F2' },
    { platform: 'Facebook', url: 'https://www.facebook.com/sharer/sharer.php?u=', icon: 'logo-facebook', color: '#1877F2' },
    { platform: 'Instagram', url: 'https://www.instagram.com/', icon: 'logo-instagram', color: '#E4405F' },
    { platform: 'LinkedIn', url: 'https://www.linkedin.com/sharing/share-offsite/?url=', icon: 'logo-linkedin', color: '#0077B5' },
    { platform: 'Email', url: 'mailto:', icon: 'mail', color: '#EA4335' },
    { platform: 'SMS', url: 'sms:', icon: 'chatbubble', color: '#34B7F1' },
];

const APP_STORE_LINKS = {
    web: 'https://zmzir.com',
};

const SHARE_MESSAGE = `🚀 Join me on Zmzir - The Ultimate Social Platform!

Hey! I've been using Zmzir and it's amazing. You can:
✨ Share moments with photos and videos
💬 Chat with friends in real-time
🎨 Customize your profile
🔒 Control your privacy

Download now: ${APP_STORE_LINKS.web}

See you there! 👋`;

export default function TellFriendScreen() {
    const insets = useSafeAreaInsets();
    const { user } = React.useContext(AuthContext);
    const { setProfileViewUserId, setProfilePreviewVisible } = useProfileView();
    const searchService = SearchService.getInstance();
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [activeTab, setActiveTab] = useState<'contacts' | 'social' | 'search' | 'invite'>('contacts');
    const [inviteEmail, setInviteEmail] = useState('');
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loadingContacts, setLoadingContacts] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);
    const [sendingInvite, setSendingInvite] = useState(false);
    const [customMessage, setCustomMessage] = useState(SHARE_MESSAGE);

    const scrollY = useRef(new Animated.Value(0)).current;
    const confettiAnim = useRef(new Animated.Value(0)).current;

    // Load contacts on mount or tab change
    useEffect(() => {
        if (activeTab === 'contacts') {
            loadContacts();
        }
    }, [activeTab]);

    const loadContacts = async () => {
        if (isWeb) {
            // Silence alert on web if just switching tabs, but show if they click it
            return;
        }

        try {
            setLoadingContacts(true);
            const { status } = await Contacts.requestPermissionsAsync();
            if (status === 'granted') {
                const { data } = await Contacts.getContactsAsync({
                    fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails, Contacts.Fields.Image],
                });
                setContacts(data);
            }
        } catch (error) {
            console.error('Error loading contacts:', error);
        } finally {
            setLoadingContacts(false);
        }
    };

    const handleSocialShare = async (platform: SocialLink, targetContact?: Contact) => {
        try {
            let url = platform.url;
            let message = customMessage;

            if (platform.platform === 'WhatsApp') {
                if (targetContact?.phoneNumbers?.[0]) {
                    const phone = targetContact.phoneNumbers[0].number.replace(/[^0-9]/g, '');
                    url += phone + '?text=' + encodeURIComponent(message);
                } else {
                    url = `https://wa.me/?text=${encodeURIComponent(message)}`;
                }
            } else if (platform.platform === 'SMS' && targetContact?.phoneNumbers?.[0]) {
                const phone = targetContact.phoneNumbers[0].number;
                url += phone + (Platform.OS === 'ios' ? '&' : '?') + 'body=' + encodeURIComponent(message);
            } else if (platform.platform === 'Email' && targetContact?.emails?.[0]) {
                const email = targetContact.emails[0].email;
                if (!isWeb) {
                    await MailComposer.composeAsync({
                        recipients: [email],
                        subject: 'Join me on Zmzir!',
                        body: message,
                    });
                    return;
                }
                url += email + '?subject=Join me on Zmzir!&body=' + encodeURIComponent(message);
            } else if (platform.platform === 'Facebook' || platform.platform === 'LinkedIn') {
                // These platforms expect a URL, not pure text
                url += encodeURIComponent(APP_STORE_LINKS.web);
                // On mobile, native share is better for including the full text
                if (!isWeb) {
                    await Share.share({ message: message, url: APP_STORE_LINKS.web, title: 'Join me on Zmzir' });
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    return;
                }
            } else if (platform.platform === 'Twitter' || platform.platform === 'Telegram') {
                url += encodeURIComponent(message);
            } else if (platform.platform === 'Instagram') {
                // Instagram usually requires native share for stories/posts
                if (!isWeb) {
                    await Share.share({ message: message, url: APP_STORE_LINKS.web });
                    return;
                }
                url = platform.url; // Just open the site
            } else {
                url += encodeURIComponent(message);
            }

            const canOpen = await Linking.canOpenURL(url);
            if (canOpen) {
                await Linking.openURL(url);
                if (!isWeb) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } else {
                await Share.share({ message, title: 'Join me on Zmzir' });
            }
        } catch (error) {
            console.error('Share failed:', error);
            // Fallback to general share
            await Share.share({ message: customMessage, title: 'Join me on Zmzir' });
        }
    };

    // Debounced global search — same pattern as chats/index.tsx
    const handleSearchUser = async (query: string) => {
        if (query.length < 2) {
            setSearchResults([]);
            setSearching(false);
            return;
        }
        setSearching(true);
        try {
            const results = await searchService.searchAll(query, user?.id || '');
            // Filter out current user and map to a flat list
            setSearchResults(
                results
                    .filter(r => r.data?.id?.toString() !== user?.id?.toString())
                    .map(r => ({
                        id: r.data?.id || r.id,
                        name: r.title,
                        username: r.data?.username || r.description || '',
                        profile_photo: r.avatar || r.data?.profile_photo || '',
                        user_id: r.data?.id?.toString() || r.id,
                        is_following: r.data?.is_following || false,
                    }))
            );
        } catch (error) {
            setSearchResults([]);
        } finally {
            setSearching(false);
        }
    };

    const debouncedSearch = (query: string) => {
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        searchTimerRef.current = setTimeout(() => { handleSearchUser(query); }, 300);
    };


    const handleSendInvite = async () => {
        if (!inviteEmail || !inviteEmail.includes('@')) {
            Alert.alert('Invalid Email', 'Please enter a valid email address.');
            return;
        }

        setSendingInvite(true);
        try {
            const response = await sendEmailInvitation(inviteEmail, customMessage);
            if (response.success) {
                // Animate confetti
                Animated.sequence([
                    Animated.timing(confettiAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
                    Animated.timing(confettiAnim, { toValue: 0, duration: 500, delay: 1000, useNativeDriver: true }),
                ]).start();

                Alert.alert('Invitation Sent!', `We've sent a premium invitation to ${inviteEmail}.`);
                setInviteEmail('');
                if (!isWeb) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } else {
                Alert.alert('Error', response.message || 'Failed to send invitation');
            }
        } catch (error) {
            Alert.alert('Error', 'Could not send invite. Please try again later.');
        } finally {
            setSendingInvite(false);
        }
    };

    const tabs = [
        { id: 'contacts', label: 'Contacts', icon: 'people', color: '#4CAF50' },
        { id: 'social', label: 'Social', icon: 'share-social', color: '#1DA1F2' },
        { id: 'search', label: 'Search', icon: 'search', color: '#FF9800' },
        { id: 'invite', label: 'Invite', icon: 'mail', color: '#1063FD' },
    ];

    const TabButton = ({ tab }: { tab: typeof tabs[0] }) => (
        <TouchableOpacity
            style={[styles.tabButton, activeTab === tab.id && styles.tabButtonActive]}
            onPress={() => setActiveTab(tab.id as any)}
        >
            <LinearGradient
                colors={activeTab === tab.id ? [tab.color, tab.color + '80'] : ['transparent', 'transparent']}
                style={styles.tabButtonGradient}
            >
                <Ionicons
                    name={tab.icon as any}
                    size={18}
                    color={activeTab === tab.id ? '#fff' : tab.color}
                />
                <Text style={[styles.tabLabel, activeTab === tab.id && styles.tabLabelActive]}>
                    {tab.label}
                </Text>
            </LinearGradient>
        </TouchableOpacity>
    );

    const ContactCard = ({ contact }: { contact: Contact }) => (
        <MotiView
            from={{ opacity: 0, translateX: -20 }}
            animate={{ opacity: 1, translateX: 0 }}
            style={styles.contactCard}
        >
            <View style={styles.contactAvatar}>
                {contact.imageAvailable && contact.image ? (
                    <Image source={{ uri: contact.image?.uri }} style={styles.contactImage} />
                ) : (
                    <LinearGradient colors={['#1063FD', '#00c6ff']} style={styles.contactInitials}>
                        <Text style={styles.contactInitial}>{contact.name?.charAt(0) || '?'}</Text>
                    </LinearGradient>
                )}
            </View>
            <View style={styles.contactInfo}>
                <Text style={styles.contactName}>{contact.name}</Text>
                {contact.phoneNumbers?.[0] && <Text style={styles.contactDetail}>{contact.phoneNumbers[0].number}</Text>}
                {contact.emails?.[0] && <Text style={styles.contactDetail}>{contact.emails[0].email}</Text>}
            </View>
            <View style={styles.contactActions}>
                {contact.phoneNumbers?.[0] && (
                    <TouchableOpacity
                        style={styles.contactAction}
                        onPress={() => handleSocialShare(SOCIAL_PLATFORMS.find(p => p.platform === 'WhatsApp')!, contact)}
                    >
                        <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
                    </TouchableOpacity>
                )}
                {contact.emails?.[0] && (
                    <TouchableOpacity
                        style={styles.contactAction}
                        onPress={() => {
                            setInviteEmail(contact.emails![0].email);
                            setActiveTab('invite');
                        }}
                    >
                        <Ionicons name="mail" size={20} color="#1063FD" />
                    </TouchableOpacity>
                )}
            </View>
        </MotiView>
    );

    const SocialButton = ({ platform }: { platform: SocialLink }) => (
        <TouchableOpacity
            style={[styles.socialButton, { backgroundColor: platform.color + '15' }]}
            onPress={() => handleSocialShare(platform)}
        >
            <LinearGradient colors={[platform.color, platform.color + '80']} style={styles.socialIconGradient}>
                <Ionicons name={platform.icon as any} size={24} color="#fff" />
            </LinearGradient>
            <Text style={[styles.socialName, { color: platform.color }]}>{platform.platform}</Text>
        </TouchableOpacity>
    );

    const SearchResultCard = ({ result }: { result: any }) => {
        const [isFollowing, setIsFollowing] = useState(result.is_following || false);
        const [loading, setLoading] = useState(false);

        const handleToggleFollow = async () => {
            if (loading) return;
            setLoading(true);
            const action = isFollowing ? 'unfollow' : 'follow';
            try {
                await followUser(result.id, action);
                setIsFollowing(!isFollowing);
                if (!isWeb) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (error) {
                Alert.alert('Error', `Could not ${action} user`);
            } finally {
                setLoading(false);
            }
        };

        const handleOpenProfile = () => {
            // Use the same ProfilePreview pattern as chats/index.tsx
            setProfileViewUserId(result.id?.toString() || result.user_id?.toString());
            setProfilePreviewVisible(true);
        };

        const initials = (result.name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
        const avatarColors = ['#1063FD', '#4CAF50', '#FF9800', '#9C27B0', '#F44336', '#00BCD4'];
        const avatarColor = avatarColors[(result.name?.charCodeAt(0) || 0) % avatarColors.length];

        return (
            <MotiView from={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={styles.searchResultCard}>
                <TouchableOpacity onPress={handleOpenProfile} activeOpacity={0.7} style={styles.searchResultTouchable}>
                    {result.profile_photo ? (
                        <Image
                            source={{ uri: `${getApiBaseImage()}/storage/${result.profile_photo}` }}
                            style={styles.searchAvatar}
                        />
                    ) : (
                        <LinearGradient colors={[avatarColor, avatarColor + '99']} style={styles.searchAvatar}>
                            <Text style={styles.searchAvatarInitials}>{initials}</Text>
                        </LinearGradient>
                    )}
                    <View style={styles.searchInfo}>
                        <Text style={styles.searchName}>{result.name}</Text>
                        <Text style={styles.searchUsername}>@{result.username}</Text>
                    </View>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.followButton, isFollowing && styles.unfollowButton]}
                    onPress={handleToggleFollow}
                    disabled={loading}
                >
                    <LinearGradient 
                        colors={isFollowing ? ['#ff4b2b', '#ff416c'] : ['#1063FD', '#0050CC']} 
                        style={styles.followButtonGradient}
                    >
                        {loading ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Text style={styles.followButtonText}>{isFollowing ? 'Unfollow' : 'Follow'}</Text>
                        )}
                    </LinearGradient>
                </TouchableOpacity>
            </MotiView>
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={StyleSheet.absoluteFill} />
            <BlurView intensity={20} style={StyleSheet.absoluteFill} />

            {/* Header */}
            <LinearGradient colors={['rgba(0,0,0,0.3)', 'transparent']} style={[styles.header, { paddingTop: insets.top + 10 }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>Invite Friends</Text>
                    <View style={styles.headerUnderline} />
                </View>
                <View style={{ width: 44 }} />
            </LinearGradient>

            {/* Hero Section */}
            <MotiView from={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={styles.heroSection}>
                <LinearGradient colors={['#1063FD', '#00c6ff']} style={styles.heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <View style={styles.heroIcon}><Ionicons name="gift" size={40} color="#fff" /></View>
                    <Text style={styles.heroTitle}>Invite & Connect</Text>
                    <Text style={styles.heroSubtitle}>Bring your friends to Zmzir and build your community together.</Text>
                </LinearGradient>
            </MotiView>

            {/* Tabs */}
            <View style={styles.tabsWrapper}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContainer}>
                    {tabs.map(tab => <TabButton key={tab.id} tab={tab} />)}
                </ScrollView>
            </View>

            {/* Content */}
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {activeTab === 'contacts' && (
                    <MotiView from={{ opacity: 0, translateY: 20 }} animate={{ opacity: 1, translateY: 0 }}>
                        {loadingContacts ? (
                            <ActivityIndicator size="large" color="#1063FD" style={{ marginTop: 40 }} />
                        ) : contacts.length === 0 ? (
                            <View style={styles.emptyContainer}>
                                <Ionicons name="people" size={60} color="rgba(255,255,255,0.2)" />
                                <Text style={styles.emptyTitle}>{isWeb ? 'Not Available on Web' : 'No contacts found'}</Text>
                                <Text style={styles.emptyText}>{isWeb ? 'Please use the Social or Invite tabs for sharing.' : 'Allow contact access to invite friends directly.'}</Text>
                                {!isWeb && <TouchableOpacity style={styles.allowButton} onPress={loadContacts}><Text style={styles.allowButtonText}>Allow Access</Text></TouchableOpacity>}
                            </View>
                        ) : (
                            contacts.map(contact => <ContactCard key={contact.id} contact={contact} />)
                        )}
                    </MotiView>
                )}

                {activeTab === 'social' && (
                    <MotiView from={{ opacity: 0, translateY: 20 }} animate={{ opacity: 1, translateY: 0 }} style={styles.socialGrid}>
                        {SOCIAL_PLATFORMS.map(platform => <SocialButton key={platform.platform} platform={platform} />)}
                    </MotiView>
                )}

                {activeTab === 'search' && (
                    <MotiView from={{ opacity: 0, translateY: 20 }} animate={{ opacity: 1, translateY: 0 }}>
                        <View style={styles.inputWrapper}>
                            <Ionicons name="search-outline" size={20} color="#FF9800" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Search by name, username or email..."
                                placeholderTextColor="rgba(255,255,255,0.3)"
                                value={searchQuery}
                                onChangeText={(t) => {
                                    setSearchQuery(t);
                                    debouncedSearch(t);
                                }}
                                returnKeyType="search"
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                            {!!searchQuery && (
                                <TouchableOpacity
                                    onPress={() => {
                                        setSearchQuery('');
                                        setSearchResults([]);
                                        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
                                    }}
                                >
                                    <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.4)" />
                                </TouchableOpacity>
                            )}
                        </View>
                        {searching && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 }}>
                                <ActivityIndicator size="small" color="#FF9800" />
                                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Searching...</Text>
                            </View>
                        )}
                        {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
                            <View style={styles.emptyContainer}>
                                <Ionicons name="person-add-outline" size={48} color="rgba(255,255,255,0.2)" />
                                <Text style={styles.emptyTitle}>No users found</Text>
                                <Text style={styles.emptyText}>
                                    Try a different name or invite them via the Invite tab.
                                </Text>
                            </View>
                        )}
                        <View style={{ marginTop: 12 }}>
                            {searchResults.map(res => <SearchResultCard key={res.id} result={res} />)}
                        </View>
                    </MotiView>
                )}

                {activeTab === 'invite' && (
                    <MotiView from={{ opacity: 0, translateY: 20 }} animate={{ opacity: 1, translateY: 0 }}>
                        <View style={styles.inviteForm}>
                            <Text style={styles.sectionTitle}>Direct Branded Invitation</Text>
                            <View style={styles.inputWrapper}>
                                <Ionicons name="mail-outline" size={20} color="#1063FD" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="friend@example.com"
                                    placeholderTextColor="rgba(255,255,255,0.3)"
                                    value={inviteEmail}
                                    onChangeText={setInviteEmail}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                />
                            </View>

                            <TouchableOpacity style={[styles.primaryButton, sendingInvite && { opacity: 0.7 }]} onPress={handleSendInvite} disabled={sendingInvite}>
                                <LinearGradient colors={['#1063FD', '#0050CC']} style={styles.primaryButtonGradient}>
                                    {sendingInvite ? <ActivityIndicator color="#fff" /> : <><Ionicons name="paper-plane" size={18} color="#fff" /><Text style={styles.primaryButtonText}>Send Invite via SMTP</Text></>}
                                </LinearGradient>
                            </TouchableOpacity>

                            <View style={styles.editorContainer}>
                                <Text style={styles.invitePreviewLabel}>Invitation Message Preview:</Text>
                                <TextInput style={styles.messageEditor} multiline value={customMessage} onChangeText={setCustomMessage} placeholderTextColor="rgba(255,255,255,0.3)" />
                            </View>
                        </View>
                    </MotiView>
                )}
            </ScrollView>

            {/* Confetti Animation */}
            <Animated.View style={[styles.confetti, { opacity: confettiAnim, transform: [{ scale: confettiAnim }] }]} pointerEvents="none">
                <Ionicons name="sparkles" size={100} color="#FFD700" />
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#1a1a2e' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16 },
    headerCenter: { alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
    headerUnderline: { width: 30, height: 3, backgroundColor: '#1063FD', borderRadius: 2, marginTop: 4 },
    closeButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
    heroSection: { marginHorizontal: 20, marginTop: 10, marginBottom: 20, borderRadius: 24, overflow: 'hidden' },
    heroGradient: { padding: 24, alignItems: 'center' },
    heroIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    heroTitle: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 6 },
    heroSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)', textAlign: 'center' },
    tabsWrapper: { marginBottom: 20 },
    tabsContainer: { paddingHorizontal: 20, gap: 10 },
    tabButton: { borderRadius: 15, overflow: 'hidden', minWidth: 100 },
    tabButtonActive: { ...createShadow({ opacity: 0.2, radius: 8 }) },
    tabButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 15, gap: 6 },
    tabLabel: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.6)' },
    tabLabelActive: { color: '#fff' },
    content: { paddingHorizontal: 20, paddingBottom: 50 },
    contactCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', padding: 15, borderRadius: 20, marginBottom: 12 },
    contactAvatar: { width: 50, height: 50, borderRadius: 25, overflow: 'hidden' },
    contactImage: { width: '100%', height: '100%' },
    contactInitials: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
    contactInitial: { color: '#fff', fontSize: 20, fontWeight: '800' },
    contactInfo: { flex: 1, marginLeft: 15 },
    contactName: { color: '#fff', fontSize: 15, fontWeight: '700' },
    contactDetail: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
    contactActions: { flexDirection: 'row', gap: 10 },
    contactAction: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
    socialGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    socialButton: { width: (width - 52) / 2, borderRadius: 20, padding: 15, alignItems: 'center' },
    socialIconGradient: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
    socialName: { fontSize: 14, fontWeight: '700' },
    inviteForm: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    sectionTitle: { fontSize: 14, fontWeight: '800', color: '#fff', marginBottom: 15, textTransform: 'uppercase' },
    inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 15, paddingHorizontal: 15, height: 50 },
    inputIcon: { marginRight: 10 },
    input: { flex: 1, color: '#fff', fontSize: 15 },
    messageToggle: { marginTop: 15 },
    messageToggleText: { color: '#1063FD', fontSize: 12, fontWeight: '600' },
    editorContainer: { marginTop: 15, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 15, padding: 12 },
    invitePreviewLabel: { color: '#1063FD', fontSize: 11, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase' },
    messageEditor: { color: 'rgba(255,255,255,0.7)', fontSize: 13, minHeight: 80, textAlignVertical: 'top' },
    primaryButton: { marginTop: 25, borderRadius: 15, overflow: 'hidden' },
    primaryButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 50, gap: 8 },
    primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    searchResultCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', padding: 15, borderRadius: 20, marginBottom: 12 },
    searchResultTouchable: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    searchAvatar: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
    searchAvatarInitials: { color: '#fff', fontWeight: '800', fontSize: 18 },
    searchInfo: { flex: 1, marginLeft: 15 },
    searchName: { color: '#fff', fontSize: 15, fontWeight: '700' },
    searchUsername: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
    followButton: { borderRadius: 12, overflow: 'hidden' },
    unfollowButton: { borderWidth: 1, borderColor: '#ff4b2b' },
    followButtonDisabled: { opacity: 0.6 },
    followButtonGradient: { paddingHorizontal: 15, paddingVertical: 8, minWidth: 80, alignItems: 'center', justifyContent: 'center' },
    followButtonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    emptyContainer: { alignItems: 'center', marginTop: 40 },
    emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 15 },
    emptyText: { color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: 10, paddingHorizontal: 40 },
    allowButton: { backgroundColor: '#1063FD', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 25, marginTop: 20 },
    allowButtonText: { color: '#fff', fontWeight: '700' },
    confetti: { position: 'absolute', top: '40%', alignSelf: 'center' },
});