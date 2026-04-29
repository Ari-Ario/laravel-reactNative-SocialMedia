import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Modal,
  ActivityIndicator,
  Platform,
  Switch
} from 'react-native';
import { useTranslation } from '@/constants/i18n';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GlobalStyles } from '@/styles/GlobalStyles';
import { useAppTheme } from '@/hooks/useAppTheme';
import * as ImagePicker from 'expo-image-picker';
import { MediaCompressor } from '@/utils/mediaCompressor';
import { useMarketStore } from '@/stores/marketStore';
import * as Haptics from 'expo-haptics';
import ShareLocation from '@/components/ChatScreen/ShareLocation';
import { useToastStore } from '@/stores/toastStore';
import getApiBaseImage from '@/services/getApiBaseImage';
import { MARKET_CATEGORIES } from '@/constants/MarketCategories';

interface CreateMarketItemModalProps {
  visible: boolean;
  onClose: () => void;
  editItem?: any;
}

export default function CreateMarketItemModal({ visible, onClose, editItem }: CreateMarketItemModalProps) {
  const { t } = useTranslation();
  const { colors, activeScheme } = useAppTheme();
  const styles = getStyles(colors, activeScheme);
  const insets = useSafeAreaInsets();
  
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('$');
  const [description, setDescription] = useState('');
  const [deliveryAvailable, setDeliveryAvailable] = useState(false);
  const [condition, setCondition] = useState('new');
  const [media, setMedia] = useState<any[]>([]);
  const [deletedMediaIds, setDeletedMediaIds] = useState<number[]>([]);
  const [location, setLocation] = useState<any>(null);
  const [showLocationSearch, setShowLocationSearch] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const { showToast } = useToastStore();

  const { addItem, updateItem } = useMarketStore();

  const getMediaUrl = (path: string) => {
    if (!path) return '';
    if (path.startsWith('http') || path.startsWith('file://') || path.startsWith('data:')) return path;
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;
    if (cleanPath.startsWith('storage/')) {
      return `${getApiBaseImage()}/${cleanPath}`;
    }
    return `${getApiBaseImage()}/storage/${cleanPath}`;
  };

  useEffect(() => {
    if (visible && editItem) {
      setTitle(editItem.title || '');
      setPrice(editItem.price?.toString() || '');
      setCurrency(editItem.currency || '$');
      setDescription(editItem.description || '');
      setDeliveryAvailable(!!editItem.delivery_available);
      setCondition(editItem.condition || 'new');
      setMedia(editItem.media || []);
      setLocation(editItem.location || null);
      setCategory(editItem.category || null);
      setDeletedMediaIds([]);
    } else if (!visible) {
      setTitle('');
      setPrice('');
      setCurrency('$');
      setDescription('');
      setDeliveryAvailable(false);
      setCondition('new');
      setMedia([]);
      setLocation(null);
      setCategory(null);
      setDeletedMediaIds([]);
    }
  }, [visible, editItem]);

  const pickMedia = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.7,
    });

    if (!result.canceled) {
      const processedAssets = [];
      for (const asset of result.assets) {
        try {
          const compressed = await MediaCompressor.prepareMediaForUpload(
            asset.uri,
            asset.fileName || `market-${Date.now()}.jpg`
          );
          processedAssets.push({
            uri: compressed.uri,
            type: 'image',
            fileName: compressed.fileName,
            isNew: true
          });
        } catch (error) {
          processedAssets.push({ ...asset, isNew: true });
        }
      }
      setMedia([...media, ...processedAssets]);
    }
  };

  const removeMedia = (index: number) => {
    const itemToRemove = media[index];
    if (!itemToRemove.isNew && itemToRemove.id) {
      setDeletedMediaIds([...deletedMediaIds, itemToRemove.id]);
    }
    
    const newMedia = [...media];
    newMedia.splice(index, 1);
    setMedia(newMedia);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSubmit = async () => {
    if (!title.trim() || !price.trim() || (media.length === 0 && !editItem)) {
      Alert.alert(t('error'), t('market_missing_fields_error', { defaultValue: 'Title, price, and at least one image are required.' }));
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('price', price);
      formData.append('currency', currency);
      formData.append('description', description);
      formData.append('delivery_available', deliveryAvailable ? '1' : '0');
      formData.append('condition', condition);
      
      if (location) {
        formData.append('location', JSON.stringify(location));
      }
      
      if (category) {
        formData.append('category', category);
      }

      // Add new media
      media.forEach((item, index) => {
        if (item.isNew) {
          const fileData = {
            uri: item.uri,
            type: 'image/jpeg',
            name: item.fileName || `media-${Date.now()}-${index}.jpg`,
          } as any;

          if (Platform.OS === 'web') {
            // Web handling (Fetch blob then append)
            // Note: This needs to be async, but for consistency we'll handle it below
          } else {
            formData.append('media[]', fileData);
          }
        }
      });

      // Special handling for Web Blobs if needed
      if (Platform.OS === 'web') {
        for (const item of media) {
          if (item.isNew) {
            const response = await fetch(item.uri);
            const blob = await response.blob();
            formData.append('media[]', blob, item.fileName || `media-${Date.now()}.jpg`);
          }
        }
      }

      if (editItem) {
        // Add deleted media IDs
        deletedMediaIds.forEach(id => {
          formData.append('delete_media[]', id.toString());
        });

        await updateItem(editItem.id, formData);
        showToast(t('market_item_updated'), 'success');
      } else {
        await addItem(formData);
        showToast(t('market_item_created'), 'success');
      }
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch (error: any) {
      console.error('Error handling market item:', error);
      Alert.alert(t('error'), editItem ? t('market_failed_update') : t('market_failed_create'));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={28} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('market_quick_sell')}</Text>
          <TouchableOpacity onPress={handleSubmit} disabled={isUploading || !title || !price || media.length === 0} style={[styles.postBtn, (!title || !price || media.length === 0) && styles.postBtnDisabled]}>
            {isUploading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.postBtnText}>{t('post')}</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.inputSection}>
            <TextInput
              style={[styles.titleInput, { color: colors.text }]}
              placeholder={t('market_what_selling_placeholder')}
              placeholderTextColor={colors.textSecondary}
              value={title}
              onChangeText={setTitle}
              maxLength={100}
            />
            
            <View style={[styles.priceContainer, { borderBottomColor: colors.border }]}>
              <TextInput
                style={[styles.currencyInput, { color: colors.text }]}
                placeholder="$"
                placeholderTextColor={colors.textSecondary}
                value={currency}
                onChangeText={setCurrency}
                maxLength={5}
              />
              <TextInput
                style={[styles.priceInput, { color: colors.text }]}
                placeholder="0.00"
                placeholderTextColor={colors.textSecondary}
                value={price}
                onChangeText={setPrice}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaScroll}>
            {media.map((item, index) => {
              const imageUri = item.uri || getMediaUrl(item.file_path);
              return (
                <View key={index} style={styles.mediaContainer}>
                  <Image source={{ uri: imageUri }} style={styles.mediaImage} />
                  <TouchableOpacity style={styles.removeMediaBtn} onPress={() => removeMedia(index)}>
                    <Ionicons name="close-circle" size={24} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              );
            })}
            {media.length < 5 && (
              <TouchableOpacity style={[styles.addMediaBtn, { borderColor: colors.border, backgroundColor: colors.surface }]} onPress={pickMedia}>
                <Ionicons name="camera-outline" size={32} color={colors.textSecondary} />
                <Text style={{ color: colors.textSecondary, marginTop: 4 }}>{t('market_add_photo')}</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
          
          <View style={styles.categorySection}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('market_condition')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
              {['new', 'like_new', 'used', 'refurbished'].map((cond) => (
                <TouchableOpacity
                  key={cond}
                  style={[
                    styles.categoryChip,
                    condition === cond ? styles.categoryChipActive : { backgroundColor: colors.surface, borderColor: colors.border }
                  ]}
                  onPress={() => setCondition(cond)}
                >
                  <Text style={[
                    styles.categoryText,
                    condition === cond ? styles.categoryTextActive : { color: colors.text }
                  ]}>
                    {t('market_condition_' + cond)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          
          <View style={styles.categorySection}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('market_category')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
              {MARKET_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryChip,
                    category === cat.id ? styles.categoryChipActive : { backgroundColor: colors.surface, borderColor: colors.border }
                  ]}
                  onPress={() => setCategory(cat.id === category ? null : cat.id)}
                >
                  <Ionicons 
                    name={cat.icon as any} 
                    size={16} 
                    color={category === cat.id ? '#fff' : colors.textSecondary} 
                    style={{ marginRight: 6 }} 
                  />
                  <Text style={[
                    styles.categoryText,
                    category === cat.id ? styles.categoryTextActive : { color: colors.text }
                  ]}>
                    {t(cat.name)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          
          <View style={[styles.optionsSection, { borderTopColor: colors.border }]}>
            <TextInput
              style={[styles.descriptionInput, { color: colors.text, backgroundColor: colors.surface }]}
              placeholder={t('market_add_description_optional')}
              placeholderTextColor={colors.textSecondary}
              value={description}
              onChangeText={setDescription}
              multiline
            />

            <View style={[styles.toggleRow, { borderBottomColor: colors.border }]}>
              <View style={styles.toggleText}>
                <Ionicons name="cube-outline" size={20} color={colors.text} />
                <Text style={[styles.toggleLabel, { color: colors.text }]}>{t('market_delivery_available')}</Text>
              </View>
              <Switch
                value={deliveryAvailable}
                onValueChange={setDeliveryAvailable}
                trackColor={{ false: colors.border, true: colors.primary }}
              />
            </View>

            <TouchableOpacity 
              style={[styles.toggleRow, { borderBottomColor: colors.border }]}
              onPress={() => setShowLocationSearch(true)}
            >
              <View style={styles.toggleText}>
                <Ionicons name="location-outline" size={20} color={colors.text} />
                <Text style={[styles.toggleLabel, { color: colors.text }]}>
                  {location ? location.name : t('market_add_location')}
                </Text>
              </View>
              {location ? (
                <TouchableOpacity onPress={() => setLocation(null)}>
                  <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              ) : (
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>

      <Modal visible={showLocationSearch} animationType="slide">
        <ShareLocation
          onClose={() => setShowLocationSearch(false)}
          onShareLocation={(loc) => { setLocation(loc); setShowLocationSearch(false); }}
        />
      </Modal>
    </Modal>
  );
}

const getStyles = (colors: any, scheme: string) => StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  closeBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  postBtn: {
    backgroundColor: '#1DA1F2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  postBtnDisabled: { backgroundColor: '#1DA1F280' },
  postBtnText: { color: '#fff', fontWeight: 'bold' },
  content: { flex: 1, padding: 16 },
  inputSection: { marginBottom: 20 },
  titleInput: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  priceContainer: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, paddingBottom: 8 },
  currencyInput: { fontSize: 28, fontWeight: '600', marginRight: 8, minWidth: 40 },
  priceInput: { fontSize: 28, fontWeight: '600', flex: 1 },
  mediaScroll: { flexDirection: 'row', marginBottom: 24 },
  mediaContainer: { marginRight: 12, position: 'relative' },
  mediaImage: { width: 100, height: 100, borderRadius: 12 },
  removeMediaBtn: { position: 'absolute', top: -8, right: -8, backgroundColor: 'white', borderRadius: 12 },
  addMediaBtn: {
    width: 100, height: 100, borderRadius: 12,
    borderWidth: 1, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center'
  },
  optionsSection: { borderTopWidth: 1, paddingTop: 16 },
  descriptionInput: {
    minHeight: 100, borderRadius: 12, padding: 12,
    fontSize: 16, textAlignVertical: 'top', marginBottom: 16
  },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth
  },
  toggleText: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleLabel: { fontSize: 16, fontWeight: '500' },
  categorySection: { marginBottom: 24 },
  sectionTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginBottom: 12, letterSpacing: 1 },
  categoryScroll: { flexDirection: 'row' },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: '#1DA1F2',
    borderColor: '#1DA1F2',
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  categoryTextActive: {
    color: '#fff',
  },
});
