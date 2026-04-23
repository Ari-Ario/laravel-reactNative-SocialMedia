import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  FlatList,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { useTranslation } from '../../constants/i18n';
import { Chat } from '../../app/(tabs)/chats/index';

interface CreateTabModalProps {
  visible: boolean;
  onClose: () => void;
  mode?: 'create' | 'edit';
  initialStep?: 1 | 2;
  initialData?: { id: string; name: string; spaceIds: string[] };
  allSpaces: Chat[];
  onSave: (data: { name: string; spaceIds: string[]; id?: string }) => void;
}

const { width, height } = Dimensions.get('window');

const CreateTabModal: React.FC<CreateTabModalProps> = ({
  visible,
  onClose,
  mode = 'create',
  initialStep = 1,
  initialData,
  allSpaces,
  onSave,
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const { t, isRTL } = useTranslation();
  const styles = getStyles(isRTL);

  useEffect(() => {
    if (visible) {
      setStep(initialStep);
      setName(initialData?.name || '');
      setSelectedIds(initialData?.spaceIds || []);
      setSearchQuery('');
    }
  }, [visible, initialStep, initialData]);

  const filteredSpaces = useMemo(() => {
    return allSpaces.filter(s => 
      s.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [allSpaces, searchQuery]);

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleNext = () => {
    if (name.trim()) {
      setStep(2);
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleFinish = () => {
    if (name.trim()) {
      onSave({ 
        name: name.trim(), 
        spaceIds: selectedIds,
        id: initialData?.id
      });
      onClose();
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <View style={[styles.header, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Text style={styles.title}>{mode === 'create' ? t('new_tab') : t('rename_tab')}</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#666" />
        </TouchableOpacity>
      </View>

      <View style={styles.inputWrapper}>
        <TextInput
          style={[styles.input, { textAlign: isRTL ? 'right' : 'left', paddingRight: isRTL ? 18 : 60, paddingLeft: isRTL ? 60 : 18 }]}
          placeholder={t('tab_name_placeholder')}
          placeholderTextColor="#999"
          value={name}
          onChangeText={setName}
          autoFocus={step === 1}
          maxLength={12}
          returnKeyType="next"
          onSubmitEditing={handleNext}
        />
        <Text style={[styles.charCount, { [isRTL ? 'left' : 'right']: 18 }]}>{name.length}/12</Text>
      </View>
 
      <Text style={[styles.description, { textAlign: isRTL ? 'right' : 'left' }]}>
        {t('tab_name_description')}
      </Text>

      <TouchableOpacity
        style={[styles.primaryButton, { flexDirection: isRTL ? 'row-reverse' : 'row' }, !name.trim() && styles.disabledButton]}
        onPress={mode === 'create' ? handleNext : handleFinish}
        disabled={!name.trim()}
      >
        <Text style={styles.buttonText}>{mode === 'create' ? t('next') : t('save_name')}</Text>
        {mode === 'create' && <Ionicons name={isRTL ? "arrow-back" : "arrow-forward"} size={18} color="#fff" style={{ [isRTL ? 'marginRight' : 'marginLeft']: 8 }} />}
      </TouchableOpacity>
    </View>
  );

  const renderStep2 = () => (
    <View style={[styles.stepContainer, { height: height * 0.8, paddingHorizontal: 0 }]}>
      <View style={[styles.header, { paddingHorizontal: 24, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <View style={[styles.headerTitleRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <TouchableOpacity onPress={() => mode === 'create' ? setStep(1) : onClose()} style={styles.backButton}>
            <Ionicons name={mode === 'create' ? (isRTL ? "arrow-forward" : "arrow-back") : "close"} size={24} color="#007AFF" />
          </TouchableOpacity>
          <View style={{ alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
            <Text style={styles.title}>{mode === 'create' ? t('select_content') : t('edit_tab')}</Text>
            <Text style={styles.subtitle}>{name}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleFinish} style={styles.doneButton}>
          <Text style={styles.doneText}>{t('done')}</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.searchContainer, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Ionicons name="search" size={18} color="#999" style={[styles.searchIcon, { [isRTL ? 'marginLeft' : 'marginRight']: 10, marginRight: isRTL ? 0 : 10 }]} />
        <TextInput
          style={[styles.searchInput, { textAlign: isRTL ? 'right' : 'left' }]}
          placeholder={t('search_spaces_people')}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#999"
        />
      </View>

      <View style={[styles.selectionSummary, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
        <Text style={styles.selectionText}>
          {selectedIds.length === 1 
            ? t('item_selected').replace('{count}', selectedIds.length.toString())
            : t('items_selected').replace('{count}', selectedIds.length.toString())}
        </Text>
      </View>

      <FlatList
        data={filteredSpaces}
        keyExtractor={item => item.id}
        renderItem={({ item }) => {
          const isSelected = selectedIds.includes(item.id);
          return (
            <TouchableOpacity 
              style={styles.itemContainer} 
              onPress={() => toggleSelection(item.id)}
              activeOpacity={0.7}
            >
              <View style={styles.avatarContainer}>
                {item.avatar ? (
                  <Image source={{ uri: item.avatar }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.placeholderAvatar]}>
                    <Ionicons name={item.type === 'space' ? 'cube' : 'person'} size={24} color="#fff" />
                  </View>
                )}
                {isSelected && (
                  <View style={styles.checkBadge}>
                    <Ionicons name="checkmark" size={12} color="#fff" />
                  </View>
                )}
              </View>
              
              <View style={[styles.itemInfo, { [isRTL ? 'marginRight' : 'marginLeft']: 16, alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
                <Text style={[styles.itemName, { textAlign: isRTL ? 'right' : 'left' }]}>{item.name}</Text>
                <Text style={[styles.itemType, { textAlign: isRTL ? 'right' : 'left' }]}>
                  {item.type === 'space' ? t('collaboration_space') : t('direct_message')}
                </Text>
              </View>

              <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
              </View>
            </TouchableOpacity>
          );
        }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        {Platform.OS === 'web' ? (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)' }]} />
        ) : (
          <BlurView intensity={25} style={StyleSheet.absoluteFill} tint="dark" />
        )}
        
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[styles.container, step === 2 && styles.fullWidthContainer]}
        >
          <Pressable style={[styles.modalContent, step === 2 && styles.pickerContent]} onPress={(e) => e.stopPropagation()}>
            {step === 1 ? renderStep1() : renderStep2()}
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
};

const getStyles = (isRTL: boolean) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '90%',
    maxWidth: 400,
  },
  fullWidthContainer: {
    width: '100%',
    maxWidth: 500,
    position: 'absolute',
    bottom: 0,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 0, // Padding handled inside steps
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 24,
    overflow: 'hidden',
  },
  pickerContent: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    height: height * 0.8,
  },
  stepContainer: {
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    [isRTL ? 'marginLeft' : 'marginRight']: 12,
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  closeButton: {
    padding: 4,
  },
  doneButton: {
    backgroundColor: '#E7F3FF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  doneText: {
    color: '#007AFF',
    fontWeight: '700',
    fontSize: 15,
  },
  inputWrapper: {
    position: 'relative',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#F5F7FA',
    borderRadius: 14,
    padding: 18,
    [isRTL ? 'paddingLeft' : 'paddingRight']: 60,
    fontSize: 17,
    color: '#000',
    borderWidth: 1.5,
    borderColor: '#E1E8F0',
  },
  charCount: {
    position: 'absolute',
    right: 18,
    top: 20,
    fontSize: 12,
    color: '#999',
    fontWeight: '600',
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 28,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  disabledButton: {
    backgroundColor: '#BDC3C7',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  // Picker Styles
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F2F5',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  searchIcon: {
    [isRTL ? 'marginLeft' : 'marginRight']: 10,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 16,
    color: '#000',
  },
  selectionSummary: {
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  selectionText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  itemContainer: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  placeholderAvatar: {
    backgroundColor: '#667EEA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    backgroundColor: '#25D366',
    borderRadius: 11,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  itemInfo: {
    flex: 1,
    [isRTL ? 'marginRight' : 'marginLeft']: 16,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  itemType: {
    fontSize: 13,
    color: '#666',
    marginTop: 3,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D1D6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  separator: {
    height: 1,
    backgroundColor: '#F0F2F5',
    [isRTL ? 'marginRight' : 'marginLeft']: 92,
  },
});

export default CreateTabModal;
