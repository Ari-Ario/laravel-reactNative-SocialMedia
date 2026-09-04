// app/chatbotTraining/index.tsx
import React, { useState, useEffect, useContext, useMemo, useCallback, useRef, memo } from 'react';
import {
    View,
    Text,
    FlatList,
    TextInput,
    StyleSheet,
    Switch,
    Alert,
    TouchableOpacity,
    Dimensions,
    Platform,
    ActivityIndicator,
    StatusBar,
    ScrollView,
    Modal,
    Animated,
    KeyboardAvoidingView,
    Keyboard,
} from 'react-native';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { MotiView, AnimatePresence } from 'moti';
import { router, useLocalSearchParams } from 'expo-router';
import { BackButton } from '@/components/ui/IconButton';
import AuthContext from '@/context/AuthContext';
import axios from '@/services/axios';
import getApiBase from '@/services/getApiBase';
import { getToken } from '@/services/TokenService';
import { useResponsiveLayout } from "@/hooks/ResponsiveLayout";
import { useNotificationStore } from '@/stores/notificationStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToastStore } from '@/stores/toastStore';
import { useAppTheme } from '@/hooks/useAppTheme';
import { createShadow } from '@/utils/styles';
import { Avatar } from '@/components/ui/Avatar';

const { width, height } = Dimensions.get('window');
const isMobile = width < 768;
const isWeb = Platform.OS === 'web';

