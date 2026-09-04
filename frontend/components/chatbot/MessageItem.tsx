import React from 'react';
import { View, Text, TouchableOpacity, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Markdown from 'react-native-markdown-display';
import { Message } from '@/stores/chatbotStore';
import { useDialecticalUIStore } from '@/stores/dialecticalUIStore';
import DialecticalProofCard from '@/components/DialecticalProofCard';
import AxiomPedigreeTree from '@/components/chatbot/AxiomPedigreeTree';
import FallbackTrainingCard from '@/components/chatbot/FallbackTrainingCard';

const formatTimestamp = (dateInput: Date | string) => {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (!date || isNaN(date.getTime())) return '';
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

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
    if (/^\s*\d/.test(math)) {
        return match;
    }
    return `${prefix}\`${math.trim()}\``;
  });

  return processed;
};

/** Classify scientific domain from text content — expanded coverage */
const classifyScientificDomain = (text: string) => {
  const tLower = text.toLowerCase();
  if (tLower.includes('peano') || tLower.includes('gauss') || tLower.includes('binomial') || tLower.includes('summation') || tLower.includes('divisibility') || tLower.includes('polynomial') || tLower.includes('divides') || tLower.includes('algebraic') || tLower.includes('number theory') || tLower.includes('riemann') || tLower.includes('fermat') || tLower.includes('prime')) {
    return { label: 'Pure Mathematics', icon: 'calculator-outline', color: '#10B981' };
  }
  if (tLower.includes('relativity') || tLower.includes('thermodynamics') || tLower.includes('quantum') || tLower.includes('speed of light') || tLower.includes('lagrangian') || tLower.includes('noether') || tLower.includes('heisenberg') || tLower.includes('schrodinger') || tLower.includes('maxwell') || tLower.includes('planck')) {
    return { label: 'Theoretical Physics', icon: 'planet-outline', color: '#6366F1' };
  }
  if (tLower.includes('stoichiometric') || tLower.includes('chemical') || tLower.includes('titration') || tLower.includes('reaction') || tLower.includes('lavoisier') || tLower.includes('chemistry') || tLower.includes('molar') || tLower.includes('avogadro')) {
    return { label: 'Chemical Synthesis', icon: 'flask-outline', color: '#EC4899' };
  }
  if (tLower.includes('hardy-weinberg') || tLower.includes('genetic') || tLower.includes('dna') || tLower.includes('allele') || tLower.includes('biological') || tLower.includes('biology') || tLower.includes('evolution') || tLower.includes('lotka-volterra') || tLower.includes('ecology')) {
    return { label: 'Molecular Biology', icon: 'git-branch-outline', color: '#84CC16' };
  }
  if (tLower.includes('modus ponens') || tLower.includes('de morgan') || tLower.includes('excluded middle') || tLower.includes('non-contradiction') || tLower.includes('propositional') || tLower.includes('boolean') || tLower.includes('syllogism') || tLower.includes('aristotelian') || tLower.includes('heyting') || tLower.includes('godel') || tLower.includes('formal logic')) {
    return { label: 'Formal Logic', icon: 'shield-outline', color: '#F59E0B' };
  }
  if (tLower.includes('turing') || tLower.includes('halting') || tLower.includes('byzantine') || tLower.includes('dijkstra') || tLower.includes('amdahl') || tLower.includes('algorithm') || tLower.includes('computer science') || tLower.includes('p vs np') || tLower.includes('complexity')) {
    return { label: 'Computer Science', icon: 'code-working-outline', color: '#06B6D4' };
  }
  if (tLower.includes('stress') || tLower.includes('strain') || tLower.includes('bending') || tLower.includes('solid media') || tLower.includes('equilibrium force') || tLower.includes('civil engineering') || tLower.includes('fourier transform') || tLower.includes('signal processing') || tLower.includes('reynolds') || tLower.includes('bernoulli')) {
    return { label: 'Engineering Science', icon: 'construct-outline', color: '#8B5CF6' };
  }
  if (tLower.includes('nash equilibrium') || tLower.includes('supply and demand') || tLower.includes('pareto') || tLower.includes('coase') || tLower.includes('sociological') || tLower.includes('game theory') || tLower.includes('economics') || tLower.includes('keynesian') || tLower.includes('gini')) {
    return { label: 'Social Science', icon: 'people-outline', color: '#3B82F6' };
  }
  if (tLower.includes('cosmol') || tLower.includes('big bang') || tLower.includes('hubble') || tLower.includes('dark matter') || tLower.includes('plate tectonic') || tLower.includes('geological') || tLower.includes('greenhouse') || tLower.includes('climate')) {
    return { label: 'Empirical Science', icon: 'earth-outline', color: '#14B8A6' };
  }
  if (tLower.includes('liar paradox') || tLower.includes('banach-tarski') || tLower.includes('zeno') || tLower.includes('russell') || tLower.includes('paradox') || tLower.includes('gettier')) {
    return { label: 'Paradox Resolution', icon: 'infinite-outline', color: '#F97316' };
  }
  return null;
};

