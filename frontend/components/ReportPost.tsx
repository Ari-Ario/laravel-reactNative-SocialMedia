// components/ReportPost.tsx
import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    ScrollView,
    TextInput,
    Alert,
    Platform,
    ActivityIndicator,
    KeyboardAvoidingView,
    Switch,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlobalStyles } from '@/styles/GlobalStyles';
import { reportPost, getReportCategories } from '@/services/ReportService';
import { useToastStore } from '@/stores/toastStore';
import { createShadow } from '@/utils/styles';
import AuthContext from '@/context/AuthContext';
import { useReportedContentStore } from '@/stores/reportedContentStore';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/constants/i18n';

// Professional, education-focused reporting categories
const REPORT_CATEGORIES = {
    post: [
        {
            id: 'information_integrity',
            icon: '🔬',
            title: 'information_integrity',
            description: 'information_integrity_desc',
            subcategories: [
                { id: 'scientific_accuracy', label: 'scientific_accuracy' },
                { id: 'misinformation', label: 'misinformation' },
                { id: 'manipulated_media', label: 'manipulated_media' },
                { id: 'source_verification', label: 'source_verification' },
            ],
            severity: 'high',
            action: 'ai_verification',
        },
        {
            id: 'criminality',
            icon: '🚨',
            title: 'criminality',
            description: 'criminality_desc',
            subcategories: [
                { id: 'illegal_acts', label: 'illegal_acts' },
                { id: 'scams_fraud', label: 'scams_fraud' },
                { id: 'drug_trafficking', label: 'drug_trafficking' },
                { id: 'extremism', label: 'extremism' },
            ],
            severity: 'critical',
            action: 'urgent_removal',
        },
        {
            id: 'sexual_content',
            icon: '🔞',
            title: 'sexual_content',
            description: 'sexual_content_desc',
            subcategories: [
                { id: 'nudity', label: 'nudity' },
                { id: 'sexual_acts', label: 'sexual_acts' },
                { id: 'solicitation', label: 'solicitation' },
            ],
            severity: 'high',
            action: 'urgent_removal',
        },
        {
            id: 'ethical_violation',
            icon: '⚖️',
            title: 'ethical_violation',
            description: 'ethical_violation_desc',
            subcategories: [
                { id: 'hate_speech', label: 'hate_speech' },
                { id: 'targeted_insult', label: 'targeted_insult' },
                { id: 'malicious_narrative', label: 'malicious_narrative' },
                { id: 'bullying', label: 'bullying' },
            ],
            severity: 'high',
            action: 'immediate_restriction',
        },
        {
            id: 'safety_rights',
            icon: '🛡️',
            title: 'safety_rights',
            description: 'safety_rights_desc',
            subcategories: [
                { id: 'violence', label: 'violence' },
                { id: 'impersonation', label: 'impersonation' },
                { id: 'privacy_doxxing', label: 'privacy_doxxing' },
            ],
            severity: 'critical',
            action: 'urgent_removal',
        },
    ],
    user: [
        {
            id: 'criminality',
            icon: '🚨',
            title: 'criminality',
            description: 'criminality_desc',
            subcategories: [
                { id: 'illegal_acts', label: 'illegal_acts' },
                { id: 'scams_fraud', label: 'scams_fraud' },
                { id: 'extremism', label: 'extremism' },
            ],
            severity: 'critical',
            action: 'global_ban',
        },
        {
            id: 'sexual_content',
            icon: '🔞',
            title: 'sexual_content',
            description: 'sexual_content_desc',
            subcategories: [
                { id: 'nudity', label: 'nudity' },
                { id: 'sexual_acts', label: 'sexual_acts' },
                { id: 'solicitation', label: 'solicitation' },
            ],
            severity: 'high',
            action: 'global_ban',
        },
        {
            id: 'bias_reporting',
            icon: '🎯',
            title: 'bias_reporting',
            description: 'bias_reporting_desc',
            subcategories: [
                { id: 'false_flagging', label: 'false_flagging' },
                { id: 'ethnic_targeting', label: 'ethnic_targeting' },
            ],
            severity: 'high',
            action: 'investigate_bias',
        },
        {
            id: 'malicious_behavior',
            icon: '⚠️',
            title: 'malicious_behavior',
            description: 'malicious_behavior_desc',
            subcategories: [
                { id: 'coordinated_attack', label: 'coordinated_attack' },
                { id: 'bot_activity', label: 'bot_activity' },
            ],
            severity: 'critical',
            action: 'global_ban',
        },
    ],
    comment: [
        {
            id: 'criminality',
            icon: '🚨',
            title: 'criminality',
            description: 'criminality_desc',
            subcategories: [
                { id: 'illegal_acts', label: 'illegal_acts' },
                { id: 'scams_fraud', label: 'scams_fraud' },
            ],
            severity: 'critical',
            action: 'urgent_removal',
        },
        {
            id: 'sexual_content',
            icon: '🔞',
            title: 'sexual_content',
            description: 'sexual_content_desc',
            subcategories: [
                { id: 'nudity', label: 'nudity' },
                { id: 'sexual_acts', label: 'sexual_acts' },
            ],
            severity: 'high',
            action: 'urgent_removal',
        },
        {
            id: 'ethical_violation',
            icon: '⚖️',
            title: 'ethical_violation',
            description: 'ethical_violation_desc',
            subcategories: [
                { id: 'hate_speech', label: 'hate_speech' },
                { id: 'targeted_insult', label: 'targeted_insult' },
                { id: 'malicious_narrative', label: 'malicious_narrative' },
                { id: 'bullying', label: 'bullying' },
            ],
            severity: 'high',
            action: 'immediate_restriction',
        },
    ],
    space: [
        {
            id: 'information_integrity',
            icon: '🔬',
            title: 'information_integrity',
            description: 'information_integrity_desc',
            subcategories: [
                { id: 'scientific_accuracy', label: 'scientific_accuracy' },
                { id: 'misinformation', label: 'misinformation' },
            ],
            severity: 'high',
            action: 'ai_verification',
        },
        {
            id: 'criminality',
            icon: '🚨',
            title: 'criminality',
            description: 'criminality_desc',
            subcategories: [
                { id: 'illegal_acts', label: 'illegal_acts' },
                { id: 'drug_trafficking', label: 'drug_trafficking' },
                { id: 'extremism', label: 'extremism' },
            ],
            severity: 'critical',
            action: 'urgent_removal',
        },
        {
            id: 'sexual_content',
            icon: '🔞',
            title: 'sexual_content',
            description: 'sexual_content_desc',
            subcategories: [
                { id: 'nudity', label: 'nudity' },
                { id: 'sexual_acts', label: 'sexual_acts' },
            ],
            severity: 'high',
            action: 'urgent_removal',
        },
    ],
    story: [
        {
            id: 'information_integrity',
            icon: '🔬',
            title: 'information_integrity',
            description: 'information_integrity_desc',
            subcategories: [
                { id: 'scientific_accuracy', label: 'scientific_accuracy' },
                { id: 'misinformation', label: 'misinformation' },
                { id: 'manipulated_media', label: 'manipulated_media' },
            ],
            severity: 'high',
            action: 'ai_verification',
        },
        {
            id: 'criminality',
            icon: '🚨',
            title: 'criminality',
            description: 'criminality_desc',
            subcategories: [
                { id: 'illegal_acts', label: 'illegal_acts' },
                { id: 'scams_fraud', label: 'scams_fraud' },
            ],
            severity: 'critical',
            action: 'urgent_removal',
        },
        {
            id: 'sexual_content',
            icon: '🔞',
            title: 'sexual_content',
            description: 'sexual_content_desc',
            subcategories: [
                { id: 'nudity', label: 'nudity' },
                { id: 'sexual_acts', label: 'sexual_acts' },
            ],
            severity: 'high',
            action: 'urgent_removal',
        },
        {
            id: 'ethical_violation',
            icon: '⚖️',
            title: 'ethical_violation',
            description: 'ethical_violation_desc',
            subcategories: [
                { id: 'hate_speech', label: 'hate_speech' },
                { id: 'targeted_insult', label: 'targeted_insult' },
                { id: 'bullying', label: 'bullying' },
            ],
            severity: 'high',
            action: 'immediate_restriction',
        },
    ],
};

