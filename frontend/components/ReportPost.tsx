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

// Professional, education-focused reporting categories
const REPORT_CATEGORIES = {
    post: [
        {
            id: 'information_integrity',
            icon: '🔬',
            title: 'Information Integrity',
            description: 'Scientific accuracy or factual integrity',
            subcategories: [
                { id: 'scientific_accuracy', label: 'Scientific / Biological Fact' },
                { id: 'misinformation', label: 'General Misinformation' },
                { id: 'manipulated_media', label: 'AI Manipulated / Deepfake' },
                { id: 'source_verification', label: 'Unverified / Fake Sources' },
            ],
            severity: 'high',
            action: 'ai_verification',
        },
        {
            id: 'criminality',
            icon: '🚨',
            title: 'Criminal Activity',
            description: 'Illegal acts, scams, or extremism',
            subcategories: [
                { id: 'illegal_acts', label: 'Illegal Acts / Activities' },
                { id: 'scams_fraud', label: 'Scams or Fraud' },
                { id: 'drug_trafficking', label: 'Drug / Weapon Trafficking' },
                { id: 'extremism', label: 'Violent Extremism' },
            ],
            severity: 'critical',
            action: 'urgent_removal',
        },
        {
            id: 'sexual_content',
            icon: '🔞',
            title: 'Sexual Content',
            description: 'Nudity, sexual acts, or pornography',
            subcategories: [
                { id: 'nudity', label: 'Nudity or Partial Nudity' },
                { id: 'sexual_acts', label: 'Sexual Acts or Pornography' },
                { id: 'solicitation', label: 'Sexual Solicitation' },
            ],
            severity: 'high',
            action: 'urgent_removal',
        },
        {
            id: 'ethical_violation',
            icon: '⚖️',
            title: 'Ethical Violation',
            description: 'Insults, hate speech, or malicious intent',
            subcategories: [
                { id: 'hate_speech', label: 'Ethnic / Cultural Hate Speech' },
                { id: 'targeted_insult', label: 'Personal Insult / Harassment' },
                { id: 'malicious_narrative', label: 'Harmful Social Narrative' },
                { id: 'bullying', label: 'Bullying or Intimidation' },
            ],
            severity: 'high',
            action: 'immediate_restriction',
        },
        {
            id: 'safety',
            icon: '🛡️',
            title: 'Safety & Rights',
            description: 'Physical safety or individual rights',
            subcategories: [
                { id: 'violence', label: 'Violence or Graphic Content' },
                { id: 'impersonation', label: 'Identity Theft / Impersonation' },
                { id: 'privacy', label: 'Privacy / Doxxing' },
            ],
            severity: 'critical',
            action: 'urgent_removal',
        },
    ],
    user: [
        {
            id: 'criminality',
            icon: '🚨',
            title: 'Criminal Activity',
            description: 'Illegal acts, scams, or extremism',
            subcategories: [
                { id: 'illegal_acts', label: 'Illegal Acts / Activities' },
                { id: 'scams_fraud', label: 'Scams or Fraud' },
                { id: 'extremism', label: 'Violent Extremism' },
            ],
            severity: 'critical',
            action: 'global_ban',
        },
        {
            id: 'sexual_content',
            icon: '🔞',
            title: 'Sexual Content',
            description: 'Nudity, sexual acts, or pornography',
            subcategories: [
                { id: 'nudity', label: 'Nudity or Partial Nudity' },
                { id: 'sexual_acts', label: 'Sexual Acts or Pornography' },
                { id: 'solicitation', label: 'Sexual Solicitation' },
            ],
            severity: 'high',
            action: 'global_ban',
        },
        {
            id: 'bias_reporting',
            icon: '🎯',
            title: 'Bias & Targeted Reporting',
            description: 'Using reporting as a tool for harassment',
            subcategories: [
                { id: 'false_flagging', label: 'Mass / Automated False Reporting' },
                { id: 'ethnic_targeting', label: 'Ethnic / Cultural Targeting' },
            ],
            severity: 'high',
            action: 'investigate_bias',
        },
        {
            id: 'malicious_behavior',
            icon: '⚠️',
            title: 'Malicious Behavior',
            description: 'Intentional harm or platform abuse',
            subcategories: [
                { id: 'coordinated_attack', label: 'Coordinated Harassment' },
                { id: 'bot_activity', label: 'Automated Platform Abuse' },
            ],
            severity: 'critical',
            action: 'global_ban',
        },
    ],
    comment: [
        {
            id: 'criminality',
            icon: '🚨',
            title: 'Criminal Activity',
            description: 'Illegal acts, scams, or extremism',
            subcategories: [
                { id: 'illegal_acts', label: 'Illegal Acts / Activities' },
                { id: 'scams_fraud', label: 'Scams or Fraud' },
            ],
            severity: 'critical',
            action: 'urgent_removal',
        },
        {
            id: 'sexual_content',
            icon: '🔞',
            title: 'Sexual Content',
            description: 'Nudity, sexual acts, or pornography',
            subcategories: [
                { id: 'nudity', label: 'Nudity or Partial Nudity' },
                { id: 'sexual_acts', label: 'Sexual Acts or Pornography' },
            ],
            severity: 'high',
            action: 'urgent_removal',
        },
        {
            id: 'ethical_violation',
            icon: '⚖️',
            title: 'Ethical Violation',
            description: 'Insults, hate speech, or malicious intent',
            subcategories: [
                { id: 'hate_speech', label: 'Ethnic / Cultural Hate Speech' },
                { id: 'targeted_insult', label: 'Personal Insult / Harassment' },
                { id: 'malicious_narrative', label: 'Harmful Social Narrative' },
                { id: 'bullying', label: 'Bullying or Intimidation' },
            ],
            severity: 'high',
            action: 'immediate_restriction',
        },
    ],
    space: [
        {
            id: 'information_integrity',
            icon: '🔬',
            title: 'Information Integrity',
            description: 'Scientific accuracy or factual integrity',
            subcategories: [
                { id: 'scientific_accuracy', label: 'Scientific / Biological Fact' },
                { id: 'misinformation', label: 'General Misinformation' },
            ],
            severity: 'high',
            action: 'ai_verification',
        },
        {
            id: 'criminality',
            icon: '🚨',
            title: 'Criminal Activity',
            description: 'Illegal acts, scams, or extremism',
            subcategories: [
                { id: 'illegal_acts', label: 'Illegal Acts / Activities' },
                { id: 'drug_trafficking', label: 'Drug / Weapon Trafficking' },
                { id: 'extremism', label: 'Violent Extremism' },
            ],
            severity: 'critical',
            action: 'urgent_removal',
        },
        {
            id: 'sexual_content',
            icon: '🔞',
            title: 'Sexual Content',
            description: 'Nudity, sexual acts, or pornography',
            subcategories: [
                { id: 'nudity', label: 'Nudity or Partial Nudity' },
                { id: 'sexual_acts', label: 'Sexual Acts or Pornography' },
            ],
            severity: 'high',
            action: 'urgent_removal',
        },
    ],
    story: [
        {
            id: 'information_integrity',
            icon: '🔬',
            title: 'Information Integrity',
            description: 'Scientific accuracy or factual integrity',
            subcategories: [
                { id: 'scientific_accuracy', label: 'Scientific / Biological Fact' },
                { id: 'misinformation', label: 'General Misinformation' },
                { id: 'manipulated_media', label: 'AI Manipulated / Deepfake' },
            ],
            severity: 'high',
            action: 'ai_verification',
        },
        {
            id: 'criminality',
            icon: '🚨',
            title: 'Criminal Activity',
            description: 'Illegal acts, scams, or extremism',
            subcategories: [
                { id: 'illegal_acts', label: 'Illegal Acts / Activities' },
                { id: 'scams_fraud', label: 'Scams or Fraud' },
            ],
            severity: 'critical',
            action: 'urgent_removal',
        },
        {
            id: 'sexual_content',
            icon: '🔞',
            title: 'Sexual Content',
            description: 'Nudity, sexual acts, or pornography',
            subcategories: [
                { id: 'nudity', label: 'Nudity or Partial Nudity' },
                { id: 'sexual_acts', label: 'Sexual Acts or Pornography' },
            ],
            severity: 'high',
            action: 'urgent_removal',
        },
        {
            id: 'ethical_violation',
            icon: '⚖️',
            title: 'Ethical Violation',
            description: 'Insults, hate speech, or malicious intent',
            subcategories: [
                { id: 'hate_speech', label: 'Ethnic / Cultural Hate Speech' },
                { id: 'targeted_insult', label: 'Personal Insult / Harassment' },
                { id: 'bullying', label: 'Bullying or Intimidation' },
            ],
            severity: 'high',
            action: 'immediate_restriction',
        },
    ],
};

