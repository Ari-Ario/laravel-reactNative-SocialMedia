// app/(settings)/PrivacySettingsScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Switch,
    ActivityIndicator,
    StatusBar,
    Dimensions,
    Animated,
    Platform,
    Alert,
    TextInput,
    Modal,
    KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchFullSettings, updateFullSettings, updatePreferences, exportUserData, updatePassword } from '@/services/SettingService';
import { fetchBlockedUsers, unblockUser } from '@/services/UserService';
import { createShadow } from '@/utils/styles';
import * as Haptics from 'expo-haptics';
import GlobalStyles from '@/styles/GlobalStyles';

const { width } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

interface PrivacyToggleProps {
    label: string;
    description: string;
    value: boolean;
    onValueChange: (val: boolean) => void;
    icon: string;
    color?: string;
    warning?: string;
}

const PrivacyToggle = ({
    label,
    description,
    value,
    onValueChange,
    icon,
    color = "#1063FD",
    warning
}: PrivacyToggleProps) => {
    const [isHovered, setIsHovered] = useState(false);
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handleToggle = (newValue: boolean) => {
        Animated.sequence([
            Animated.spring(scaleAnim, { toValue: 0.96, useNativeDriver: true, friction: 5 }),
            Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 5 }),
        ]).start();

        if (!isWeb && Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }

        onValueChange(newValue);
    };

    return (
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <TouchableOpacity
                activeOpacity={0.7}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                <LinearGradient
                    colors={isHovered ? ['#f8f9fa', '#fff'] : ['#fff', '#fff']}
                    style={styles.toggleCard}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                >
                    <View style={styles.toggleInfo}>
                        <View style={[styles.iconContainer, { backgroundColor: color + '15' }]}>
                            <Ionicons name={icon as any} size={22} color={color} />
                        </View>
                        <View style={styles.textContainer}>
                            <Text style={styles.toggleLabel}>{label}</Text>
                            <Text style={styles.toggleDescription}>{description}</Text>
                            {warning && value && (
                                <View style={styles.warningBadge}>
                                    <Ionicons name="alert-circle" size={12} color="#FF9800" />
                                    <Text style={styles.warningText}>{warning}</Text>
                                </View>
                            )}
                        </View>
                    </View>
                    <Switch
                        value={value}
                        onValueChange={handleToggle}
                        trackColor={{ false: '#e5e5e5', true: color + '80' }}
                        thumbColor={value ? color : '#fff'}
                        ios_backgroundColor="#e5e5e5"
                    />
                </LinearGradient>
            </TouchableOpacity>
        </Animated.View>
    );
};

