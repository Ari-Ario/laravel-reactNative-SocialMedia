// app/(settings)/AccountSettingsScreen.tsx
import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    TextInput,
    ActivityIndicator,
    Alert,
    Platform,
    StatusBar,
    Dimensions,
    Animated,
    Modal,
    FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MotiView, AnimatePresence } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AuthContext from '@/context/AuthContext';
import { fetchFullSettings, updateFullSettings, deleteAccount } from '@/services/SettingService';
import { loadUser } from '@/services/AuthService';
import { createShadow } from '@/utils/styles';

const SOCIAL_PLATFORMS = [
    { id: 'whatsapp', platform: 'WhatsApp', icon: 'logo-whatsapp', color: '#25D366' },
    { id: 'telegram', platform: 'Telegram', icon: 'logo-telegram', color: '#0088cc' },
    { id: 'twitter', platform: 'Twitter', icon: 'logo-twitter', color: '#1a1a1a' },
    { id: 'instagram', platform: 'Instagram', icon: 'logo-instagram', color: '#E4405F' },
    { id: 'facebook', platform: 'Facebook', icon: 'logo-facebook', color: '#1877F2' },
    { id: 'linkedin', platform: 'LinkedIn', icon: 'logo-linkedin', color: '#0077B5' },
    { id: 'tiktok', platform: 'TikTok', icon: 'musical-notes', color: '#000000' },
    { id: 'youtube', platform: 'YouTube', icon: 'logo-youtube', color: '#FF0000' },
];

const GENDER_OPTIONS = [
    { value: 'male', label: 'Male', icon: '👨' },
    { value: 'female', label: 'Female', icon: '👩' },
    { value: 'non_binary', label: 'Non-binary', icon: '🧑' },
    { value: 'prefer_not', label: 'Prefer not to say', icon: '🔒' },
    { value: 'other', label: 'Other', icon: '✨' },
];

const EDUCATION_LEVELS = [
    'High School', "Associate's Degree", "Bachelor's Degree", "Master's Degree",
    'Doctorate / PhD', 'Professional Degree', 'Trade / Vocational', 'Self-taught', 'Other'
];

const isWeb = Platform.OS === 'web';
const { width } = Dimensions.get('window');

