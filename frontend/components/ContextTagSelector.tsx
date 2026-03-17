// components/ContextTagSelector.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { createShadow } from '@/utils/styles';

const { width } = Dimensions.get('window');

const CONTEXT_TAGS = [
  { emoji: "🔥", label: "Hot", fullLabel: "Hot Take", color: "#FF6B6B" },
  { emoji: "💡", label: "Idea", fullLabel: "Mind Blown", color: "#4ECDC4" },
  { emoji: "🎯", label: "Truth", fullLabel: "On Point", color: "#45B7D1" },
  { emoji: "📚", label: "Read", fullLabel: "Must Read", color: "#96CEB4" },
  { emoji: "🎨", label: "Art", fullLabel: "Creative Inspo", color: "#FFEAA7" },
  { emoji: "🤔", label: "Deep", fullLabel: "Deep Thought", color: "#D4A5A5" },
  { emoji: "⚡", label: "Urgent", fullLabel: "Urgent", color: "#FF6CCB" },
  { emoji: "💎", label: "Gem", fullLabel: "Hidden Gem", color: "#845EC2" },
  { emoji: "❤️", label: "Love", fullLabel: "Absolutely Love", color: "#FF4040" },
  { emoji: "🎉", label: "Win", fullLabel: "Big Win", color: "#FFD93D" },
  { emoji: "🎬", label: "Watch", fullLabel: "Must Watch", color: "#6C5CE7" },
  { emoji: "🎵", label: "Vibe", fullLabel: "Perfect Vibe", color: "#A8E6CF" },
];

interface ContextTagSelectorProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (tag: string, note: string) => void;
}

