import React, { memo, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDialecticalUIStore } from '../../stores/dialecticalUIStore';

interface ParentAxiom {
  id: number;
  thesis_statement: string;
  branch?: string;
}

interface Props {
  messageId: string;
  parentAxioms?: ParentAxiom[];
  axiomId?: number;
  status?: string;
  confidenceScore?: number;
  branch?: string;
  colors: Record<string, string>;
  activeScheme?: string;
  onAxiomClick?: (axiomId: number, thesis?: string) => void;
}

/** Branch → icon mapping (aligned to 6 dialectical phases) */
const BRANCH_ICONS: Record<string, string> = {
  ontology: 'infinite', epistemology: 'eye', metaphysics: 'prism',
  formal_logic: 'shield-checkmark', set_theory: 'git-network', modal_logic: 'layers',
  dialectics: 'git-merge', proof_theory: 'document-text',
  arithmetic: 'calculator', algebra: 'swap-horizontal', calculus: 'trending-up',
  number_theory: 'apps', topology: 'git-branch', game_theory: 'game-controller',
  classical_mechanics: 'planet', quantum_mechanics: 'nuclear', relativity: 'timer',
  thermodynamics: 'flame', chemistry: 'flask',
  genetics: 'leaf', evolutionary_biology: 'leaf-sharp', neuroscience: 'body',
  ecology: 'earth',
  computer_science: 'code-working', economics: 'bar-chart',
  sociology: 'people', law: 'scale',
  general: 'chatbubble',
};

const PHASE_COLORS: Record<number, string> = {
  0: '#6B7280', 1: '#7C3AED', 2: '#10B981', 3: '#F59E0B',
  4: '#3B82F6', 5: '#84CC16', 6: '#06B6D4',
};

const BRANCH_PHASE: Record<string, number> = {
  ontology: 1, epistemology: 1, metaphysics: 1,
  formal_logic: 2, set_theory: 2, modal_logic: 2, dialectics: 2, proof_theory: 2,
  arithmetic: 3, algebra: 3, calculus: 3, number_theory: 3, topology: 3, game_theory: 3,
  classical_mechanics: 4, quantum_mechanics: 4, relativity: 4, thermodynamics: 4, chemistry: 4,
  genetics: 5, evolutionary_biology: 5, neuroscience: 5, ecology: 5,
  computer_science: 6, economics: 6, sociology: 6, law: 6,
};

/**
 * AxiomPedigreeTree
 *
 * Displays the full parent-chain of an axiom directly from the backend
 * `parentAxioms` array — no regex parsing needed.
 *
 * Root (0: Nothing / 1: Being) → parent1 → parent2 → ... → current axiom
 *
 * Each node is individually tappable to re-query that axiom's proof.
 * Expansion state lives in dialecticalUIStore — toggling this tree
 * does NOT cause other MessageItems to re-render.
 */