const getSeverityColors = (colors: any) => ({
    low: colors.success,
    medium: colors.warning,
    high: colors.error,
    critical: '#9C27B0', // Keep specific for critical if no theme match
});

const ACTION_ICONS = {
    review_and_flag: 'flag-outline',
    review: 'eye-outline',
    immediate_removal: 'trash-outline',
    legal_review: 'scale-outline',
    investigate: 'search-outline',
    immediate_action: 'flash-outline',
    restrict: 'lock-closed-outline',
};

interface ReportPostProps {
    visible: boolean;
    postId?: number;
    userId?: number;
    spaceId?: string;
    targetId?: number | string;
    type?: 'post' | 'user' | 'comment' | 'space' | 'story' | 'profile';
    onClose: () => void;
    onReportSubmitted: (reportId: string) => void;
}

export default function ReportPost({
    visible,
    postId,
    userId,
    spaceId,
    targetId,
    type = 'post',
    onClose,
    onReportSubmitted,
}: ReportPostProps) {
    const insets = useSafeAreaInsets();
    const { colors, activeScheme } = useAppTheme();
    const { t, isRTL } = useTranslation();
    const styles = getStyles(colors, activeScheme, isRTL);
    const { showToast } = useToastStore();
    const { user } = React.useContext(AuthContext);

    const [step, setStep] = useState<'category' | 'details' | 'ai_analysis' | 'submitted'>('category');
    const [selectedCategory, setSelectedCategory] = useState<any>(null);
    const [selectedSubcategory, setSelectedSubcategory] = useState<string>('');
    const [description, setDescription] = useState('');
    const [evidence, setEvidence] = useState<string[]>([]);
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [isUrgent, setIsUrgent] = useState(false);
    const [loading, setLoading] = useState(false);
    const [fetchingExisting, setFetchingExisting] = useState(false);
    const [aiSignature, setAiSignature] = useState<any>(null);
    const [isUpdate, setIsUpdate] = useState(false);
    const [reportId, setReportId] = useState<string | null>(null);

    const categories = REPORT_CATEGORIES[type === 'profile' ? 'user' : type] || REPORT_CATEGORIES.post;

    React.useEffect(() => {
        if (visible && (targetId || spaceId || postId || userId)) {
            fetchExistingReport();
        } else if (!visible) {
            // Reset state when modal closes
            setStep('category');
            setSelectedCategory(null);
            setSelectedSubcategory('');
            setDescription('');
            setIsUpdate(false);
            setReportId(null);
        }
    }, [visible, targetId, spaceId, postId, userId, type]);

    const fetchExistingReport = async () => {
        const id = targetId || spaceId || postId || userId;
        if (!id) return;

        setFetchingExisting(true);
        try {
            const { getReportByTarget } = require('@/services/ReportService');
            const existingReport = await getReportByTarget(type, id.toString());
            
            if (existingReport) {
                // Pre-fill categories
                const category = categories.find(c => c.id === existingReport.category);
                if (category) {
                    setSelectedCategory(category);
                    setSelectedSubcategory(existingReport.subcategory);
                    setDescription(existingReport.description || '');
                    setIsUrgent(existingReport.severity === 'critical' || existingReport.severity === 'high');
                    setIsUpdate(true);
                    setReportId(existingReport.report_id);
                    setStep('details'); // Jump to details if already reported
                }
            }
        } catch (error) {
            console.error('Error fetching existing report:', error);
        } finally {
            setFetchingExisting(false);
        }
    };

    const handleSelectCategory = (category: any) => {
        setSelectedCategory(category);
        setStep('details');
    };

    const handleSubmitReport = async () => {
        if (!selectedCategory || !selectedSubcategory) {
            showToast(t('select_issue_area'), 'error');
            return;
        }

        setLoading(true);
        setStep('ai_analysis'); // Show the AI analysis step during submission

        try {
            const reportData = {
                type,
                targetId: targetId || spaceId || postId || userId || '',
                categoryId: selectedCategory.id,
                subcategoryId: selectedSubcategory,
                description: description.trim(),
                evidence,
                isAnonymous,
                isUrgent,
                metadata: {
                    platform: Platform.OS,
                    clientTime: new Date().toISOString(),
                },
            };

            const response = await reportPost(reportData);
            
            // ✅ Optimistically update the reported content store
            useReportedContentStore.getState().addReportedItem(type, (targetId || spaceId || postId || userId || '').toString());

            setAiSignature(response.ai_analysis);
            
            // Artificial delay to show the "AI processing" effect for premium feel
            setTimeout(() => {
                setStep('submitted');
                onReportSubmitted(response.reportId);
            }, 2000);

        } catch (error: any) {
            setStep('details');
            showToast(error.response?.data?.error || t('failed_process_request'), 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setStep('category');
        setSelectedCategory(null);
        setSelectedSubcategory('');
        setDescription('');
        setEvidence([]);
        onClose();
    };

    const renderCategoryStep = () => (
        <ScrollView 
            showsVerticalScrollIndicator={false} 
            contentContainerStyle={{ paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
        >
            <View style={styles.header}>
                <BlurView intensity={20} tint={activeScheme === 'dark' ? 'dark' : 'light'} style={[styles.iconCircle, { backgroundColor: colors.muted }]}>
                    <MaterialIcons
                        name={type === 'user' || type === 'profile' ? 'person' : type === 'comment' ? 'comment' : 'article'}
                        size={32}
                        color={colors.tint}
                    />
                </BlurView>
                <Text style={[styles.headerTitle, { color: colors.text }]}>{t('information_integrity')}</Text>
                <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                    {t('select_issue_area')}
                </Text>
            </View>

            {categories.map((category) => (
                <TouchableOpacity
                    key={category.id}
                    style={styles.categoryCard}
                    onPress={() => handleSelectCategory(category)}
                    activeOpacity={0.8}
                >
                    <View style={styles.categoryInfo}>
                        <Text style={styles.categoryEmoji}>{category.icon}</Text>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.categoryLabel, { color: colors.text }]}>{t(category.title)}</Text>
                            <Text style={[styles.categoryDesc, { color: colors.textSecondary }]}>{t(category.description)}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={colors.border} />
                    </View>
                </TouchableOpacity>
            ))}
        </ScrollView>
    );

    const renderDetailsStep = () => (
        <ScrollView 
            showsVerticalScrollIndicator={false} 
            contentContainerStyle={{ paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
        >
            <TouchableOpacity 
                style={styles.backButton} 
                onPress={() => {
                    setStep('category');
                    setIsUpdate(false); // Reset update status if they go back to categories
                }}
            >
                <Ionicons name="arrow-back" size={20} color={colors.text} />
                <Text style={[styles.backText, { color: colors.textSecondary }]}>{t('back_to_categories')}</Text>
            </TouchableOpacity>

            <View style={styles.detailsHeader}>
                <Text style={[styles.selectedTitle, { color: colors.text }]}>{t(selectedCategory.title)}</Text>
                <Text style={[styles.detailsSubtitle, { color: colors.textSecondary }]}>{t('specify_violation_nature')}</Text>
            </View>

            <View style={styles.subcategoryGrid}>
                {selectedCategory.subcategories.map((sub: any) => (
                    <TouchableOpacity
                        key={sub.id}
                        style={[
                            styles.subOption,
                            selectedSubcategory === sub.id && styles.subOptionActive
                        ]}
                        onPress={() => setSelectedSubcategory(sub.id)}
                    >
                        <Text style={[
                            styles.subOptionText,
                            { color: selectedSubcategory === sub.id ? '#fff' : colors.text }
                        ]}>
                            {t(sub.label)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <View style={styles.inputSection}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>{t('additional_context')}</Text>
                <TextInput
                    style={[styles.textArea, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                    placeholder={t('assist_ai_verification_placeholder')}
                    placeholderTextColor={colors.textSecondary}
                    multiline
                    value={description}
                    onChangeText={setDescription}
                />
            </View>

            <View style={[styles.urgentSection, { backgroundColor: colors.muted }]}>
                <View style={styles.urgentTextContainer}>
                    <Text style={styles.urgentLabel}>{t('urgent_review_required')}</Text>
                    <Text style={[styles.urgentDesc, { color: colors.textSecondary }]}>{t('flag_physical_safety')}</Text>
                </View>
                <Switch 
                    value={isUrgent}
                    onValueChange={setIsUrgent}
                    trackColor={{ false: colors.border, true: colors.error + '60' }}
                    thumbColor={isUrgent ? colors.error : colors.muted}
                    ios_backgroundColor={colors.border}
                />
            </View>

            <TouchableOpacity 
                style={[styles.submitButton, !selectedSubcategory && styles.submitButtonDisabled]} 
                onPress={handleSubmitReport}
                disabled={!selectedSubcategory || loading}
            >
                <Text style={styles.submitButtonText}>{isUpdate ? t('update_ai_report') : t('generate_ai_report')}</Text>
                <Ionicons name={isUpdate ? "refresh" : "shield-checkmark"} size={20} color="#fff" />
            </TouchableOpacity>
        </ScrollView>
    );

    const renderAiAnalysisStep = () => (
        <View style={styles.aiStepContainer}>
            <ActivityIndicator size="large" color={colors.success} />
            <Text style={[styles.aiStatusText, { color: colors.text }]}>{t('ai_analysis_progress')}</Text>
            <Text style={[styles.aiStepSub, { color: colors.textSecondary }]}>{t('distinguishing_context')}</Text>
            
            <View style={styles.aiProcessingList}>
                <View style={[styles.aiBullet, { opacity: 0.8 }]}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                    <Text style={styles.aiBulletText}>{t('cross_referencing_databases')}</Text>
                </View>
                <View style={[styles.aiBullet, { opacity: 0.6 }]}>
                    <ActivityIndicator size="small" color={colors.text} style={{ transform: [{ scale: 0.6 }] }} />
                    <Text style={[styles.aiBulletText, { color: colors.text }]}>{t('analyzing_reporting_bias')}</Text>
                </View>
            </View>
        </View>
    );

    const renderSubmittedStep = () => (
        <View style={styles.submittedContainer}>
            <Ionicons name="checkmark-done-circle" size={80} color={colors.success} />
            <Text style={[styles.submittedTitle, { color: colors.text }]}>{t('report_authenticated')}</Text>
            <Text style={[styles.submittedText, { color: colors.textSecondary }]}>
                {t('ai_moderation_engine_desc')}
            </Text>

            {aiSignature && (
                <BlurView intensity={30} tint={activeScheme === 'dark' ? 'dark' : 'light'} style={[styles.aiAnalysisCard, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                    <Text style={styles.signatureTitle}>{t('ai_moderate_signature')}</Text>
                    <View style={styles.statRow}>
                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('science_accuracy_label')}</Text>
                        <Text style={[styles.statValue, { color: colors.text }]}>{(aiSignature.fact_score * 100).toFixed(1)}%</Text>
                    </View>
                    <View style={styles.statRow}>
                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('malicious_intent_label')}</Text>
                        <Text style={[styles.statValue, { color: aiSignature.malicious_intent_score > 0.5 ? colors.error : colors.success }]}>
                            {(aiSignature.malicious_intent_score * 100).toFixed(1)}%
                        </Text>
                    </View>
                </BlurView>
            )}

            <TouchableOpacity style={[styles.finalButton, { backgroundColor: colors.tint }]} onPress={handleClose}>
                <Text style={[styles.finalButtonText, { color: '#fff' }]}>{t('return_to_platform')}</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <Modal
            transparent
            visible={visible}
            animationType="slide"
            onRequestClose={handleClose}
        >
            <BlurView intensity={60} tint="dark" style={styles.overlay}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.keyboardView}
                    enabled
                >
                    <View style={[
                        styles.container, 
                        GlobalStyles.popupContainer,
                        { paddingBottom: Math.max(insets.bottom, 20) }
                    ]}>
                        <View style={styles.dragIndicator} />
                        
                        <View style={styles.topNav}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('trust_center')}</Text>
                            <TouchableOpacity onPress={handleClose} style={[styles.closeBtn, { backgroundColor: colors.muted, borderRadius: 20 }]}>
                                <Ionicons name="close" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        {step === 'category' && renderCategoryStep()}
                        {step === 'details' && renderDetailsStep()}
                        {step === 'ai_analysis' && renderAiAnalysisStep()}
                        {step === 'submitted' && renderSubmittedStep()}
                    </View>
                </KeyboardAvoidingView>
            </BlurView>
        </Modal>
    );
}

const getStyles = (colors: any, activeScheme: string, isRTL: boolean) => StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    keyboardView: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    container: {
        borderTopLeftRadius: 36,
        borderTopRightRadius: 36,
        padding: 24,
        maxHeight: '92%',
        zIndex: 6000,
        backgroundColor: colors.surface,
        ...createShadow({
            width: 0,
            height: -10,
            opacity: 0.3,
            radius: 20,
            elevation: 15,
        }),
    },
    dragIndicator: {
        width: 40,
        height: 5,
        backgroundColor: colors.border,
        borderRadius: 3,
        alignSelf: 'center',
        marginBottom: 16,
    },
    topNav: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.text,
        letterSpacing: 0.5,
    },
    closeBtn: {
        padding: 4,
    },
    header: {
        alignItems: 'center',
        marginBottom: 32,
    },
    iconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        overflow: 'hidden',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: colors.text,
        marginBottom: 8,
    },
    headerSubtitle: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
        paddingHorizontal: 10,
    },
    categoryCard: {
        backgroundColor: colors.background,
        borderRadius: 20,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    categoryInfo: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: 16,
    },
    categoryEmoji: {
        fontSize: 28,
    },
    categoryLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 2,
        textAlign: isRTL ? 'right' : 'left',
    },
    categoryDesc: {
        fontSize: 13,
        color: colors.textSecondary,
        textAlign: isRTL ? 'right' : 'left',
    },
    backButton: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 24,
    },
    backText: {
        color: colors.textSecondary,
        fontSize: 14,
    },
    detailsHeader: {
        marginBottom: 24,
    },
    selectedTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: colors.text,
        marginBottom: 4,
        textAlign: isRTL ? 'right' : 'left',
    },
    detailsSubtitle: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: isRTL ? 'right' : 'left',
    },
    subcategoryGrid: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 32,
    },
    subOption: {
        backgroundColor: colors.background,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
    },
    subOptionActive: {
        backgroundColor: colors.success,
        borderColor: colors.success,
    },
    subOptionText: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '500',
    },
    subOptionTextActive: {
        fontWeight: '700',
    },
    inputSection: {
        marginBottom: 32,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 12,
        textAlign: isRTL ? 'right' : 'left',
    },
    textArea: {
        backgroundColor: colors.background,
        borderRadius: 20,
        padding: 16,
        color: colors.text,
        fontSize: 15,
        minHeight: 120,
        textAlignVertical: 'top',
        borderWidth: 1,
        borderColor: colors.border,
    },
    submitButton: {
        backgroundColor: colors.success,
        borderRadius: 20,
        padding: 18,
        flexDirection: isRTL ? 'row-reverse' : 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
        ...createShadow({
            width: 0,
            height: 4,
            opacity: 0.3,
            radius: 8,
            elevation: 5,
        }),
    },
    submitButtonDisabled: {
        backgroundColor: colors.border,
        opacity: 0.5,
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    aiStepContainer: {
        alignItems: 'center',
        paddingVertical: 60,
    },
    aiStatusText: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.text,
        marginTop: 24,
        marginBottom: 8,
    },
    aiStepSub: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: 32,
    },
    aiProcessingList: {
        gap: 12,
    },
    aiBullet: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: 10,
    },
    aiBulletText: {
        color: colors.text,
        fontSize: 13,
        textAlign: isRTL ? 'right' : 'left',
    },
    submittedContainer: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    submittedTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: colors.text,
        marginTop: 20,
        marginBottom: 12,
    },
    submittedText: {
        fontSize: 15,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: 32,
        lineHeight: 22,
    },
    aiAnalysisCard: {
        width: '100%',
        backgroundColor: colors.background,
        borderRadius: 24,
        padding: 20,
        marginBottom: 32,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
    },
    signatureTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: colors.success,
        textTransform: 'uppercase',
        letterSpacing: 2,
        marginBottom: 16,
        textAlign: 'center',
    },
    statRow: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
    },
    statLabel: {
        color: colors.textSecondary,
        fontSize: 14,
    },
    statValue: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '700',
    },
    finalButton: {
        backgroundColor: colors.tint,
        width: '100%',
        padding: 18,
        borderRadius: 20,
        alignItems: 'center',
    },
    finalButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    urgentSection: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.error + '10',
        padding: 16,
        borderRadius: 20,
        marginBottom: 32,
        borderWidth: 1,
        borderColor: colors.error + '20',
        gap: 12,
    },
    urgentTextContainer: {
        flex: 1,
    },
    urgentLabel: {
        fontSize: 15,
        fontWeight: '700',
        color: colors.error,
        marginBottom: 2,
        textAlign: isRTL ? 'right' : 'left',
    },
    urgentDesc: {
        fontSize: 12,
        color: colors.textSecondary,
        lineHeight: 16,
        textAlign: isRTL ? 'right' : 'left',
    },
});