const SEVERITY_COLORS = {
    low: '#4CAF50',
    medium: '#FF9800',
    high: '#F44336',
    critical: '#9C27B0',
};

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
    type?: 'post' | 'user' | 'comment' | 'space' | 'story';
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
    const [aiSignature, setAiSignature] = useState<any>(null);

    const categories = REPORT_CATEGORIES[type] || REPORT_CATEGORIES.post;

    const handleSelectCategory = (category: any) => {
        setSelectedCategory(category);
        setStep('details');
    };

    const handleSubmitReport = async () => {
        if (!selectedCategory || !selectedSubcategory) {
            showToast('Please select a specific reason', 'error');
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

            setAiSignature(response.ai_analysis);
            
            // Artificial delay to show the "AI processing" effect for premium feel
            setTimeout(() => {
                setStep('submitted');
                onReportSubmitted(response.reportId);
            }, 2000);

        } catch (error: any) {
            setStep('details');
            showToast(error.response?.data?.error || 'Failed to submit report. Please try again.', 'error');
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
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
            <View style={styles.header}>
                <BlurView intensity={20} tint="light" style={styles.iconCircle}>
                    <MaterialIcons
                        name={type === 'user' ? 'person' : type === 'comment' ? 'comment' : 'article'}
                        size={32}
                        color="#fff"
                    />
                </BlurView>
                <Text style={styles.headerTitle}>Information Integrity</Text>
                <Text style={styles.headerSubtitle}>
                    Select the area that best describes the issue. Use 'Scientific Accuracy' for factual biology or science claims.
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
                            <Text style={styles.categoryLabel}>{category.title}</Text>
                            <Text style={styles.categoryDesc}>{category.description}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />
                    </View>
                </TouchableOpacity>
            ))}
        </ScrollView>
    );

    const renderDetailsStep = () => (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
            <TouchableOpacity style={styles.backButton} onPress={() => setStep('category')}>
                <Ionicons name="arrow-back" size={20} color="#fff" />
                <Text style={styles.backText}>Back to Categories</Text>
            </TouchableOpacity>

            <View style={styles.detailsHeader}>
                <Text style={styles.selectedTitle}>{selectedCategory.title}</Text>
                <Text style={styles.detailsSubtitle}>Specify the exact nature of the violation</Text>
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
                            selectedSubcategory === sub.id && styles.subOptionTextActive
                        ]}>
                            {sub.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>Additional Context</Text>
                <TextInput
                    style={styles.textArea}
                    placeholder="Provide details to assist the AI verification..."
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    multiline
                    value={description}
                    onChangeText={setDescription}
                />
            </View>

            <View style={styles.urgentSection}>
                <View style={styles.urgentTextContainer}>
                    <Text style={styles.urgentLabel}>Urgent Review Required</Text>
                    <Text style={styles.urgentDesc}>Flag this for immediate human intervention if physical safety is at risk.</Text>
                </View>
                <Switch 
                    value={isUrgent}
                    onValueChange={setIsUrgent}
                    trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(244, 67, 54, 0.4)' }}
                    thumbColor={isUrgent ? '#F44336' : '#f4f3f4'}
                    ios_backgroundColor="rgba(255,255,255,0.1)"
                />
            </View>

            <TouchableOpacity 
                style={[styles.submitButton, !selectedSubcategory && styles.submitButtonDisabled]} 
                onPress={handleSubmitReport}
                disabled={!selectedSubcategory || loading}
            >
                <Text style={styles.submitButtonText}>Generate AI Report</Text>
                <Ionicons name="shield-checkmark" size={20} color="#fff" />
            </TouchableOpacity>
        </ScrollView>
    );

    const renderAiAnalysisStep = () => (
        <View style={styles.aiStepContainer}>
            <ActivityIndicator size="large" color="#4CAF50" />
            <Text style={styles.aiStatusText}>Pure AI Analysis in Progress...</Text>
            <Text style={styles.aiStepSub}>Distinguishing scientific context from malicious intent</Text>
            
            <View style={styles.aiProcessingList}>
                <View style={[styles.aiBullet, { opacity: 0.8 }]}>
                    <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                    <Text style={styles.aiBulletText}>Cross-referencing scientific databases</Text>
                </View>
                <View style={[styles.aiBullet, { opacity: 0.6 }]}>
                    <ActivityIndicator size="small" color="#fff" style={{ transform: [{ scale: 0.6 }] }} />
                    <Text style={styles.aiBulletText}>Analyzing reporting bias and targeting patterns</Text>
                </View>
            </View>
        </View>
    );

    const renderSubmittedStep = () => (
        <View style={styles.submittedContainer}>
            <Ionicons name="checkmark-done-circle" size={80} color="#4CAF50" />
            <Text style={styles.submittedTitle}>Report Authenticated</Text>
            <Text style={styles.submittedText}>
                Your report has been analyzed by our Pure AI moderation engine.
            </Text>

            {aiSignature && (
                <BlurView intensity={30} tint="light" style={styles.aiAnalysisCard}>
                    <Text style={styles.signatureTitle}>AI Moderate Signature</Text>
                    <View style={styles.statRow}>
                        <Text style={styles.statLabel}>Science Accuracy</Text>
                        <Text style={styles.statValue}>{(aiSignature.fact_score * 100).toFixed(1)}%</Text>
                    </View>
                    <View style={styles.statRow}>
                        <Text style={styles.statLabel}>Malicious Intent</Text>
                        <Text style={[styles.statValue, { color: aiSignature.malicious_intent_score > 0.5 ? '#FF453A' : '#4CAF50' }]}>
                            {(aiSignature.malicious_intent_score * 100).toFixed(1)}%
                        </Text>
                    </View>
                </BlurView>
            )}

            <TouchableOpacity style={styles.finalButton} onPress={handleClose}>
                <Text style={styles.finalButtonText}>Return to Platform</Text>
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
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.keyboardView}
                >
                    <View style={[
                        styles.container, 
                        GlobalStyles.popupContainer,
                        { paddingBottom: Math.max(insets.bottom, 20) }
                    ]}>
                        <View style={styles.dragIndicator} />
                        
                        <View style={styles.topNav}>
                            <Text style={styles.modalTitle}>Trust Center</Text>
                            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                                <Ionicons name="close" size={24} color="#fff" />
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

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    keyboardView: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: 'rgba(28, 28, 30, 0.95)',
        borderTopLeftRadius: 36,
        borderTopRightRadius: 36,
        padding: 24,
        maxHeight: '92%',
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
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 3,
        alignSelf: 'center',
        marginBottom: 16,
    },
    topNav: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
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
        color: '#fff',
        marginBottom: 8,
    },
    headerSubtitle: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.5)',
        textAlign: 'center',
        lineHeight: 20,
        paddingHorizontal: 10,
    },
    categoryCard: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 20,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    categoryInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    categoryEmoji: {
        fontSize: 28,
    },
    categoryLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 2,
    },
    categoryDesc: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.4)',
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 24,
    },
    backText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 14,
    },
    detailsHeader: {
        marginBottom: 24,
    },
    selectedTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#fff',
        marginBottom: 4,
    },
    detailsSubtitle: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.5)',
    },
    subcategoryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 32,
    },
    subOption: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    subOptionActive: {
        backgroundColor: '#4CAF50',
        borderColor: '#4CAF50',
    },
    subOptionText: {
        color: '#fff',
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
        color: 'rgba(255,255,255,0.7)',
        marginBottom: 12,
    },
    textArea: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 20,
        padding: 16,
        color: '#fff',
        fontSize: 15,
        minHeight: 120,
        textAlignVertical: 'top',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    submitButton: {
        backgroundColor: '#4CAF50',
        borderRadius: 20,
        padding: 18,
        flexDirection: 'row',
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
        backgroundColor: 'rgba(255,255,255,0.1)',
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
        color: '#fff',
        marginTop: 24,
        marginBottom: 8,
    },
    aiStepSub: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.4)',
        textAlign: 'center',
        marginBottom: 32,
    },
    aiProcessingList: {
        gap: 12,
    },
    aiBullet: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    aiBulletText: {
        color: '#fff',
        fontSize: 13,
    },
    submittedContainer: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    submittedTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: '#fff',
        marginTop: 20,
        marginBottom: 12,
    },
    submittedText: {
        fontSize: 15,
        color: 'rgba(255,255,255,0.5)',
        textAlign: 'center',
        marginBottom: 32,
        lineHeight: 22,
    },
    aiAnalysisCard: {
        width: '100%',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 24,
        padding: 20,
        marginBottom: 32,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        overflow: 'hidden',
    },
    signatureTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: '#4CAF50',
        textTransform: 'uppercase',
        letterSpacing: 2,
        marginBottom: 16,
        textAlign: 'center',
    },
    statRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
    },
    statLabel: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 14,
    },
    statValue: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
    },
    finalButton: {
        backgroundColor: '#fff',
        width: '100%',
        padding: 18,
        borderRadius: 20,
        alignItems: 'center',
    },
    finalButtonText: {
        color: '#1C1C1E',
        fontSize: 16,
        fontWeight: '700',
    },
    urgentSection: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(244, 67, 54, 0.05)',
        padding: 16,
        borderRadius: 20,
        marginBottom: 32,
        borderWidth: 1,
        borderColor: 'rgba(244, 67, 54, 0.1)',
        gap: 12,
    },
    urgentTextContainer: {
        flex: 1,
    },
    urgentLabel: {
        fontSize: 15,
        fontWeight: '700',
        color: '#F44336',
        marginBottom: 2,
    },
    urgentDesc: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.4)',
        lineHeight: 16,
    },
});

