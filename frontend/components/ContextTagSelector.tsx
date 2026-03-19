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
import { MotiView, AnimatePresence } from 'moti';
import EmojiPicker from 'rn-emoji-keyboard';
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
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const [tagLabel, setTagLabel] = useState('');
  const [note, setNote] = useState('');
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);

  const handleEmojiSelect = (emoji: any) => {
    setSelectedEmoji(emoji.emoji);
    setIsEmojiPickerOpen(false);
  };

  const handleConfirm = () => {
    let finalTag = '';
    if (selectedEmoji) {
      finalTag = `${selectedEmoji} ${tagLabel || 'Thought'}`;
    } else if (tagLabel) {
      finalTag = tagLabel;
    }

    onConfirm(finalTag, note);
    resetState();
    onClose();
  };

  const resetState = () => {
    setSelectedEmoji(null);
    setTagLabel('');
    setNote('');
  };

  const handleClose = () => {
    resetState();
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
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.mainContent}>
              {/* Custom Tag Section */}
              <View style={styles.section}>
                <View style={styles.tagInputRow}>
                  <TouchableOpacity 
                    style={[styles.emojiButton, selectedEmoji ? { backgroundColor: 'rgba(255,255,255,0.1)' } : null]}
                    onPress={() => setIsEmojiPickerOpen(true)}
                  >
                    <Text style={styles.emojiDisplay}>
                      {selectedEmoji || '😀'}
                    </Text>
                    <View style={styles.emojiEditBadge}>
                      <Ionicons name="pencil" size={10} color="#fff" />
                    </View>
                  </TouchableOpacity>
                  
                  <View style={styles.tagLabelContainer}>
                    <TextInput
                      style={styles.labelInput}
                      placeholder="Context Tag..."
                      placeholderTextColor="#666"
                      value={tagLabel}
                      onChangeText={setTagLabel}
                      maxLength={20}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.separator} />

              {/* Personal Note Section */}
              <View style={styles.section}>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="Write a personal note..."
                    placeholderTextColor="#666"
                    multiline
                    value={note}
                    onChangeText={setNote}
                    maxLength={150}
                  />
                  <Text style={styles.charCount}>
                    {note.length}/150
                  </Text>
                </View>
              </View>
            </ScrollView>

            {/* Action Button */}
            <View style={styles.actionContainer}>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleConfirm}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmText}>Repost Now</Text>
                <Ionicons name="repeat" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            <EmojiPicker
              open={isEmojiPickerOpen}
              onClose={() => setIsEmojiPickerOpen(false)}
              onEmojiSelected={handleEmojiSelect}
              emojiSize={28}
              theme={{
                backdrop: '#000000',
                knob: '#766dfc',
                container: '#282828',
                header: '#ffffff',
                skinTonesContainer: '#252427',
                category: {
                  icon: '#766dfc',
                  iconActive: '#ffffff',
                  container: '#252427',
                  containerActive: '#766dfc',
                },
                search: {
                  background: '#353535',
                  text: '#ffffff',
                  placeholder: '#888888',
                  icon: '#888888',
                },
              }}
            />
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
  mainContent: {
    maxHeight: 400,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#aaa',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  tagInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  emojiButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  emojiDisplay: {
    fontSize: 30,
  },
  emojiEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#766dfc',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#222',
  },
  tagLabelContainer: {
    flex: 1,
  },
  labelInput: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    padding: 4,
  },
  labelHint: {
    fontSize: 11,
    color: '#766dfc',
    marginTop: 2,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  presetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    gap: 6,
  },
  presetEmoji: {
    fontSize: 14,
  },
  presetLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 20,
  },
  inputContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    padding: 16,
    paddingBottom: 40,
    color: '#fff',
    fontSize: 15,
    minHeight: 100,
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
    marginTop: 10,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#766dfc',
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