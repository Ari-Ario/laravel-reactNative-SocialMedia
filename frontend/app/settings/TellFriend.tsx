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
    DeviceEventEmitter,
    FlatList,
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
import Colors from '@/constants/Colors';
import { BackButton } from '@/components/ui/IconButton';
import * as Clipboard from 'expo-clipboard';
import { createShadow } from '@/utils/styles';
import GlobalStyles from '@/styles/GlobalStyles';
import { useAppTheme } from '@/hooks/useAppTheme';
import AuthContext from '@/context/AuthContext';
import { fetchUserByEmail, followUser, sendEmailInvitation } from '@/services/UserService';
import getApiBaseImage from '@/services/getApiBaseImage';
import { useProfileView } from '@/context/ProfileViewContext';
import SearchService from '@/services/ChatScreen/SearchServiceChat';
import { fetchSocialFriends } from '@/services/SettingService';

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
    { platform: 'Telegram', url: 'https://t.me/share/url?url=', icon: 'paper-plane', color: '#0088cc' },
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
    const { colors, activeScheme } = useAppTheme();
    const styles = getStyles(colors, activeScheme);
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
    const [socialFriends, setSocialFriends] = useState<any[]>([]);
    const [customMessage, setCustomMessage] = useState(SHARE_MESSAGE);

    // Pagination states
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    const scrollY = useRef(new Animated.Value(0)).current;
    const confettiAnim = useRef(new Animated.Value(0)).current;

    // Load contacts on mount or tab change
    useEffect(() => {
        if (activeTab === 'contacts') {
            loadContacts();
        }
    }, [activeTab]);

    // Real-time follow status sync
    useEffect(() => {
        const subscription = DeviceEventEmitter.addListener('user-follow-updated', ({ userId, isFollowing }) => {
            console.log('🔄 Syncing follow status in search:', userId, isFollowing);
            setSearchResults(prev => prev.map(item => 
                item.user_id.toString() === userId.toString() ? { ...item, is_following: isFollowing } : item
            ));
        });
        return () => subscription.remove();
    }, []);

    const loadContacts = async () => {
        try {
            setLoadingContacts(true);

            if (isWeb) {
                // Web Contact Picker API Support (Safari 14.5+, Chrome 80+)
                if ('contacts' in navigator && 'select' in (navigator as any).contacts) {
                    const props = ['name', 'email', 'tel'];
                    const opts = { multiple: true };
                    try {
                        const webContacts = await (navigator as any).contacts.select(props, opts);
                        const formattedContacts = webContacts.map((wc: any, index: number) => ({
                            id: `web-${index}-${wc.name?.[0] || 'unknown'}`,
                            name: wc.name?.[0] || 'Unknown Name',
                            emails: wc.email?.map((e: string) => ({ email: e })) || [],
                            phoneNumbers: wc.tel?.map((t: string) => ({ number: t })) || [],
                        }));
                        setContacts(prev => [...prev, ...formattedContacts]);
                    } catch (err) {
                        console.log('Web Contact Picker cancelled or failed:', err);
                    }
                } else {
                    console.log('Web Contact Picker API not supported on this browser');
                }
                return;
            }

            // Native Mobile Implementation
            const { status } = await Contacts.requestPermissionsAsync();
            if (status === 'granted') {
                const { data } = await Contacts.getContactsAsync({
                    fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails, Contacts.Fields.Image],
                });
                setContacts(data);
            }
            // Fetch social friends matches from backend
            try {
                const sf = await fetchSocialFriends();
                setSocialFriends(sf);
            } catch (sfError) {
                // Silently fail, discovery simply won't show
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
            const message = customMessage;

            // Platform-specific logic for prefilling and app detection
            if (platform.platform === 'WhatsApp') {
                const encodedMessage = encodeURIComponent(message);
                if (targetContact?.phoneNumbers?.[0]) {
                    const phone = targetContact.phoneNumbers[0].number.replace(/[^0-9]/g, '');
                    url = `whatsapp://send?phone=${phone}&text=${encodedMessage}`;
                } else {
                    url = `whatsapp://send?text=${encodedMessage}`;
                }
            } else if (platform.platform === 'SMS') {
                if (targetContact?.phoneNumbers?.[0]) {
                    const phone = targetContact.phoneNumbers[0].number;
                    // iOS uses '&' for params after the first, but 'sms:' URLs on iOS are strict.
                    // The safer way for body prefill on iOS is sms:phone&body=...
                    const separator = Platform.OS === 'ios' ? '&' : '?';
                    url = `sms:${phone}${separator}body=${encodeURIComponent(message)}`;
                } else {
                    // General SMS share - native share sheet is much more reliable for body prefill on mobile
                    if (!isWeb) {
                        await Share.share({ message });
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        return;
                    }
                    url = `sms:?body=${encodeURIComponent(message)}`;
                }
            } else if (platform.platform === 'Instagram') {
                if (!isWeb) {
                    await Clipboard.setStringAsync(message);
                    Alert.alert(
                        'Message Copied!',
                        'Instagram does not allow pre-filling text automatically. We have copied the invitation to your clipboard - you can paste it into your post or story!',
                        [
                            { 
                                text: 'Open Instagram', 
                                onPress: async () => {
                                    const instaUrl = 'instagram://library';
                                    const canOpen = await Linking.canOpenURL(instaUrl);
                                    if (canOpen) {
                                        await Linking.openURL(instaUrl);
                                    } else {
                                        await Share.share({ message, url: APP_STORE_LINKS.web });
                                    }
                                } 
                            },
                        ]
                    );
                    return;
                }
            } else if (platform.platform === 'Telegram') {
                const encodedMessage = encodeURIComponent(message);
                if (!isWeb) {
                    const tgUrl = `tg://msg?text=${encodedMessage}`;
                    const canOpenTg = await Linking.canOpenURL(tgUrl);
                    if (canOpenTg) {
                        url = tgUrl;
                    } else {
                        url = platform.url + encodedMessage;
                    }
                } else {
                    url = platform.url + encodedMessage;
                }
            } else if (platform.platform === 'Twitter') {
                url = platform.url + encodeURIComponent(message);
            } else if (platform.platform === 'Facebook' || platform.platform === 'LinkedIn') {
                url = platform.url + encodeURIComponent(APP_STORE_LINKS.web);
                if (!isWeb) {
                    await Share.share({ message: message, url: APP_STORE_LINKS.web, title: 'Join me on Zmzir' });
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    return;
                }
            } else {
                url += encodeURIComponent(message);
            }

            const canOpen = await Linking.canOpenURL(url);
            if (canOpen) {
                await Linking.openURL(url);
                if (!isWeb) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } else {
                // Final fallback to native share
                if (!isWeb) {
                    await Share.share({ message, title: 'Join me on Zmzir' });
                } else {
                    Alert.alert('Sharing', 'Please copy the message and share it manually or try our Email/Link options.');
                }
            }
        } catch (error) {
            console.error('Share failed:', error);
            if (!isWeb) await Share.share({ message: customMessage, title: 'Join me on Zmzir' });
        }
    };

    // Debounced global search — same pattern as chats/index.tsx
    const handleSearchUser = async (query: string, pageNum: number = 1, append: boolean = false) => {
        if (query.length < 2) {
            setSearchResults([]);
            setSearching(false);
            setPage(1);
            setHasMore(true);
            return;
        }

        if (append) {
            setLoadingMore(true);
        } else {
            setSearching(true);
            setPage(1);
        }

        try {
            const response = await searchService.searchAll(query, user?.id || '', 50, pageNum, ['contacts']);
            const results = response.results || [];
            
            // Filter out current user and map to a flat list
            const formattedResults = results
                .filter((r: any) => (r.data?.id?.toString() || r.id?.toString()) !== user?.id?.toString())
                .map((r: any) => ({
                    id: r.data?.id || r.id,
                    name: r.title,
                    username: r.data?.username || r.description || '',
                    profile_photo: r.avatar || r.data?.profile_photo || '',
                    user_id: (r.data?.id || r.id).toString(),
                    is_following: r.data?.is_following || false,
                }));

            if (append) {
                setSearchResults(prev => {
                    const existingIds = new Set(prev.map(item => item.id.toString()));
                    const uniqueNew = formattedResults.filter((item: any) => !existingIds.has(item.id.toString()));
                    return [...prev, ...uniqueNew];
                });
            } else {
                setSearchResults(formattedResults);
            }

            setHasMore(response.has_more);
            setPage(pageNum);
        } catch (error) {
            console.error('Search error:', error);
            if (!append) setSearchResults([]);
        } finally {
            setSearching(false);
            setLoadingMore(false);
        }
    };

    const handleLoadMore = () => {
        if (loadingMore || !hasMore || !searchQuery) return;
        handleSearchUser(searchQuery, page + 1, true);
    };

    const debouncedSearch = (query: string) => {
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        searchTimerRef.current = setTimeout(() => { 
            handleSearchUser(query); 
        }, 300);
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

    const TabButton = ({ tab }: { tab: typeof tabs[0] }) => {
        const { colors } = useAppTheme();
        return (
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
    };

    const ContactCard = ({ contact }: { contact: Contact }) => {
        const { colors } = useAppTheme();
        const styles = getStyles(colors, activeScheme);
        return (
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
                            <Ionicons name="mail" size={20} color={colors.tint} />
                        </TouchableOpacity>
                    )}
                </View>
            </MotiView>
        );
    };

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
        const { colors } = useAppTheme();
        const styles = getStyles(colors, activeScheme);
        const [localLoading, setLocalLoading] = useState(false);

        const handleOpenProfile = () => {
            setProfileViewUserId(result.user_id?.toString());
            setProfilePreviewVisible(true);
        };

        const initials = (result.name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
        const avatarColors = ['#1063FD', '#4CAF50', '#FF9800', '#9C27B0', '#F44336', '#00BCD4'];
        const avatarColor = avatarColors[(result.name?.charCodeAt(0) || 0) % avatarColors.length];

        const isFollowing = result.is_following;

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
                    onPress={async () => {
                        if (localLoading) return;
                        setLocalLoading(true);
                        const action = isFollowing ? 'unfollow' : 'follow';
                        try {
                            await followUser(result.user_id, action);
                            // Local update state is handled by DeviceEventEmitter listener in parent
                            if (!isWeb) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        } catch (error) {
                            Alert.alert('Error', `Could not ${action} user`);
                        } finally {
                            setLocalLoading(false);
                        }
                    }}
                    disabled={localLoading}
                >
                    <LinearGradient 
                        colors={isFollowing ? ['#ff4b2b', '#ff416c'] : [colors.tint, colors.tint + 'CC']} 
                        style={styles.followButtonGradient}
                    >
                        {localLoading ? (
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
        <View style={[styles.container, GlobalStyles.popupContainer]}>
            <StatusBar barStyle={activeScheme === 'dark' ? 'light-content' : 'dark-content'} />
            <LinearGradient colors={activeScheme === 'dark' ? ['#1a1a2e', '#16213e', '#0f3460'] : [colors.background, colors.surface]} style={StyleSheet.absoluteFill} />
            <BlurView intensity={activeScheme === 'dark' ? 20 : 10} style={StyleSheet.absoluteFill} />

            {/* Header */}
            <LinearGradient colors={activeScheme === 'dark' ? ['rgba(0,0,0,0.3)', 'transparent'] : [colors.surface, 'transparent']} style={[styles.header, { paddingTop: insets.top + 10 }]}>
                <BackButton onPress={() => router.back()} />
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>Invite Friends</Text>
                    <View style={styles.headerUnderline} />
                </View>
                <View style={{ width: 44 }} />
            </LinearGradient>

            {/* Hero Section */}
            <MotiView from={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={styles.heroSection}>
                <LinearGradient colors={['#1063FD', '#00c6ff']} style={styles.heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <View style={styles.heroIcon}><Ionicons name="gift" size={40} color={colors.surface} /></View>
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

            {activeTab !== 'search' ? (
                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    {activeTab === 'contacts' && (
                        <MotiView from={{ opacity: 0, translateY: 20 }} animate={{ opacity: 1, translateY: 0 }}>
                            {loadingContacts ? (
                                <ActivityIndicator size="large" color={colors.tint} style={{ marginTop: 40 }} />
                            ) : (
                                <>
                                    {socialFriends.length > 0 && (
                                        <View style={{ marginBottom: 25 }}>
                                            <View style={styles.sectionHeader}>
                                                <Ionicons name="sparkles" size={18} color="#FF9800" />
                                                <Text style={styles.sectionTitle}>Found on Social Media</Text>
                                            </View>
                                            {socialFriends.map(friend => (
                                                <SearchResultCard key={`social-${friend.id}`} result={{
                                                    ...friend,
                                                    user_id: friend.id.toString(),
                                                    is_following: false
                                                }} />
                                            ))}
                                        </View>
                                    )}

                                    <View style={styles.sectionHeader}>
                                        <Ionicons name="phone-portrait-outline" size={18} color="#4CAF50" />
                                        <Text style={styles.sectionTitle}>Phone Contacts</Text>
                                    </View>

                                    {contacts.length === 0 ? (
                                        <View style={styles.emptyContainer}>
                                            <Ionicons name="people" size={60} color={colors.border} />
                                            <Text style={styles.emptyTitle}>
                                                {isWeb && !('contacts' in navigator) ? 'Not Available on this Browser' : 'No contacts found'}
                                            </Text>
                                            <Text style={styles.emptyText}>
                                                {isWeb && !('contacts' in navigator) 
                                                    ? 'Your browser does not support contact selection. Try the Social or Invite tabs.' 
                                                    : 'Select contacts from your phone to invite them to Zmzir.'}
                                            </Text>
                                            {( !isWeb || ('contacts' in navigator) ) && (
                                                <TouchableOpacity style={styles.allowButton} onPress={loadContacts}>
                                                    <Text style={styles.allowButtonText}>
                                                        {isWeb ? 'Select Contacts' : 'Allow Access'}
                                                    </Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    ) : (
                                        contacts.map(contact => <ContactCard key={contact.id} contact={contact} />)
                                    )}
                                </>
                            )}
                        </MotiView>
                    )}

                    {activeTab === 'social' && (
                        <MotiView from={{ opacity: 0, translateY: 20 }} animate={{ opacity: 1, translateY: 0 }} style={styles.socialGrid}>
                            {SOCIAL_PLATFORMS.map(platform => <SocialButton key={platform.platform} platform={platform} />)}
                        </MotiView>
                    )}

                    {activeTab === 'invite' && (
                        <MotiView from={{ opacity: 0, translateY: 20 }} animate={{ opacity: 1, translateY: 0 }}>
                            <View style={styles.inviteForm}>
                                <Text style={styles.sectionTitle}>Direct Branded Invitation</Text>
                                <View style={styles.inputWrapper}>
                                    <Ionicons name="mail-outline" size={20} color={colors.tint} style={styles.inputIcon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="friend@example.com"
                                        placeholderTextColor={colors.textSecondary + '60'}
                                        value={inviteEmail}
                                        onChangeText={setInviteEmail}
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                    />
                                </View>

                                <TouchableOpacity style={[styles.primaryButton, sendingInvite && { opacity: 0.7 }]} onPress={handleSendInvite} disabled={sendingInvite}>
                                    <LinearGradient colors={[colors.tint, colors.tint + 'CC']} style={styles.primaryButtonGradient}>
                                        {sendingInvite ? <ActivityIndicator color={colors.surface} /> : <><Ionicons name="paper-plane" size={18} color={colors.surface} /><Text style={styles.primaryButtonText}>Send Invite via SMTP</Text></>}
                                    </LinearGradient>
                                </TouchableOpacity>

                                <View style={styles.editorContainer}>
                                    <Text style={styles.invitePreviewLabel}>Invitation Message Preview:</Text>
                                    <TextInput style={styles.messageEditor} multiline value={customMessage} onChangeText={setCustomMessage} placeholderTextColor={colors.textSecondary + '4D'} />
                                </View>
                            </View>
                        </MotiView>
                    )}
                </ScrollView>
            ) : (
                <View style={{ flex: 1, paddingHorizontal: 20 }}>
                    <MotiView from={{ opacity: 0, translateY: 20 }} animate={{ opacity: 1, translateY: 0 }} style={{ flex: 1 }}>
                        <View style={styles.searchHeaderSticky}>
                            <View style={styles.inputWrapper}>
                                <Ionicons name="search-outline" size={20} color={colors.tint} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Search by name, username or email..."
                                    placeholderTextColor={colors.textSecondary + '60'}
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
                                            setPage(1);
                                            setHasMore(true);
                                            if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
                                        }}
                                    >
                                        <Ionicons name="close-circle" size={18} color={colors.textSecondary + '66'} />
                                    </TouchableOpacity>
                                )}
                            </View>
                            {searching && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8, paddingHorizontal: 5 }}>
                                    <ActivityIndicator size="small" color={colors.tint} />
                                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Searching...</Text>
                                </View>
                            )}
                        </View>

                        <FlatList
                            data={searchResults}
                            keyExtractor={(item) => item.id.toString()}
                            renderItem={({ item }) => <SearchResultCard result={item} />}
                            scrollEnabled={true}
                            onEndReached={handleLoadMore}
                            onEndReachedThreshold={0.5}
                            ListEmptyComponent={() => {
                                if (!searching && searchQuery.length >= 2 && searchResults.length === 0) {
                                    return (
                                        <View style={styles.emptyContainer}>
                                            <Ionicons name="person-add-outline" size={48} color={colors.border} />
                                            <Text style={styles.emptyTitle}>No users found</Text>
                                            <Text style={styles.emptyText}>
                                                Try a different name or invite them via the Invite tab.
                                            </Text>
                                        </View>
                                    );
                                }
                                return null;
                            }}
                            ListFooterComponent={() => (
                                loadingMore ? (
                                    <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                                        <ActivityIndicator color={colors.tint} />
                                        <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 10 }}>Loading more...</Text>
                                    </View>
                                ) : null
                            )}
                            contentContainerStyle={{ paddingBottom: 100 }}
                        />
                    </MotiView>
                </View>
            )}

            {/* Confetti Animation */}
            <Animated.View 
                style={[
                    styles.confetti, 
                    { 
                        opacity: confettiAnim, 
                        transform: [{ scale: confettiAnim }],
                        pointerEvents: 'none'
                    }
                ]}
            >
                <Ionicons name="sparkles" size={100} color="#FFD700" />
            </Animated.View>
        </View>
    );
}