// ─── Date Picker (platform-aware) ────────────────────────────────────────────
interface DatePickerModalProps {
    visible: boolean;
    value: string; // ISO date string or ''
    onConfirm: (date: string) => void;
    onClose: () => void;
}
const DatePickerModal = ({ visible, value, onConfirm, onClose }: DatePickerModalProps) => {
    const parsed = value ? new Date(value) : new Date(1995, 0, 1);
    const [year, setYear] = useState(String(parsed.getFullYear()));
    const [month, setMonth] = useState(String(parsed.getMonth() + 1).padStart(2, '0'));
    const [day, setDay] = useState(String(parsed.getDate()).padStart(2, '0'));
    const [webDate, setWebDate] = useState(value || '1995-01-01');

    const handleConfirm = () => {
        if (isWeb) {
            onConfirm(webDate);
        } else {
            const iso = `${year}-${month}-${day}`;
            const d = new Date(iso);
            if (isNaN(d.getTime())) {
                Alert.alert('Invalid Date', 'Please enter a valid date.');
                return;
            }
            onConfirm(iso);
        }
    };

    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <TouchableOpacity style={modalStyles.overlay} activeOpacity={1} onPress={onClose}>
                <MotiView
                    from={{ translateY: 300, opacity: 0 }}
                    animate={{ translateY: 0, opacity: 1 }}
                    transition={{ type: 'spring', damping: 22 }}
                    style={modalStyles.sheet}
                >
                    <TouchableOpacity activeOpacity={1}>
                        <View style={modalStyles.handle} />
                        <View style={modalStyles.header}>
                            <TouchableOpacity onPress={onClose}>
                                <Text style={modalStyles.cancelBtn}>Cancel</Text>
                            </TouchableOpacity>
                            <Text style={modalStyles.title}>Date of Birth</Text>
                            <TouchableOpacity onPress={handleConfirm}>
                                <Text style={modalStyles.doneBtn}>Done</Text>
                            </TouchableOpacity>
                        </View>

                        {isWeb ? (
                            <View style={modalStyles.webDateContainer}>
                                <Text style={modalStyles.webDateLabel}>Select your birthday</Text>
                                {/* Use a hidden HTML input on web */}
                                <input
                                    type="date"
                                    value={webDate}
                                    max={new Date().toISOString().split('T')[0]}
                                    onChange={(e: any) => setWebDate(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: 14,
                                        fontSize: 18,
                                        borderRadius: 12,
                                        border: '2px solid #e5e5e5',
                                        outline: 'none',
                                        fontFamily: 'inherit',
                                        color: '#1a1a1a',
                                        backgroundColor: '#F8F9FA',
                                        marginTop: 8,
                                    }}
                                />
                            </View>
                        ) : (
                            <View style={modalStyles.pickerRow}>
                                {/* Day */}
                                <View style={modalStyles.pickerCol}>
                                    <Text style={modalStyles.pickerLabel}>Day</Text>
                                    <TextInput
                                        style={modalStyles.pickerInput}
                                        value={day}
                                        onChangeText={v => setDay(v.replace(/\D/, '').slice(0, 2))}
                                        keyboardType="number-pad"
                                        maxLength={2}
                                        placeholder="DD"
                                        placeholderTextColor="#ccc"
                                    />
                                </View>
                                {/* Month */}
                                <View style={modalStyles.pickerCol}>
                                    <Text style={modalStyles.pickerLabel}>Month</Text>
                                    <ScrollView style={modalStyles.monthScroll} showsVerticalScrollIndicator={false}>
                                        {MONTHS.map((m, i) => (
                                            <TouchableOpacity
                                                key={m}
                                                style={[modalStyles.monthItem, month === String(i + 1).padStart(2, '0') && modalStyles.monthItemActive]}
                                                onPress={() => setMonth(String(i + 1).padStart(2, '0'))}
                                            >
                                                <Text style={[modalStyles.monthText, month === String(i + 1).padStart(2, '0') && modalStyles.monthTextActive]}>
                                                    {m}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                                {/* Year */}
                                <View style={modalStyles.pickerCol}>
                                    <Text style={modalStyles.pickerLabel}>Year</Text>
                                    <TextInput
                                        style={modalStyles.pickerInput}
                                        value={year}
                                        onChangeText={v => setYear(v.replace(/\D/, '').slice(0, 4))}
                                        keyboardType="number-pad"
                                        maxLength={4}
                                        placeholder="YYYY"
                                        placeholderTextColor="#ccc"
                                    />
                                </View>
                            </View>
                        )}

                        <View style={{ height: 30 }} />
                    </TouchableOpacity>
                </MotiView>
            </TouchableOpacity>
        </Modal>
    );
};

// ─── Gender Picker ────────────────────────────────────────────────────────────
interface GenderPickerModalProps {
    visible: boolean;
    value: string;
    onSelect: (val: string) => void;
    onClose: () => void;
}
const GenderPickerModal = ({ visible, value, onSelect, onClose }: GenderPickerModalProps) => (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <TouchableOpacity style={modalStyles.overlay} activeOpacity={1} onPress={onClose}>
            <MotiView
                from={{ translateY: 300, opacity: 0 }}
                animate={{ translateY: 0, opacity: 1 }}
                transition={{ type: 'spring', damping: 22 }}
                style={modalStyles.sheet}
            >
                <TouchableOpacity activeOpacity={1}>
                    <View style={modalStyles.handle} />
                    <View style={modalStyles.header}>
                        <Text style={modalStyles.title}>Gender Identity</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={22} color="#666" />
                        </TouchableOpacity>
                    </View>
                    {GENDER_OPTIONS.map(opt => (
                        <TouchableOpacity
                            key={opt.value}
                            style={[modalStyles.genderItem, value === opt.value && modalStyles.genderItemActive]}
                            onPress={() => { onSelect(opt.value); onClose(); }}
                        >
                            <Text style={modalStyles.genderEmoji}>{opt.icon}</Text>
                            <Text style={[modalStyles.genderLabel, value === opt.value && modalStyles.genderLabelActive]}>
                                {opt.label}
                            </Text>
                            {value === opt.value && (
                                <Ionicons name="checkmark-circle" size={20} color="#1063FD" />
                            )}
                        </TouchableOpacity>
                    ))}
                    <View style={{ height: 30 }} />
                </TouchableOpacity>
            </MotiView>
        </TouchableOpacity>
    </Modal>
);

// ─── Education Picker ─────────────────────────────────────────────────────────
interface EducationPickerModalProps {
    visible: boolean;
    value: string;
    onSelect: (val: string) => void;
    onClose: () => void;
}
const EducationPickerModal = ({ visible, value, onSelect, onClose }: EducationPickerModalProps) => (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <TouchableOpacity style={modalStyles.overlay} activeOpacity={1} onPress={onClose}>
            <MotiView
                from={{ translateY: 300, opacity: 0 }}
                animate={{ translateY: 0, opacity: 1 }}
                transition={{ type: 'spring', damping: 22 }}
                style={modalStyles.sheet}
            >
                <TouchableOpacity activeOpacity={1}>
                    <View style={modalStyles.handle} />
                    <View style={modalStyles.header}>
                        <Text style={modalStyles.title}>Education Level</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={22} color="#666" />
                        </TouchableOpacity>
                    </View>
                    <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
                        {EDUCATION_LEVELS.map(lvl => (
                            <TouchableOpacity
                                key={lvl}
                                style={[modalStyles.genderItem, value === lvl && modalStyles.genderItemActive]}
                                onPress={() => { onSelect(lvl); onClose(); }}
                            >
                                <Ionicons name="school-outline" size={18} color={value === lvl ? '#1063FD' : '#666'} style={{ marginRight: 12 }} />
                                <Text style={[modalStyles.genderLabel, value === lvl && modalStyles.genderLabelActive]}>
                                    {lvl}
                                </Text>
                                {value === lvl && (
                                    <Ionicons name="checkmark-circle" size={20} color="#1063FD" />
                                )}
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                    <View style={{ height: 30 }} />
                </TouchableOpacity>
            </MotiView>
        </TouchableOpacity>
    </Modal>
);

// ─── Editable Field ───────────────────────────────────────────────────────────
interface EditableFieldProps {
    label: string;
    value: string;
    icon: string;
    onSave: (newValue: string) => Promise<void>;
    multiline?: boolean;
    keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'url';
    hint?: string;
    maxLength?: number;
    prefix?: string;
}

const EditableField = ({ label, value, icon, onSave, multiline, keyboardType = 'default', hint, maxLength = 255, prefix }: EditableFieldProps) => {
    const [isEditing, setIsEditing] = useState(false);
    const [tempValue, setTempValue] = useState(value);
    const [loading, setLoading] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const inputRef = useRef<TextInput>(null);
    const scaleAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (isEditing) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isEditing]);

    useEffect(() => {
        setTempValue(value);
    }, [value]);

    const handleSave = async () => {
        if (tempValue === value) {
            setIsEditing(false);
            return;
        }
        setLoading(true);
        try {
            await onSave(tempValue);
            setIsEditing(false);
            Animated.sequence([
                Animated.spring(scaleAnim, { toValue: 1.02, useNativeDriver: true, friction: 3 }),
                Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 3 }),
            ]).start();
        } catch (error) {
            Alert.alert('Error', 'Failed to update ' + label);
            setTempValue(value);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setIsEditing(true)}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                <LinearGradient
                    colors={isHovered ? ['rgba(0,132,255,0.02)', 'rgba(0,132,255,0.05)'] : ['#fff', '#fff']}
                    style={[styles.fieldCard, isEditing && styles.fieldCardEditing]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                >
                    <View style={styles.fieldHeader}>
                        <View style={styles.fieldLabelRow}>
                            <View style={styles.iconContainer}>
                                <Ionicons name={icon as any} size={18} color="#0084ff" />
                            </View>
                            <Text style={styles.fieldLabel}>{label}</Text>
                            {value && !isEditing && (
                                <View style={styles.verifiedBadge}>
                                    <Ionicons name="checkmark-circle" size={12} color="#4CAF50" />
                                </View>
                            )}
                        </View>
                        {!isEditing && (
                            <MotiView
                                from={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: isHovered ? 1 : 0, scale: isHovered ? 1 : 0.8 }}
                                transition={{ type: 'timing' }}
                            >
                                <TouchableOpacity onPress={() => setIsEditing(true)}>
                                    <Ionicons name="pencil" size={16} color="#0084ff" />
                                </TouchableOpacity>
                            </MotiView>
                        )}
                    </View>

                    {isEditing ? (
                        <MotiView
                            from={{ opacity: 0, translateY: -10 }}
                            animate={{ opacity: 1, translateY: 0 }}
                            style={styles.inputContainer}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
                                <TextInput
                                    ref={inputRef}
                                    style={[styles.input, multiline && styles.multilineInput]}
                                    value={tempValue}
                                    onChangeText={setTempValue}
                                    onBlur={handleSave}
                                    onSubmitEditing={handleSave}
                                    multiline={multiline}
                                    keyboardType={keyboardType}
                                    placeholder={`Enter ${label.toLowerCase()}...`}
                                    placeholderTextColor="rgba(0,0,0,0.3)"
                                    maxLength={maxLength}
                                />
                            </View>
                            {loading && <ActivityIndicator size="small" color="#0084ff" />}
                            <TouchableOpacity onPress={() => setIsEditing(false)} style={styles.cancelEdit}>
                                <Ionicons name="close" size={18} color="#999" />
                            </TouchableOpacity>
                        </MotiView>
                    ) : (
                        <View>
                            <Text style={[styles.fieldValue, !value && styles.placeholderValue]}>
                                {value ? (prefix ? `${prefix}${value}` : value) : `Tap to set ${label.toLowerCase()}`}
                            </Text>
                            {hint && !value && (
                                <Text style={styles.hintText}>{hint}</Text>
                            )}
                        </View>
                    )}

                    {isEditing && multiline && (
                        <View style={styles.charCountContainer}>
                            <View style={styles.charCountBar}>
                                <View
                                    style={[
                                        styles.charCountFill,
                                        { width: `${Math.min((tempValue.length / maxLength) * 100, 100)}%` as any }
                                    ]}
                                />
                            </View>
                            <Text style={styles.charCountText}>{tempValue.length}/{maxLength}</Text>
                        </View>
                    )}
                </LinearGradient>
            </TouchableOpacity>
        </Animated.View>
    );
};

// ─── Picker Display Field (non-editable, opens modal) ─────────────────────────
interface PickerFieldProps {
    label: string;
    displayValue: string;
    icon: string;
    onPress: () => void;
    color?: string;
    empty?: boolean;
}
const PickerField = ({ label, displayValue, icon, onPress, color = '#0084ff', empty }: PickerFieldProps) => (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        <LinearGradient
            colors={['#fff', '#fff']}
            style={styles.fieldCard}
        >
            <View style={styles.fieldHeader}>
                <View style={styles.fieldLabelRow}>
                    <View style={styles.iconContainer}>
                        <Ionicons name={icon as any} size={18} color={color} />
                    </View>
                    <Text style={styles.fieldLabel}>{label}</Text>
                    {!empty && (
                        <View style={styles.verifiedBadge}>
                            <Ionicons name="checkmark-circle" size={12} color="#4CAF50" />
                        </View>
                    )}
                </View>
                <Ionicons name="chevron-down" size={18} color="#ccc" />
            </View>
            <Text style={[styles.fieldValue, empty && styles.placeholderValue]}>
                {empty ? `Tap to select ${label.toLowerCase()}` : displayValue}
            </Text>
        </LinearGradient>
    </TouchableOpacity>
);

// ─── Social Link Item ─────────────────────────────────────────────────────────
interface SocialLinkItemProps {
    platform: any;
    value: string;
    onSave: (val: string) => Promise<void>;
    index: number;
}
const SocialLinkItem = ({ platform, value, onSave, index }: SocialLinkItemProps) => {
    const [isEditing, setIsEditing] = useState(false);
    const [tempValue, setTempValue] = useState(value);
    const [loading, setLoading] = useState(false);
    const inputRef = useRef<TextInput>(null);

    useEffect(() => {
        if (isEditing) setTimeout(() => inputRef.current?.focus(), 100);
    }, [isEditing]);

    const handleSave = async () => {
        if (tempValue === value) { setIsEditing(false); return; }
        setLoading(true);
        try {
            await onSave(tempValue);
            setIsEditing(false);
        } catch (error) {
            Alert.alert('Error', 'Failed to update ' + platform.platform);
            setTempValue(value);
        } finally {
            setLoading(false);
        }
    };

    return (
        <MotiView
            from={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 400 + index * 50 }}
            style={[styles.socialItem, isEditing && styles.socialItemEditing]}
        >
            <TouchableOpacity
                style={styles.socialHeader}
                onPress={() => setIsEditing(!isEditing)}
                activeOpacity={0.7}
            >
                <View style={[styles.socialIconBg, { backgroundColor: platform.color + '15' }]}>
                    <Ionicons name={platform.icon} size={20} color={platform.color} />
                </View>
                {!isEditing && (
                    <Text style={[styles.socialValue, !value && styles.placeholderSocial]} numberOfLines={1}>
                        {value || 'Add link'}
                    </Text>
                )}
                {isEditing && (
                    <TextInput
                        ref={inputRef}
                        style={styles.socialInput}
                        value={tempValue}
                        onChangeText={setTempValue}
                        onBlur={handleSave}
                        onSubmitEditing={handleSave}
                        placeholder="@username or URL"
                        placeholderTextColor="rgba(0,0,0,0.3)"
                        autoCapitalize="none"
                    />
                )}
                {loading ? (
                    <ActivityIndicator size="small" color={platform.color} />
                ) : (
                    <Ionicons
                        name={isEditing ? "checkmark" : (value ? "checkmark-circle" : "add")}
                        size={16}
                        color={isEditing ? platform.color : (value ? "#4CAF50" : "rgba(0,0,0,0.2)")}
                    />
                )}
            </TouchableOpacity>
            {!isEditing && value ? (
                <Text style={styles.socialPlatformName}>{platform.platform}</Text>
            ) : null}
        </MotiView>
    );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AccountSettingsScreen() {
    const insets = useSafeAreaInsets();
    const { user, setUser } = useContext(AuthContext);
    const [fullSettings, setFullSettings] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeSection, setActiveSection] = useState('identity');
    const scrollY = useRef(new Animated.Value(0)).current;

    // Pickers
    const [showGenderPicker, setShowGenderPicker] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showEducationPicker, setShowEducationPicker] = useState(false);

    const headerOpacity = scrollY.interpolate({
        inputRange: [0, 100],
        outputRange: [0, 1],
        extrapolate: 'clamp',
    });

    useEffect(() => { loadSettings(); }, []);

    const loadSettings = async () => {
        try {
            setLoading(true);
            const data = await fetchFullSettings();
            setFullSettings(data.user);
            if (data.user) setUser((prev: any) => ({ ...prev, ...data.user }));
        } catch (error) {
            console.error('Failed to load settings:', error);
            Alert.alert('Error', 'Could not refresh settings. Please check your connection.');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = async (field: string, value: string) => {
        try {
            await updateFullSettings({ [field]: value });
            const updated = await loadUser();
            setUser(updated);
            setFullSettings((prev: any) => ({ ...prev, [field]: value }));
        } catch (error) {
            throw error;
        }
    };

    const handleSocialUpdate = async (platformId: string, value: string) => {
        const currentLinks = fullSettings?.social_links || {};
        const updatedLinks = { ...currentLinks, [platformId]: value };
        try {
            await updateFullSettings({ social_links: updatedLinks });
            setFullSettings((prev: any) => ({ ...prev, social_links: updatedLinks }));
        } catch (error) {
            throw error;
        }
    };

    const handleDeleteAccount = () => {
        Alert.alert(
            'Delete Account',
            'This action is permanent. All your data will be lost forever.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                        Alert.prompt(
                            'Confirm Password',
                            'Please enter your password to confirm account deletion',
                            [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                    text: 'Delete',
                                    style: 'destructive',
                                    onPress: async (password) => {
                                        if (!password) return;
                                        try {
                                            await deleteAccount(password);
                                            setUser(null);
                                            router.replace('/LoginScreen');
                                        } catch (error) {
                                            Alert.alert('Error', 'Incorrect password or deletion failed.');
                                        }
                                    }
                                }
                            ],
                            'secure-text'
                        );
                    }
                }
            ]
        );
    };

    const genderDisplayValue = () => {
        const opt = GENDER_OPTIONS.find(o => o.value === fullSettings?.gender);
        return opt ? `${opt.icon} ${opt.label}` : '';
    };

    const birthdayDisplayValue = () => {
        if (!fullSettings?.birthday) return '';
        try {
            return new Date(fullSettings.birthday).toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric'
            });
        } catch { return fullSettings.birthday; }
    };

    const sections = [
        { id: 'identity', label: 'Identity', icon: 'person', color: '#0084ff' },
        { id: 'contact', label: 'Contact', icon: 'call', color: '#4CAF50' },
        { id: 'social', label: 'Social', icon: 'share-social', color: '#FF2D55' },
        { id: 'professional', label: 'Professional', icon: 'briefcase', color: '#FF9800' },
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
                <Ionicons name={icon} size={16} color={activeSection === id ? '#fff' : color} />
                <Text style={[styles.sectionButtonText, activeSection === id && styles.sectionButtonTextActive]}>
                    {label}
                </Text>
            </LinearGradient>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />

            {/* Pickers */}
            <GenderPickerModal
                visible={showGenderPicker}
                value={fullSettings?.gender || ''}
                onSelect={val => handleUpdate('gender', val)}
                onClose={() => setShowGenderPicker(false)}
            />
            <DatePickerModal
                visible={showDatePicker}
                value={fullSettings?.birthday || ''}
                onConfirm={val => handleUpdate('birthday', val)}
                onClose={() => setShowDatePicker(false)}
            />
            <EducationPickerModal
                visible={showEducationPicker}
                value={fullSettings?.education || ''}
                onSelect={val => handleUpdate('education', val)}
                onClose={() => setShowEducationPicker(false)}
            />

            {/* Header */}
            <LinearGradient
                colors={['#fff', '#f8f9fa']}
                style={[styles.header, { paddingTop: insets.top + 10 }]}
            >
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>

                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>Account Identity</Text>
                    <Animated.View style={[styles.headerUnderline, { opacity: headerOpacity }]} />
                </View>

                <TouchableOpacity onPress={loadSettings} style={styles.refreshButton}>
                    <Ionicons name="refresh" size={20} color="#0084ff" />
                </TouchableOpacity>
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

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#0084ff" />
                    <Text style={styles.loadingText}>Loading your profile...</Text>
                </View>
            ) : (
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

                        {/* ── Identity Section ── */}
                        {activeSection === 'identity' && (
                            <>
                                <Text style={styles.sectionTitle}>Identity</Text>
                                <EditableField
                                    label="Full Name"
                                    value={fullSettings?.name || ''}
                                    icon="person-outline"
                                    onSave={val => handleUpdate('name', val)}
                                    hint="Your real name helps people find you"
                                />
                                <EditableField
                                    label="Username"
                                    value={fullSettings?.username || ''}
                                    icon="at-outline"
                                    onSave={val => handleUpdate('username', val)}
                                    hint="Unique handle for @mentions"
                                    prefix="@"
                                    maxLength={30}
                                />
                                {/* Birthday — Date Picker */}
                                <PickerField
                                    label="Birthday"
                                    displayValue={birthdayDisplayValue()}
                                    icon="calendar-outline"
                                    onPress={() => setShowDatePicker(true)}
                                    empty={!fullSettings?.birthday}
                                />
                                {/* Gender — Picker */}
                                <PickerField
                                    label="Gender Identity"
                                    displayValue={genderDisplayValue()}
                                    icon="transgender-outline"
                                    onPress={() => setShowGenderPicker(true)}
                                    empty={!fullSettings?.gender}
                                    color="#9C27B0"
                                />
                                <EditableField
                                    label="Bio"
                                    value={fullSettings?.bio || ''}
                                    icon="book-outline"
                                    multiline
                                    maxLength={150}
                                    onSave={val => handleUpdate('bio', val)}
                                    hint="Tell the world about yourself"
                                />
                            </>
                        )}

                        {/* ── Social Section ── */}
                        {activeSection === 'social' && (
                            <>
                                <View style={styles.sectionHeaderRow}>
                                    <Text style={styles.sectionTitle}>Social Profiles</Text>
                                    <View style={styles.premiumBadge}>
                                        <Ionicons name="sparkles" size={10} color="#fff" />
                                        <Text style={styles.premiumText}>Verified</Text>
                                    </View>
                                </View>
                                <View style={styles.socialGrid}>
                                    {SOCIAL_PLATFORMS.map((platform, index) => (
                                        <SocialLinkItem
                                            key={platform.id}
                                            platform={platform}
                                            index={index}
                                            value={fullSettings?.social_links?.[platform.id] || ''}
                                            onSave={val => handleSocialUpdate(platform.id, val)}
                                        />
                                    ))}
                                </View>
                                <View style={styles.socialTip}>
                                    <Ionicons name="information-circle-outline" size={14} color="#666" />
                                    <Text style={styles.socialTipText}>Enter your username or full profile URL for each platform.</Text>
                                </View>
                            </>
                        )}

                        {/* ── Contact Section ── */}
                        {activeSection === 'contact' && (
                            <>
                                <Text style={styles.sectionTitle}>Contact Information</Text>
                                <EditableField
                                    label="Email Address"
                                    value={fullSettings?.email || ''}
                                    icon="mail-outline"
                                    keyboardType="email-address"
                                    onSave={val => handleUpdate('email', val)}
                                    hint="Used for login and notifications"
                                />
                                <EditableField
                                    label="Phone Number"
                                    value={fullSettings?.phone || ''}
                                    icon="call-outline"
                                    keyboardType="phone-pad"
                                    onSave={val => handleUpdate('phone', val)}
                                    hint="Include country code (e.g. +1 555 000 0000)"
                                    prefix="+"
                                    maxLength={20}
                                />
                                <EditableField
                                    label="Location"
                                    value={fullSettings?.location || ''}
                                    icon="location-outline"
                                    onSave={val => handleUpdate('location', val)}
                                    hint="City, Country — visible on your profile"
                                    maxLength={100}
                                />
                            </>
                        )}

                        {/* ── Professional Section ── */}
                        {activeSection === 'professional' && (
                            <>
                                <Text style={styles.sectionTitle}>Professional Details</Text>
                                <EditableField
                                    label="Job Title"
                                    value={fullSettings?.job_title || ''}
                                    icon="briefcase-outline"
                                    onSave={val => handleUpdate('job_title', val)}
                                    hint="e.g. Senior Developer, Designer, CEO"
                                />
                                <EditableField
                                    label="Company / Organization"
                                    value={fullSettings?.company || ''}
                                    icon="business-outline"
                                    onSave={val => handleUpdate('company', val)}
                                    hint="Where you currently work"
                                />
                                {/* Education — Picker */}
                                <PickerField
                                    label="Education Level"
                                    displayValue={fullSettings?.education || ''}
                                    icon="school-outline"
                                    onPress={() => setShowEducationPicker(true)}
                                    empty={!fullSettings?.education}
                                    color="#FF9800"
                                />
                                <EditableField
                                    label="Personal Website"
                                    value={fullSettings?.website || ''}
                                    icon="globe-outline"
                                    keyboardType="url"
                                    onSave={val => handleUpdate('website', val)}
                                    hint="https://yourwebsite.com"
                                    maxLength={255}
                                />
                            </>
                        )}

                        {/* Delete Account Section */}
                        <MotiView
                            from={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 300 }}
                            style={styles.deleteSection}
                        >
                            <View style={styles.deleteWarning}>
                                <Ionicons name="warning" size={20} color="#FF3B30" />
                                <Text style={styles.deleteWarningText}>Danger Zone</Text>
                            </View>
                            <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAccount}>
                                <LinearGradient
                                    colors={['#FFF0F0', '#FFE5E5']}
                                    style={styles.deleteButtonGradient}
                                >
                                    <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                                    <Text style={styles.deleteButtonText}>Delete Account Permanently</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                            <Text style={styles.deleteNote}>
                                This action cannot be undone. All your data will be permanently removed.
                            </Text>
                        </MotiView>
                    </MotiView>
                </Animated.ScrollView>
            )}
        </View>
    );
}