const formatTimestamp = (dateInput: Date | string) => {
    if (!dateInput) return '';
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (!date || isNaN(date.getTime())) return '';

    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

interface TrainingRule {
    id: number;
    trigger: string;
    response: string;
    category: string;
    subcategory?: string;
    is_active: boolean;
    needs_review?: boolean;
    keywords?: string[];
    confidence_score?: number;
    usage_count?: number;
    success_rate?: number;
    // Dialectical promotion fields
    branch?: string;
    domain_partition?: string;
    parent_thesis?: string;
    formal_proof?: string;
    knowledge_axiom_id?: number;
    promoted_at?: string;
    parent_axiom_id?: number;
    created_by?: {
        id: number;
        name: string;
        profile_photo?: string;
    };
    assigned_to?: {
        id: number;
        name: string;
        avatar?: string;
    };
    reviewed_by?: {
        id: number;
        name: string;
    };
    created_at: string;
    updated_at: string;
    last_used?: string;
    tags?: string[];
}

interface Category {
    id: string;
    name: string;
    icon: string;
    color: string;
    count: number;
    description?: string;
}

interface Expert {
    id: number;
    name: string;
    email: string;
    avatar?: string;
    expertise: string[];
    assigned_count: number;
    review_count: number;
}

// Promote-to-axiom payload
interface PromoteData {
    approved: boolean;
    promote_to_knowledge_axiom: boolean;
    branch?: string;
    domain_partition?: string;
    parent_thesis?: string;
    formal_proof?: string;
}

// ============================================================
// 31-CATEGORY DIALECTICAL TAXONOMY — 6 Phases of Knowledge
// Phase 1: Root Ontology | Phase 2: Formal Logic | Phase 3: Mathematics
// Phase 4: Physical Sciences | Phase 5: Life & Earth Sciences | Phase 6: Applied
// ============================================================
const CATEGORIES: Category[] = [
    // ── Navigation ────────────────────────────────────────────
    { id: 'all',        name: 'All Wisdom',       icon: 'apps',            color: '#667EEA', count: 0 },
    { id: 'my_tickets', name: 'My Inbox',          icon: 'person',          color: '#FF4081', count: 0 },
    { id: 'pending',    name: 'Pending Review',    icon: 'time',            color: '#FFC107', count: 0 },
    // ── Phase 1: Root Ontology ────────────────────────────────
    { id: 'ontology',     name: 'Ontology',     icon: 'infinite',        color: '#7C3AED', count: 0 },
    { id: 'epistemology', name: 'Epistemology', icon: 'eye',             color: '#8B5CF6', count: 0 },
    { id: 'metaphysics',  name: 'Metaphysics',  icon: 'planet',          color: '#A78BFA', count: 0 },
    // ── Phase 2: Formal Logic & Abstract ─────────────────────
    { id: 'formal_logic', name: 'Formal Logic', icon: 'git-merge',       color: '#2563EB', count: 0 },
    { id: 'set_theory',   name: 'Set Theory',   icon: 'ellipse',         color: '#3B82F6', count: 0 },
    { id: 'modal_logic',  name: 'Modal Logic',  icon: 'layers',          color: '#60A5FA', count: 0 },
    { id: 'dialectics',   name: 'Dialectics',   icon: 'swap-horizontal', color: '#0EA5E9', count: 0 },
    { id: 'proof_theory', name: 'Proof Theory', icon: 'checkmark-done',  color: '#38BDF8', count: 0 },
    // ── Phase 3: Mathematics ─────────────────────────────────
    { id: 'arithmetic',   name: 'Arithmetic',   icon: 'calculator',      color: '#059669', count: 0 },
    { id: 'algebra',      name: 'Algebra',       icon: 'code-slash',      color: '#10B981', count: 0 },
    { id: 'calculus',     name: 'Calculus',      icon: 'trending-up',     color: '#34D399', count: 0 },
    { id: 'number_theory',name: 'Number Theory', icon: 'keypad',          color: '#6EE7B7', count: 0 },
    { id: 'topology',     name: 'Topology',      icon: 'repeat',          color: '#A7F3D0', count: 0 },
    { id: 'game_theory',  name: 'Game Theory',   icon: 'game-controller', color: '#047857', count: 0 },
    // ── Phase 4: Physical Sciences ────────────────────────────
    { id: 'classical_mechanics', name: 'Mechanics',    icon: 'cog',        color: '#D97706', count: 0 },
    { id: 'quantum_mechanics',   name: 'Quantum',       icon: 'nuclear',    color: '#F59E0B', count: 0 },
    { id: 'relativity',          name: 'Relativity',    icon: 'speedometer',color: '#FBBF24', count: 0 },
    { id: 'thermodynamics',      name: 'Thermo',        icon: 'thermometer',color: '#FCD34D', count: 0 },
    { id: 'chemistry',           name: 'Chemistry',     icon: 'flask',      color: '#EF4444', count: 0 },
    // ── Phase 5: Life & Earth Sciences ───────────────────────
    { id: 'genetics',            name: 'Genetics',      icon: 'dna',        color: '#DB2777', count: 0 },
    { id: 'evolutionary_biology',name: 'Evolution',     icon: 'leaf',       color: '#EC4899', count: 0 },
    { id: 'neuroscience',        name: 'Neuroscience',  icon: 'pulse',      color: '#F472B6', count: 0 },
    { id: 'ecology',             name: 'Ecology',       icon: 'earth',      color: '#FBCFE8', count: 0 },
    // ── Phase 6: Applied Sciences ─────────────────────────────
    { id: 'computer_science',    name: 'CS',            icon: 'hardware-chip', color: '#0891B2', count: 0 },
    { id: 'economics',           name: 'Economics',     icon: 'cash',       color: '#0E7490', count: 0 },
    { id: 'sociology',           name: 'Sociology',     icon: 'people',     color: '#164E63', count: 0 },
    { id: 'law',                 name: 'Law',           icon: 'shield',     color: '#155E75', count: 0 },
    // ── Special ───────────────────────────────────────────────
    { id: 'general',             name: 'General',       icon: 'chatbubble', color: '#6B7280', count: 0 },
    { id: 'support',             name: 'Support',       icon: 'help-buoy',  color: '#9CA3AF', count: 0 },
];

// Phase metadata for badges
const PHASE_MAP: Record<string, { label: string; color: string }> = {
    ontology: { label: 'Phase 1', color: '#7C3AED' },
    epistemology: { label: 'Phase 1', color: '#8B5CF6' },
    metaphysics: { label: 'Phase 1', color: '#A78BFA' },
    formal_logic: { label: 'Phase 2', color: '#2563EB' },
    set_theory: { label: 'Phase 2', color: '#3B82F6' },
    modal_logic: { label: 'Phase 2', color: '#60A5FA' },
    dialectics: { label: 'Phase 2', color: '#0EA5E9' },
    proof_theory: { label: 'Phase 2', color: '#38BDF8' },
    arithmetic: { label: 'Phase 3', color: '#059669' },
    algebra: { label: 'Phase 3', color: '#10B981' },
    calculus: { label: 'Phase 3', color: '#34D399' },
    number_theory: { label: 'Phase 3', color: '#6EE7B7' },
    topology: { label: 'Phase 3', color: '#A7F3D0' },
    game_theory: { label: 'Phase 3', color: '#047857' },
    classical_mechanics: { label: 'Phase 4', color: '#D97706' },
    quantum_mechanics: { label: 'Phase 4', color: '#F59E0B' },
    relativity: { label: 'Phase 4', color: '#FBBF24' },
    thermodynamics: { label: 'Phase 4', color: '#FCD34D' },
    chemistry: { label: 'Phase 4', color: '#EF4444' },
    genetics: { label: 'Phase 5', color: '#DB2777' },
    evolutionary_biology: { label: 'Phase 5', color: '#EC4899' },
    neuroscience: { label: 'Phase 5', color: '#F472B6' },
    ecology: { label: 'Phase 5', color: '#FBCFE8' },
    computer_science: { label: 'Phase 6', color: '#0891B2' },
    economics: { label: 'Phase 6', color: '#0E7490' },
    sociology: { label: 'Phase 6', color: '#164E63' },
    law: { label: 'Phase 6', color: '#155E75' },
};

// Memoized Training Item Component
const TrainingItem = memo(({
    item,
    editingItem,
    isExpanded,
    onToggleExpand,
    onEditChange,
    onUpdate,
    onDelete,
    onAssign,
    onReview,
    onPromote,
    index,
    isExpert,
    currentUserId,
    apiBase,
    colors,
    activeScheme,
    styles
}: {
    item: TrainingRule;
    editingItem: any;
    isExpanded: boolean;
    onToggleExpand: (id: number) => void;
    onEditChange: (id: number, field: string, value: any) => void;
    onUpdate: (id: number) => void;
    onDelete: (id: number) => void;
    onAssign: (id: number) => void;
    onReview: (id: number, approved: boolean, updates?: any) => void;
    onPromote: (id: number, promoteData: PromoteData) => void;
    index: number;
    isExpert: boolean;
    currentUserId: number;
    apiBase: string;
    colors: any;
    activeScheme: string;
    styles: any;
}) => {
    const isAssignedToMe = item.assigned_to?.id === currentUserId;
    const isPendingReview = item.needs_review;
    const isAlreadyPromoted = !!item.knowledge_axiom_id;
    const canEdit = isExpert && (isAssignedToMe || !item.assigned_to || item.created_by?.id === currentUserId);

    // ── Promote-to-axiom local state ─────────────────────────
    const [showPromote, setShowPromote] = React.useState(false);
    const [promoteParentSearch, setPromoteParentSearch] = React.useState(item.parent_thesis ?? '');
    const [promoteParentResults, setPromoteParentResults] = React.useState<{ id: number; thesis_statement: string; branch: string }[]>([]);
    const [promoteParentLoading, setPromoteParentLoading] = React.useState(false);
    const [selectedParent, setSelectedParent] = React.useState<{ id: number; thesis_statement: string } | null>(null);
    const [promoteFormalProof, setPromoteFormalProof] = React.useState(item.formal_proof ?? '');
    const [promoteDomainPartition, setPromoteDomainPartition] = React.useState(item.domain_partition ?? 'Core');
    const [isPromoting, setIsPromoting] = React.useState(false);

    // Debounced parent axiom search
    React.useEffect(() => {
        if (promoteParentSearch.length < 3) {
            setPromoteParentResults([]);
            return;
        }
        const timer = setTimeout(async () => {
            try {
                setPromoteParentLoading(true);
                const token = await getToken();
                const { data } = await axios.get(
                    `${apiBase}/knowledge-axioms?search=${encodeURIComponent(promoteParentSearch)}&status=global_axiom&limit=6`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                setPromoteParentResults(Array.isArray(data) ? data : (data?.data ?? []));
            } catch {
                setPromoteParentResults([]);
            } finally {
                setPromoteParentLoading(false);
            }
        }, 400);
        return () => clearTimeout(timer);
    }, [promoteParentSearch]);

    const handlePromoteSubmit = () => {
        if (!selectedParent) {
            Alert.alert('Missing Parent', 'Select a parent axiom before promoting.');
            return;
        }
        if (promoteFormalProof.trim().length < 20) {
            Alert.alert('Proof Required', 'Please provide at least a 20-character formal proof.');
            return;
        }
        onPromote(item.id, {
            approved: true,
            promote_to_knowledge_axiom: true,
            branch: (editingItem?.category ?? item.category) || item.branch,
            domain_partition: promoteDomainPartition.trim(),
            parent_thesis: selectedParent.thesis_statement,
            formal_proof: promoteFormalProof.trim(),
        });
        setShowPromote(false);
        setIsPromoting(true);
    };

    const getCategoryConfig = () => {
        const cat = CATEGORIES.find(c => c.id === item.category);
        return cat || CATEGORIES[0];
    };

    const categoryConfig = getCategoryConfig();
    const purity = Math.round((item.confidence_score || 0) * 100);
    const phaseInfo = PHASE_MAP[item.category ?? ''];

    return (
        <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', delay: index * 50 }}
            style={[
                styles.itemCard,
                { backgroundColor: colors.surface, borderColor: isExpanded ? colors.tint : colors.border },
                isExpanded && styles.itemCardExpanded
            ]}
        >
            {/* Header / Summary */}
            <TouchableOpacity
                onPress={() => onToggleExpand(item.id)}
                activeOpacity={0.8}
                style={styles.itemHeaderContainer}
            >
                <View style={styles.itemHeader}>
                    <View style={styles.itemHeaderLeft}>
                        <View style={[styles.categoryIcon, { backgroundColor: categoryConfig.color + '20' }]}>
                            <Ionicons name={categoryConfig.icon as any} size={18} color={categoryConfig.color} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <View style={styles.triggerRow}>
                                <Text style={[styles.itemTrigger, { color: colors.text }]} numberOfLines={isExpanded ? undefined : 1}>
                                    {item.trigger}
                                </Text>
                                {!isExpanded && <Text style={styles.timeAgo}>{formatTimestamp(item.created_at)}</Text>}
                            </View>
                            <View style={styles.itemMeta}>
                                <View style={[styles.categoryPill, { backgroundColor: categoryConfig.color + '15' }]}>
                                    <Text style={[styles.categoryPillText, { color: categoryConfig.color }]}>
                                        {categoryConfig.name}
                                    </Text>
                                </View>
                                {/* Phase badge */}
                                {phaseInfo && (
                                    <View style={[styles.categoryPill, { backgroundColor: phaseInfo.color + '20', marginLeft: 4 }]}>
                                        <Text style={[styles.categoryPillText, { color: phaseInfo.color }]}>
                                            {phaseInfo.label}
                                        </Text>
                                    </View>
                                )}
                                {/* Promoted badge */}
                                {isAlreadyPromoted && (
                                    <View style={[styles.reviewBadge, { backgroundColor: '#10B98115' }]}>
                                        <Ionicons name="star" size={10} color="#10B981" />
                                        <Text style={[styles.reviewBadgeText, { color: '#10B981' }]}>AXIOM</Text>
                                    </View>
                                )}
                                {item.subcategory && (
                                    <View style={styles.subcategoryPill}>
                                        <Text style={styles.subcategoryPillText}>{item.subcategory}</Text>
                                    </View>
                                )}
                                {(!item.response || item.response.trim() === '') && (
                                    <View style={[styles.reviewBadge, { backgroundColor: colors.error + '15' }]}>
                                        <Ionicons name="flask" size={10} color={colors.error} />
                                        <Text style={[styles.reviewBadgeText, { color: colors.error }]}>NEEDS INDUCTION</Text>
                                    </View>
                                )}
                                {isPendingReview && (
                                    <View style={[styles.reviewBadge, { backgroundColor: colors.warning + '20' }]}>
                                        <Ionicons name="time" size={10} color={colors.warning} />
                                        <Text style={[styles.reviewBadgeText, { color: colors.warning }]}>PENDING</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    </View>
                    <View style={styles.itemHeaderRight}>
                        <Switch
                            value={editingItem?.is_active ?? item.is_active}
                            onValueChange={(val) => onEditChange(item.id, 'is_active', val)}
                            trackColor={{ false: '#767577', true: colors.success + '80' }}
                            thumbColor={(editingItem?.is_active ?? item.is_active) ? colors.success : '#f4f3f4'}
                            ios_backgroundColor="#3e3e3e"
                            style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                        />
                        <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={18} color={colors.textSecondary} />
                    </View>
                </View>
            </TouchableOpacity>

            <AnimatePresence>
                {isExpanded && (
                    <MotiView
                        from={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ type: 'timing', duration: 400 }}
                        style={styles.itemExpanded}
                    >
                        <View style={styles.itemDivider} />

                        {/* Purity Meter */}
                        <View style={styles.purityContainer}>
                            <View style={styles.purityHeader}>
                                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Knowledge Purity</Text>
                                <Text style={[styles.purityValue, { color: colors.tint }]}>{purity}%</Text>
                            </View>
                            <View style={[styles.purityTrack, { backgroundColor: colors.border }]}>
                                <MotiView
                                    from={{ width: 0 }}
                                    animate={{ width: `${purity}%` }}
                                    style={[styles.purityFill, { backgroundColor: colors.tint }]}
                                />
                            </View>
                        </View>

                        {/* Logic Chain */}
                        <View style={styles.logicChain}>
                            <View style={[styles.logicNode, item.needs_review && styles.logicNodeActive]}>
                                <Ionicons name="flask" size={12} color={item.needs_review ? colors.warning : colors.textSecondary} />
                                <Text style={styles.logicNodeText}>Hypothesis</Text>
                            </View>
                            <Ionicons name="arrow-forward" size={12} color={colors.border} />
                            <View style={[styles.logicNode, !item.needs_review && !isAlreadyPromoted && styles.logicNodeActive]}>
                                <Ionicons name="shield-checkmark" size={12} color={!item.needs_review && !isAlreadyPromoted ? colors.success : colors.textSecondary} />
                                <Text style={styles.logicNodeText}>Approved</Text>
                            </View>
                            <Ionicons name="arrow-forward" size={12} color={colors.border} />
                            <View style={[styles.logicNode, isAlreadyPromoted && styles.logicNodeActive]}>
                                <Ionicons name="star" size={12} color={isAlreadyPromoted ? '#10B981' : colors.textSecondary} />
                                <Text style={styles.logicNodeText}>Global Axiom</Text>
                            </View>
                        </View>

                        <Text style={[styles.inputLabel, { color: colors.textSecondary, marginTop: 16 }]}>Expert Response</Text>
                        <TextInput
                            style={[
                                styles.itemInput,
                                styles.itemTextArea,
                                { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }
                            ]}
                            value={editingItem?.response ?? item.response}
                            onChangeText={(text) => onEditChange(item.id, 'response', text)}
                            multiline
                            placeholder="Scientific response..."
                            placeholderTextColor={colors.textSecondary + '60'}
                        />

                        {/* Branch / Category Selector */}
                        <Text style={[styles.inputLabel, { color: colors.textSecondary, marginTop: 16 }]}>Branch / Classification</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryPicker}>
                            {CATEGORIES.filter(c => !['all','my_tickets','pending'].includes(c.id)).map((cat) => {
                                const isSelected = (editingItem?.category ?? item.category) === cat.id;
                                return (
                                    <TouchableOpacity
                                        key={cat.id}
                                        style={[
                                            styles.categoryOption,
                                            {
                                                backgroundColor: isSelected ? cat.color + '20' : colors.background,
                                                borderColor: isSelected ? cat.color : colors.border
                                            }
                                        ]}
                                        onPress={() => onEditChange(item.id, 'category', cat.id)}
                                    >
                                        <Ionicons name={cat.icon as any} size={14} color={isSelected ? cat.color : colors.textSecondary} />
                                        <Text style={[styles.categoryOptionText, { color: isSelected ? cat.color : colors.textSecondary }]}>
                                            {cat.name}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        {/* Keywords / Trigger Hardening */}
                        <Text style={[styles.inputLabel, { color: colors.textSecondary, marginTop: 16 }]}>Trigger Keywords (Comma Separated)</Text>
                        <TextInput
                            style={[
                                styles.itemInput,
                                { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }
                            ]}
                            value={editingItem?.trigger ?? item.trigger}
                            onChangeText={(text) => onEditChange(item.id, 'trigger', text)}
                            placeholder="Keywords, axioms, triggers..."
                            placeholderTextColor={colors.textSecondary + '60'}
                        />

                        <View style={styles.actionRow}>
                            {isPendingReview ? (
                                <>
                                    <TouchableOpacity
                                        style={[styles.actionBtn, styles.approveBtn, { flex: 1 }]}
                                        onPress={() => onReview(item.id, true, editingItem)}
                                    >
                                        <Ionicons name="checkmark-circle" size={16} color="#fff" />
                                        <Text style={styles.actionBtnText}>APPROVE</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.actionBtn, styles.rejectBtn]}
                                        onPress={() => onReview(item.id, false)}
                                    >
                                        <Ionicons name="close-circle" size={16} color="#fff" />
                                    </TouchableOpacity>
                                </>
                            ) : (
                                <TouchableOpacity
                                    style={[styles.actionBtn, styles.saveBtn, { flex: 1 }]}
                                    onPress={() => onUpdate(item.id)}
                                >
                                    <Ionicons name="save" size={16} color="#fff" />
                                    <Text style={styles.actionBtnText}>SAVE WISDOM</Text>
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity
                                style={[styles.actionBtn, styles.deleteBtn]}
                                onPress={() => onDelete(item.id)}
                            >
                                <Ionicons name="trash-outline" size={16} color={colors.error} />
                            </TouchableOpacity>
                        </View>

                        {/* ═══ PROMOTE TO AXIOM SECTION (Experts only) ═══ */}
                        {isExpert && !isAlreadyPromoted && (
                            <View style={{ marginTop: 16, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16 }}>
                                <TouchableOpacity
                                    onPress={() => setShowPromote(v => !v)}
                                    style={[
                                        styles.actionBtn,
                                        { flex: 1, backgroundColor: showPromote ? '#10B98115' : colors.background,
                                          borderWidth: 1, borderColor: '#10B981', justifyContent: 'center' }
                                    ]}
                                >
                                    <Ionicons name="star" size={16} color="#10B981" />
                                    <Text style={[styles.actionBtnText, { color: '#10B981' }]}>
                                        {showPromote ? 'CANCEL PROMOTE' : 'PROMOTE TO AXIOM'}
                                    </Text>
                                </TouchableOpacity>

                                {showPromote && (
                                    <MotiView
                                        from={{ opacity: 0, translateY: -8 }}
                                        animate={{ opacity: 1, translateY: 0 }}
                                        style={{ marginTop: 12 }}
                                    >
                                        {/* Parent Axiom Search */}
                                        <Text style={[styles.inputLabel, { color: '#10B981' }]}>🔗 Parent Axiom (search)</Text>
                                        <TextInput
                                            style={[
                                                styles.itemInput,
                                                { color: colors.text, borderColor: '#10B981', backgroundColor: colors.background }
                                            ]}
                                            value={promoteParentSearch}
                                            onChangeText={setPromoteParentSearch}
                                            placeholder="Type to search known global axioms..."
                                            placeholderTextColor={colors.textSecondary + '80'}
                                        />
                                        {promoteParentLoading && (
                                            <ActivityIndicator size="small" color="#10B981" style={{ marginTop: 4 }} />
                                        )}
                                        {/* Parent axiom results */}
                                        {promoteParentResults.map(ax => (
                                            <TouchableOpacity
                                                key={ax.id}
                                                onPress={() => {
                                                    setSelectedParent(ax);
                                                    setPromoteParentSearch(ax.thesis_statement);
                                                    setPromoteParentResults([]);
                                                }}
                                                style={[
                                                    styles.categoryOption,
                                                    { marginBottom: 4, borderColor: selectedParent?.id === ax.id ? '#10B981' : colors.border }
                                                ]}
                                            >
                                                <Ionicons name="infinite" size={12} color="#10B981" />
                                                <Text style={[styles.categoryOptionText, { color: colors.text }]} numberOfLines={1}>
                                                    #{ax.id} — {ax.thesis_statement}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                        {selectedParent && (
                                            <View style={[styles.reviewBadge, { backgroundColor: '#10B98120', alignSelf: 'flex-start', marginBottom: 8 }]}>
                                                <Ionicons name="checkmark" size={12} color="#10B981" />
                                                <Text style={[styles.reviewBadgeText, { color: '#10B981' }]}>
                                                    Parent: #{selectedParent.id}
                                                </Text>
                                            </View>
                                        )}

                                        {/* Domain Partition */}
                                        <Text style={[styles.inputLabel, { color: '#10B981', marginTop: 12 }]}>🌐 Domain Partition</Text>
                                        <TextInput
                                            style={[
                                                styles.itemInput,
                                                { color: colors.text, borderColor: '#10B981', backgroundColor: colors.background }
                                            ]}
                                            value={promoteDomainPartition}
                                            onChangeText={setPromoteDomainPartition}
                                            placeholder="e.g., Core, Theoretical, Applied..."
                                            placeholderTextColor={colors.textSecondary + '80'}
                                        />

                                        {/* Formal Proof */}
                                        <Text style={[styles.inputLabel, { color: '#10B981', marginTop: 12 }]}>📜 Formal Proof</Text>
                                        <TextInput
                                            style={[
                                                styles.itemInput,
                                                styles.itemTextArea,
                                                { color: colors.text, borderColor: '#10B981', backgroundColor: colors.background, minHeight: 100 }
                                            ]}
                                            value={promoteFormalProof}
                                            onChangeText={setPromoteFormalProof}
                                            multiline
                                            placeholder="Write the dialectical formal proof here..."
                                            placeholderTextColor={colors.textSecondary + '80'}
                                        />

                                        <TouchableOpacity
                                            style={[
                                                styles.actionBtn,
                                                styles.approveBtn,
                                                { flex: 1, marginTop: 12, opacity: isPromoting ? 0.6 : 1 }
                                            ]}
                                            onPress={handlePromoteSubmit}
                                            disabled={isPromoting}
                                        >
                                            {isPromoting
                                                ? <ActivityIndicator size="small" color="#fff" />
                                                : <Ionicons name="star" size={16} color="#fff" />
                                            }
                                            <Text style={styles.actionBtnText}>
                                                {isPromoting ? 'PROMOTING...' : 'CONFIRM PROMOTE TO GLOBAL AXIOM'}
                                            </Text>
                                        </TouchableOpacity>
                                    </MotiView>
                                )}
                            </View>
                        )}

                        {/* Source Metadata */}
                        <View style={styles.sourceMeta}>
                            <Text style={styles.sourceText}>
                                {item.created_by ? `Proposed by ${item.created_by.name}` : 'System Generated Trial'}
                            </Text>
                            <Text style={styles.sourceDate}>{formatTimestamp(item.created_at)}</Text>
                        </View>
                    </MotiView>
                )}
            </AnimatePresence>
        </MotiView>
    );
});

const ChatbotTrainingScreen = () => {
    const { colors, activeScheme } = useAppTheme();
    const styles = getStyles(colors, activeScheme);
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const { from } = params;
    const { user } = useContext(AuthContext);
    const { notifications, markChatbotNotificationsAsRead } = useNotificationStore();
    const { showToast } = useToastStore();

    const [trainings, setTrainings] = useState<TrainingRule[]>([]);
    const [categories, setCategories] = useState<Category[]>(CATEGORIES);
    const [experts, setExperts] = useState<Expert[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeMainTab, setActiveMainTab] = useState<'all' | 'my'>('all');
    const [activeCategory, setActiveCategory] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive' | 'pending'>('all');
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [isReviewing, setIsReviewing] = useState(false);
    const [newTraining, setNewTraining] = useState<Partial<TrainingRule>>({
        trigger: '',
        response: '',
        category: 'general',
        subcategory: '',
        keywords: [],
        is_active: true
    });
    const [editingItems, setEditingItems] = useState<Record<number, Partial<TrainingRule>>>({});
    const [isExpert, setIsExpert] = useState(false);
    const [showExpertModal, setShowExpertModal] = useState(false);
    const [selectedExpert, setSelectedExpert] = useState<Expert | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);

    const API_BASE = getApiBase();
    const scrollY = useRef(new Animated.Value(0)).current;

    // Check if user is expert
    useEffect(() => {
        const checkExpertStatus = async () => {
            try {
                const token = await getToken();
                const response = await axios.get(`${API_BASE}/chatbot-training/experts`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setIsExpert(response.data.is_expert || false);
                setExperts(response.data.experts || []);
            } catch (error) {
                console.error('Expert check failed:', error);
            }
        };
        checkExpertStatus();
    }, []);

    useEffect(() => {
        fetchTrainings();
        markChatbotNotificationsAsRead();
    }, []);

    const fetchTrainings = async (silent = false) => {
        try {
            if (!silent) setLoading(true);
            const token = await getToken();
            const { data } = await axios.get(`${API_BASE}/chatbot-training`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const trainingsData = Array.isArray(data) ? data : (data?.data || []);
            setTrainings(trainingsData);

            const initialEditingState: Record<number, Partial<TrainingRule>> = {};
            trainingsData.forEach((item: TrainingRule) => {
                initialEditingState[item.id] = {
                    trigger: item.trigger,
                    response: item.response,
                    category: item.category,
                    subcategory: item.subcategory,
                    keywords: item.keywords,
                    is_active: item.is_active
                };
            });
            setEditingItems(initialEditingState);
        } catch (error) {
            showToast('Failed to load trainings', 'error');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const fetchCategories = useCallback(() => {
        const updatedCategories = CATEGORIES.map(cat => {
            let count = 0;
            if (cat.id === 'all') count = trainings.length;
            else if (cat.id === 'my_tickets') count = trainings.filter(t => t.assigned_to?.id === user?.id).length;
            else if (cat.id === 'pending') count = trainings.filter(t => t.needs_review).length;
            else count = trainings.filter(t => t.category === cat.id).length;

            return { ...cat, count };
        });
        setCategories(updatedCategories);
    }, [trainings, user?.id]);

    useEffect(() => {
        fetchCategories();
    }, [trainings, fetchCategories]);

    const filteredTrainings = useMemo(() => {
        let filtered = [...trainings];

        // Main Tab Filtering
        if (activeMainTab === 'my') {
            filtered = filtered.filter(t => t.assigned_to?.id === user?.id);
        }

        // Category filtering
        if (activeCategory === 'pending') {
            filtered = filtered.filter(t => t.needs_review);
        } else if (activeCategory !== 'all') {
            filtered = filtered.filter(t => t.category === activeCategory);
        }

        // Status filter
        if (filterStatus !== 'all') {
            if (filterStatus === 'active') {
                filtered = filtered.filter(t => t.is_active);
            } else if (filterStatus === 'inactive') {
                filtered = filtered.filter(t => !t.is_active);
            } else if (filterStatus === 'pending') {
                filtered = filtered.filter(t => t.needs_review);
            }
        }

        // Search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(t =>
                t.trigger.toLowerCase().includes(query) ||
                t.response.toLowerCase().includes(query) ||
                t.category.toLowerCase().includes(query) ||
                t.keywords?.some(k => k.toLowerCase().includes(query))
            );
        }

        return filtered;
    }, [trainings, activeMainTab, activeCategory, filterStatus, searchQuery]);

    const handleAddTraining = async () => {
        const trigger = newTraining.trigger?.trim();
        const response = newTraining.response?.trim();

        if (!trigger || !response) {
            showToast('Please provide both trigger and response.', 'error');
            return;
        }

        try {
            const token = await getToken();
            await axios.post(`${API_BASE}/chatbot-training`, newTraining, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setNewTraining({ trigger: '', response: '', category: 'general', subcategory: '', keywords: [], is_active: true });
            setShowCreateModal(false);
            fetchTrainings();
            showToast('Rule added successfully!', 'success');
        } catch (error) {
            showToast('Failed to add rule', 'error');
        }
    };

    const handleUpdateTraining = async (id: number) => {
        try {
            const token = await getToken();
            const updates = editingItems[id];

            await axios.put(`${API_BASE}/chatbot-training/${id}`, updates, {
                headers: { Authorization: `Bearer ${token}` }
            });

            fetchTrainings();
            showToast('Wisdom updated successfully!', 'success');
        } catch (error: any) {
            showToast(error.response?.data?.message || 'Update failed', 'error');
        }
    };

    const handleDeleteTraining = async (id: number) => {
        const confirmDelete = () => {
            (async () => {
                try {
                    const token = await getToken();
                    await axios.delete(`${API_BASE}/chatbot-training/${id}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    showToast('Rule deleted successfully', 'success');
                    fetchTrainings();
                } catch (error: any) {
                    showToast(error.response?.data?.message || 'Failed to delete rule', 'error');
                }
            })();
        };

        if (isWeb) {
            if (window.confirm("Are you sure you want to delete this rule?")) confirmDelete();
        } else {
            Alert.alert('Delete Rule', 'Are you sure?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: confirmDelete }
            ]);
        }
    };

    const handleAssignToMe = async (id: number) => {
        try {
            const token = await getToken();
            await axios.post(`${API_BASE}/chatbot-training/${id}/assign`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchTrainings();
            showToast('Rule assigned to you', 'success');
        } catch (error) {
            showToast('Failed to assign rule', 'error');
        }
    };

    const handleReviewRule = async (id: number, approved: boolean, updates: any = {}) => {
        try {
            const token = await getToken();
            // Route: PUT /api/chatbot-training/{id}/review
            const response = await axios.put(`${API_BASE}/chatbot-training/${id}/review`, {
                approved,
                ...updates
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                showToast(approved ? 'Rule approved! ✓' : 'Rule rejected', approved ? 'success' : 'error');
                await fetchTrainings(true);
            }
        } catch (error: any) {
            console.error('Review error:', error?.response?.data ?? error);
            showToast(error?.response?.data?.message || 'Failed to review rule', 'error');
        }
    };

    /**
     * Promote a training ticket to a Global Axiom.
     * Calls PUT /api/chatbot-training/{id}/review with promote_to_knowledge_axiom=true.
     */
    const handlePromoteRule = async (id: number, promoteData: PromoteData) => {
        try {
            const token = await getToken();
            const response = await axios.put(`${API_BASE}/chatbot-training/${id}/review`, promoteData, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                const axiomId = response.data.axiom_id || response.data.knowledge_axiom_id;
                showToast(
                    axiomId
                        ? `★ Promoted to Global Axiom #${axiomId}!`
                        : 'Promoted to Global Axiom!',
                    'success'
                );
                await fetchTrainings(true);
            } else {
                showToast(response.data.message || 'Promote failed', 'error');
            }
        } catch (error: any) {
            console.error('Promote error:', error?.response?.data ?? error);
            showToast(error?.response?.data?.message || 'Promotion failed', 'error');
        }
    };

    const handleEditChange = (id: number, field: string, value: any) => {
        setEditingItems(prev => ({
            ...prev,
            [id]: {
                ...(prev[id] || {}),
                [field]: field === 'is_active' ? Boolean(value) : value
            }
        }));
    };

    const headerOpacity = scrollY.interpolate({
        inputRange: [0, 100],
        outputRange: [1, 0.95],
        extrapolate: 'clamp',
    });



    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar barStyle={activeScheme === 'dark' ? 'light-content' : 'dark-content'} />

            {/* Header */}
            <Animated.View style={[styles.header, { paddingTop: insets.top + 10, opacity: headerOpacity }]}>
              <View style={styles.headerLeft}>
                <BackButton onPress={() => {
                  if (router.canGoBack()) {
                    router.back();
                  } else {
                    router.replace('/(tabs)/chatbot');
                  }
                }} />
              </View>
                <View>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>AI Training Hub</Text>
                    <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                        {filteredTrainings.length} rules • {trainings.filter(t => t.needs_review).length} pending review
                    </Text>
                </View>
                <TouchableOpacity
                    onPress={() => {
                        Keyboard.dismiss();
                        setShowCreateModal(true);
                    }}
                    style={styles.createHeaderButton}
                >
                    <Ionicons name="add" size={24} color={colors.tint} />
                </TouchableOpacity>
            </Animated.View>

            {/* Stats Dashboard */}
            <View style={styles.statsDashboard}>
                <View style={styles.statBox}>
                    <View style={[styles.statIcon, { backgroundColor: '#667EEA20' }]}>
                        <Ionicons name="apps" size={18} color="#667EEA" />
                    </View>
                    <View>
                        <Text style={[styles.statNum, { color: colors.text }]}>{trainings.length}</Text>
                        <Text style={styles.dashboardStatLabel}>Global Wisdom</Text>
                    </View>
                </View>
                <View style={styles.statBox}>
                    <View style={[styles.statIcon, { backgroundColor: '#FF408120' }]}>
                        <Ionicons name="person" size={18} color="#FF4081" />
                    </View>
                    <View>
                        <Text style={[styles.statNum, { color: colors.text }]}>
                            {trainings.filter(t => t.assigned_to?.id === user?.id).length}
                        </Text>
                        <Text style={styles.dashboardStatLabel}>My Tickets</Text>
                    </View>
                </View>
                <View style={styles.statBox}>
                    <View style={[styles.statIcon, { backgroundColor: '#FFC10720' }]}>
                        <Ionicons name="ticket" size={18} color="#FFC107" />
                    </View>
                    <View>
                        <Text style={[styles.statNum, { color: colors.text }]}>
                            {trainings.filter(t => t.needs_review).length}
                        </Text>
                        <Text style={styles.dashboardStatLabel}>Pending</Text>
                    </View>
                </View>
            </View>

            {/* Sticky Header: Search, Toggles, and Categories */}
            <View style={styles.stickyHeader}>
                <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Ionicons name="search" size={18} color={colors.textSecondary} />
                    <TextInput
                        style={[styles.searchInput, { color: colors.text }]}
                        placeholder="Search wisdom, triggers, or responses..."
                        placeholderTextColor={colors.textSecondary + '60'}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery !== '' && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                        </TouchableOpacity>
                    )}
                </View>

                <View style={styles.mainToggleContainer}>
                    <TouchableOpacity
                        style={[styles.mainToggleBtn, activeMainTab === 'all' && styles.mainToggleBtnActive]}
                        onPress={() => setActiveMainTab('all')}
                    >
                        <Ionicons name="apps" size={16} color={activeMainTab === 'all' ? colors.tint : colors.textSecondary} />
                        <Text style={[styles.mainToggleText, activeMainTab === 'all' && styles.mainToggleTextActive]}>Global Wisdom</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.mainToggleBtn, activeMainTab === 'my' && styles.mainToggleBtnActive]}
                        onPress={() => setActiveMainTab('my')}
                    >
                        <Ionicons name="person" size={16} color={activeMainTab === 'my' ? colors.tint : colors.textSecondary} />
                        <Text style={[styles.mainToggleText, activeMainTab === 'my' && styles.mainToggleTextActive]}>My Inbox</Text>
                    </TouchableOpacity>
                </View>

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
                                styles.categoryTab,
                                activeCategory === cat.id && { backgroundColor: cat.color, borderColor: cat.color }
                            ]}
                            onPress={() => setActiveCategory(cat.id)}
                        >
                            <Ionicons name={cat.icon as any} size={14} color={activeCategory === cat.id ? '#fff' : cat.color} />
                            <Text style={[styles.categoryTabText, activeCategory === cat.id && { color: '#fff' }]}>
                                {cat.name}
                            </Text>
                            {cat.count > 0 && (
                                <View style={[styles.categoryCount, activeCategory === cat.id && { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
                                    <Text style={[styles.categoryCountText, activeCategory === cat.id && { color: '#fff' }]}>
                                        {cat.count}
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                <TouchableOpacity
                    onPress={() => setShowFilters(!showFilters)}
                    style={{ position: 'absolute', right: 20, top: 12 }}
                >
                    <Ionicons name="options-outline" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
            </View>

            {showFilters && (
                <MotiView
                    from={{ opacity: 0, translateY: -10 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    style={styles.filterBar}
                >
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <TouchableOpacity
                            style={[styles.filterChip, filterStatus === 'all' && styles.filterChipActive]}
                            onPress={() => setFilterStatus('all')}
                        >
                            <Text style={[styles.filterChipText, filterStatus === 'all' && styles.filterChipTextActive]}>All</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.filterChip, filterStatus === 'active' && styles.filterChipActive]}
                            onPress={() => setFilterStatus('active')}
                        >
                            <Ionicons name="checkmark-circle" size={12} color={filterStatus === 'active' ? '#fff' : colors.success} />
                            <Text style={[styles.filterChipText, filterStatus === 'active' && styles.filterChipTextActive]}>Active</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.filterChip, filterStatus === 'inactive' && styles.filterChipActive]}
                            onPress={() => setFilterStatus('inactive')}
                        >
                            <Ionicons name="close-circle" size={12} color={filterStatus === 'inactive' ? '#fff' : colors.error} />
                            <Text style={[styles.filterChipText, filterStatus === 'inactive' && styles.filterChipTextActive]}>Inactive</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.filterChip, filterStatus === 'pending' && styles.filterChipActive]}
                            onPress={() => setFilterStatus('pending')}
                        >
                            <Ionicons name="time" size={12} color={filterStatus === 'pending' ? '#fff' : colors.warning} />
                            <Text style={[styles.filterChipText, filterStatus === 'pending' && styles.filterChipTextActive]}>Pending</Text>
                        </TouchableOpacity>
                    </ScrollView>
                </MotiView>
            )}

            {loading ? (
                <View style={styles.loaderContainer}>
                    <ActivityIndicator size="large" color={colors.tint} />
                    <Text style={[styles.loaderText, { color: colors.textSecondary }]}>Loading wisdom...</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredTrainings}
                    keyExtractor={item => item.id.toString()}
                    renderItem={({ item, index }) => (
                        <TrainingItem
                            item={item}
                            editingItem={editingItems[item.id]}
                            isExpanded={expandedId === item.id}
                            onToggleExpand={(id) => setExpandedId(expandedId === id ? null : id)}
                            onEditChange={handleEditChange}
                            onUpdate={handleUpdateTraining}
                            onDelete={handleDeleteTraining}
                            onAssign={handleAssignToMe}
                            onReview={handleReviewRule}
                            onPromote={handlePromoteRule}
                            index={index}
                            isExpert={isExpert}
                            currentUserId={Number(user?.id) || 0}
                            apiBase={API_BASE}
                            colors={colors}
                            activeScheme={activeScheme}
                            styles={styles}
                        />
                    )}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    onScroll={Animated.event(
                        [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                        { useNativeDriver: false }
                    )}
                    scrollEventThrottle={16}
                    ListEmptyComponent={
                        <MotiView
                            from={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            style={styles.emptyContainer}
                        >
                            <View style={[styles.emptyIcon, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                <Ionicons name="sparkles" size={48} color={colors.textSecondary + '40'} />
                            </View>
                            <Text style={[styles.emptyTitle, { color: colors.text }]}>No rules found</Text>
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                                {searchQuery ? 'Try a different search term' : 'Create your first training rule to get started'}
                            </Text>
                            {!searchQuery && (
                                <TouchableOpacity onPress={() => setShowCreateModal(true)} style={styles.emptyButton}>
                                    <LinearGradient colors={['#667EEA', '#764BA2']} style={styles.emptyButtonGradient}>
                                        <Ionicons name="add" size={18} color="#fff" />
                                        <Text style={styles.emptyButtonText}>Create Rule</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            )}
                        </MotiView>
                    }
                />
            )}


            {/* Create Rule Modal */}
            <Modal
                visible={showCreateModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowCreateModal(false)}
            >
                <BlurView intensity={90} tint={activeScheme === 'dark' ? 'dark' : 'light'} style={styles.modalOverlay}>
                    <MotiView
                        from={{ opacity: 0, scale: 0.9, translateY: 50 }}
                        animate={{ opacity: 1, scale: 1, translateY: 0 }}
                        transition={{ type: 'spring', damping: 20 }}
                        style={[styles.modalContainer, { backgroundColor: colors.background }]}
                    >
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>Create New Wisdom</Text>
                            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                                <Ionicons name="close" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalContent}>
                            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Trigger Pattern</Text>
                            <TextInput
                                value={newTraining.trigger}
                                onChangeText={text => setNewTraining({ ...newTraining, trigger: text })}
                                style={[styles.modalInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                                placeholder="e.g., user says 'hello', asks for help..."
                                placeholderTextColor={colors.textSecondary + '60'}
                                multiline
                            />

                            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>AI Response</Text>
                            <TextInput
                                value={newTraining.response}
                                onChangeText={text => setNewTraining({ ...newTraining, response: text })}
                                style={[styles.modalInput, styles.modalTextArea, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                                placeholder="Enter the bot's response..."
                                placeholderTextColor={colors.textSecondary + '60'}
                                multiline
                            />

                            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Category</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryPicker}>
                                {CATEGORIES.filter(c => c.id !== 'all' && c.id !== 'pending').map(cat => (
                                    <TouchableOpacity
                                        key={cat.id}
                                        style={[
                                            styles.categoryOption,
                                            newTraining.category === cat.id && { backgroundColor: cat.color + '20', borderColor: cat.color }
                                        ]}
                                        onPress={() => setNewTraining({ ...newTraining, category: cat.id })}
                                    >
                                        <Ionicons name={cat.icon as any} size={14} color={cat.color} />
                                        <Text style={[styles.categoryOptionText, { color: cat.color }]}>{cat.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            <TouchableOpacity onPress={handleAddTraining} style={styles.createButton}>
                                <LinearGradient colors={['#667EEA', '#764BA2']} style={styles.createButtonGradient}>
                                    <Ionicons name="add-circle" size={20} color="#fff" />
                                    <Text style={styles.createButtonText}>Create Rule</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </ScrollView>
                    </MotiView>
                </BlurView>
            </Modal>
        </View>
    );
};

const getStyles = (colors: any, activeScheme: string) => StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 16,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '800',
    },
    headerSubtitle: {
        fontSize: 12,
        marginTop: 2,
    },
    statsDashboard: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        marginBottom: 20,
        gap: 12,
    },
    statBox: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        padding: 12,
        borderRadius: 16,
        gap: 10,
        borderWidth: 1,
        borderColor: colors.border,
        ...createShadow({ opacity: 0.05, radius: 10 }),
    },
    statIcon: {
        width: 36,
        height: 36,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    statNum: {
        fontSize: 16,
        fontWeight: '800',
    },
    dashboardStatLabel: {
        fontSize: 9,
        fontWeight: '600',
        color: colors.textSecondary,
        textTransform: 'uppercase',
    },
    createHeaderButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    stickyHeader: {
        backgroundColor: colors.background,
        paddingBottom: 8,
        zIndex: 100,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        elevation: 5,
    },
    mainToggleContainer: {
        flexDirection: 'row',
        backgroundColor: colors.surface,
        marginHorizontal: 20,
        marginBottom: 12,
        borderRadius: 25,
        padding: 4,
        height: 48,
        borderWidth: 1,
        borderColor: colors.border,
    },
    mainToggleBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 20,
        gap: 6,
        height: '100%',
    },
    mainToggleBtnActive: {
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
        ...createShadow({ opacity: 0.1, radius: 5 }),
    },
    mainToggleText: {
        fontSize: 13,
        color: colors.textSecondary,
        fontWeight: '500',
    },
    mainToggleTextActive: {
        color: colors.tint,
        fontWeight: '700',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 20,
        marginBottom: 12,
        paddingHorizontal: 15,
        paddingVertical: Platform.OS === 'ios' ? 12 : 8,
        borderRadius: 30,
        gap: 8,
        borderWidth: 1,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
    },
    filterBar: {
        marginHorizontal: 20,
        marginBottom: 12,
    },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        marginRight: 8,
        gap: 4,
        borderWidth: 1,
        borderColor: colors.border,
    },
    filterChipActive: {
        backgroundColor: colors.tint,
        borderColor: colors.tint,
    },
    filterChipText: {
        fontSize: 12,
        fontWeight: '500',
        color: colors.textSecondary,
    },
    filterChipTextActive: {
        color: '#fff',
    },
    categoryScroll: {
        marginVertical: 12,
        height: 50,
    },
    categoryContainer: {
        paddingHorizontal: 20,
        gap: 8,
        alignItems: 'center',
    },
    categoryTab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        height: 40,
        borderRadius: 20,
        gap: 8,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        minWidth: 100,
        justifyContent: 'center',
        flexShrink: 0,
    },
    categoryCount: {
        backgroundColor: colors.muted,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
    },
    categoryCountText: {
        fontSize: 10,
        fontWeight: '700',
        color: colors.textSecondary,
    },
    categoryTabText: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.textSecondary,
    },
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 100,
    },
    itemCard: {
        borderRadius: 20,
        marginBottom: 12,
        borderWidth: 1,
        overflow: 'hidden',
        ...createShadow({ opacity: 0.05, radius: 8 }),
    },
    itemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
    },
    itemHeaderLeft: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    itemCardExpanded: {
        ...createShadow({ opacity: 0.15, radius: 15 }),
    },
    itemHeaderContainer: {
        padding: 16,
    },
    categoryIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    itemTrigger: {
        fontSize: 14,
        fontWeight: '700',
        flex: 1,
    },
    triggerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    timeAgo: {
        fontSize: 10,
        color: colors.textSecondary,
        marginLeft: 8,
    },
    itemMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    categoryPill: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
    },
    categoryPillText: {
        fontSize: 9,
        fontWeight: '700',
    },
    subcategoryPill: {
        backgroundColor: colors.muted,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
    },
    subcategoryPillText: {
        fontSize: 9,
        color: colors.textSecondary,
    },
    usagePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    usageText: {
        fontSize: 9,
        color: colors.textSecondary,
    },
    itemHeaderRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    statusBadge: {
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 8,
    },
    activeBadge: {
        backgroundColor: '#4CAF5020',
    },
    inactiveBadge: {
        backgroundColor: '#99999920',
    },
    statusText: {
        fontSize: 9,
        fontWeight: '700',
    },
    activeText: {
        color: '#4CAF50',
    },
    inactiveText: {
        color: '#999',
    },
    reviewBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 8,
        gap: 3,
    },
    reviewBadgeText: {
        fontSize: 9,
        fontWeight: '700',
    },
    purityContainer: {
        marginBottom: 16,
    },
    purityHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    purityValue: {
        fontSize: 14,
        fontWeight: '800',
    },
    purityTrack: {
        height: 6,
        borderRadius: 3,
        overflow: 'hidden',
    },
    purityFill: {
        height: '100%',
        borderRadius: 3,
    },
    logicChain: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
        backgroundColor: 'rgba(0,0,0,0.03)',
        padding: 8,
        borderRadius: 12,
    },
    logicNode: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        opacity: 0.4,
    },
    logicNodeActive: {
        opacity: 1,
    },
    logicNodeText: {
        fontSize: 10,
        fontWeight: '700',
    },
    sourceMeta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 16,
        opacity: 0.6,
    },
    sourceDate: {
        fontSize: 10,
    },
    assignedBadge: {
        marginLeft: 4,
    },
    itemExpanded: {
        paddingHorizontal: 16,
        paddingBottom: 24, // Increased padding to avoid clipping
        backgroundColor: 'rgba(0,0,0,0.01)',
    },
    itemDivider: {
        height: 1,
        backgroundColor: colors.border,
        marginBottom: 16,
    },
    inputLabel: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 6,
    },
    itemInput: {
        borderRadius: 12,
        padding: 12,
        fontSize: 14,
        marginBottom: 12,
        borderWidth: 1,
    },
    itemTextArea: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    categoryPicker: {
        flexDirection: 'row',
        marginBottom: 12,
    },
    categoryOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 16,
        gap: 6,
        marginRight: 8,
        borderWidth: 1,
        borderColor: colors.border,
    },
    categoryOptionText: {
        fontSize: 12,
        fontWeight: '600',
    },
    statsSection: {
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
    },
    statsTitle: {
        fontSize: 11,
        fontWeight: '700',
        marginBottom: 8,
    },
    statsGrid: {
        flexDirection: 'row',
        gap: 16,
    },
    statCard: {
        alignItems: 'center',
    },
    statValue: {
        fontSize: 16,
        fontWeight: '700',
    },
    statLabel: {
        fontSize: 10,
        marginTop: 2,
    },
    actionRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 8,
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 12,
        gap: 6,
    },
    saveBtn: {
        backgroundColor: colors.tint,
    },
    approveBtn: {
        backgroundColor: colors.success,
    },
    rejectBtn: {
        backgroundColor: colors.error,
    },
    assignBtn: {
        backgroundColor: colors.tint,
    },
    deleteBtn: {
        backgroundColor: colors.error + '10',
        borderWidth: 1,
        borderColor: colors.error + '30',
    },
    actionBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#fff',
    },
    createdBy: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginLeft: 'auto',
    },
    createdByText: {
        fontSize: 10,
    },
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loaderText: {
        marginTop: 12,
        fontSize: 14,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyIcon: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        borderWidth: 1,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 13,
        textAlign: 'center',
        marginBottom: 20,
    },
    emptyButton: {
        borderRadius: 25,
        overflow: 'hidden',
    },
    emptyButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 10,
        gap: 8,
    },
    emptyButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContainer: {
        width: width - 40,
        maxWidth: 500,
        maxHeight: height * 0.85,
        borderRadius: 28,
        overflow: 'hidden',
        ...createShadow({ opacity: 0.2, radius: 20 }),
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
    },
    modalContent: {
        padding: 20,
    },
    modalInput: {
        borderRadius: 12,
        padding: 12,
        fontSize: 14,
        marginBottom: 16,
        borderWidth: 1,
    },
    modalTextArea: {
        minHeight: 100,
        textAlignVertical: 'top',
    },
    switchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    switchLabel: {
        fontSize: 14,
        fontWeight: '500',
    },
    createButton: {
        borderRadius: 16,
        overflow: 'hidden',
        marginTop: 8,
    },
    createButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        gap: 8,
    },
    createButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
});

export default ChatbotTrainingScreen;