export default function PrivacySettingsScreen() {
    const insets = useSafeAreaInsets();
    const scrollY = useRef(new Animated.Value(0)).current;
    const [settings, setSettings] = useState<any>(null);
    const [preferences, setPreferences] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeSection, setActiveSection] = useState('visibility');
    const [keywordInput, setKeywordInput] = useState('');
    const keywordInputRef = useRef<TextInput>(null);
    const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
    const [isExporting, setIsExporting] = useState(false);
    
    // Password Update State
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (activeSection === 'interactions') {
            loadBlockedUsers();
        }
    }, [activeSection]);

    const loadData = async () => {
        try {
            setLoading(true);
            const data = await fetchFullSettings();
            setSettings(data.user);
            setPreferences(data.preferences);
        } catch (error) {
            console.error('Failed to load privacy settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadBlockedUsers = async () => {
        try {
            const data = await fetchBlockedUsers();
            setBlockedUsers(data);
        } catch (error) {
            console.error('Failed to load blocked users:', error);
        }
    };

    const handleUnblock = async (targetId: string) => {
        try {
            if (!isWeb) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            await unblockUser(targetId);
            setBlockedUsers(prev => prev.filter(u => String(u.id) !== String(targetId)));
        } catch (error) {
            Alert.alert('Error', 'Failed to unblock user');
        }
    };

    const handleExport = async () => {
        try {
            setIsExporting(true);
            const data = await exportUserData();

            // Handle download (works on Web & Mobile Browsers)
            // if data is already a Blob (from SettingService), use it directly
            const blob = data instanceof Blob ? data : new Blob([typeof data === 'string' ? data : JSON.stringify(data, null, 2)], { type: 'application/json' });
            
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'zmzir_privacy_export.json');
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            
            if (!isWeb) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error) {
            console.error('Export failed:', error);
            Alert.alert('Error', 'Failed to export data. Please try again on a web browser.');
        } finally {
            setIsExporting(false);
        }
    };

    const handleUpdatePassword = async () => {
        if (!currentPassword || !newPassword || !confirmPassword) {
            Alert.alert('Missing Info', 'Please fill in all password fields.');
            return;
        }

        if (newPassword !== confirmPassword) {
            Alert.alert('Error', 'New passwords do not match.');
            return;
        }

        if (newPassword.length < 8) {
            Alert.alert('Too Short', 'Password must be at least 8 characters.');
            return;
        }

        try {
            setIsUpdatingPassword(true);
            await updatePassword({
                current_password: currentPassword,
                password: newPassword,
                password_confirmation: confirmPassword
            });

            Alert.alert('Success', 'Your password has been updated securely.');
            setShowPasswordModal(false);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            
            if (!isWeb) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error: any) {
            const errorMessage = error.response?.data?.message || 'Failed to update password. Check your current password.';
            Alert.alert('Error', errorMessage);
        } finally {
            setIsUpdatingPassword(false);
        }
    };

    const handleUpdatePreference = async (field: string, value: any) => {
        try {
            setPreferences((prev: any) => ({ ...prev, [field]: value }));
            await updatePreferences({ [field]: value });
            if (!isWeb) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
        } catch (error) {
            setPreferences((prev: any) => ({ ...prev, [field]: preferences?.[field] }));
            Alert.alert('Error', 'Failed to update preference');
        }
    };

    const handleToggleSetting = async (field: string, value: boolean) => {
        try {
            setSettings((prev: any) => ({ ...prev, [field]: value }));
            await updateFullSettings({ [field]: value });
        } catch (error) {
            setSettings((prev: any) => ({ ...prev, [field]: !value }));
        }
    };

    const handleTogglePreference = async (field: string, value: boolean) => {
        handleUpdatePreference(field, value);
    };

    // Muted keywords as array
    const mutedKeywords: string[] = Array.isArray(preferences?.muted_keywords)
        ? preferences.muted_keywords
        : typeof preferences?.muted_keywords === 'string' && preferences.muted_keywords
            ? preferences.muted_keywords.split(',').map((k: string) => k.trim()).filter(Boolean)
            : [];

    const addKeyword = (raw: string) => {
        const kw = raw.trim().replace(/,$/, '').trim();
        if (!kw || mutedKeywords.includes(kw)) { setKeywordInput(''); return; }
        const updated = [...mutedKeywords, kw];
        setKeywordInput('');
        handleUpdatePreference('muted_keywords', updated);
    };

    const removeKeyword = (kw: string) => {
        const updated = mutedKeywords.filter(k => k !== kw);
        handleUpdatePreference('muted_keywords', updated);
    };

    // Dynamic privacy score
    const privacyScore = () => {
        let score = 50; // base
        if (settings?.is_private) score += 25;
        if (!preferences?.show_email) score += 10;
        if (!preferences?.show_phone) score += 10;
        if (!preferences?.show_birthday) score += 5;
        if (mutedKeywords.length > 0) score += 5;
        if (preferences?.synergy_traits?.two_factor_enabled) score += 15;
        return Math.min(score, 100);
    };

    const privacyScoreColor = (score: number) => {
        if (score >= 80) return '#34C759';
        if (score >= 60) return '#FF9800';
        return '#FF3B30';
    };

    const privacyScoreLabel = (score: number) => {
        if (score >= 80) return 'Well protected! Keep it up.';
        if (score >= 60) return 'Good protection. Consider more restrictions.';
        return 'Low protection. Review your privacy settings.';
    };

    const handleTogglePreference2 = (field: string, value: boolean) => {
        handleUpdatePreference(field, value);
    };

    const sections = [
        { id: 'visibility', label: 'Visibility', icon: 'eye', color: '#1063FD' },
        { id: 'sharing', label: 'Sharing', icon: 'share', color: '#4CAF50' },
        { id: 'interactions', label: 'Interactions', icon: 'chatbubbles', color: '#FF9800' },
        { id: 'security', label: 'Security', icon: 'shield', color: '#9C27B0' },
    ];

    const SectionButton = ({ id, label, icon, color }: any) => (
        <TouchableOpacity
            style={[styles.sectionButton, activeSection === id && styles.sectionButtonActive]}
            onPress={() => setActiveSection(id)}
        >
            <LinearGradient
                colors={activeSection === id ? [color, color + '80'] : ['#f5f5f7', '#f5f5f7']}
                style={styles.sectionButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
            >
                <Ionicons name={icon} size={14} color={activeSection === id ? '#fff' : color} />
                <Text style={[styles.sectionButtonText, activeSection === id && styles.sectionButtonTextActive]}>
                    {label}
                </Text>
            </LinearGradient>
        </TouchableOpacity>
    );

    const headerOpacity = scrollY.interpolate({
        inputRange: [0, 100],
        outputRange: [1, 0.95],
        extrapolate: 'clamp',
    });

    if (loading) {
        return (
            <View style={styles.container}>
                <StatusBar barStyle="dark-content" />
                <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color="#000" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Privacy Vault</Text>
                    <View style={{ width: 44 }} />
                </View>
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#1063FD" />
                    <Text style={styles.loadingText}>Loading your privacy settings...</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.container, GlobalStyles.popupContainer]}>
            <StatusBar barStyle="dark-content" />

            <LinearGradient
                colors={['#fff', '#f8f9fa']}
                style={[styles.header, { paddingTop: insets.top + 10 }]}
            >
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>

                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>Privacy Vault</Text>
                    <Animated.View style={[styles.headerUnderline, { opacity: headerOpacity }]} />
                </View>

                <View style={{ width: 44 }} />
            </LinearGradient>

            {/* Section Navigation */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.sectionNav}
                contentContainerStyle={styles.sectionNavContent}
            >
                {sections.map(section => (
                    <SectionButton key={section.id} {...section} />
                ))}
            </ScrollView>

            <Animated.ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                    { useNativeDriver: false }
                )}
                scrollEventThrottle={16}
            >
                <MotiView from={{ opacity: 0, translateY: 20 }} animate={{ opacity: 1, translateY: 0 }}>
                    {/* Privacy Score Card — Dynamic */}
                    {(() => { const score = privacyScore(); const color = privacyScoreColor(score); return (
                    <LinearGradient
                        colors={[color, color + 'CC']}
                        style={styles.privacyScoreCard}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <Text style={styles.privacyScoreLabel}>Privacy Score</Text>
                        <Text style={styles.privacyScore}>{score}/100</Text>
                        <View style={styles.privacyScoreBar}>
                            <Animated.View style={[styles.privacyScoreFill, { width: `${score}%` as any }]} />
                        </View>
                        <Text style={styles.privacyScoreHint}>
                            {privacyScoreLabel(score)}
                        </Text>
                    </LinearGradient>
                    ); })()}

                    {activeSection === 'visibility' && (
                        <>
                            <View style={styles.sectionTitleRow}>
                                <Ionicons name="eye" size={14} color="#1063FD" />
                                <Text style={styles.sectionTitle}>Account Visibility</Text>
                            </View>
                            <PrivacyToggle
                                label="Private Account"
                                description="Only followers you approve will see your posts and content."
                                value={!!settings?.is_private}
                                onValueChange={(val) => handleToggleSetting('is_private', val)}
                                icon="lock-closed"
                                color="#34C759"
                                warning="New followers will need approval"
                            />
                        </>
                    )}

                    {activeSection === 'sharing' && (
                        <>
                            <View style={styles.sectionTitleRow}>
                                <Ionicons name="share" size={14} color="#4CAF50" />
                                <Text style={styles.sectionTitle}>Information Sharing</Text>
                            </View>
                            <PrivacyToggle
                                label="Share Birthday"
                                description="Show your date of birth on your profile."
                                value={!!preferences?.show_birthday}
                                onValueChange={(val) => handleTogglePreference('show_birthday', val)}
                                icon="gift-outline"
                                color="#FF9800"
                            />
                            <PrivacyToggle
                                label="Share Email"
                                description="Make your email visible to followers."
                                value={!!preferences?.show_email}
                                onValueChange={(val) => handleTogglePreference('show_email', val)}
                                icon="mail-outline"
                                color="#4CAF50"
                            />
                            <PrivacyToggle
                                label="Share Phone"
                                description="Make your phone number visible to followers."
                                value={!!preferences?.show_phone}
                                onValueChange={(val) => handleTogglePreference('show_phone', val)}
                                icon="call-outline"
                                color="#1063FD"
                            />
                        </>
                    )}

                    {activeSection === 'interactions' && (
                        <>
                            <View style={styles.sectionTitleRow}>
                                <Ionicons name="chatbubbles" size={14} color="#FF9800" />
                                <Text style={styles.sectionTitle}>Interaction Controls</Text>
                            </View>

                            {/* Blocked Users List */}
                            <View style={styles.actionCardCol}>
                                <View style={styles.actionHeader}>
                                    <View style={[styles.actionIcon, { backgroundColor: '#FF3B3015' }]}>
                                        <Ionicons name="hand-left-outline" size={22} color="#FF3B30" />
                                    </View>
                                    <View style={styles.actionTextContainer}>
                                        <Text style={styles.actionLabel}>Blocked Users</Text>
                                        <Text style={styles.actionDescription}>Manage the people you want to restrict.</Text>
                                    </View>
                                </View>
                                
                                {blockedUsers.length > 0 ? (
                                    <View style={styles.blockedList}>
                                        {blockedUsers.map(u => (
                                            <View key={u.id} style={styles.blockedItem}>
                                                <View style={styles.blockedUserInfo}>
                                                    <View style={styles.blockedAvatar}>
                                                        <Text style={styles.blockedAvatarText}>
                                                            {u.name?.charAt(0) || u.username?.charAt(0) || '?'}
                                                        </Text>
                                                    </View>
                                                    <View>
                                                        <Text style={styles.blockedName}>{u.name || u.username}</Text>
                                                        <Text style={styles.blockedUsername}>@{u.username}</Text>
                                                    </View>
                                                </View>
                                                <TouchableOpacity 
                                                    style={styles.unblockBtn}
                                                    onPress={() => handleUnblock(u.id)}
                                                >
                                                    <Text style={styles.unblockBtnText}>Unblock</Text>
                                                </TouchableOpacity>
                                            </View>
                                        ))}
                                    </View>
                                ) : (
                                    <Text style={styles.emptyListText}>No blocked users yet.</Text>
                                )}
                            </View>

                            {/* Muted Keywords — Tag Chip System */}
                            <View style={styles.actionCard}>
                                <View style={[styles.actionIcon, { backgroundColor: '#9C27B015' }]}>
                                    <Ionicons name="volume-mute" size={22} color="#9C27B0" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.actionLabel}>Muted Keywords</Text>
                                    <Text style={styles.actionDescription}>
                                        Content containing these words will be hidden from your feed.
                                    </Text>
                                    {/* Chips */}
                                    {mutedKeywords.length > 0 && (
                                        <View style={styles.chipsContainer}>
                                            {mutedKeywords.map(kw => (
                                                <View key={kw} style={styles.chip}>
                                                    <Text style={styles.chipText}>{kw}</Text>
                                                    <TouchableOpacity onPress={() => removeKeyword(kw)} style={styles.chipRemove}>
                                                        <Ionicons name="close-circle" size={14} color="#fff" />
                                                    </TouchableOpacity>
                                                </View>
                                            ))}
                                        </View>
                                    )}
                                    {/* Input row */}
                                    <View style={styles.keywordInputRow}>
                                        <TextInput
                                            ref={keywordInputRef}
                                            style={styles.keywordInput}
                                            value={keywordInput}
                                            onChangeText={v => {
                                                if (v.endsWith(',')) { addKeyword(v); }
                                                else { setKeywordInput(v); }
                                            }}
                                            onSubmitEditing={() => addKeyword(keywordInput)}
                                            placeholder="Type and press Enter..."
                                            placeholderTextColor="rgba(0,0,0,0.3)"
                                            returnKeyType="done"
                                        />
                                        <TouchableOpacity
                                            style={[styles.addKeywordBtn, !keywordInput.trim() && { opacity: 0.4 }]}
                                            onPress={() => addKeyword(keywordInput)}
                                            disabled={!keywordInput.trim()}
                                        >
                                            <Ionicons name="add" size={16} color="#fff" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        </>
                    )}

                    {activeSection === 'security' && (
                        <>
                            <View style={styles.sectionTitleRow}>
                                <Ionicons name="shield" size={14} color="#9C27B0" />
                                <Text style={styles.sectionTitle}>Security Settings</Text>
                            </View>
                            
                            <PrivacyToggle
                                label="Two-Factor Authentication"
                                description="Add an extra layer of security using synergy traits."
                                value={!!preferences?.synergy_traits?.two_factor_enabled}
                                onValueChange={(val) => {
                                    const traits = preferences?.synergy_traits || {};
                                    handleUpdatePreference('synergy_traits', { ...traits, two_factor_enabled: val });
                                }}
                                icon="key"
                                color="#1063FD"
                            />

                            <TouchableOpacity
                                style={styles.actionCard}
                                onPress={() => setShowPasswordModal(true)}
                            >
                                <View style={styles.actionContent}>
                                    <View style={[styles.actionIcon, { backgroundColor: '#9C27B015' }]}>
                                        <Ionicons name="lock-closed" size={22} color="#9C27B0" />
                                    </View>
                                    <View style={styles.actionTextContainer}>
                                        <Text style={styles.actionLabel}>Change Password</Text>
                                        <Text style={styles.actionDescription}>Update your credentials for better security.</Text>
                                    </View>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color="#999" />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.actionCard}
                                onPress={handleExport}
                                disabled={isExporting}
                            >
                                <View style={styles.actionContent}>
                                    <View style={[styles.actionIcon, { backgroundColor: '#4CAF5015' }]}>
                                        {isExporting ? (
                                            <ActivityIndicator size="small" color="#4CAF50" />
                                        ) : (
                                            <Ionicons name="download" size={22} color="#4CAF50" />
                                        )}
                                    </View>
                                    <View style={styles.actionTextContainer}>
                                        <Text style={styles.actionLabel}>Data Export</Text>
                                        <Text style={styles.actionDescription}>
                                            {isExporting ? 'Preparing your package...' : 'Download a copy of your data.'}
                                        </Text>
                                    </View>
                                </View>
                                {!isExporting && <Ionicons name="chevron-forward" size={20} color="#999" />}
                            </TouchableOpacity>
                        </>
                    )}

                    {/* Privacy Info Box */}
                    <View style={styles.infoBox}>
                        <Ionicons name="shield-checkmark" size={20} color="#1063FD" />
                        <Text style={styles.infoText}>
                            Your privacy settings are synchronized across all devices in real-time.
                            Changes may take a few moments to apply everywhere.
                        </Text>
                    </View>
                </MotiView>
            </Animated.ScrollView>

            <Modal
                visible={showPasswordModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowPasswordModal(false)}
            >
                <KeyboardAvoidingView 
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.modalOverlay}
                >
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View style={[styles.actionIcon, { backgroundColor: '#9C27B015' }]}>
                                <Ionicons name="lock-closed" size={24} color="#9C27B0" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.modalTitle}>Change Password</Text>
                                <Text style={styles.modalSubtitle}>Please enter your credentials below</Text>
                            </View>
                            <TouchableOpacity 
                                onPress={() => setShowPasswordModal(false)}
                                style={styles.closeButton}
                            >
                                <Ionicons name="close" size={24} color="#999" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.modalBody}>
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Current Password</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    secureTextEntry
                                    value={currentPassword}
                                    onChangeText={setCurrentPassword}
                                    placeholder="Enter current password"
                                    placeholderTextColor="#AAA"
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>New Password</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    secureTextEntry
                                    value={newPassword}
                                    onChangeText={setNewPassword}
                                    placeholder="Min 8 characters"
                                    placeholderTextColor="#AAA"
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Confirm New Password</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    secureTextEntry
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                    placeholder="Repeat new password"
                                    placeholderTextColor="#AAA"
                                />
                            </View>

                            <TouchableOpacity 
                                style={[styles.updateButton, isUpdatingPassword && { opacity: 0.7 }]}
                                onPress={handleUpdatePassword}
                                disabled={isUpdatingPassword}
                            >
                                {isUpdatingPassword ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <>
                                        <Text style={styles.updateButtonText}>Update Password</Text>
                                        <Ionicons name="shield-checkmark" size={18} color="#fff" />
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    headerCenter: { alignItems: 'center' },
    headerTitle: { fontSize: 20, fontWeight: '800', color: '#1a1a1a' },
    headerUnderline: {
        width: 40,
        height: 3,
        backgroundColor: '#1063FD',
        borderRadius: 2,
        marginTop: 4,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F5F5F7',
        justifyContent: 'center',
        alignItems: 'center',
    },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 12, color: '#666', fontSize: 14 },
    sectionNav: {
        maxHeight: 50,
        marginTop: 16,
    },
    sectionNavContent: {
        paddingHorizontal: 20,
        gap: 8,
    },
    sectionButton: {
        borderRadius: 25,
        overflow: 'hidden',
    },
    sectionButtonActive: {
        ...createShadow({ opacity: 0.2, radius: 8 }),
    },
    sectionButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        gap: 6,
    },
    sectionButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#666',
    },
    sectionButtonTextActive: {
        color: '#fff',
    },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 100 },
    privacyScoreCard: {
        borderRadius: 24,
        padding: 20,
        marginBottom: 24,
        marginTop: 10,
        ...createShadow({ opacity: 0.15, radius: 12 }),
    },
    privacyScoreLabel: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.8)',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 4,
    },
    privacyScore: {
        fontSize: 32,
        fontWeight: '800',
        color: '#fff',
        marginBottom: 8,
    },
    privacyScoreBar: {
        height: 6,
        backgroundColor: 'rgba(255,255,255,0.3)',
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: 8,
    },
    privacyScoreFill: {
        height: '100%',
        backgroundColor: '#fff',
        borderRadius: 3,
    },
    privacyScoreHint: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.7)',
    },
    sectionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 10,
        marginBottom: 15,
        marginLeft: 5,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: '#1063FD',
        textTransform: 'uppercase',
        letterSpacing: 1.5,
    },
    toggleCard: {
        borderRadius: 20,
        padding: 18,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: '#e5e5e5',
        ...createShadow({ opacity: 0.05, radius: 8 }),
    },
    toggleInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 15 },
    iconContainer: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    textContainer: { flex: 1 },
    toggleLabel: { fontSize: 16, fontWeight: '700', color: '#000', marginBottom: 2 },
    toggleDescription: { fontSize: 12, color: 'rgba(0,0,0,0.5)', lineHeight: 16 },
    warningBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 4 },
    warningText: { fontSize: 11, color: '#FF9800', fontWeight: '600' },
    actionCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 18,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: '#e5e5e5',
        ...createShadow({ opacity: 0.05, radius: 8 }),
    },
    actionContent: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 15 },
    actionIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    actionLabel: { fontSize: 16, fontWeight: '700', color: '#000', marginBottom: 2, marginLeft: 12 },
    actionDescription: { fontSize: 12, color: 'rgba(0,0,0,0.5)', lineHeight: 16, marginLeft: 12, marginBottom: 8 },
    chipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginLeft: 12, marginBottom: 8 },
    chip: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#9C27B0',
        borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, gap: 4,
    },
    chipText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    chipRemove: { marginLeft: 2 },
    keywordInputRow: {
        flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 12, marginTop: 4,
    },
    keywordInput: {
        flex: 1, borderWidth: 1, borderColor: '#e5e5e5', borderRadius: 12,
        padding: 10, fontSize: 13, color: '#000', fontWeight: '500',
    },
    addKeywordBtn: {
        width: 32, height: 32, borderRadius: 16, backgroundColor: '#9C27B0',
        justifyContent: 'center', alignItems: 'center',
    },
    infoBox: {
        marginTop: 30,
        flexDirection: 'row',
        backgroundColor: '#F8F9FA',
        padding: 16,
        borderRadius: 20,
        gap: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e5e5e5',
    },
    infoText: { flex: 1, fontSize: 12, color: 'rgba(0,0,0,0.6)', lineHeight: 16, fontWeight: '500' },
    // Interactions & Security Extended Styles
    actionCardCol: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 18,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#e5e5e5',
        ...createShadow({ opacity: 0.05, radius: 8 }),
    },
    actionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 15,
    },
    blockedList: {
        marginTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
        paddingTop: 10,
    },
    blockedItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f9f9f9',
    },
    blockedUserInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    blockedAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#f0f0f0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    blockedAvatarText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#666',
    },
    blockedName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#000',
    },
    blockedUsername: {
        fontSize: 12,
        color: '#999',
    },
    unblockBtn: {
        backgroundColor: '#F5F5F7',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    unblockBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#FF3B30',
    },
    emptyListText: {
        fontSize: 13,
        color: '#999',
        textAlign: 'center',
        paddingVertical: 20,
        fontStyle: 'italic',
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        paddingBottom: 40,
        ...createShadow({ opacity: 0.2, radius: 20 }),
        ...Platform.select({
            web: {
                maxWidth: 1440,
                width: '100%',
                alignSelf: 'center',
            }
        })
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
        gap: 15,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#000',
    },
    modalSubtitle: {
        fontSize: 13,
        color: '#666',
        marginTop: 2,
    },
    closeButton: {
        padding: 4,
    },
    modalBody: {
        gap: 20,
    },
    inputGroup: {
        gap: 8,
    },
    inputLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: '#333',
        marginLeft: 4,
    },
    modalInput: {
        backgroundColor: '#F5F5F7',
        borderRadius: 16,
        padding: 16,
        fontSize: 15,
        color: '#000',
        borderWidth: 1,
        borderColor: '#E5E5E7',
    },
    updateButton: {
        backgroundColor: '#9C27B0',
        borderRadius: 18,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        marginTop: 10,
        ...createShadow({ color: '#9C27B0', opacity: 0.3, radius: 10 }),
    },
    updateButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
});