function getStyles(colors: any, activeScheme: string) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16 },
    headerCenter: { alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
    headerUnderline: { width: 30, height: 3, backgroundColor: colors.tint, borderRadius: 2, marginTop: 4 },
    backButton: { padding: 4 },
    heroSection: { marginHorizontal: 20, marginTop: 10, marginBottom: 20, borderRadius: 24, overflow: 'hidden' },
    heroGradient: { padding: 24, alignItems: 'center' },
    heroIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.surface + '33', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    heroTitle: { fontSize: 20, fontWeight: '800', color: colors.surface, marginBottom: 6 },
    heroSubtitle: { fontSize: 13, color: colors.surface + 'CC', textAlign: 'center' },
    tabsWrapper: { marginBottom: 20 },
    tabsContainer: { paddingHorizontal: 20, gap: 10 },
    tabButton: { borderRadius: 15, overflow: 'hidden', minWidth: 100 },
    tabButtonActive: { ...createShadow({ opacity: 0.2, radius: 8 }) },
    tabButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 15, gap: 6 },
    tabLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
    tabLabelActive: { color: colors.surface },
    content: { paddingHorizontal: 20, paddingBottom: 50 },
    contactCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, padding: 15, borderRadius: 20, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
    contactAvatar: { width: 50, height: 50, borderRadius: 25, overflow: 'hidden' },
    contactImage: { width: '100%', height: '100%' },
    contactInitials: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
    contactInitial: { color: colors.surface, fontSize: 20, fontWeight: '800' },
    contactInfo: { flex: 1, marginLeft: 15 },
    contactName: { color: colors.text, fontSize: 15, fontWeight: '700' },
    contactDetail: { color: colors.textSecondary, fontSize: 12 },
    contactActions: { flexDirection: 'row', gap: 10 },
    contactAction: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.muted, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border },
    socialGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
    socialButton: { width: (width - 56) / 2, borderRadius: 20, padding: 15, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
    socialIconGradient: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
    socialName: { fontSize: 14, fontWeight: '700' },
    inviteForm: { backgroundColor: colors.surface, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: colors.border },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 15, marginTop: 10 },
    sectionTitle: { fontSize: 14, fontWeight: '800', color: colors.text, textTransform: 'uppercase' },
    inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 15, paddingHorizontal: 15, height: 50, borderWidth: 1, borderColor: colors.border },
    inputIcon: { marginRight: 10 },
    input: { flex: 1, color: colors.text, fontSize: 15 },
    messageToggle: { marginTop: 15 },
    messageToggleText: { color: colors.tint, fontSize: 12, fontWeight: '600' },
    editorContainer: { marginTop: 15, backgroundColor: colors.background, borderRadius: 15, padding: 12, borderWidth: 1, borderColor: colors.border },
    invitePreviewLabel: { color: colors.tint, fontSize: 11, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase' },
    messageEditor: { color: colors.textSecondary, fontSize: 13, minHeight: 80, textAlignVertical: 'top' },
    primaryButton: { marginTop: 25, borderRadius: 15, overflow: 'hidden' },
    primaryButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 50, gap: 8 },
    primaryButtonText: { color: colors.surface, fontSize: 15, fontWeight: '700' },
    searchResultCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, padding: 15, borderRadius: 20, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
    searchResultTouchable: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    searchAvatar: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
    searchAvatarInitials: { color: colors.surface, fontWeight: '800', fontSize: 18 },
    searchInfo: { flex: 1, marginLeft: 15 },
    searchName: { color: colors.text, fontSize: 15, fontWeight: '700' },
    searchUsername: { color: colors.textSecondary, fontSize: 12 },
    followButton: { borderRadius: 12, overflow: 'hidden' },
    unfollowButton: { borderWidth: 1, borderColor: '#ff4b2b' },
    followButtonDisabled: { opacity: 0.6 },
    followButtonGradient: { paddingHorizontal: 15, paddingVertical: 8, minWidth: 80, alignItems: 'center', justifyContent: 'center' },
    followButtonText: { color: colors.surface, fontSize: 12, fontWeight: '700' },
    emptyContainer: { alignItems: 'center', marginTop: 40 },
    emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 15 },
    emptyText: { color: colors.textSecondary, textAlign: 'center', marginTop: 10, paddingHorizontal: 40 },
    allowButton: { backgroundColor: colors.tint, paddingHorizontal: 30, paddingVertical: 12, borderRadius: 25, marginTop: 20 },
    allowButtonText: { color: colors.surface, fontWeight: '700' },
    confetti: { position: 'absolute', top: '40%', alignSelf: 'center' },
});
}