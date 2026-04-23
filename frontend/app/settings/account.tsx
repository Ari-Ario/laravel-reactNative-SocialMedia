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
import Colors from '@/constants/Colors';
import { BackButton } from '@/components/ui/IconButton';
import AuthContext from '@/context/AuthContext';
import { fetchFullSettings, updateFullSettings, deleteAccount } from '@/services/SettingService';
import { loadUser } from '@/services/AuthService';
import { createShadow } from '@/utils/styles';
import ShareLocation from '@/components/ChatScreen/ShareLocation';
import GlobalStyles from '@/styles/GlobalStyles';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/constants/i18n';

const SOCIAL_PLATFORMS = [
    { id: 'whatsapp', platform: 'WhatsApp', icon: 'logo-whatsapp', color: '#25D366' },
    { id: 'telegram', platform: 'Telegram', icon: 'paper-plane', color: '#0088cc' },
    { id: 'twitter', platform: 'Twitter', icon: 'logo-twitter', color: '#1a1a1a' },
    { id: 'instagram', platform: 'Instagram', icon: 'logo-instagram', color: '#E4405F' },
    { id: 'facebook', platform: 'Facebook', icon: 'logo-facebook', color: '#1877F2' },
    { id: 'linkedin', platform: 'LinkedIn', icon: 'logo-linkedin', color: '#0077B5' },
    { id: 'tiktok', platform: 'TikTok', icon: 'musical-notes', color: '#000000' },
    { id: 'youtube', platform: 'YouTube', icon: 'logo-youtube', color: '#FF0000' },
];

// Moved inside components

const isWeb = Platform.OS === 'web';
const { width } = Dimensions.get('window');