/** Detect if the response is a structured 3-phase dialectical proof */
const hasPhaseProofContent = (text: string): boolean => {
  return (
    text.includes('Phase 1:') || text.includes('Phase 2:') || text.includes('Phase 3:') ||
    text.includes('1️⃣') || text.includes('2️⃣') || text.includes('3️⃣') ||
    text.includes('MATHEMATICAL PROOF') || text.includes('BOOLEAN LOGIC PROOF') ||
    text.includes('FORMAL LOGIC PROOF') || text.includes('EMPIRICAL SCIENCE PROOF') ||
    text.includes('ENGINEERING SCIENCE PROOF') || text.includes('NATURAL SCIENCE PROOF') ||
    text.includes('NUMBER THEORY PROOF') || text.includes('QUANTUM MECHANICS PROOF') ||
    text.includes('SOCIAL SCIENCE PROOF')
  );
};

/** MODEL short-name map — what to show in the model badge */
const MODEL_SHORT: Record<string, string> = {
  'phi-3': 'P1·Trial',
  'mistral': 'P2·Deductive',
  'llama-3': 'P3·Inductive',
};

export const MessageItem = React.memo(({
  item,
  isStreaming,
  onEdit,
  onCopy,
  onFeedback,
  onUse,
  onAxiomClick,
  onShare,
  user,
  colors,
  activeScheme,
  t,
  styles
}: any) => {
  const isUser = item.sender === 'user';
  const isError = item.type === 'error';
  const isDark = activeScheme === 'dark';

  // ── FIX: correct store selectors (Record<string,boolean> not array/string) ──
  const isReasoningExpanded = useDialecticalUIStore((s: any) => s.expandedMessages[item.id] ?? false);
  const toggleMessage = useDialecticalUIStore((s: any) => s.toggleMessage);

  const isUserMsgExpanded = useDialecticalUIStore((s: any) => s.expandedUserMessages[item.id] ?? false);
  const toggleUserMessage = useDialecticalUIStore((s: any) => s.toggleUserMessage);

  // ── Phase proof detection ─────────────────────────────────────────────────
  const hasPhaseProof = !isUser && !isError && hasPhaseProofContent(item.text);
  const phaseBarColors = [
    { key: 'Phase 1:', label: t('phase_1_trial') || '🔬 Trial', color: '#E53935' },
    { key: 'Phase 2:', label: t('phase_2_deductive') || '🧮 Deductive', color: '#1565C0' },
    { key: 'Phase 3:', label: t('phase_3_inductive') || '🌍 Inductive', color: '#2E7D32' },
  ];
  const presentPhases = phaseBarColors.filter(p => item.text.includes(p.key));

  // ── Domain badge ──────────────────────────────────────────────────────────
  const domain = !isUser ? classifyScientificDomain(item.text) : null;

  // ── Markdown styles ───────────────────────────────────────────────────────
  const markdownStyles = {
    body: { fontSize: 15, color: colors.text, lineHeight: 23 },
    heading1: { fontSize: 21, fontWeight: 'bold' as const, color: colors.text, marginTop: 14, marginBottom: 6 },
    heading2: { fontSize: 18, fontWeight: 'bold' as const, color: colors.text, marginTop: 12, marginBottom: 5 },
    heading3: { fontSize: 16, fontWeight: 'bold' as const, color: colors.text, marginTop: 10, marginBottom: 4 },
    strong: { fontWeight: 'bold' as const, color: colors.text },
    em: { fontStyle: 'italic' as const, color: colors.text },
    blockquote: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
      borderLeftWidth: 4,
      borderLeftColor: colors.primary || '#667EEA',
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginVertical: 8,
      borderRadius: 4,
    },
    table: { borderColor: colors.border, borderWidth: 1, borderRadius: 8, marginVertical: 10, overflow: 'hidden' as const },
    th: { padding: 8, fontWeight: 'bold' as const, color: colors.text, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', borderBottomWidth: 1, borderColor: colors.border },
    td: { padding: 8, color: colors.text, borderBottomWidth: 1, borderColor: colors.border },
    hr: { backgroundColor: colors.border, height: 1, marginVertical: 12 },
    code_inline: { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', color: colors.primary || '#667EEA', paddingHorizontal: 4, paddingVertical: 0, margin: 0, borderRadius: 4, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
    code_block: { backgroundColor: isDark ? '#1E1E1E' : '#F5F5F5', color: isDark ? '#D4D4D4' : '#333333', padding: 12, borderRadius: 8, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginVertical: 8, overflow: 'hidden' as const },
    fence: { backgroundColor: isDark ? '#1E1E1E' : '#F5F5F5', color: isDark ? '#D4D4D4' : '#333333', padding: 12, borderRadius: 8, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginVertical: 8, overflow: 'hidden' as const },
    pre: { backgroundColor: isDark ? '#1E1E1E' : '#F5F5F5', padding: 12, borderRadius: 8, marginVertical: 8, overflow: 'hidden' as const },
    link: { color: colors.primary || '#667EEA', textDecorationLine: 'underline' as const },
    bullet_list_icon: { color: colors.primary || '#667EEA' },
    ordered_list_icon: { color: colors.primary || '#667EEA', fontWeight: 'bold' as const },
  };

  return (
    <Animated.View style={[styles.messageWrapper, isUser ? styles.userWrapper : styles.botWrapper]}>
      {/* Avatar */}
      <View style={styles.messageAvatar}>
        {isUser ? (
          <LinearGradient colors={[colors.primary, colors.primary + '80']} style={styles.avatarGradient}>
            <Text style={styles.avatarText}>{user?.name?.charAt(0)?.toUpperCase() || 'U'}</Text>
          </LinearGradient>
        ) : (
          <LinearGradient colors={['#667EEA', '#764BA2']} style={styles.avatarGradient}>
            <Ionicons name="sparkles" size={18} color="#fff" />
          </LinearGradient>
        )}
      </View>

      {/* Message Content */}
      <View style={[styles.messageContent, isUser ? styles.userContent : styles.botContent]}>
        {/* ── Header Row ─────────────────────────────────────────────── */}
        <View style={[styles.messageHeader, { flexWrap: 'wrap' }]}>
          <Text style={[styles.messageSender, isUser && styles.userSender]}>
            {isUser ? user?.name || t('current_user') : t('chatbot') || 'Zmzir AI'}
          </Text>
          <Text style={styles.messageTime}>{formatTimestamp(item.timestamp)}</Text>

          {/* Model badge */}
          {item.model && !isUser && (
            <View style={[styles.modelBadge, { backgroundColor: isDark ? 'rgba(33,150,243,0.15)' : '#E8F4FD' }]}>
              <Text style={styles.modelBadgeText}>{MODEL_SHORT[item.model] ?? item.model}</Text>
            </View>
          )}

          {/* Scientific domain badge */}
          {domain && !isUser && (
            <View style={[styles.modelBadge, { backgroundColor: domain.color + '15', borderColor: domain.color + '30', borderWidth: 0.5, flexDirection: 'row', alignItems: 'center', marginLeft: 4 }]}>
              <Ionicons name={domain.icon as any} size={10} color={domain.color} style={{ marginRight: 2 }} />
              <Text style={[styles.modelBadgeText, { color: domain.color }]}>{domain.label}</Text>
            </View>
          )}

          {/* Global Axiom gold badge */}
          {!isUser && item.status === 'global_axiom' && (
            <View style={[styles.modelBadge, { backgroundColor: '#FFF9C4', borderColor: '#DAA520', borderWidth: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 4 }]}>
              <Ionicons name="shield-checkmark" size={10} color="#856404" style={{ marginRight: 2 }} />
              <Text style={[styles.modelBadgeText, { color: '#856404', fontWeight: 'bold' }]}>
                Global Axiom{item.confidenceScore != null ? ` · ${Math.round(item.confidenceScore * 100)}%` : ''}
              </Text>
            </View>
          )}

          {/* Synthesized thesis badge */}
          {!isUser && item.status === 'synthesized_thesis' && (
            <View style={[styles.modelBadge, { backgroundColor: '#FF9800', flexDirection: 'row', alignItems: 'center', marginLeft: 4 }]}>
              <Ionicons name="git-merge-outline" size={10} color="#fff" style={{ marginRight: 2 }} />
              <Text style={[styles.modelBadgeText, { color: '#fff' }]}>Synthesized</Text>
            </View>
          )}
        </View>

        {/* ── Bubble ─────────────────────────────────────────────────── */}
        <View style={[
          styles.messageBubble,
          isUser
            ? [styles.userBubble, { backgroundColor: colors.primary }]
            : [styles.botBubble, { backgroundColor: isDark ? '#1E1E2E' : '#F5F5F5' }],
          isError && styles.errorBubble,
        ]}>

          {/* Phase indicator bar (only on completed proofs, not streaming) */}
          {hasPhaseProof && !isStreaming && presentPhases.length > 0 && (
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
              {presentPhases.map(p => (
                <View key={p.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: p.color + '18', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 0.5, borderColor: p.color + '50' }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: p.color }}>{p.label}</Text>
                </View>
              ))}
            </View>
          )}

          {/* ── Content rendering ──────────────────────────────────── */}
          {item.type === 'code' ? (
            /* Code block */
            <View style={styles.codeBlock}>
              <View style={styles.codeHeader}>
                <Ionicons name="code" size={14} color="#4CAF50" />
                <Text style={styles.codeHeaderText}>{t('code_output') || 'Code Output'}</Text>
                <TouchableOpacity onPress={() => onCopy(item.text)} style={styles.codeCopy}>
                  <Ionicons name="copy-outline" size={14} color="#666" />
                </TouchableOpacity>
              </View>
              <Text selectable style={[styles.messageText, styles.codeText]}>{item.text}</Text>
            </View>
          ) : isUser ? (
            /* User message — expandable for long text */
            <TouchableOpacity activeOpacity={0.85} onLongPress={() => onCopy(item.text)} delayLongPress={400}>
              <Text
                selectable
                style={[styles.messageText, styles.userMessageText]}
                numberOfLines={(isUserMsgExpanded || item.text.length <= 120) ? undefined : 3}
              >
                {item.text}
              </Text>
            </TouchableOpacity>
          ) : isStreaming ? (
            /* Streaming: plain text with blinking cursor */
            <View>
              <Text selectable style={[styles.messageText, { color: colors.text }]}>
                {item.text}
                {'▋'}
              </Text>
              <View style={styles.livePhaseRow}>
                <View style={styles.livePhaseDot} />
                <Text style={[styles.livePhaseText, { color: colors.textSecondary }]}>
                  {item.text.includes('Phase 3') || item.text.includes('3️⃣')
                    ? '🌍 Inductive Scaling…'
                    : item.text.includes('Phase 2') || item.text.includes('2️⃣')
                      ? '🧮 Deductive Purification…'
                      : item.text.includes('Phase 1') || item.text.includes('1️⃣')
                        ? '🔬 Empirical Observation…'
                        : '⚙️ Processing…'
                  }
                </Text>
              </View>
            </View>
          ) : hasPhaseProof ? (
            /* ── FIX: structured proof → ONLY DialecticalProofCard, plus intro text above ── */
            <View style={{ width: '100%' }}>
              {(() => {
                // Match the FIRST occurrence of any proof phase/heading marker
                // This handles both emoji-phase (1️⃣) and markdown heading (### 🔬) styles
                const match = item.text.match(/(1️⃣|###\s*[🔬🧮🌍⚗]|Phase 1\s|Phase 2\s|Phase 3\s)/i);
                if (match && match.index != null && match.index > 0) {
                  const intro = item.text.substring(0, match.index).trim();
                  if (intro) {
                    return (
                      <Markdown style={markdownStyles as any}>
                        {preprocessMath(intro)}
                      </Markdown>
                    );
                  }
                }
                return null;
              })()}
              <DialecticalProofCard
                text={item.text}
                status={item.status as any}
                colors={colors}
                isStreaming={false}
                defaultCollapsed={false}
                activeScheme={activeScheme}
              />
            </View>
          ) : (
            /* Regular bot response — Markdown renderer */
            <View style={{ width: '100%' }}>
              <Markdown style={markdownStyles as any}>
                {preprocessMath(item.text)}
              </Markdown>
            </View>
          )}
        </View>

        {/* ── Error Sieve Alert ──────────────────────────────────────── */}
        {!isUser && item.type === 'error' && (
          <View style={[styles.sieveAlert, { borderColor: '#EF4444', backgroundColor: isDark ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.04)' }]}>
            <View style={styles.sieveAlertHeader}>
              <Ionicons name="alert-circle-outline" size={16} color="#EF4444" />
              <Text style={styles.sieveAlertTitle}>{t('anti_corruption_sieve_active') || '🛡️ Anti-Corruption Sieve Active'}</Text>
            </View>
            <Text style={[styles.sieveAlertText, { color: colors.textSecondary }]}>
              {t('sieve_alert_text') || 'Hypothesis tested against global axioms. Logical inconsistency detected.'}
            </Text>
          </View>
        )}

        {/* ── Axiom Pedigree Tree ───────────────────────────────────── */}
        {!isUser && (item.axiomId != null || item.status === 'global_axiom' || item.status === 'synthesized_thesis') && (
          <AxiomPedigreeTree
            messageId={item.id}
            parentAxioms={item.parentAxioms}
            axiomId={item.axiomId}
            status={item.status}
            confidenceScore={item.confidenceScore}
            branch={item.branch}
            colors={colors}
            activeScheme={activeScheme}
            onAxiomClick={(axiomId: number, thesis?: string) => onAxiomClick?.(String(axiomId), thesis || `Axiom #${axiomId}`)}
          />
        )}

        {/* ── Fallback Training Card (AI admins only) ────────────── */}
        {!isUser && item.isNewFallback && item.trainingTicketId && user?.ai_admin && (
          <FallbackTrainingCard
            ticketId={item.trainingTicketId}
            branch={item.branch}
            colors={colors}
            activeScheme={activeScheme}
          />
        )}

        {/* ── User message actions (copy, edit, show more) ──────── */}
        {isUser && (
          <View style={styles.userMessageActions}>
            {item.text.length > 120 && (
              <TouchableOpacity onPress={() => toggleUserMessage(item.id)}>
                <Text style={[styles.showMoreText, { color: colors.textSecondary }]}>
                  {isUserMsgExpanded ? 'Show less ‹' : 'Show more ›'}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => onCopy(item.text)} style={styles.miniActionIcon}>
              <Ionicons name="copy-outline" size={13} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onEdit(item)} style={styles.miniActionIcon}>
              <Ionicons name="pencil-outline" size={13} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* ── Bot message action row ──────────────────────────────── */}
        {!isUser && (
          <View style={styles.messageFooter}>
            {item.tokens != null && (
              <Text style={styles.tokenText}>
                {t('tokens_count', { count: item.tokens }) || `${item.tokens} tokens`}
              </Text>
            )}
            <View style={styles.ideaActions}>
              {/* Agree / thumbs up */}
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => onFeedback(item, item.feedback === 'up' ? null : 'up')}
              >
                <Ionicons
                  name={item.feedback === 'up' ? 'thumbs-up' : 'thumbs-up-outline'}
                  size={15}
                  color={item.feedback === 'up' ? '#4CAF50' : colors.textSecondary}
                />
                <Text style={[styles.actionButtonText, { color: item.feedback === 'up' ? '#4CAF50' : colors.textSecondary }]}>
                  {t('agree') || 'Agree'}
                  {item.feedbackCounts?.up ? ` (${item.feedbackCounts.up})` : ''}
                </Text>
              </TouchableOpacity>

              {/* Contradict / thumbs down */}
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => onFeedback(item, item.feedback === 'down' ? null : 'down')}
              >
                <Ionicons
                  name={item.feedback === 'down' ? 'thumbs-down' : 'thumbs-down-outline'}
                  size={15}
                  color={item.feedback === 'down' ? '#F44336' : colors.textSecondary}
                />
                <Text style={[styles.actionButtonText, { color: item.feedback === 'down' ? '#F44336' : colors.textSecondary }]}>
                  {t('contradict') || 'Contradict'}
                  {item.feedbackCounts?.down ? ` (${item.feedbackCounts.down})` : ''}
                </Text>
              </TouchableOpacity>

              {/* Expert review (only when downvoted) — escalates to Pancracy review queue */}
              {item.feedback === 'down' && (
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => onFeedback(item, 'expert_review' as any)}
                >
                  <Ionicons name="git-pull-request-outline" size={15} color="#F59E0B" />
                  <Text style={[styles.actionButtonText, { color: '#F59E0B', fontWeight: 'bold' }]}>
                    {t('expert_review') || 'Expert Review'}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Share */}
              <TouchableOpacity style={styles.actionButton} onPress={() => onShare(item)}>
                <Ionicons name="share-outline" size={15} color={colors.textSecondary} />
                <Text style={[styles.actionButtonText, { color: colors.textSecondary }]}>
                  {t('share') || 'Share'}
                </Text>
              </TouchableOpacity>

              {/* Use / rocket */}
              <TouchableOpacity style={styles.actionButton} onPress={() => onUse(item.text)}>
                <Ionicons name="rocket-outline" size={15} color="#4CAF50" />
                <Text style={[styles.actionButtonText, { color: '#4CAF50' }]}>
                  {t('use') || 'Use'}
                </Text>
              </TouchableOpacity>

              {/* Copy */}
              <TouchableOpacity onPress={() => onCopy(item.text)} style={styles.miniActionIcon}>
                <Ionicons name="copy-outline" size={14} color={colors.textSecondary} />
              </TouchableOpacity>

              {/* Reasoning expand (only if has reasoning) */}
              {item.reasoning && (
                <TouchableOpacity onPress={() => toggleMessage(item.id)} style={styles.miniActionIcon}>
                  <Ionicons
                    name={isReasoningExpanded ? 'chevron-up' : 'chevron-down'}
                    size={14}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* ── Reasoning expanded view ─────────────────────────────── */}
        {isReasoningExpanded && item.reasoning && (
          <View style={[styles.reasoningContainer, { borderLeftWidth: 3, borderLeftColor: '#667EEA', borderRadius: 0, paddingLeft: 14 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Ionicons name="git-branch-outline" size={13} color="#667EEA" />
              <Text style={styles.reasoningTitle}>{t('internal_syllogism_chain') || '🧠 Internal Syllogism Chain'}</Text>
            </View>
            <Text selectable style={[styles.reasoningText, { color: colors.text }]}>{item.reasoning}</Text>
          </View>
        )}

        {/* ── Sources list ────────────────────────────────────────── */}
        {item.sources && item.sources.length > 0 && (
          <View style={styles.sourcesContainer}>
            <Text style={styles.sourcesTitle}>📚 {t('sources') || 'Sources'}</Text>
            {item.sources.map((source: any, idx: number) => (
              <TouchableOpacity key={idx} style={styles.sourceItem}>
                <Ionicons name="link" size={12} color={colors.primary} />
                <Text style={styles.sourceText}>{source.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </Animated.View>
  );
}, (prevProps, nextProps) => {
  // Custom comparator — only re-render when content actually changes
  return (
    prevProps.item.text === nextProps.item.text &&
    prevProps.item.feedback === nextProps.item.feedback &&
    prevProps.item.feedbackCounts?.up === nextProps.item.feedbackCounts?.up &&
    prevProps.item.feedbackCounts?.down === nextProps.item.feedbackCounts?.down &&
    prevProps.isStreaming === nextProps.isStreaming &&
    prevProps.activeScheme === nextProps.activeScheme &&
    prevProps.item.status === nextProps.item.status &&
    prevProps.item.confidenceScore === nextProps.item.confidenceScore &&
    prevProps.item.reasoning === nextProps.item.reasoning &&
    prevProps.item.axiomId === nextProps.item.axiomId &&
    prevProps.item.isNewFallback === nextProps.item.isNewFallback
  );
});