// ─── Picker Modal Styles ──────────────────────────────────────────────────────
const modalStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingHorizontal: 20,
        paddingTop: 8,
        maxHeight: '75%',
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#e5e5e5',
        alignSelf: 'center',
        marginBottom: 12,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        marginBottom: 12,
    },
    title: { fontSize: 18, fontWeight: '800', color: '#1a1a1a' },
    cancelBtn: { fontSize: 15, color: '#666', fontWeight: '600' },
    doneBtn: { fontSize: 15, color: '#0084ff', fontWeight: '800' },
    pickerRow: {
        flexDirection: 'row',
        gap: 12,
        paddingVertical: 12,
    },
    pickerCol: { flex: 1, alignItems: 'center' },
    pickerLabel: { fontSize: 11, fontWeight: '700', color: '#999', textTransform: 'uppercase', marginBottom: 8 },
    pickerInput: {
        width: '100%',
        borderWidth: 2,
        borderColor: '#e5e5e5',
        borderRadius: 12,
        padding: 12,
        fontSize: 20,
        fontWeight: '700',
        textAlign: 'center',
        color: '#1a1a1a',
    },
    monthScroll: { maxHeight: 160, width: '100%' },
    monthItem: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 10,
        marginBottom: 4,
        alignItems: 'center',
    },
    monthItemActive: { backgroundColor: '#0084ff20' },
    monthText: { fontSize: 14, color: '#666', fontWeight: '600' },
    monthTextActive: { color: '#0084ff', fontWeight: '800' },
    webDateContainer: { paddingVertical: 16 },
    webDateLabel: { fontSize: 14, color: '#666', fontWeight: '600', marginBottom: 4 },
    genderItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 16,
        marginBottom: 8,
        backgroundColor: '#F8F9FA',
    },
    genderItemActive: { backgroundColor: '#0084ff10', borderWidth: 2, borderColor: '#0084ff40' },
    genderEmoji: { fontSize: 20, marginRight: 14 },
    genderLabel: { flex: 1, fontSize: 16, fontWeight: '600', color: '#333' },
    genderLabelActive: { color: '#0084ff', fontWeight: '800' },
});