// ─── Country Data for Phone Picker ──────────────────────────────────────────
const COUNTRIES = [
    { name: 'Afghanistan', code: '+93', flag: '🇦🇫' },
    { name: 'Albania', code: '+355', flag: '🇦🇱' },
    { name: 'Algeria', code: '+213', flag: '🇩🇿' },
    { name: 'Andorra', code: '+376', flag: '🇦🇩' },
    { name: 'Angola', code: '+244', flag: '🇦🇴' },
    { name: 'Argentina', code: '+54', flag: '🇦🇷' },
    { name: 'Armenia', code: '+374', flag: '🇦🇲' },
    { name: 'Australia', code: '+61', flag: '🇦🇺' },
    { name: 'Austria', code: '+43', flag: '🇦🇹' },
    { name: 'Azerbaijan', code: '+994', flag: '🇦🇿' },
    { name: 'Bahrain', code: '+973', flag: '🇧🇭' },
    { name: 'Bangladesh', code: '+880', flag: '🇧🇩' },
    { name: 'Belarus', code: '+375', flag: '🇧🇾' },
    { name: 'Belgium', code: '+32', flag: '🇧🇪' },
    { name: 'Bolivia', code: '+591', flag: '🇧🇴' },
    { name: 'Bosnia and Herzegovina', code: '+387', flag: '🇧🇦' },
    { name: 'Brazil', code: '+55', flag: '🇧🇷' },
    { name: 'Bulgaria', code: '+359', flag: '🇧🇬' },
    { name: 'Cambodia', code: '+855', flag: '🇰🇭' },
    { name: 'Cameroon', code: '+237', flag: '🇨🇲' },
    { name: 'Canada', code: '+1', flag: '🇨🇦' },
    { name: 'Chile', code: '+56', flag: '🇨🇱' },
    { name: 'China', code: '+86', flag: '🇨🇳' },
    { name: 'Colombia', code: '+57', flag: '🇨🇴' },
    { name: 'Costa Rica', code: '+506', flag: '🇨🇷' },
    { name: 'Croatia', code: '+385', flag: '🇭🇷' },
    { name: 'Cuba', code: '+53', flag: '🇨🇺' },
    { name: 'Cyprus', code: '+357', flag: '🇨🇾' },
    { name: 'Czech Republic', code: '+420', flag: '🇨🇿' },
    { name: 'Denmark', code: '+45', flag: '🇩🇰' },
    { name: 'Dominican Republic', code: '+1', flag: '🇩🇴' },
    { name: 'Ecuador', code: '+593', flag: '🇪🇨' },
    { name: 'Egypt', code: '+20', flag: '🇪🇬' },
    { name: 'El Salvador', code: '+503', flag: '🇸🇻' },
    { name: 'Estonia', code: '+372', flag: '🇪🇪' },
    { name: 'Ethiopia', code: '+251', flag: '🇪🇹' },
    { name: 'Finland', code: '+358', flag: '🇫🇮' },
    { name: 'France', code: '+33', flag: '🇫🇷' },
    { name: 'Georgia', code: '+995', flag: '🇬🇪' },
    { name: 'Germany', code: '+49', flag: '🇩🇪' },
    { name: 'Ghana', code: '+233', flag: '🇬🇭' },
    { name: 'Greece', code: '+30', flag: '🇬🇷' },
    { name: 'Guatemala', code: '+502', flag: '🇬🇹' },
    { name: 'Honduras', code: '+504', flag: '🇭🇳' },
    { name: 'Hong Kong', code: '+852', flag: '🇭🇰' },
    { name: 'Hungary', code: '+36', flag: '🇭🇺' },
    { name: 'Iceland', code: '+354', flag: '🇮🇸' },
    { name: 'India', code: '+91', flag: '🇮🇳' },
    { name: 'Indonesia', code: '+62', flag: '🇮🇩' },
    { name: 'Iran', code: '+98', flag: '🇮🇷' },
    { name: 'Iraq', code: '+964', flag: '🇮🇶' },
    { name: 'Ireland', code: '+353', flag: '🇮🇪' },
    { name: 'Israel', code: '+972', flag: '🇮🇱' },
    { name: 'Italy', code: '+39', flag: '🇮🇹' },
    { name: 'Jamaica', code: '+1', flag: '🇯🇲' },
    { name: 'Japan', code: '+81', flag: '🇯🇵' },
    { name: 'Jordan', code: '+962', flag: '🇯🇴' },
    { name: 'Kazakhstan', code: '+7', flag: '🇰🇿' },
    { name: 'Kenya', code: '+254', flag: '🇰🇪' },
    { name: 'Kuwait', code: '+965', flag: '🇰🇼' },
    { name: 'Latvia', code: '+371', flag: '🇱🇻' },
    { name: 'Lebanon', code: '+961', flag: '🇱🇧' },
    { name: 'Libya', code: '+218', flag: '🇱🇾' },
    { name: 'Lithuania', code: '+370', flag: '🇱🇹' },
    { name: 'Luxembourg', code: '+352', flag: '🇱🇺' },
    { name: 'Malaysia', code: '+60', flag: '🇲🇾' },
    { name: 'Malta', code: '+356', flag: '🇲🇹' },
    { name: 'Mexico', code: '+52', flag: '🇲🇽' },
    { name: 'Moldova', code: '+373', flag: '🇲🇩' },
    { name: 'Monaco', code: '+377', flag: '🇲🇨' },
    { name: 'Mongolia', code: '+976', flag: '🇲🇳' },
    { name: 'Montenegro', code: '+382', flag: '🇲🇪' },
    { name: 'Morocco', code: '+212', flag: '🇲🇦' },
    { name: 'Netherlands', code: '+31', flag: '🇳🇱' },
    { name: 'New Zealand', code: '+64', flag: '🇳🇿' },
    { name: 'Nigeria', code: '+234', flag: '🇳🇬' },
    { name: 'Norway', code: '+47', flag: '🇳🇴' },
    { name: 'Oman', code: '+968', flag: '🇴🇲' },
    { name: 'Pakistan', code: '+92', flag: '🇵🇰' },
    { name: 'Panama', code: '+507', flag: '🇵🇦' },
    { name: 'Paraguay', code: '+595', flag: '🇵🇾' },
    { name: 'Peru', code: '+51', flag: '🇵🇪' },
    { name: 'Philippines', code: '+63', flag: '🇵🇭' },
    { name: 'Poland', code: '+48', flag: '🇵🇱' },
    { name: 'Portugal', code: '+351', flag: '🇵🇹' },
    { name: 'Qatar', code: '+974', flag: '🇶🇦' },
    { name: 'Romania', code: '+40', flag: '🇷🇴' },
    { name: 'Russia', code: '+7', flag: '🇷🇺' },
    { name: 'Saudi Arabia', code: '+966', flag: '🇸🇦' },
    { name: 'Serbia', code: '+381', flag: '🇷🇸' },
    { name: 'Singapore', code: '+65', flag: '🇸🇬' },
    { name: 'Slovakia', code: '+421', flag: '🇸🇰' },
    { name: 'Slovenia', code: '+386', flag: '🇸🇮' },
    { name: 'South Africa', code: '+27', flag: '🇿🇦' },
    { name: 'South Korea', code: '+82', flag: '🇰🇷' },
    { name: 'Spain', code: '+34', flag: '🇪🇸' },
    { name: 'Sri Lanka', code: '+94', flag: '🇱🇰' },
    { name: 'Sweden', code: '+46', flag: '🇸🇪' },
    { name: 'Switzerland', code: '+41', flag: '🇨🇭' },
    { name: 'Syria', code: '+963', flag: '🇸🇾' },
    { name: 'Taiwan', code: '+886', flag: '🇹🇼' },
    { name: 'Thailand', code: '+66', flag: '🇹🇭' },
    { name: 'Tunisia', code: '+216', flag: '🇹🇳' },
    { name: 'Turkey', code: '+90', flag: '🇹🇷' },
    { name: 'Ukraine', code: '+380', flag: '🇺🇦' },
    { name: 'United Arab Emirates', code: '+971', flag: '🇦🇪' },
    { name: 'United Kingdom', code: '+44', flag: '🇬🇧' },
    { name: 'United States', code: '+1', flag: '🇺🇸' },
    { name: 'Uruguay', code: '+598', flag: '🇺🇾' },
    { name: 'Uzbekistan', code: '+998', flag: '🇺🇿' },
    { name: 'Venezuela', code: '+58', flag: '🇻🇪' },
    { name: 'Vietnam', code: '+84', flag: '🇻🇳' }
].sort((a, b) => a.name.localeCompare(b.name));