export const ContextTagSelector = ({ visible, onClose, onConfirm }: ContextTagSelectorProps) => {
  const [selectedTag, setSelectedTag] = useState(CONTEXT_TAGS[0]);
  const [note, setNote] = useState('');
  const [step, setStep] = useState<'tag' | 'note'>('tag');

  const handleTagSelect = (tag: typeof CONTEXT_TAGS[0]) => {
    setSelectedTag(tag);
    setStep('note');
  };

  const handleConfirm = () => {
    onConfirm(`${selectedTag.emoji} ${selectedTag.fullLabel}`, note);
    setNote('');
    setStep('tag');
    onClose();
  };

  const handleClose = () => {
    setStep('tag');
    setNote('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <BlurView intensity={90} tint="dark" style={styles.backdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
        >
          <MotiView
            from={{ opacity: 0, translateY: 100 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 15 }}
            style={styles.sheet}
          >
            {/* Handle Bar */}
            <View style={styles.handleContainer}>
              <View style={styles.handle} />
            </View>

            {/* Header */}
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>
                  {step === 'tag' ? 'Add Context' : 'Add a Note'}
                </Text>
                <Text style={styles.subtitle}>
                  {step === 'tag'
                    ? 'Pick how you feel about this'
                    : 'Why are you sharing this?'}
                </Text>
              </View>
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {step === 'tag' ? (
              <>
                {/* Quick Tags Grid */}
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.tagGrid}
                >
                  <View style={styles.tagRow}>
                    {CONTEXT_TAGS.slice(0, 4).map((tag, index) => (
                      <MotiView
                        key={tag.label}
                        from={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 50 }}
                        style={[styles.tagItem, { backgroundColor: tag.color + '20' }]}
                      >
                        <TouchableOpacity
                          style={styles.tagTouchable}
                          onPress={() => handleTagSelect(tag)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.tagEmoji}>{tag.emoji}</Text>
                          <Text style={[styles.tagLabel, { color: tag.color }]}>
                            {tag.label}
                          </Text>
                        </TouchableOpacity>
                      </MotiView>
                    ))}
                  </View>

                  <View style={styles.tagRow}>
                    {CONTEXT_TAGS.slice(4, 8).map((tag, index) => (
                      <MotiView
                        key={tag.label}
                        from={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: (index + 4) * 50 }}
                        style={[styles.tagItem, { backgroundColor: tag.color + '20' }]}
                      >
                        <TouchableOpacity
                          style={styles.tagTouchable}
                          onPress={() => handleTagSelect(tag)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.tagEmoji}>{tag.emoji}</Text>
                          <Text style={[styles.tagLabel, { color: tag.color }]}>
                            {tag.label}
                          </Text>
                        </TouchableOpacity>
                      </MotiView>
                    ))}
                  </View>

                  <View style={styles.tagRow}>
                    {CONTEXT_TAGS.slice(8).map((tag, index) => (
                      <MotiView
                        key={tag.label}
                        from={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: (index + 8) * 50 }}
                        style={[styles.tagItem, { backgroundColor: tag.color + '20' }]}
                      >
                        <TouchableOpacity
                          style={styles.tagTouchable}
                          onPress={() => handleTagSelect(tag)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.tagEmoji}>{tag.emoji}</Text>
                          <Text style={[styles.tagLabel, { color: tag.color }]}>
                            {tag.label}
                          </Text>
                        </TouchableOpacity>
                      </MotiView>
                    ))}
                  </View>
                </ScrollView>

                {/* Quick Select Hint */}
                <View style={styles.hintContainer}>
                  <Ionicons name="chevron-down" size={16} color="#666" />
                  <Text style={styles.hintText}>More options below</Text>
                </View>
              </>
            ) : (
              <>
                {/* Selected Tag Badge */}
                <MotiView
                  from={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  style={[styles.selectedTagBadge, { backgroundColor: selectedTag.color + '20' }]}
                >
                  <Text style={styles.selectedTagEmoji}>{selectedTag.emoji}</Text>
                  <Text style={[styles.selectedTagText, { color: selectedTag.color }]}>
                    {selectedTag.fullLabel}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setStep('tag')}
                    style={styles.changeTagButton}
                  >
                    <Text style={styles.changeTagText}>Change</Text>
                  </TouchableOpacity>
                </MotiView>

                {/* Note Input */}
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="Add a personal note... (optional)"
                    placeholderTextColor="#666"
                    multiline
                    value={note}
                    onChangeText={setNote}
                    maxLength={150}
                    autoFocus
                  />
                  <Text style={styles.charCount}>
                    {note.length}/150
                  </Text>
                </View>

                {/* Suggested Quick Notes */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.suggestionsContainer}
                >
                  {['🔥 So good!', '💯 Must see', '🎯 Exactly!', '🤣 Hilarious'].map((suggestion, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.suggestionChip}
                      onPress={() => setNote(suggestion)}
                    >
                      <Text style={styles.suggestionText}>{suggestion}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            {/* Action Button */}
            {step === 'note' && (
              <MotiView
                from={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                style={styles.actionContainer}
              >
                <TouchableOpacity
                  style={[styles.confirmButton, { backgroundColor: selectedTag.color }]}
                  onPress={handleConfirm}
                  activeOpacity={0.8}
                >
                  <Text style={styles.confirmText}>Repost with Context</Text>
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </TouchableOpacity>
              </MotiView>
            )}
          </MotiView>
        </KeyboardAvoidingView>
      </BlurView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  container: {
    width: '100%',
  },
  sheet: {
    backgroundColor: 'rgba(20,20,30,0.95)',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    ...createShadow({
      width: 0,
      height: -4,
      opacity: 0.3,
      radius: 12,
      elevation: 20,
    }),
  },
  handleContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#aaa',
  },
  closeButton: {
    padding: 4,
  },
  tagGrid: {
    paddingBottom: 20,
  },
  tagRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  tagItem: {
    flex: 1,
    marginHorizontal: 4,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  tagTouchable: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  tagLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  hintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  hintText: {
    fontSize: 11,
    color: '#666',
    marginLeft: 4,
  },
  selectedTagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 30,
    marginBottom: 20,
    alignSelf: 'flex-start',
  },
  selectedTagEmoji: {
    fontSize: 20,
    marginRight: 8,
  },
  selectedTagText: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 12,
  },
  changeTagButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  changeTagText: {
    fontSize: 11,
    color: '#fff',
  },
  inputContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    padding: 16,
    paddingBottom: 40,
    color: '#fff',
    fontSize: 15,
    minHeight: 120,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  charCount: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    fontSize: 11,
    color: '#666',
  },
  suggestionsContainer: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  suggestionChip: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  suggestionText: {
    color: '#fff',
    fontSize: 13,
  },
  actionContainer: {
    marginTop: 8,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 30,
    paddingVertical: 16,
    gap: 8,
    ...createShadow({
      width: 0,
      height: 4,
      opacity: 0.3,
      radius: 8,
      elevation: 5,
    }),
  },
  confirmText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});