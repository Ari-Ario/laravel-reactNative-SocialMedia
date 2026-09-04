// components/DialecticalProofCard.tsx
// Premium renderer for Zmzir Dialectical Engine proof responses
// Enhanced: Markdown inside tabs, collapsible card, Expert Review detection.

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Markdown from 'react-native-markdown-display';

const { width } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

export type ProofStatus = 'global_axiom' | 'synthesized_thesis' | 'expert_review' | undefined;

interface DialecticalSection {
  trial: string;
  deductive: string;
  inductive: string;
  synthesis: string;
  dependencies: string[];
  hasCalculation: boolean;
  calculationResult?: string;
  hasExpertReview: boolean;
  expertBranch?: string;
}

function parseDialecticalProof(text: string): DialecticalSection | null {
  // Must contain at least one dialectical marker to parse
  if (!text.includes('1️⃣') && !text.includes('Phase 1') && !text.includes('MATHEMATICAL PROOF')) {
    return null;
  }

  const extract = (start: RegExp, end: RegExp): string => {
    const startMatch = text.match(start);
    if (!startMatch) return '';
    const startIdx = (startMatch.index ?? 0) + startMatch[0].length;
    const remainder = text.slice(startIdx);
    const endMatch = remainder.match(end);
    const endIdx = endMatch ? (endMatch.index ?? remainder.length) : remainder.length;
    return remainder.slice(0, endIdx).trim();
  };

  const trial = extract(
    /(?:1️⃣[^\n]*|Phase 1[^\n]*|### 🔬[^\n]*)\n?/i,
    /(?:2️⃣|Phase 2|### 🧮|Deductive|3️⃣|Inductive|🗣️|Conclusion|Result|---)/i
  );
  const deductive = extract(
    /(?:2️⃣[^\n]*|Phase 2[^\n]*|### 🧮[^\n]*)\n?/i,
    /(?:3️⃣|Phase 3|### 🌍|Inductive|🗣️|Conclusion|Result|---)/i
  );
  const inductive = extract(
    /(?:3️⃣[^\n]*|Phase 3[^\n]*|### 🌍[^\n]*)\n?/i,
    /(?:🗣️|Conclusion|Result|EXPERT REVIEW|Domain Translation|---$)/im
  );
  const synthesis = extract(
    /(?:🗣️[^\n]*|Conclusion[^\n]*|Result[^\n]*|Domain Translation[^\n]*)\n?/i,
    /$^/ // to end
  );

  // Extract dependency citations
  const deps: string[] = [];
  const depRegex = /Axiom #(\d+):\s*([^\n(]+)/g;
  let depMatch;
  while ((depMatch = depRegex.exec(text)) !== null) {
    deps.push(`#${depMatch[1]}: ${depMatch[2]?.trim()?.replace(/\*\*/g, '') || ''}`);
  }

  // Check for Expert Review
  const hasExpertReview = text.includes('EXPERT REVIEW TICKET');
  const branchMatch = text.match(/Branch:\s*([^\n]+)/i);
  const expertBranch = branchMatch ? branchMatch[1].trim() : undefined;

  // Check for computational result
  const resultMatch = text.match(/Result:\s*\*\*([^*]+)\*\*/);
  const hasCalc = text.includes('Deductive Computation') || text.includes('Calculated Result') || text.includes('Computed Result');

  return {
    trial: trial || '',
    deductive: deductive || '',
    inductive: inductive || '',
    synthesis: synthesis || '',
    dependencies: deps,
    hasCalculation: hasCalc,
    calculationResult: resultMatch?.[1]?.trim(),
    hasExpertReview,
    expertBranch,
  };
}

const preprocessMath = (text: string) => {
  if (!text) return '';
  let processed = text;

  // Truncate long Zmzir hashes that break React Native text wrapping
  processed = processed.replace(/Zmzir Engine Autonomous Axiom DB \(([a-f0-9]{32,})\)/gi, (match, hash) => {
    return `Zmzir Engine Autonomous Axiom DB (${hash.substring(0, 16)}...)`;
  });
  
  // Convert $$ ... $$ to a fenced code block
  processed = processed.replace(/\$\$(.*?)\$\$/gs, (match, math) => {
    return `\n\n\`\`\`math\n${math.trim()}\n\`\`\`\n\n`;
  });

  // Convert \[ ... \] to a fenced code block
  processed = processed.replace(/\\\[(.*?)\\\]/gs, (match, math) => {
    return `\n\n\`\`\`math\n${math.trim()}\n\`\`\`\n\n`;
  });

  // Convert \( ... \) to inline code
  processed = processed.replace(/\\\((.*?)\\\)/gs, (match, math) => {
    return `\`${math.trim()}\``;
  });

  // Convert single $ ... $ to inline code
  processed = processed.replace(/(^|[^\\])\$([^\$]+?)\$/g, (match, prefix, math) => {
    if (/^\s*\d/.test(math)) return match;
    return `${prefix}\`${math.trim()}\``;
  });

  return processed;
};

// ─── Config ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: string; label: string }> = {
  global_axiom: { color: '#DAA520', bg: '#FFF9E6', icon: 'shield-checkmark', label: 'Global Axiom' },
  synthesized_thesis: { color: '#FF6B00', bg: '#FFF3E0', icon: 'git-merge', label: 'Synthesized Thesis' },
  expert_review: { color: '#9C27B0', bg: '#F3E5F5', icon: 'flask', label: 'Expert Review' },
};

const TAB_CONFIG = [
  { id: 'trial',     icon: 'eye-outline',       label: 'Trial',     color: '#E53935', gradients: ['#FF6B6B', '#E53935'] as [string, string] },
  { id: 'deductive', icon: 'calculator-outline', label: 'Deductive', color: '#1565C0', gradients: ['#42A5F5', '#1565C0'] as [string, string] },
  { id: 'inductive', icon: 'git-branch-outline', label: 'Inductive', color: '#2E7D32', gradients: ['#66BB6A', '#2E7D32'] as [string, string] },
  { id: 'synthesis', icon: 'globe-outline',       label: 'Synthesis', color: '#4527A0', gradients: ['#9575CD', '#4527A0'] as [string, string] },
] as const;

type TabId = typeof TAB_CONFIG[number]['id'];

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  text: string;
  status?: ProofStatus;
  colors: any;
  isStreaming?: boolean;
  defaultCollapsed?: boolean;
  activeScheme?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function DialecticalProofCard({
  text,
  status,
  colors,
  isStreaming,
  defaultCollapsed = true,
  activeScheme = 'light',
}: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('trial');
  const [cardCollapsed, setCardCollapsed] = useState(defaultCollapsed);
  const [tabBarWidth, setTabBarWidth] = useState(0);
  const tabAnim = useRef(new Animated.Value(0)).current;
  const collapseAnim = useRef(new Animated.Value(defaultCollapsed ? 0 : 1)).current;

  const proof = parseDialecticalProof(text);
  if (!proof) return null;

  const availableTabs = TAB_CONFIG.filter(tab => {
    if (tab.id === 'trial'     && !proof.trial     && !isStreaming) return false;
    if (tab.id === 'deductive' && !proof.deductive && !isStreaming) return false;
    if (tab.id === 'inductive' && !proof.inductive && !isStreaming) return false;
    if (tab.id === 'synthesis' && !proof.synthesis && !isStreaming) return false;
    return true;
  });

  const currentTab = availableTabs.find(t => t.id === activeTab) ? activeTab : (availableTabs[0]?.id ?? 'trial');
  const activeConfig = TAB_CONFIG.find(t => t.id === currentTab) ?? TAB_CONFIG[0];
  const activeContent = proof[currentTab as keyof DialecticalSection] as string;
  const statusConfig = status ? STATUS_CONFIG[status] : null;

  const switchTab = (tabId: TabId) => {
    const idx = availableTabs.findIndex(t => t.id === tabId);
    Animated.spring(tabAnim, {
      toValue: idx >= 0 ? idx : 0,
      useNativeDriver: true,
      tension: 80,
      friction: 10,
    }).start();
    setActiveTab(tabId);
  };

  const toggleCollapse = () => {
    const to = cardCollapsed ? 1 : 0;
    setCardCollapsed(!cardCollapsed);
    Animated.spring(collapseAnim, {
      toValue: to,
      useNativeDriver: false,
      tension: 60,
      friction: 12,
    }).start();
  };

  const contentMaxH = collapseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 2000],
  });

  const numTabs = Math.max(1, availableTabs.length);
  const tabWidth = tabBarWidth > 0 ? tabBarWidth / numTabs : 0;
  
  const tabTranslateX = tabAnim.interpolate({
    inputRange: [0, 1, 2, 3, 4],
    outputRange: [0, tabWidth, tabWidth * 2, tabWidth * 3, tabWidth * 4],
    extrapolate: 'clamp',
  });

  // Markdown styles for inside the proof card (slightly smaller than main view)
  const mdStyles = {
    body: { fontSize: 13, color: colors.text ?? '#1a1a1a', lineHeight: 20 },
    heading1: { fontSize: 16, fontWeight: 'bold' as const, color: colors.text, marginTop: 10, marginBottom: 4 },
    heading2: { fontSize: 15, fontWeight: 'bold' as const, color: colors.text, marginTop: 8, marginBottom: 4 },
    heading3: { fontSize: 14, fontWeight: 'bold' as const, color: colors.text, marginTop: 6, marginBottom: 3 },
    strong: { fontWeight: 'bold' as const, color: colors.text },
    em: { fontStyle: 'italic' as const, color: colors.text },
    blockquote: {
      borderLeftWidth: 3,
      borderLeftColor: activeConfig.color,
      paddingHorizontal: 10,
      paddingVertical: 4,
      marginVertical: 6,
      backgroundColor: activeScheme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
    },
    table: { borderColor: 'rgba(0,0,0,0.1)', borderWidth: 1, borderRadius: 6, marginVertical: 8, overflow: 'hidden' as const },
    th: {
      padding: 6,
      fontWeight: 'bold' as const,
      color: colors.text,
      backgroundColor: activeScheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
      fontSize: 12,
    },
    td: { padding: 6, color: colors.text, fontSize: 12 },
    hr: { backgroundColor: 'rgba(0,0,0,0.1)', height: 1, marginVertical: 8 },
    code_inline: {
      backgroundColor: activeScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
      color: activeConfig.color,
      paddingHorizontal: 4,
      paddingVertical: 0,
      margin: 0,
      borderRadius: 4,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 12,
    },
    code_block: {
      backgroundColor: activeScheme === 'dark' ? '#1E1E1E' : '#F5F5F5',
      color: activeScheme === 'dark' ? '#D4D4D4' : '#333',
      padding: 10,
      borderRadius: 6,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 12,
      marginVertical: 6,
    },
    fence: {
      backgroundColor: activeScheme === 'dark' ? '#1E1E1E' : '#F5F5F5',
      color: activeScheme === 'dark' ? '#D4D4D4' : '#333',
      padding: 10,
      borderRadius: 6,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 12,
      marginVertical: 6,
    },
    bullet_list_icon: { color: activeConfig.color },
    ordered_list_icon: { color: activeConfig.color, fontWeight: 'bold' as const },
    link: { color: colors.primary ?? '#667EEA', textDecorationLine: 'underline' as const },
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card ?? '#fff', borderColor: colors.border ?? '#e0e0e0' }]}>

      {/* ── Card Header (always visible) ────────────────────────────── */}
      <TouchableOpacity onPress={toggleCollapse} activeOpacity={0.85}>
        <LinearGradient
          colors={activeConfig.gradients}
          style={styles.cardHeader}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <View style={styles.headerLeft}>
            <Ionicons name="sparkles" size={15} color="rgba(255,255,255,0.9)" />
            <Text style={styles.headerTitle}>Dialectical Proof</Text>
          </View>
          <View style={styles.headerRight}>
            {statusConfig && (
              <View style={styles.statusBadge}>
                <Ionicons name={statusConfig.icon as any} size={11} color="#fff" />
                <Text style={styles.statusText}>{statusConfig.label}</Text>
              </View>
            )}
            {isStreaming && (
              <View style={styles.streamingBadge}>
                <Text style={styles.streamingText}>Proving…</Text>
              </View>
            )}
            <Ionicons
              name={cardCollapsed ? 'chevron-down' : 'chevron-up'}
              size={14}
              color="rgba(255,255,255,0.8)"
              style={styles.collapseChevron}
            />
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {/* ── Expandable Body ──────────────────────────────────────────── */}
      <Animated.View style={{ maxHeight: contentMaxH, overflow: 'hidden' }}>

        {/* Dependency Chain */}
        {proof.dependencies.length > 0 && (
          <View style={[styles.depsRow, { backgroundColor: colors.muted ?? '#f5f5f5' }]}>
            <Ionicons name="git-network-outline" size={12} color="#888" />
            <Text style={styles.depsLabel}>Depends on:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.depsScroll}>
              {proof.dependencies.map((dep, i) => (
                <View key={i} style={styles.depChip}>
                  <Text style={styles.depText}>{dep}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Calculation Result Banner */}
        {proof.hasCalculation && proof.calculationResult && (
          <View style={styles.resultBanner}>
            <Ionicons name="checkmark-circle" size={16} color="#2E7D32" />
            <Text style={styles.resultLabel}>Computed Result:</Text>
            <Text style={styles.resultValue}>{proof.calculationResult}</Text>
          </View>
        )}

        {/* Expert Review Banner */}
        {proof.hasExpertReview && (
          <View style={[styles.expertBanner, { backgroundColor: activeScheme === 'dark' ? 'rgba(156,39,176,0.1)' : 'rgba(156,39,176,0.06)' }]}>
            <View style={styles.expertHeader}>
              <Ionicons name="people-outline" size={14} color="#9C27B0" />
              <Text style={styles.expertTitle}>Sent for Expert Pancracy Review</Text>
            </View>
            <Text style={[styles.expertBody, { color: colors.textSecondary }]}>
              {proof.expertBranch
                ? `Branch: ${proof.expertBranch} — This thesis could not be proven mathematically and has been queued for Socratic debate by domain experts.`
                : 'This thesis could not be proven algebraically and is awaiting consensus from the Pancracy review system.'}
            </Text>
          </View>
        )}

        {/* Tab Bar */}
        <View 
          style={[styles.tabBar, { backgroundColor: colors.muted ?? '#f8f8f8' }]}
          onLayout={(e) => setTabBarWidth(e.nativeEvent.layout.width)}
        >
          <Animated.View
            style={[
              styles.tabIndicator,
              { width: tabWidth - 4, backgroundColor: activeConfig.color, transform: [{ translateX: tabTranslateX }] },
            ]}
          />
          {availableTabs.map((tab) => {
            const isActive = currentTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tab, { flex: 1 }]}
                onPress={() => switchTab(tab.id)}
                activeOpacity={0.8}
              >
                <Ionicons name={tab.icon as any} size={13} color={isActive ? '#fff' : colors.textSecondary ?? '#999'} />
                <Text style={[styles.tabLabel, { color: isActive ? '#fff' : colors.textSecondary ?? '#999' }]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Tab Content */}
        <View style={styles.content}>
          {activeContent ? (
            <ScrollView
              style={styles.contentScroll}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
            >
              <View style={[styles.contentInner, { borderLeftColor: activeConfig.color }]}>
                <Markdown style={mdStyles as any}>
                  {preprocessMath(activeContent)}
                </Markdown>
              </View>
            </ScrollView>
          ) : (
            <View style={styles.emptyTab}>
              <Ionicons name="hourglass-outline" size={22} color="#ccc" />
              <Text style={styles.emptyText}>Processing this phase…</Text>
            </View>
          )}
        </View>

      </Animated.View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    marginTop: 10,
    ...Platform.select({
      web: { boxShadow: '0 2px 12px rgba(0,0,0,0.07)' } as any,
      default: { elevation: 2 },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  collapseChevron: {
    marginLeft: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  streamingBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  streamingText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  depsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  depsLabel: {
    fontSize: 10,
    color: '#888',
    fontWeight: '600',
  },
  depsScroll: {
    flex: 1,
  },
  depChip: {
    backgroundColor: 'rgba(102,126,234,0.12)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 6,
    borderWidth: 1,
    borderColor: 'rgba(102,126,234,0.2)',
  },
  depText: {
    fontSize: 10,
    color: '#667EEA',
    fontWeight: '500',
  },
  resultBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#E8F5E9',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  resultLabel: {
    fontSize: 12,
    color: '#2E7D32',
    fontWeight: '600',
  },
  resultValue: {
    fontSize: 14,
    color: '#1B5E20',
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  expertBanner: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(156,39,176,0.15)',
    gap: 5,
  },
  expertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  expertTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9C27B0',
  },
  expertBody: {
    fontSize: 11,
    lineHeight: 16,
  },
  tabBar: {
    flexDirection: 'row',
    position: 'relative',
    height: 40,
    padding: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  tabIndicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: 10,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    zIndex: 1,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  content: {
    maxHeight: 600,
  },
  contentScroll: {
    flex: 1,
  },
  contentInner: {
    padding: 12,
    borderLeftWidth: 3,
    margin: 10,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.012)',
  },
  emptyTab: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: '#ccc',
  },
});