// ─── Screen Styles ────────────────────────────────────────────────────────────
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
    headerUnderline: { width: 40, height: 3, backgroundColor: '#0084ff', borderRadius: 2, marginTop: 4 },
    backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F5F5F7', justifyContent: 'center', alignItems: 'center' },
    refreshButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F5F5F7', justifyContent: 'center', alignItems: 'center' },
    sectionNav: { maxHeight: 50, marginTop: 16 },
    sectionNavContent: { paddingHorizontal: 20, gap: 8 },
    sectionButton: { borderRadius: 25, overflow: 'hidden' },
    sectionButtonActive: { ...createShadow({ opacity: 0.2, radius: 8 }) },
    sectionButtonGradient: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 6 },
    sectionButtonText: { fontSize: 13, fontWeight: '600', color: '#666' },
    sectionButtonTextActive: { color: '#fff' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 12, color: '#666', fontSize: 14 },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 100 },
    sectionTitle: {
        fontSize: 13, fontWeight: '800', color: '#0084ff', textTransform: 'uppercase',
        letterSpacing: 1.5, marginTop: 30, marginBottom: 15, marginLeft: 5,
    },
    sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 30, marginBottom: 15, paddingHorizontal: 5 },
    fieldCard: {
        borderRadius: 20, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: '#e5e5e5',
        ...createShadow({ opacity: 0.05, radius: 8 }),
    },
    fieldCardEditing: { borderColor: '#0084ff', borderWidth: 2, ...createShadow({ opacity: 0.1, radius: 12 }) },
    fieldHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    iconContainer: { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(0,132,255,0.1)', justifyContent: 'center', alignItems: 'center' },
    fieldLabel: { fontSize: 13, fontWeight: '700', color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase' },
    verifiedBadge: { marginLeft: 4 },
    fieldValue: { fontSize: 17, fontWeight: '600', color: '#000' },
    placeholderValue: { color: 'rgba(0,0,0,0.25)', fontStyle: 'italic', fontSize: 15 },
    hintText: { fontSize: 11, color: 'rgba(0,0,0,0.35)', marginTop: 4, fontStyle: 'italic' },
    prefix: { fontSize: 17, fontWeight: '600', color: '#0084ff', marginRight: 2 },
    inputContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
    input: { flex: 1, fontSize: 17, fontWeight: '600', color: '#000', padding: 0 },
    multilineInput: { minHeight: 60, textAlignVertical: 'top' },
    cancelEdit: { padding: 4 },
    charCountContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
    charCountBar: { flex: 1, height: 2, backgroundColor: '#e5e5e5', borderRadius: 1, marginRight: 8, overflow: 'hidden' },
    charCountFill: { height: '100%', backgroundColor: '#0084ff', borderRadius: 1 },
    charCountText: { fontSize: 10, color: '#999' },
    // Social grid
    premiumBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF2D55', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, gap: 4 },
    premiumText: { color: '#fff', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
    socialGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    socialItem: {
        width: (width - 56) / 2,
        backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e5e5e5', overflow: 'hidden',
    },
    socialItemEditing: { borderColor: '#0084ff', borderWidth: 1.5, ...createShadow({ opacity: 0.1, radius: 8 }) },
    socialHeader: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8 },
    socialIconBg: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    socialValue: { flex: 1, fontSize: 13, fontWeight: '600', color: '#1a1a1a' },
    placeholderSocial: { color: 'rgba(0,0,0,0.2)', fontSize: 12 },
    socialInput: { flex: 1, fontSize: 13, fontWeight: '600', color: '#000', padding: 0 },
    socialPlatformName: { fontSize: 10, color: '#999', paddingHorizontal: 12, paddingBottom: 8, fontWeight: '600' },
    socialTip: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16, paddingHorizontal: 8 },
    socialTipText: { fontSize: 12, color: '#666', fontStyle: 'italic', flex: 1 },
    // Delete section
    deleteSection: { marginTop: 40, marginBottom: 20, padding: 16, borderRadius: 20, backgroundColor: '#FFF5F5', borderWidth: 1, borderColor: '#FFCDD2' },
    deleteWarning: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
    deleteWarningText: { fontSize: 13, fontWeight: '800', color: '#FF3B30', textTransform: 'uppercase', letterSpacing: 1 },
    deleteButton: { borderRadius: 16, overflow: 'hidden', marginBottom: 12 },
    deleteButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, gap: 8 },
    deleteButtonText: { color: '#FF3B30', fontSize: 15, fontWeight: '700' },
    deleteNote: { fontSize: 11, color: '#999', textAlign: 'center', lineHeight: 16 },
});