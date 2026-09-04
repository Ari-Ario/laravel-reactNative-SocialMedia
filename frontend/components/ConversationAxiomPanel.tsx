import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Message } from '@/stores/chatbotStore';
import { useTranslation } from '@/constants/i18n';

const { height: SCREEN_H } = Dimensions.get('window');
const PANEL_MAX_H = Math.min(300, SCREEN_H * 0.35);

// ─── Types ──────────────────────────────────────────────────────────────────

interface AxiomEntry {
  id: number;
  thesis: string;
  status?: string;
  confidenceScore?: number;
  source: 'proven' | 'dependency';
}

// ─── Axiom Extraction Logic ──────────────────────────────────────────────────

/**
 * Scans all bot messages in a conversation for:
 *  1. Inline "Axiom #X: description" citations (dependency chains)
 *  2. "proven_axiom: description (Axiom ID: X)" patterns
 *  3. Direct axiomId field (the current message's promoted axiom)
 */
function extractAxiomsFromMessages(messages: Message[]): AxiomEntry[] {
  const axiomsMap = new Map<number, AxiomEntry>();

  for (const msg of messages) {
    if (msg.sender !== 'bot') continue;

    // Pattern 1: "Axiom #12: Gauss Summation..."
    const refRegex = /Axiom\s*#(\d+):\s*([^\n(]+)/g;
    let m;
    while ((m = refRegex.exec(msg.text)) !== null) {
      const id = parseInt(m[1], 10);
      const thesis = m[2].trim().replace(/\*\*/g, '').replace(/`/g, '').trim();
      if (!axiomsMap.has(id)) {
        axiomsMap.set(id, { id, thesis, source: 'dependency' });
      }
    }

    // Pattern 2: "proven_axiom: thesis_text (Axiom ID: 5)"
    const provenRegex = /proven_axiom:\s*([^\n(]+)\s*\(Axiom ID:\s*(\d+)\)/g;
    while ((m = provenRegex.exec(msg.text)) !== null) {
      const thesis = m[1].trim().replace(/\*\*/g, '').replace(/`/g, '').trim();
      const id = parseInt(m[2], 10);
      if (!axiomsMap.has(id)) {
        axiomsMap.set(id, { id, thesis, source: 'dependency' });
      }
    }

    // Pattern 3: message's own axiomId (the theorem that was just promoted)
    // FIX: use != null so axiomId=0 (root) is also handled correctly
    if (msg.axiomId != null && !axiomsMap.has(msg.axiomId)) {
      // Extract a clean thesis from the response text
      const bypassMatch = msg.text.match(/AXIOMATIC BYPASS ACTIVATED/i);
      let thesis = `Axiom #${msg.axiomId}`;
      if (!bypassMatch) {
        // Try to get the first meaningful line of the proof text
        const lines = msg.text.split('\n').map(l => l.trim()).filter(Boolean);
        const firstContent = lines.find(l => !l.startsWith('#') && !l.startsWith('---') && l.length > 10);
        if (firstContent) {
          thesis = firstContent.replace(/\*\*/g, '').replace(/`/g, '').slice(0, 120);
        }
      } else {
        // When it's a bypass, find what theorem was recognized as axiom
        const recogMatch = msg.text.match(/recognizes that[^"]*"([^"]+)"/i);
        if (recogMatch) thesis = recogMatch[1];
      }

      axiomsMap.set(msg.axiomId, {
        id: msg.axiomId,
        thesis,
        status: msg.status,
        confidenceScore: msg.confidenceScore,
        source: 'proven',
      });
    }

    // Pattern 4: direct parentAxioms array from backend
    if (msg.parentAxioms && msg.parentAxioms.length > 0) {
      for (const p of msg.parentAxioms) {
        if (!axiomsMap.has(p.id)) {
          axiomsMap.set(p.id, { id: p.id, thesis: p.thesis_statement, source: 'dependency' });
        }
      }
    }
  }

  // Filter out absolute root axioms (ID 1=Being, ID 2=Nothing) from the dependency list
  // as they appear in every single proof and clutter the panel. They are always implied.
  const filtered = Array.from(axiomsMap.values()).filter(a => a.id > 2 || a.source === 'proven');
  return filtered.sort((a, b) => a.id - b.id);
}

// ─── Status config ───────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, { label: string; icon: string }> = {
  global_axiom: { label: 'Global Axiom', icon: 'shield-checkmark-outline' },
  synthesized_thesis: { label: 'Thesis', icon: 'git-merge-outline' },
};

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  messages: Message[];
  colors: any;
  activeScheme: string;
  onAxiomClick?: (id: string, thesis: string) => void;
}

export default function ConversationAxiomPanel({ messages, colors, activeScheme, onAxiomClick }: Props) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const animHeight = useRef(new Animated.Value(0)).current;

  const axioms = useMemo(() => extractAxiomsFromMessages(messages), [messages]);

  if (axioms.length === 0) return null;

  const toggle = () => {
    const toValue = expanded ? 0 : 1;
    setExpanded(!expanded);
    Animated.spring(animHeight, {
      toValue,
      useNativeDriver: false,
      tension: 60,
      friction: 12,
    }).start();
  };

  const panelMaxHeight = animHeight.interpolate({
    inputRange: [0, 1],
    outputRange: [0, PANEL_MAX_H],
  });

  const isDark = activeScheme === 'dark';
  const panelBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)';
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
  const chipBg = isDark ? 'rgba(102,126,234,0.15)' : 'rgba(102,126,234,0.08)';

  return (
    <View style={[styles.wrapper, { borderTopColor: borderColor, backgroundColor: panelBg }]}>
      {/* Toggle Bar */}
      <TouchableOpacity
        style={styles.toggleBar}
        onPress={toggle}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={`${axioms.length} axioms referenced. Tap to ${expanded ? 'collapse' : 'expand'}.`}
      >
        <View style={styles.toggleLeft}>
          <Ionicons name="library-outline" size={15} color={colors.textSecondary} />
          <Text style={[styles.toggleLabel, { color: colors.text }]}>
            {t('axioms_referenced_in_conversation') || 'Axioms Referenced in this Conversation'}
          </Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{axioms.length}</Text>
          </View>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.textSecondary}
        />
      </TouchableOpacity>

      {/* Collapsible List */}
      <Animated.View style={[styles.expandable, { maxHeight: panelMaxHeight }]}>
        <ScrollView
          style={styles.listScroll}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          // Prevent the outer FlatList from consuming these scroll events
          scrollEnabled
        >
          {axioms.map((axiom, index) => {
            const statusCfg = axiom.status ? STATUS_LABEL[axiom.status] : null;
            const isLast = index === axioms.length - 1;

            return (
              <TouchableOpacity
                key={axiom.id}
                style={[
                  styles.axiomRow,
                  { borderBottomColor: borderColor },
                  isLast && styles.axiomRowLast,
                ]}
                onPress={() => onAxiomClick?.(axiom.id.toString(), axiom.thesis)}
                disabled={!onAxiomClick}
                activeOpacity={0.7}
              >
                {/* ID Badge */}
                <View style={[styles.idBadge, { backgroundColor: chipBg }]}>
                  <Text style={[styles.idText, { color: '#667EEA' }]}>#{axiom.id}</Text>
                </View>

                {/* Thesis Content */}
                <View style={styles.thesisBlock}>
                  <Text
                    style={[styles.thesisText, { color: colors.text }]}
                    numberOfLines={2}
                  >
                    {axiom.thesis}
                  </Text>

                  {/* Status pill + Confidence */}
                  <View style={styles.axiomMeta}>
                    {statusCfg && (
                      <View style={styles.statusPill}>
                        <Ionicons
                          name={statusCfg.icon as any}
                          size={10}
                          color={axiom.status === 'global_axiom' ? '#DAA520' : '#FF6B00'}
                        />
                        <Text
                          style={[
                            styles.statusText,
                            { color: axiom.status === 'global_axiom' ? '#DAA520' : '#FF6B00' },
                          ]}
                        >
                          {statusCfg.label}
                        </Text>
                      </View>
                    )}
                    {axiom.source === 'dependency' && (
                      <View style={styles.depPill}>
                        <Text style={styles.depText}>dependency</Text>
                      </View>
                    )}
                    {axiom.confidenceScore != null && (
                      <Text style={[styles.confText, { color: colors.textSecondary }]}>
                        {Math.round(axiom.confidenceScore * 100)}% confidence
                      </Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Footer note */}
          <View style={styles.panelFooter}>
            <Ionicons name="information-circle-outline" size={11} color={colors.textSecondary} />
            <Text style={[styles.footerNote, { color: colors.textSecondary }]}>
              {t('these_axioms_form_foundation') || "These axioms form the logical foundation for this conversation's proofs."}
            </Text>
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    borderTopWidth: 1,
  },
  toggleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 11,
    minHeight: 44,
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  countBadge: {
    backgroundColor: '#667EEA',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  countText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  expandable: {
    overflow: 'hidden',
  },
  listScroll: {
    maxHeight: PANEL_MAX_H,
    paddingBottom: 4,
  },
  axiomRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: 1,
  },
  axiomRowLast: {
    borderBottomWidth: 0,
  },
  idBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    minWidth: 38,
    alignItems: 'center',
    marginTop: 1,
  },
  idText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  thesisBlock: {
    flex: 1,
    gap: 5,
  },
  thesisText: {
    fontSize: 13,
    lineHeight: 18,
  },
  axiomMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  depPill: {
    backgroundColor: 'rgba(102,126,234,0.12)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  depText: {
    fontSize: 9,
    color: '#667EEA',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  confText: {
    fontSize: 10,
  },
  panelFooter: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  footerNote: {
    fontSize: 10,
    lineHeight: 14,
    flex: 1,
    fontStyle: 'italic',
  },
});