// ─── Date Picker (platform-aware) ────────────────────────────────────────────
interface DatePickerModalProps {
    visible: boolean;
    value: string; // ISO date string or ''
    onConfirm: (date: string) => void;
    onClose: () => void;
}
const DatePickerModal = ({ visible, value, onConfirm, onClose }: DatePickerModalProps) => {
    const { t } = useTranslation();
    const { colors, activeScheme } = useAppTheme();
    const modalStyles = getModalStyles(colors, activeScheme);
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
                Alert.alert(t('error'), t('failed_update'));
                return;
            }
            onConfirm(iso);
        }
    };

    const MONTHS = [
        t('month_jan'), t('month_feb'), t('month_mar'), t('month_apr'), t('month_may'), t('month_jun'),
        t('month_jul'), t('month_aug'), t('month_sep'), t('month_oct'), t('month_nov'), t('month_dec')
    ];

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
                                <Text style={modalStyles.cancelBtn}>{t('cancel')}</Text>
                            </TouchableOpacity>
                            <Text style={modalStyles.title}>{t('date_of_birth')}</Text>
                            <TouchableOpacity onPress={handleConfirm}>
                                <Text style={modalStyles.doneBtn}>{t('save')}</Text>
                            </TouchableOpacity>
                        </View>

                        {isWeb ? (
                            <View style={modalStyles.webDateContainer}>
                                <Text style={modalStyles.webDateLabel}>{t('select_birthday')}</Text>
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
                                        border: `2px solid ${colors.border}`,
                                        outline: 'none',
                                        fontFamily: 'inherit',
                                        color: colors.text,
                                        backgroundColor: colors.surface,
                                        marginTop: 8,
                                    }}
                                />
                            </View>
                        ) : (
                            <View style={modalStyles.pickerRow}>
                                <View style={modalStyles.pickerCol}>
                                    <Text style={modalStyles.pickerLabel}>{t('day')}</Text>
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
                                <View style={modalStyles.pickerCol}>
                                    <Text style={modalStyles.pickerLabel}>{t('month')}</Text>
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
                                <View style={modalStyles.pickerCol}>
                                    <Text style={modalStyles.pickerLabel}>{t('year')}</Text>
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
const GenderPickerModal = ({ visible, value, onSelect, onClose }: GenderPickerModalProps) => {
    const { t } = useTranslation();
    const { colors, activeScheme } = useAppTheme();
    const GENDER_OPTIONS = [
        { value: 'male', label: t('gender_male'), icon: '👨' },
        { value: 'female', label: t('gender_female'), icon: '👩' },
        { value: 'non_binary', label: t('gender_non_binary'), icon: '🧑' },
        { value: 'prefer_not', label: t('gender_prefer_not'), icon: '🔒' },
        { value: 'other', label: t('gender_other'), icon: '✨' },
    ];
    const modalStyles = getModalStyles(colors, activeScheme);
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
                        <Text style={modalStyles.title}>{t('gender_identity')}</Text>
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
                                <Ionicons name="checkmark-circle" size={20} color={colors.tint} />
                            )}
                        </TouchableOpacity>
                    ))}
                    <View style={{ height: 30 }} />
                </TouchableOpacity>
            </MotiView>
        </TouchableOpacity>
    </Modal>
    );
};

