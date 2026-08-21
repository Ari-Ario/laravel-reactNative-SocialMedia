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
    // Basic heuristic: if it looks like a price (e.g. $10) skip it
    if (/^\s*\d/.test(math)) {
        return match;
    }
    return `${prefix}\`${math.trim()}\``;
  });

  return processed;
};

const classifyScientificDomain = (text: string) => {
  const tLower = text.toLowerCase();
  if (tLower.includes('peano') || tLower.includes('gauss') || tLower.includes('binomial') || tLower.includes('summation') || tLower.includes('divisibility') || tLower.includes('polynomial') || tLower.includes('divides') || tLower.includes('algebraic') || tLower.includes('identity')) {
    return { label: 'Pure Mathematics', icon: 'calculator-outline', color: '#10B981' }; 
  }
  if (tLower.includes('relativity') || tLower.includes('thermodynamics') || tLower.includes('quantum') || tLower.includes('speed of light') || tLower.includes('lagrangian') || tLower.includes('noether')) {
    return { label: 'Theoretical Physics', icon: 'planet-outline', color: '#6366F1' }; 
  }
  if (tLower.includes('stoichiometric') || tLower.includes('chemical') || tLower.includes('titration') || tLower.includes('reaction') || tLower.includes('lavoisier') || tLower.includes('chemistry')) {
    return { label: 'Chemical Synthesis', icon: 'flask-outline', color: '#EC4899' }; 
  }
  if (tLower.includes('hardy-weinberg') || tLower.includes('genetic') || tLower.includes('dna') || tLower.includes('allele') || tLower.includes('biological') || tLower.includes('biology')) {
    return { label: 'Molecular Biology', icon: 'git-branch-outline', color: '#84CC16' }; 
  }
  if (tLower.includes('modus ponens') || tLower.includes('de morgan') || tLower.includes('excluded middle') || tLower.includes('non-contradiction') || tLower.includes('propositional') || tLower.includes('boolean') || tLower.includes('syllogism') || tLower.includes('aristotelian') || tLower.includes('heyting')) {
    return { label: 'Formal Logic', icon: 'shield-outline', color: '#F59E0B' }; 
  }
  if (tLower.includes('turing') || tLower.includes('halting') || tLower.includes('byzantine') || tLower.includes('dijkstra') || tLower.includes('amdahl') || tLower.includes('algorithm') || tLower.includes('computer science')) {
    return { label: 'Computer Science', icon: 'code-working-outline', color: '#06B6D4' }; 
  }
  if (tLower.includes('stress') || tLower.includes('strain') || tLower.includes('bending') || tLower.includes('solid media') || tLower.includes('equilibrium force') || tLower.includes('civil engineering')) {
    return { label: 'Structural Engineering', icon: 'business-outline', color: '#8B5CF6' }; 
  }
  if (tLower.includes('nash equilibrium') || tLower.includes('supply and demand') || tLower.includes('pareto') || tLower.includes('coase') || tLower.includes('sociological') || tLower.includes('game theory') || tLower.includes('economics')) {
    return { label: 'Pancratic Social Science', icon: 'people-outline', color: '#3B82F6' }; 
  }
  return null;
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

  // O(1) state access correctly
  const expandedMessageIds = useDialecticalUIStore((s: any) => s.expandedMessageIds) || [];
  const isExpanded = expandedMessageIds.includes(item.id);
  const toggleMessage = useDialecticalUIStore((s: any) => s.toggleMessage);

  const expandedUserMessageId = useDialecticalUIStore((s: any) => s.expandedUserMessageId);
  const setExpandedUserMessageId = useDialecticalUIStore((s: any) => s.setExpandedUserMessageId);

  const hasPhaseProof = !isUser && (item.text.includes('Phase 1:') || item.text.includes('Phase 2:') || item.text.includes('Phase 3:'));
  const phaseBarColors = [
    { key: 'Phase 1:', label: t('phase_1_trial') || '🔬 Trial', color: '#E53935' },
    { key: 'Phase 2:', label: t('phase_2_deductive') || '🧮 Deductive', color: '#1565C0' },
    { key: 'Phase 3:', label: t('phase_3_inductive') || '🌍 Inductive', color: '#2E7D32' },
  ];

  const markdownStyles = {
    body: { fontSize: 16, color: colors.text, lineHeight: 24 },
    heading1: { fontSize: 22, fontWeight: 'bold' as const, color: colors.text, marginTop: 12, marginBottom: 6 },
    heading2: { fontSize: 20, fontWeight: 'bold' as const, color: colors.text, marginTop: 12, marginBottom: 6 },
    heading3: { fontSize: 18, fontWeight: 'bold' as const, color: colors.text, marginTop: 12, marginBottom: 6 },
    strong: { fontWeight: 'bold' as const, color: colors.text },
    em: { fontStyle: 'italic' as const, color: colors.text },
    blockquote: {
      backgroundColor: activeScheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
      borderLeftWidth: 4,
      borderLeftColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginVertical: 8,
      borderRadius: 4,
    },
    table: { borderColor: colors.border, borderWidth: 1, borderRadius: 8, marginVertical: 10, overflow: 'hidden' },
    th: { padding: 8, fontWeight: 'bold' as const, color: colors.text, backgroundColor: activeScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', borderBottomWidth: 1, borderColor: colors.border },
    td: { padding: 8, color: colors.text, borderBottomWidth: 1, borderColor: colors.border },
    hr: { backgroundColor: colors.border, height: 1, marginVertical: 12 },
    code_inline: { backgroundColor: activeScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', color: colors.primary, paddingHorizontal: 4, borderRadius: 4, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
    code_block: { backgroundColor: activeScheme === 'dark' ? '#1E1E1E' : '#F5F5F5', color: activeScheme === 'dark' ? '#D4D4D4' : '#333333', padding: 12, borderRadius: 8, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginVertical: 8, overflow: 'hidden' },
    fence: { backgroundColor: activeScheme === 'dark' ? '#1E1E1E' : '#F5F5F5', color: activeScheme === 'dark' ? '#D4D4D4' : '#333333', padding: 12, borderRadius: 8, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginVertical: 8, overflow: 'hidden' },
    pre: { backgroundColor: activeScheme === 'dark' ? '#1E1E1E' : '#F5F5F5', padding: 12, borderRadius: 8, marginVertical: 8, overflow: 'hidden' },
    link: { color: colors.primary, textDecorationLine: 'underline' as const },
  };

  return (
    <Animated.View style={[styles.messageWrapper, isUser ? styles.userWrapper : styles.botWrapper]}>
      {/* Avatar */}
      <View style={styles.messageAvatar}>
        {isUser ? (
          <LinearGradient colors={[colors.primary, colors.primary + '80']} style={styles.avatarGradient}>
            <Text style={styles.avatarText}>{user?.name?.charAt(0) || 'U'}</Text>
          </LinearGradient>
        ) : (
          <LinearGradient colors={['#667EEA', '#764BA2']} style={styles.avatarGradient}>
            <Ionicons name="sparkles" size={18} color="#fff" />
          </LinearGradient>
        )}
      </View>

      {/* Message Content */}
      <View style={[styles.messageContent, isUser ? styles.userContent : styles.botContent]}>
        <View style={styles.messageHeader}>
          <Text style={[styles.messageSender, isUser && styles.userSender]}>
            {isUser ? user?.name || t('current_user') : t('chatbot')}
          </Text>
          <Text style={styles.messageTime}>{formatTimestamp(item.timestamp)}</Text>
          {item.model && !isUser && (
            <View style={styles.modelBadge}>
              <Text style={styles.modelBadgeText}>
                {item.model}
              </Text>
            </View>
          )}
          {!isUser && (() => {
            const domain = classifyScientificDomain(item.text);
            if (!domain) return null;
            return (
              <View style={[styles.modelBadge, { backgroundColor: domain.color + '15', borderColor: domain.color + '30', borderWidth: 0.5, flexDirection: 'row', alignItems: 'center', marginLeft: 4 }]}>
                <Ionicons name={domain.icon as any} size={10} color={domain.color} style={{ marginRight: 2 }} />
                <Text style={[styles.modelBadgeText, { color: domain.color }]}>{domain.label}</Text>
              </View>
            );
          })()}
          {!isUser && item.status === 'global_axiom' && (
            <View style={[styles.modelBadge, { backgroundColor: '#FFD700', borderColor: '#DAA520', borderWidth: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 4 }]}>
              <Ionicons name="shield-checkmark" size={10} color="#000" style={{ marginRight: 2 }} />
              <Text style={[styles.modelBadgeText, { color: '#000', fontWeight: 'bold' }]}>Global Axiom ({item.confidenceScore})</Text>
            </View>
          )}
          {!isUser && item.status === 'synthesized_thesis' && (
            <View style={[styles.modelBadge, { backgroundColor: '#FF9800', flexDirection: 'row', alignItems: 'center', marginLeft: 4 }]}>
              <Ionicons name="git-merge-outline" size={10} color="#fff" style={{ marginRight: 2 }} />
              <Text style={[styles.modelBadgeText, { color: '#fff' }]}>Synthesized Thesis</Text>
            </View>
          )}
        </View>

        <View style={[
          styles.messageBubble,
          isUser ? [styles.userBubble, { backgroundColor: colors.primary }] : [styles.botBubble, { backgroundColor: activeScheme === 'dark' ? '#1E1E2E' : '#F5F5F5' }],
          isError && styles.errorBubble,
        ]}>
          {hasPhaseProof && !isUser && !isStreaming && (
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
              {phaseBarColors.filter(p => item.text.includes(p.key)).map(p => (
                <View key={p.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: p.color + '18', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 0.5, borderColor: p.color + '50' }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: p.color }}>{p.label}</Text>
                </View>
              ))}
            </View>
          )}
          {item.type === 'code' ? (
            <View style={styles.codeBlock}>
              <View style={styles.codeHeader}>
                <Ionicons name="code" size={14} color="#4CAF50" />
                <Text style={styles.codeHeaderText}>{t('code_output')}</Text>
                <TouchableOpacity onPress={() => onCopy(item.text)} style={styles.codeCopy}>
                  <Ionicons name="copy-outline" size={14} color="#666" />
                </TouchableOpacity>
              </View>
              <Text style={[styles.messageText, styles.codeText]}>{item.text}</Text>
            </View>
          ) : isUser ? (
            <TouchableOpacity activeOpacity={0.85} onLongPress={() => onCopy(item.text)} delayLongPress={400}>
              <Text
                style={[styles.messageText, styles.userMessageText]}
                numberOfLines={(expandedUserMessageId === item.id || item.text.length <= 120) ? undefined : 3}
              >
                {item.text}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: '100%' }}>
              {isStreaming ? (
                <View>
                  <Text selectable style={[styles.messageText, { color: colors.text }]}>
                    {item.text}
                    <View style={styles.streamingCursor} />
                  </Text>
                  <View style={styles.livePhaseRow}>
                    <View style={styles.livePhaseDot} />
                    <Text style={[styles.livePhaseText, { color: colors.textSecondary }]}>
                      {item.text.includes('Phase 3') || item.text.includes('3️⃣') || item.text.includes('\uD83C\uDF0D')
                        ? '\uD83C\uDF0D Inductive Scaling\u2026'
                        : item.text.includes('Phase 2') || item.text.includes('2️⃣') || item.text.includes('\uD83E\uDDEE')
                          ? '\uD83E\uDDEE Deductive Purification\u2026'
                          : item.text.includes('Phase 1') || item.text.includes('1️⃣') || item.text.includes('\uD83D\uDD2C')
                            ? '\uD83D\uDD2C Empirical Observation\u2026'
                            : '\u2699\uFE0F Processing\u2026'
                      }
                    </Text>
                  </View>
                </View>
              ) : (
                <Markdown style={markdownStyles as any}>
                  {preprocessMath(item.text)}
                </Markdown>
              )}
              {!isStreaming && item.text.length > 50 && (
                <DialecticalProofCard
                  text={item.text}
                  status={item.status as any}
                  colors={colors}
                  isStreaming={isStreaming}
                  defaultCollapsed={true}
                  activeScheme={activeScheme}
                />
              )}
            </View>
          )}
        </View>

        {!isUser && item.type === 'error' && (
          <View style={[styles.sieveAlert, { borderColor: '#EF4444', backgroundColor: activeScheme === 'dark' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.04)' }]}>
            <View style={styles.sieveAlertHeader}>
              <Ionicons name="alert-circle-outline" size={16} color="#EF4444" />
              <Text style={styles.sieveAlertTitle}>{t('anti_corruption_sieve_active')}</Text>
            </View>
            <Text style={[styles.sieveAlertText, { color: colors.textSecondary }]}>
              {t('sieve_alert_text')}
            </Text>
          </View>
        )}

        {!isUser && (item.axiomId || item.status === 'global_axiom' || item.status === 'synthesized_thesis') && (
          <AxiomPedigreeTree
            messageId={item.id}
            parentAxioms={item.parentAxioms}
            axiomId={item.axiomId}
            status={item.status}
            confidenceScore={item.confidenceScore}
            branch={item.branch}
            colors={colors}
            activeScheme={activeScheme}
            onAxiomClick={onAxiomClick}
          />
        )}

        {!isUser && item.isNewFallback && item.trainingTicketId && user?.ai_admin && (
          <FallbackTrainingCard
            ticketId={item.trainingTicketId}
            branch={item.branch}
            colors={colors}
            activeScheme={activeScheme}
          />
        )}

        {isUser && (
          <View style={styles.userMessageActions}>
            {item.text.length > 120 && (
              <TouchableOpacity
                onPress={() => setExpandedUserMessageId(expandedUserMessageId === item.id ? null : item.id)}
              >
                <Text style={[styles.showMoreText, { color: colors.textSecondary }]}>
                  {expandedUserMessageId === item.id ? 'Show less ‹' : 'Show more ›'}
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

        {!isUser && (
          <View style={styles.messageFooter}>
            {item.tokens && (
              <Text style={styles.tokenText}>{t('tokens_count', { count: item.tokens })}</Text>
            )}
            <View style={styles.ideaActions}>
              <TouchableOpacity style={styles.actionButton} onPress={() => onFeedback(item, item.feedback === 'up' ? null : 'up')}>
                <Ionicons name={item.feedback === 'up' ? "thumbs-up" : "thumbs-up-outline"} size={16} color={item.feedback === 'up' ? "#4CAF50" : colors.textSecondary} />
                <Text style={[styles.actionButtonText, { color: item.feedback === 'up' ? "#4CAF50" : colors.textSecondary }]}>
                  {t('agree') || 'Agree'} {item.feedbackCounts?.up ? `(${item.feedbackCounts.up})` : ''}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.actionButton} onPress={() => onFeedback(item, item.feedback === 'down' ? null : 'down')}>
                <Ionicons name={item.feedback === 'down' ? "thumbs-down" : "thumbs-down-outline"} size={16} color={item.feedback === 'down' ? "#F44336" : colors.textSecondary} />
                <Text style={[styles.actionButtonText, { color: item.feedback === 'down' ? "#F44336" : colors.textSecondary }]}>
                  {t('contradict') || 'Contradict'} {item.feedbackCounts?.down ? `(${item.feedbackCounts.down})` : ''}
                </Text>
              </TouchableOpacity>
              
              {item.feedback === 'down' && (
                <TouchableOpacity style={styles.actionButton} onPress={() => onFeedback(item, 'down')}>
                  <Ionicons name="git-pull-request-outline" size={16} color="#F59E0B" />
                  <Text style={[styles.actionButtonText, { color: "#F59E0B", fontWeight: 'bold' }]}>Expert Review</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.actionButton} onPress={() => onShare(item)}>
                <Ionicons name="share-outline" size={16} color={colors.textSecondary} />
                <Text style={[styles.actionButtonText, { color: colors.textSecondary }]}>{t('share')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={() => onUse(item.text)}>
                <Ionicons name="rocket-outline" size={16} color="#4CAF50" />
                <Text style={[styles.actionButtonText, { color: "#4CAF50" }]}>{t('use')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onCopy(item.text)} style={styles.miniActionIcon}>
                <Ionicons name="copy-outline" size={14} color={colors.textSecondary} />
              </TouchableOpacity>

              {item.reasoning && (
                <TouchableOpacity onPress={() => toggleMessage(item.id)} style={styles.miniActionIcon}>
                  <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={14} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {isExpanded && item.reasoning && (
          <View style={[styles.reasoningContainer, { borderLeftWidth: 3, borderLeftColor: '#667EEA', borderRadius: 0, paddingLeft: 14 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Ionicons name="git-branch-outline" size={13} color="#667EEA" />
              <Text style={styles.reasoningTitle}>{t('internal_syllogism_chain') || '🧠 Internal Syllogism Chain'}</Text>
            </View>
            <Text style={[styles.reasoningText, { color: colors.text }]}>{item.reasoning}</Text>
          </View>
        )}

        {item.sources && item.sources.length > 0 && (
          <View style={styles.sourcesContainer}>
            <Text style={styles.sourcesTitle}>📚 {t('sources')}</Text>
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
  return prevProps.item.text === nextProps.item.text &&
         prevProps.item.feedback === nextProps.item.feedback &&
         prevProps.item.feedbackCounts?.up === nextProps.item.feedbackCounts?.up &&
         prevProps.item.feedbackCounts?.down === nextProps.item.feedbackCounts?.down &&
         prevProps.isStreaming === nextProps.isStreaming &&
         prevProps.activeScheme === nextProps.activeScheme;
});