const AxiomPedigreeTree = memo(({
  messageId, parentAxioms, axiomId, status, confidenceScore,
  branch, colors, activeScheme, onAxiomClick,
}: Props) => {
  const isExpanded = useDialecticalUIStore((s) => s.expandedAxiomTrees[messageId] ?? false);
  const toggle = useDialecticalUIStore((s) => s.toggleAxiomTree);
  const isDark = activeScheme === 'dark';

  const phase = BRANCH_PHASE[branch ?? ''] ?? 0;
  const phaseColor = PHASE_COLORS[phase];
  const iconName = (BRANCH_ICONS[branch ?? ''] ?? 'help-circle') as any;
  const isAxiom = status === 'global_axiom';
  const isSynthesized = status === 'synthesized_thesis';

  const confidencePct = useMemo(() => {
    if (confidenceScore == null) return 0;
    return Math.round(confidenceScore * 100);
  }, [confidenceScore]);

  // Show pedigree for any message that has an axiomId OR parentAxioms chain OR is a proven status
  const hasContent = axiomId != null || (parentAxioms && parentAxioms.length > 0) || isAxiom || isSynthesized;
  if (!hasContent) return null;

  return (
    <View style={styles.container}>
      {/* ── Collapsible header ─────────────────────────────────────────────── */}
      <TouchableOpacity
        style={[styles.header, { borderColor: phaseColor + '50' }]}
        onPress={() => toggle(messageId)}
        activeOpacity={0.75}
      >
        <View style={[styles.statusDot, { backgroundColor: isAxiom ? '#10B981' : '#F59E0B' }]} />
        <Ionicons name={iconName} size={13} color={phaseColor} style={{ marginRight: 4 }} />
        <Text style={[styles.headerTitle, { color: phaseColor }]}>
          {isAxiom ? '✓ Global Axiom' : isSynthesized ? '⚗ Synthesized Thesis' : '📐 Proven Axiom'}
        </Text>
        {branch && (
          <View style={[styles.branchPill, { backgroundColor: phaseColor + '20' }]}>
            <Text style={[styles.branchText, { color: phaseColor }]}>
              {String(branch).replace(/_/g, ' ')}
            </Text>
          </View>
        )}
        {confidenceScore !== undefined && (
          <Text style={[styles.conf, { color: isDark ? '#999' : '#666' }]}>
            {confidencePct}%
          </Text>
        )}
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={13}
          color={isDark ? '#888' : '#999'}
          style={{ marginLeft: 'auto' }}
        />
      </TouchableOpacity>

      {/* ── Expanded pedigree chain ──────────────────────────────────────── */}
      {isExpanded && (
        <View style={styles.tree}>
          {/* Root nodes */}
          <View style={styles.nodeRow}>
            <View style={[styles.rootNode, { borderColor: '#7C3AED' }]}>
              <Text style={[styles.rootText, { color: '#7C3AED' }]}>0: Nothing</Text>
            </View>
            <Text style={styles.connector}>↔</Text>
            <View style={[styles.rootNode, { borderColor: '#7C3AED' }]}>
              <Text style={[styles.rootText, { color: '#7C3AED' }]}>1: Being</Text>
            </View>
          </View>

          {/* Parent chain (from backend, already ordered root→leaf) */}
          {(parentAxioms ?? []).map((p, i) => {
            const pBranch = p.branch ?? '';
            const pPhase = BRANCH_PHASE[pBranch] ?? 0;
            const pColor = PHASE_COLORS[pPhase];
            const pIcon = (BRANCH_ICONS[pBranch] ?? 'git-commit') as any;
            const shortText =
              p.thesis_statement.length > 80
                ? p.thesis_statement.slice(0, 77) + '…'
                : p.thesis_statement;
            return (
              <View key={p.id}>
                <View style={[styles.arrow, { borderColor: pColor + '50' }]}>
                  <View style={[styles.arrowLine, { backgroundColor: pColor + '40' }]} />
                  <Ionicons name="arrow-down" size={10} color={pColor + '90'} />
                </View>
                <TouchableOpacity
                  style={[styles.parentNode, { borderColor: pColor + '60', backgroundColor: pColor + '10' }]}
                  activeOpacity={0.75}
                  onPress={() => onAxiomClick?.(p.id, p.thesis_statement)}
                >
                  <Ionicons name={pIcon} size={11} color={pColor} style={{ marginRight: 4 }} />
                  <Text style={[styles.parentText, { color: isDark ? '#ddd' : '#333' }]}>
                    {shortText}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}

          {/* Terminal arrow + current axiom node */}
          {(axiomId || isAxiom || isSynthesized) && (
            <>
              <View style={[styles.arrow, { borderColor: phaseColor + '50' }]}>
                <View style={[styles.arrowLine, { backgroundColor: phaseColor + '40' }]} />
                <Ionicons name="arrow-down" size={10} color={phaseColor + '90'} />
              </View>
              <TouchableOpacity
                style={[styles.currentNode, { borderColor: phaseColor, backgroundColor: phaseColor + '18' }]}
                activeOpacity={0.75}
                onPress={() => axiomId != null && onAxiomClick?.(axiomId)}
              >
                <Ionicons name={iconName} size={12} color={phaseColor} style={{ marginRight: 5 }} />
                <Text style={[styles.currentText, { color: phaseColor }]}>
                  {axiomId ? `#${axiomId} ` : '#NEW '}Current Axiom
                </Text>
                <View style={[styles.confBadge, { backgroundColor: phaseColor + '25' }]}>
                  <Text style={[styles.confBadgeText, { color: phaseColor }]}>{confidencePct}%</Text>
                </View>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    </View>
  );
});

AxiomPedigreeTree.displayName = 'AxiomPedigreeTree';

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    borderRadius: 10,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: 8,
    gap: 4,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 4,
  },
  headerTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  branchPill: {
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
    marginLeft: 4,
  },
  branchText: {
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  conf: {
    fontSize: 10,
    marginLeft: 4,
  },
  tree: {
    marginTop: 6,
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  nodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 2,
  },
  rootNode: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  rootText: {
    fontSize: 10,
    fontWeight: '700',
  },
  connector: {
    fontSize: 12,
    color: '#7C3AED',
  },
  arrow: {
    alignItems: 'center',
    paddingVertical: 2,
  },
  arrowLine: {
    width: 1,
    height: 8,
  },
  parentNode: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginVertical: 2,
  },
  parentText: {
    fontSize: 10.5,
    flex: 1,
    lineHeight: 14,
  },
  currentNode: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 2,
  },
  currentText: {
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },
  confBadge: {
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  confBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
});

export default AxiomPedigreeTree;