// ─── Education Picker ─────────────────────────────────────────────────────────
interface EducationPickerModalProps {
    visible: boolean;
    value: string;
    onSelect: (val: string) => void;
    onClose: () => void;
}
const EducationPickerModal = ({ visible, value, onSelect, onClose }: EducationPickerModalProps) => {
    const { t } = useTranslation();
    const { colors, activeScheme } = useAppTheme();
    const EDUCATION_LEVELS = [
        t('edu_high_school'), t('edu_associates'), t('edu_bachelors'), t('edu_masters'),
        t('edu_doctorate'), t('edu_professional'), t('edu_trade'), t('edu_self_taught'), t('edu_other')
    ];
    const modalStyles = getModalStyles(colors, activeScheme);
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
                        <Text style={modalStyles.title}>{t('education_level')}</Text>
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
                                <Ionicons name="school-outline" size={18} color={value === lvl ? colors.tint : colors.textSecondary} style={{ marginRight: 12 }} />
                                <Text style={[modalStyles.genderLabel, value === lvl && modalStyles.genderLabelActive]}>
                                    {lvl}
                                </Text>
                                {value === lvl && (
                                    <Ionicons name="checkmark-circle" size={20} color={colors.tint} />
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
};

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
    const { t } = useTranslation();
    const { colors, activeScheme } = useAppTheme();
    const styles = getStyles(colors, activeScheme);
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
            Alert.alert(t('error'), t('failed_update') + ' ' + label);
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
            >
                <LinearGradient
                    colors={isHovered ? [colors.tint + '05', colors.tint + '10'] : [colors.surface, colors.surface]}
                    style={[styles.fieldCard, isEditing && styles.fieldCardEditing]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                >
                    <View style={styles.fieldHeader}>
                        <View style={styles.fieldLabelRow}>
                            <View style={styles.iconContainer}>
                                <Ionicons name={icon as any} size={18} color={colors.tint} />
                            </View>
                            <Text style={styles.fieldLabel}>{label}</Text>
                            {value && !isEditing && (
                                <View style={styles.verifiedBadge}>
                                    <Ionicons name="checkmark-circle" size={12} color={colors.success} />
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
                                    <Ionicons name="pencil" size={16} color={colors.tint} />
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
                                    placeholder={`${t('enter_placeholder')} ${label}...`}
                                    placeholderTextColor={colors.textSecondary + '60'}
                                    maxLength={maxLength}
                                />
                            </View>
                            {loading && <ActivityIndicator size="small" color={colors.tint} />}
                            <TouchableOpacity onPress={() => setIsEditing(false)} style={styles.cancelEdit}>
                                <Ionicons name="close" size={18} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </MotiView>
                    ) : (
                        <View>
                            <Text style={[styles.fieldValue, !value && styles.placeholderValue]}>
                                {value ? (prefix ? `${prefix}${value}` : value) : t('tap_to_set')}
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

// ─── Country Code Picker Modal ───────────────────────────────────────────────
interface CountryPickerModalProps {
    visible: boolean;
    onSelect: (country: typeof COUNTRIES[0]) => void;
    onClose: () => void;
}
const CountryPickerModal = ({ visible, onSelect, onClose }: CountryPickerModalProps) => {
    const { t } = useTranslation();
    const { colors, activeScheme } = useAppTheme();
    const styles = getStyles(colors, activeScheme);
    const modalStyles = getModalStyles(colors, activeScheme);
    const [search, setSearch] = useState('');
    const filtered = COUNTRIES.filter(c => 
        c.name.toLowerCase().includes(search.toLowerCase()) || 
        c.code.includes(search)
    );

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <TouchableOpacity style={modalStyles.overlay} activeOpacity={1} onPress={onClose}>
                <MotiView
                    from={{ translateY: 400, opacity: 0 }}
                    animate={{ translateY: 0, opacity: 1 }}
                    style={[modalStyles.sheet, { height: '80%' }]}
                >
                    <TouchableOpacity activeOpacity={1} style={{ flex: 1 }}>
                        <View style={modalStyles.handle} />
                        <View style={modalStyles.header}>
                            <Text style={modalStyles.title}>{t('select_country')}</Text>
                            <TouchableOpacity onPress={onClose}>
                                <Ionicons name="close" size={24} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                        
                        <View style={styles.searchContainer}>
                            <Ionicons name="search" size={18} color={colors.textSecondary} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder={t('search_country_placeholder')}
                                value={search}
                                onChangeText={setSearch}
                                autoFocus={!isWeb}
                            />
                        </View>

                        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                            {filtered.map(country => (
                                <TouchableOpacity
                                    key={country.name}
                                    style={modalStyles.countryItem}
                                    onPress={() => { onSelect(country); onClose(); }}
                                >
                                    <Text style={modalStyles.countryFlag}>{country.flag}</Text>
                                    <Text style={modalStyles.countryName}>{country.name}</Text>
                                    <Text style={modalStyles.countryCode}>{country.code}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                        <View style={{ height: 30 }} />
                    </TouchableOpacity>
                </MotiView>
            </TouchableOpacity>
        </Modal>
    );
};

// ─── Premium Phone Input ─────────────────────────────────────────────────────
interface PhoneInputProps {
    value: string;
    onSave: (val: string) => Promise<void>;
}
const PremiumPhoneInput = ({ value, onSave }: PhoneInputProps) => {
    const { t } = useTranslation();
    const { colors, activeScheme } = useAppTheme();
    const styles = getStyles(colors, activeScheme);
    const [isEditing, setIsEditing] = useState(false);
    const [showPicker, setShowPicker] = useState(false);
    const [loading, setLoading] = useState(false);
    
    // Parse existing value
    const parsePhone = (phone: string) => {
        if (!phone) return { code: '+41', number: '', flag: '🇨🇭' };
        
        // Remove + if present for matching
        const clean = phone.startsWith('+') ? phone.slice(1) : phone;
        
        // Find matching country (longest code first)
        const sortedCountries = [...COUNTRIES].sort((a,b) => b.code.length - a.code.length);
        const match = sortedCountries.find(c => clean.startsWith(c.code.slice(1)));
        
        if (match) {
            return {
                code: match.code,
                number: clean.slice(match.code.length - 1),
                flag: match.flag
            };
        }
        return { code: '+', number: clean, flag: '🏳️' };
    };

    const initial = parsePhone(value);
    const [country, setCountry] = useState({ code: initial.code, flag: initial.flag });
    const [localNumber, setLocalNumber] = useState(initial.number);

    useEffect(() => {
        const reset = parsePhone(value);
        setCountry({ code: reset.code, flag: reset.flag });
        setLocalNumber(reset.number);
    }, [value]);

    const handleSave = async () => {
        const cleanNumber = localNumber.replace(/\D/g, '');
        if (cleanNumber.length < 7) {
            Alert.alert(t('error'), t('invalid_phone_number'));
            return;
        }
        
        setLoading(true);
        try {
            // Save without + prefix to match existing DB format (e.g. 41762166557)
            const fullNumber = country.code.slice(1) + cleanNumber;
            await onSave(fullNumber);
            setIsEditing(false);
        } catch (error) {
            Alert.alert(t('error'), t('failed_update'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.fieldCard}>
            <View style={styles.fieldHeader}>
                <View style={styles.fieldLabelRow}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="call-outline" size={18} color={colors.tint} />
                    </View>
                    <Text style={styles.fieldLabel}>{t('phone_number')}</Text>
                </View>
                {!isEditing && (
                    <TouchableOpacity onPress={() => setIsEditing(true)}>
                        <Ionicons name="pencil" size={16} color={colors.tint} />
                    </TouchableOpacity>
                )}
            </View>

            {isEditing ? (
                <View style={styles.phoneInputContainer}>
                    <TouchableOpacity 
                        style={styles.countrySelector} 
                        onPress={() => setShowPicker(true)}
                    >
                        <Text style={styles.flagText}>{country.flag}</Text>
                        <Text style={styles.codeText}>{country.code}</Text>
                        <Ionicons name="chevron-down" size={12} color={colors.textSecondary} />
                    </TouchableOpacity>
                    
                    <TextInput
                        style={styles.phoneNumberInput}
                        value={localNumber}
                        onChangeText={v => setLocalNumber(v.replace(/\D/g, ''))}
                        placeholder={t('phone_number')}
                        keyboardType="phone-pad"
                        autoFocus
                    />
                    
                    {loading ? (
                        <ActivityIndicator size="small" color={colors.tint} />
                    ) : (
                        <TouchableOpacity onPress={handleSave}>
                            <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => setIsEditing(false)} style={{ marginLeft: 8 }}>
                        <Ionicons name="close-circle" size={24} color={colors.border} />
                    </TouchableOpacity>
                </View>
            ) : (
                <TouchableOpacity onPress={() => setIsEditing(true)}>
                    <Text style={[styles.fieldValue, !value && styles.placeholderValue]}>
                        {value ? `(${country.code}) ${localNumber}` : t('tap_to_set')}
                    </Text>
                </TouchableOpacity>
            )}

            <CountryPickerModal
                visible={showPicker}
                onClose={() => setShowPicker(false)}
                onSelect={c => {
                    setCountry({ code: c.code, flag: c.flag });
                    setShowPicker(false);
                }}
            />
        </View>
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
const PickerField = ({ label, displayValue, icon, onPress, color = '#0084ff', empty }: PickerFieldProps) => {
    const { t } = useTranslation();
    const { colors, activeScheme } = useAppTheme();
    const styles = getStyles(colors, activeScheme);
    return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        <LinearGradient
            colors={[colors.surface, colors.surface]}
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
                            <Ionicons name="checkmark-circle" size={12} color={colors.success} />
                        </View>
                    )}
                </View>
                <Ionicons name="chevron-down" size={18} color={colors.textSecondary + 'B3'} />
            </View>
            <Text style={[styles.fieldValue, empty && styles.placeholderValue]}>
                {empty ? t('tap_to_select') : displayValue}
            </Text>
        </LinearGradient>
    </TouchableOpacity>
    );
};

// ─── Social Link Item ─────────────────────────────────────────────────────────
interface SocialLinkItemProps {
    platform: any;
    value: string;
    onSave: (val: string) => Promise<void>;
    index: number;
}
const SocialLinkItem = ({ platform, value, onSave, index }: SocialLinkItemProps) => {
    const { t } = useTranslation();
    const { colors, activeScheme } = useAppTheme();
    const styles = getStyles(colors, activeScheme);
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
            Alert.alert(t('error'), t('failed_update'));
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
                onPress={() => !isEditing && setIsEditing(true)}
                activeOpacity={isEditing ? 1 : 0.7}
            >
                <View style={[styles.socialIconBg, { backgroundColor: platform.color + '15' }]}>
                    <Ionicons name={platform.icon} size={20} color={platform.color} />
                </View>
                {!isEditing && (
                    <Text style={[styles.socialValue, !value && styles.placeholderSocial]} numberOfLines={1}>
                        {value || t('save')}
                    </Text>
                )}
                {isEditing && (
                    <TextInput
                        ref={inputRef}
                        style={styles.socialInput}
                        value={tempValue}
                        onChangeText={setTempValue}
                        onSubmitEditing={handleSave}
                        placeholder={t('enter_placeholder')}
                        placeholderTextColor={colors.textSecondary + '60'}
                        autoCapitalize="none"
                        selectTextOnFocus // Better for mobile editing
                    />
                )}
                {loading ? (
                    <ActivityIndicator size="small" color={platform.color} />
                ) : (
                    <TouchableOpacity 
                        onPress={isEditing ? handleSave : () => setIsEditing(true)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons
                            name={isEditing ? "checkmark-circle" : (value ? "checkmark-circle" : "add-circle-outline")}
                            size={22}
                            color={isEditing ? colors.success : (value ? colors.success : colors.border)}
                        />
                    </TouchableOpacity>
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
    const { colors, activeScheme } = useAppTheme();
    const styles = getStyles(colors, activeScheme);
    const modalStyles = getModalStyles(colors, activeScheme);
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();
    const { user, setUser } = useContext(AuthContext);

    const GENDER_OPTIONS = [
        { value: 'male', label: t('gender_male'), icon: '👨' },
        { value: 'female', label: t('gender_female'), icon: '👩' },
        { value: 'non_binary', label: t('gender_non_binary'), icon: '🧑' },
        { value: 'prefer_not', label: t('gender_prefer_not'), icon: '🔒' },
        { value: 'other', label: t('gender_other'), icon: '✨' },
    ];

    const EDUCATION_LEVELS = [
        t('edu_high_school'), t('edu_associates'), t('edu_bachelors'), t('edu_masters'),
        t('edu_doctorate'), t('edu_professional'), t('edu_trade'), t('edu_self_taught'), t('edu_other')
    ];
    const [fullSettings, setFullSettings] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeSection, setActiveSection] = useState('identity');
    const scrollY = useRef(new Animated.Value(0)).current;

    // Pickers
    const [showGenderPicker, setShowGenderPicker] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showEducationPicker, setShowEducationPicker] = useState(false);
    const [showLocationPicker, setShowLocationPicker] = useState(false);

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
            if (data.user && user) setUser({ ...user, ...data.user });
            else if (data.user) setFullSettings(data.user); // Fallback if user context is lost
        } catch (error) {
            console.error('Failed to load settings:', error);
            Alert.alert(t('error'), t('failed_update'));
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

    const handleLocationSelect = async (locData: any) => {
        // Save as JSON string to preserve coordinates ("numbers")
        const locationValue = JSON.stringify(locData);
        await handleUpdate('location', locationValue);
        setShowLocationPicker(false);
    };

    const getLocationDisplay = (value: string) => {
        if (!value) return '';
        if (typeof value === 'string' && value.startsWith('{')) {
            try {
                const parsed = JSON.parse(value);
                return parsed.name || parsed.address || 'Location Pin';
            } catch (e) {
                return value;
            }
        }
        return value;
    };

    const handleSocialUpdate = async (platformId: string, value: string) => {
        const currentLinks = fullSettings?.social_links || {};
        const isFirstTime = !currentLinks[platformId] && value;
        const updatedLinks = { ...currentLinks, [platformId]: value };
        try {
            await updateFullSettings({ social_links: updatedLinks });
            setFullSettings((prev: any) => ({ ...prev, social_links: updatedLinks }));
            
            if (isFirstTime) {
                Alert.alert(
                    t('success'),
                    t('connect'),
                    [{ text: t('save') }]
                );
            }
        } catch (error) {
            throw error;
        }
    };

    const handleDeleteAccount = () => {
        Alert.alert(
            t('logout'),
            t('logout_confirm'),
            [
                { text: t('cancel'), style: 'cancel' },
                {
                    text: t('logout'),
                    style: 'destructive',
                    onPress: () => {
                        Alert.prompt(
                            t('logout'),
                            t('logout_confirm'),
                            [
                                { text: t('cancel'), style: 'cancel' },
                                {
                                    text: t('logout'),
                                    style: 'destructive',
                                    onPress: async (password?: string) => {
                                        if (!password) return;
                                        try {
                                            await deleteAccount(password);
                                            setUser(null);
                                            router.replace('/LoginScreen');
                                        } catch (error) {
                                            Alert.alert(t('error'), t('failed_update'));
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
        { id: 'identity', label: t('profile'), icon: 'person', color: '#0084ff' },
        { id: 'contact', label: t('connect'), icon: 'call', color: '#4CAF50' },
        { id: 'social', label: t('social'), icon: 'share-social', color: '#FF2D55' },
        { id: 'professional', label: t('professional'), icon: 'briefcase', color: '#FF9800' },
    ];

    const SectionButton = ({ id, label, icon, color }: any) => (
        <TouchableOpacity
            style={[styles.sectionButton, activeSection === id && styles.sectionButtonActive]}
            onPress={() => setActiveSection(id)}
        >
            <LinearGradient
                colors={activeSection === id ? [color, color + 'CC'] : [colors.muted, colors.muted]}
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
        <View style={[styles.container, GlobalStyles.popupContainer]}>
            <StatusBar barStyle="dark-content" />

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

            <LinearGradient
                colors={[colors.surface, colors.background]}
                style={[styles.header, { paddingTop: insets.top + 10 }]}
            >
                <BackButton onPress={() => router.navigate('/(tabs)/settings')} />

                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>{t('account')}</Text>
                    <Animated.View style={[styles.headerUnderline, { opacity: headerOpacity }]} />
                </View>

                <TouchableOpacity onPress={loadSettings} style={styles.refreshButton}>
                    <Ionicons name="refresh" size={20} color="#0084ff" />
                </TouchableOpacity>
            </LinearGradient>

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
                    <ActivityIndicator size="large" color={colors.tint} />
                    <Text style={styles.loadingText}>{t('loading')}</Text>
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

                        {activeSection === 'identity' && (
                            <>
                                <Text style={styles.sectionTitle}>{t('profile')}</Text>
                                <EditableField
                                    label={t('name')}
                                    value={fullSettings?.name || ''}
                                    icon="person-outline"
                                    onSave={val => handleUpdate('name', val)}
                                />
                                <EditableField
                                    label={t('username')}
                                    value={fullSettings?.username || ''}
                                    icon="at-outline"
                                    onSave={val => handleUpdate('username', val)}
                                    prefix="@"
                                    maxLength={30}
                                />
                                <PickerField
                                    label={t('birthday')}
                                    displayValue={birthdayDisplayValue()}
                                    icon="calendar-outline"
                                    onPress={() => setShowDatePicker(true)}
                                    empty={!fullSettings?.birthday}
                                />
                                <PickerField
                                    label={t('gender_identity')}
                                    displayValue={genderDisplayValue()}
                                    icon="transgender-outline"
                                    onPress={() => setShowGenderPicker(true)}
                                    empty={!fullSettings?.gender}
                                    color="#9C27B0"
                                />
                                <EditableField
                                    label={t('bio')}
                                    value={fullSettings?.bio || ''}
                                    icon="book-outline"
                                    multiline
                                    maxLength={150}
                                    onSave={val => handleUpdate('bio', val)}
                                />
                            </>
                        )}

                        {activeSection === 'social' && (
                            <>
                                <View style={styles.sectionHeaderRow}>
                                    <Text style={styles.sectionTitle}>{t('social')}</Text>
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
                                    <Ionicons name="information-circle-outline" size={14} color={colors.textSecondary} />
                                    <Text style={styles.socialTipText}>{t('connect')}</Text>
                                </View>
                            </>
                        )}

                        {activeSection === 'contact' && (
                            <>
                                <Text style={styles.sectionTitle}>{t('connect')}</Text>
                                <EditableField
                                    label={t('email_address')}
                                    value={fullSettings?.email || ''}
                                    icon="mail-outline"
                                    keyboardType="email-address"
                                    onSave={val => handleUpdate('email', val)}
                                    hint="Used for login and notifications"
                                />
                                <PremiumPhoneInput
                                    value={fullSettings?.phone || ''}
                                    onSave={val => handleUpdate('phone', val)}
                                />
                                <PickerField
                                    label={t('about')}
                                    displayValue={getLocationDisplay(fullSettings?.location || '')}
                                    icon="location-outline"
                                    onPress={() => setShowLocationPicker(true)}
                                    empty={!fullSettings?.location}
                                />
                            </>
                        )}

                        {activeSection === 'professional' && (
                            <>
                                <Text style={styles.sectionTitle}>{t('professional')}</Text>
                                <EditableField
                                    label={t('professional')}
                                    value={fullSettings?.job_title || ''}
                                    icon="briefcase-outline"
                                    onSave={val => handleUpdate('job_title', val)}
                                    hint={t('professional')}
                                />
                                <EditableField
                                    label={t('professional')}
                                    value={fullSettings?.company || ''}
                                    icon="business-outline"
                                    onSave={val => handleUpdate('company', val)}
                                    hint={t('professional')}
                                />
                                <PickerField
                                    label={t('education_level')}
                                    displayValue={fullSettings?.education || ''}
                                    icon="school-outline"
                                    onPress={() => setShowEducationPicker(true)}
                                    empty={!fullSettings?.education}
                                    color="#FF9800"
                                />
                                <EditableField
                                    label={t('about')}
                                    value={fullSettings?.website || ''}
                                    icon="globe-outline"
                                    keyboardType="url"
                                    onSave={val => handleUpdate('website', val)}
                                    hint="https://yourwebsite.com"
                                    maxLength={255}
                                />
                            </>
                        )}

                        <MotiView
                            from={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 300 }}
                            style={styles.deleteSection}
                        >
                            <View style={styles.deleteWarning}>
                                <Ionicons name="warning" size={20} color="#FF3B30" />
                                <Text style={styles.deleteWarningText}>{t('logout')}</Text>
                            </View>
                            <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAccount}>
                                <LinearGradient
                                    colors={['#FFF0F0', '#FFE5E5']}
                                    style={styles.deleteButtonGradient}
                                >
                                    <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                                    <Text style={styles.deleteButtonText}>{t('logout')}</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                            <Text style={styles.deleteNote}>
                                {t('logout_confirm')}
                            </Text>
                        </MotiView>
                    </MotiView>
                </Animated.ScrollView>
            )}

            <ShareLocation
                visible={showLocationPicker}
                onClose={() => setShowLocationPicker(false)}
                onShareLocation={handleLocationSelect}
            />
        </View>
    );
}

// ─── Picker Modal Styles ──────────────────────────────────────────────────────
function getModalStyles(colors: any, activeScheme: string) {
    return StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingHorizontal: 20,
        paddingTop: 8,
        maxHeight: '75%',
        ...Platform.select({
            web: {
                maxWidth: 1440,
                width: '100%',
                alignSelf: 'center',
            }
        })
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: colors.border,
        alignSelf: 'center',
        marginBottom: 12,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        marginBottom: 12,
    },
    title: { fontSize: 18, fontWeight: '800', color: colors.text },
    cancelBtn: { fontSize: 15, color: colors.textSecondary, fontWeight: '600' },
    doneBtn: { fontSize: 15, color: colors.tint, fontWeight: '800' },
    pickerRow: {
        flexDirection: 'row',
        gap: 12,
        paddingVertical: 12,
    },
    pickerCol: { flex: 1, alignItems: 'center' },
    pickerLabel: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', marginBottom: 8 },
    pickerInput: {
        width: '100%',
        borderWidth: 2,
        borderColor: colors.border,
        borderRadius: 12,
        padding: 12,
        fontSize: 20,
        fontWeight: '700',
        textAlign: 'center',
        color: colors.text,
        backgroundColor: colors.background,
    },
    monthScroll: { maxHeight: 160, width: '100%' },
    monthItem: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 10,
        marginBottom: 4,
        alignItems: 'center',
    },
    monthItemActive: { backgroundColor: colors.tint + '20' },
    monthText: { fontSize: 14, color: colors.textSecondary, fontWeight: '600' },
    monthTextActive: { color: colors.tint, fontWeight: '800' },
    webDateContainer: { paddingVertical: 16 },
    webDateLabel: { fontSize: 14, color: colors.textSecondary, fontWeight: '600', marginBottom: 4 },
    genderItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 16,
        marginBottom: 8,
        backgroundColor: colors.background,
    },
    genderItemActive: { backgroundColor: colors.tint + '10', borderWidth: 2, borderColor: colors.tint + '40' },
    genderEmoji: { fontSize: 20, marginRight: 14 },
    genderLabel: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.text },
    genderLabelActive: { color: colors.tint, fontWeight: '800' },
    countryItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    countryFlag: { fontSize: 24, marginRight: 16 },
    countryName: { flex: 1, fontSize: 16, color: colors.text, fontWeight: '500' },
    countryCode: { fontSize: 16, color: colors.tint, fontWeight: '700' },
});
}

// ─── Screen Styles ────────────────────────────────────────────────────────────
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
    headerCenter: { alignItems: 'center' },
    headerTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
    headerUnderline: { width: 40, height: 3, backgroundColor: colors.tint, borderRadius: 2, marginTop: 4 },
    backButton: { padding: 4 },
    refreshButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.muted, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border },
    sectionNav: { maxHeight: 50, marginTop: 16 },
    sectionNavContent: { paddingHorizontal: 20, gap: 8 },
    sectionButton: { borderRadius: 25, overflow: 'hidden' },
    sectionButtonActive: { ...createShadow({ opacity: 0.2, radius: 8 }) },
    sectionButtonGradient: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 6 },
    sectionButtonText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    sectionButtonTextActive: { color: '#fff' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 12, color: colors.textSecondary, fontSize: 14 },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 100 },
    sectionTitle: {
        fontSize: 13, fontWeight: '800', color: colors.tint, textTransform: 'uppercase',
        letterSpacing: 1.5, marginTop: 30, marginBottom: 15, marginLeft: 5,
    },
    sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 30, marginBottom: 15, paddingHorizontal: 5 },
    fieldCard: {
        borderRadius: 20, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: colors.border,
        backgroundColor: colors.surface,
        ...createShadow({ opacity: 0.05, radius: 8 }),
    },
    fieldCardEditing: { borderColor: colors.tint, borderWidth: 2, ...createShadow({ opacity: 0.1, radius: 12 }) },
    fieldHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    iconContainer: { width: 28, height: 28, borderRadius: 8, backgroundColor: colors.tint + '15', justifyContent: 'center', alignItems: 'center' },
    fieldLabel: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase' },
    verifiedBadge: { marginLeft: 4 },
    fieldValue: { fontSize: 17, fontWeight: '600', color: colors.text },
    placeholderValue: { color: colors.textSecondary + '60', fontStyle: 'italic', fontSize: 15 },
    hintText: { fontSize: 11, color: colors.textSecondary, marginTop: 4, fontStyle: 'italic' },
    prefix: { fontSize: 17, fontWeight: '600', color: colors.tint, marginRight: 2 },
    inputContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
    input: { flex: 1, fontSize: 17, fontWeight: '600', color: colors.text, padding: 0 },
    multilineInput: { minHeight: 60, textAlignVertical: 'top' },
    cancelEdit: { padding: 4 },
    charCountContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
    charCountBar: { flex: 1, height: 2, backgroundColor: colors.border, borderRadius: 1, marginRight: 8, overflow: 'hidden' },
    charCountFill: { height: '100%', backgroundColor: colors.tint, borderRadius: 1 },
    charCountText: { fontSize: 10, color: colors.textSecondary },
    // Social list (Formerly grid)
    premiumBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF2D55', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, gap: 4 },
    premiumText: { color: '#fff', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
    socialGrid: { flexDirection: 'column', gap: 10 },
    socialItem: {
        width: '100%',
        backgroundColor: colors.surface, 
        borderRadius: 20, 
        borderWidth: 1, 
        borderColor: colors.border, 
        overflow: 'hidden',
        ...createShadow({ opacity: 0.04, radius: 10 }),
    },
    socialItemEditing: { borderColor: colors.tint, borderWidth: 2, ...createShadow({ opacity: 0.1, radius: 12 }) },
    socialHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
    socialIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    socialValue: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.text },
    placeholderSocial: { color: colors.textSecondary + '60', fontSize: 15, fontStyle: 'italic' },
    socialInput: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.text, padding: 4, backgroundColor: colors.background, borderRadius: 8 },
    socialPlatformName: { fontSize: 11, color: colors.textSecondary, paddingHorizontal: 16, paddingBottom: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    socialTip: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16, paddingHorizontal: 8 },
    socialTipText: { fontSize: 12, color: colors.textSecondary, fontStyle: 'italic', flex: 1 },
    // Delete section
    deleteSection: { 
        marginTop: 40, 
        marginBottom: 20, 
        padding: 16, 
        borderRadius: 20, 
        backgroundColor: colors.error + '10', 
        borderWidth: 1, 
        borderColor: colors.error + '30' 
    },
    deleteWarning: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
    deleteWarningText: { fontSize: 13, fontWeight: '800', color: colors.error, textTransform: 'uppercase', letterSpacing: 1 },
    deleteButton: { borderRadius: 16, overflow: 'hidden', marginBottom: 12 },
    deleteButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, gap: 8 },
    deleteButtonText: { color: colors.error, fontSize: 15, fontWeight: '700' },
    deleteNote: { fontSize: 11, color: colors.textSecondary, textAlign: 'center', lineHeight: 16 },
    // Phone Picker Styles
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background,
        borderRadius: 12,
        paddingHorizontal: 12,
        marginBottom: 16,
        height: 44,
        borderWidth: 1,
        borderColor: colors.border,
    },
    searchInput: { flex: 1, marginLeft: 8, fontSize: 16, color: colors.text },
    phoneInputContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 },
    countrySelector: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 10,
        gap: 6,
        borderWidth: 1,
        borderColor: colors.border,
    },
    flagText: { fontSize: 18 },
    codeText: { fontSize: 15, fontWeight: '700', color: colors.text },
    phoneNumberInput: {
        flex: 1,
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: colors.tint,
    },
});
}