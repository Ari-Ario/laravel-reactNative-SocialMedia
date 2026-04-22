import { useState, useRef, useEffect, useContext, useMemo } from 'react';
import {
  View,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  Dimensions,
  ActivityIndicator,
  StatusBar,
  Switch,
  Modal,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView, AnimatePresence } from 'moti';
import AuthContext from "@/context/AuthContext";
import { logout, loadUser } from "@/services/AuthService";
import { uploadProfilePhoto, updateUserName, deleteProfilePhoto } from '@/services/SettingService';
import * as ImagePicker from 'expo-image-picker';
import getApiBaseImage from '@/services/getApiBaseImage';
import { router } from 'expo-router';
import { GlobalStyles } from '@/styles/GlobalStyles';
import { useNotificationStore } from '@/stores/notificationStore';
import { useToastStore } from '@/stores/toastStore';
import { useBookmarkStore } from '@/stores/bookmarkStore';
import PushNotificationService from '@/services/PushNotificationService';
import { MediaCompressor } from '@/utils/mediaCompressor';
import GenericMenu, { MenuItem } from '@/components/GenericMenu';
import { AnchorPosition, calculateAnchor } from '@/utils/layout';
import PlatformCameraView from '@/components/PlatformCameraView';
import { Colors } from '@/constants/Colors';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useThemeStore } from '@/stores/themeStore';
import { t, LANGUAGES, Locale } from '@/constants/i18n';
import axios from '@/services/axios';

export const THEME_CONFIG = {
  nav: Colors.nav,
  backButtonSize: 28,
  backButtonIcon: 'chevron-back' as const,
};

const { width } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

const SettingsItem = ({ name, icon, color, onPress, badge, rightElement }: any) => {
  const { colors, activeScheme } = useAppTheme();
  return (
    <TouchableOpacity
      style={[styles.item, { backgroundColor: colors.card, borderColor: activeScheme === 'dark' ? colors.border : '#000' }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, { backgroundColor: color + '20', borderColor: activeScheme === 'dark' ? colors.border : 'rgba(0,0,0,0.05)' }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={[styles.itemText, { color: colors.text }]}>{name}</Text>
      {!!badge && badge > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      )}
      {rightElement ? rightElement : <Ionicons name="chevron-forward" size={20} color={colors.textSecondary + '99'} />}
    </TouchableOpacity>
  );
};

const Page = () => {
  const { colors, activeScheme, themePreference } = useAppTheme();
  const { setThemePreference } = useThemeStore();
  const { user, setUser } = useContext(AuthContext);
  const { unreadModerationCount } = useNotificationStore();
  const { bookmarks } = useBookmarkStore();

  const [activeTab, setActiveTab] = useState<'settings' | 'stats'>('settings');
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [themeMenuPosition, setThemeMenuPosition] = useState<AnchorPosition | undefined>(undefined);
  const themeIconRef = useRef<View>(null);
  const [editNameMode, setEditNameMode] = useState(false);
  const [newName, setNewName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const nameInputRef = useRef<TextInput>(null);
  const webCameraRef = useRef<any>(null);


  useEffect(() => {
    if (editNameMode) {
      setTimeout(() => nameInputRef.current?.focus(), 100);
    }
  }, [editNameMode]);

  const handlePushToggle = async (value: boolean) => {
    if (value) {
      const granted = await PushNotificationService.requestPermission();
      setPushEnabled(granted);
    } else {
      await PushNotificationService.unregister();
      setPushEnabled(false);
    }
  };

  const handleNameUpdate = async () => {
    if (newName === user?.name || !newName.trim()) {
      setEditNameMode(false);
      return;
    }
    setSaving(true);
    try {
      await updateUserName(newName.trim());
      const updated = await loadUser();
      setUser(updated);
      setEditNameMode(false);
    } catch (e) {
      Alert.alert('Error', 'Could not update name');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    const confirmLogout = async () => {
      try {
        // Best effort unregister with a 2s timeout to prevent hanging on mobile browsers
        try {
          await Promise.race([
            PushNotificationService.unregister(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
          ]);
        } catch (e) {
          console.log('Push unregister timed out or failed, proceeding with logout.');
        }

        await logout();
        setUser(null);
        router.replace('/LoginScreen');
      } catch (error) {
        console.error('Logout error:', error);
        setUser(null);
        router.replace('/LoginScreen');
      }
    };

    if (isWeb) {
      if (window.confirm("Are you sure you want to log out?")) confirmLogout();
    } else {
      Alert.alert('Logout', 'Are you sure?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: confirmLogout }
      ]);
    }
  };

  const { showToast } = useToastStore();
  const [showPhotoMenu, setShowPhotoMenu] = useState(false);
  const [photoMenuPosition, setPhotoMenuPosition] = useState<AnchorPosition | undefined>(undefined);
  const cameraIconRef = useRef<View>(null);

  const handlePhotoAction = () => {
    if (cameraIconRef.current) {
      cameraIconRef.current.measure((x, y, width, height, pageX, pageY) => {
        const anchor = calculateAnchor(pageX, pageY, width, height, 220);
        setPhotoMenuPosition(anchor);
        setShowPhotoMenu(true);
      });
    } else {
      // Fallback for web or if ref is missing
      setShowPhotoMenu(true);
    }
  };

  const showImagePicker = async (useCamera: boolean) => {
    if (isWeb && useCamera) {
      setIsCameraVisible(true);
      setShowPhotoMenu(false);
      return;
    }

    try {
      setShowPhotoMenu(false);
      const pickerOptions: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      };

      const result = useCamera
        ? await ImagePicker.launchCameraAsync(pickerOptions)
        : await ImagePicker.launchImageLibraryAsync(pickerOptions);

      if (!result.canceled && result.assets[0].uri) {
        setSaving(true);
        // Aggressive compression for profile photo (~20KB target)
        const compressedUri = await MediaCompressor.compressImage(result.assets[0].uri, {
          maxWidth: 200,
          quality: 0.5
        });

        await uploadProfilePhoto(compressedUri);
        const updated = await loadUser();
        setUser(updated);
        showToast('Profile photo updated successfully', 'success');
      }
    } catch (e) {
      console.error('Photo upload error:', e);
      showToast('Photo upload failed. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePhoto = async () => {
    setSaving(true);
    setShowPhotoMenu(false);
    try {
      await deleteProfilePhoto();
      const updated = await loadUser();
      setUser(updated);
      showToast('Profile photo removed', 'info');
    } catch (e) {
      console.error('Photo delete error:', e);
      showToast('Failed to delete photo', 'error');
    } finally {
      setSaving(false);
    }
  };

  const photoMenuItems: MenuItem[] = [
    {
      icon: 'camera',
      label: 'Take Photo',
      onPress: () => showImagePicker(true),
    },
    {
      icon: 'images',
      label: 'Choose from Gallery',
      onPress: () => showImagePicker(false),
    },
    ...(user?.profile_photo && String(user.profile_photo).trim() !== 'null' ? [{
      icon: 'trash-outline',
      label: 'Delete Photo',
      onPress: handleDeletePhoto,
      isDestructive: true,
    } as MenuItem] : [])
  ];

  const handleThemeAction = () => {
    if (themeIconRef.current) {
      themeIconRef.current.measure((x, y, width, height, pageX, pageY) => {
        const anchor = calculateAnchor(pageX, pageY, width, height, 220);
        setThemeMenuPosition(anchor);
        setShowThemeMenu(true);
      });
    } else {
      setShowThemeMenu(true);
    }
  };

  const getThemeIcon = () => {
    switch (themePreference) {
      case 'light': return 'sunny';
      case 'dark': return 'moon';
      case 'dynamic': return 'color-palette';
      default: return 'contrast';
    }
  };

  const themeMenuItems: MenuItem[] = [
    { icon: 'contrast', label: 'Automatic (System)', onPress: () => { setThemePreference('automatic'); setShowThemeMenu(false); } },
    { icon: 'sunny', label: 'Light Mode', onPress: () => { setThemePreference('light'); setShowThemeMenu(false); } },
    { icon: 'moon', label: 'Dark Mode', onPress: () => { setThemePreference('dark'); setShowThemeMenu(false); } },
    { icon: 'color-palette', label: 'Dynamic (Android 12+)', onPress: () => { setThemePreference('dynamic'); setShowThemeMenu(false); } },
  ];

  const handleWebCapture = async () => {
    if (webCameraRef.current) {
      try {
        setSaving(true);
        const result = await webCameraRef.current.takePictureAsync();
        if (result && result.uri) {
          setIsCameraVisible(false);

          // Aggressive compression for profile photo (~20KB target)
          const compressedUri = await MediaCompressor.compressImage(result.uri, {
            maxWidth: 200,
            quality: 0.5
          });

          await uploadProfilePhoto(compressedUri);
          const updated = await loadUser();
          setUser(updated);
          showToast('Profile photo updated successfully', 'success');
        }
      } catch (err) {
        console.error('Web capture error:', err);
        showToast('Failed to capture photo', 'error');
      } finally {
        setSaving(false);
      }
    }
  };

  const handleLanguageAction = () => {
    router.push('/settings/language');
  };

  const renderProfilePhoto = () => {
    // Check for null, undefined, or the literal string "null" from backend
    if (user?.profile_photo && String(user.profile_photo).trim() !== 'null') {
      return (
        <ExpoImage
          source={{ uri: `${getApiBaseImage()}/storage/${user.profile_photo}` }}
          style={styles.profilePhoto}
          contentFit="cover"
          transition={200}
          cachePolicy="disk"
        />
      );
    }
    return (
      <LinearGradient colors={['#667eea', '#764ba2']} style={styles.profilePhoto}>
        <Text style={styles.initials}>{user?.name?.charAt(0).toUpperCase()}</Text>
      </LinearGradient>
    );
  };

  const settingsSections = useMemo(() => {
    const sections = [
      {
        title: t('settings'),
        items: [
          { name: t('account'), icon: 'key-outline', color: '#075E54', onPress: () => router.push('/settings/account') },
          {
            name: t('language'),
            icon: 'language-outline',
            color: '#0084ff',
            onPress: handleLanguageAction,
            rightElement: (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: colors.textSecondary, marginRight: 8 }}>
                  {LANGUAGES.find(l => l.code === (user?.locale || 'en'))?.native}
                </Text>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary + '99'} />
              </View>
            )
          },
          { name: t('privacy'), icon: 'lock-closed-outline', color: '#2196F3', onPress: () => router.push('/settings/privacy') },
          { name: 'Administration', icon: 'shield-half-outline', color: '#FF3B30', badge: unreadModerationCount, onPress: () => router.push('/moderation/admin-channel') },
        ]
      },
      {
        title: 'Notifications',
        items: [
          {
            name: 'Web Push (Offline)',
            icon: 'notifications-outline',
            color: '#FF2D55',
            rightElement: (
              <Switch
                value={pushEnabled}
                onValueChange={handlePushToggle}
                trackColor={{ false: '#eee', true: '#30D158' }}
                ios_backgroundColor="#eee"
                style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
              />
            )
          },
        ]
      },
      {
        title: 'Content',
        items: [
          { name: 'Bookmarks', icon: 'bookmark-outline', color: '#FFD700', badge: bookmarks?.length, onPress: () => router.push('/settings/bookmarks') },
          { name: 'AI Safety Status', icon: 'shield-checkmark-outline', color: '#4CAF50', onPress: () => router.push('/settings/ai-safety') },
          { name: 'Storage and Data', icon: 'cloud-outline', color: '#25D366', onPress: () => router.push('/settings/storage') },
        ]
      },
      {
        title: 'Connect',
        items: [
          { name: 'Broadcast Lists', icon: 'megaphone-outline', color: '#25D366', onPress: () => router.push('/settings/broadcasts') },
          { name: 'Linked Devices', icon: 'laptop-outline', color: '#25D366', onPress: () => router.push('/settings/linked-devices') },
          { name: 'Chat Highlights', icon: 'flash-outline', color: '#FFD700', onPress: () => router.push('/settings/highlights') },
        ]
      },
      {
        title: 'Support',
        items: [
          { name: 'Help Center', icon: 'information-circle-outline', color: '#075E54', onPress: () => router.push('/settings/help') },
          { name: 'Tell a Friend', icon: 'heart-outline', color: '#FF3B30', onPress: () => router.push('/settings/TellFriend') },
        ]
      }
    ];

    if (user?.ai_admin) {
      sections[2].items.splice(2, 0, {
        name: 'Chatbot Training',
        icon: 'chatbubbles-outline',
        color: '#0084ff',
        onPress: () => router.push({ pathname: '/chatbotTraining', params: { from: 'settings' } })
      });
    }

    if (user?.is_admin) {
      sections.push({
        title: 'Admin',
        items: [
          { name: 'Moderation Panel', icon: 'hammer-outline', color: '#F44336', onPress: () => router.push('/moderation') },
        ]
      });
    }

    return sections;
  }, [user, unreadModerationCount, bookmarks?.length, pushEnabled]);

  return (
    <View style={[styles.mainContainer, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={activeScheme === 'dark' ? 'light-content' : 'dark-content'} />

      <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 60 : 40 }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('settings')} & Stats</Text>
        <View ref={themeIconRef}>
          <TouchableOpacity onPress={handleThemeAction} style={styles.closeButton}>
            <Ionicons name={getThemeIcon()} size={22} color={colors.tint} />
          </TouchableOpacity>
        </View>
      </View>

      <GenericMenu
        visible={showThemeMenu}
        onClose={() => setShowThemeMenu(false)}
        items={themeMenuItems}
        anchorPosition={themeMenuPosition}
      />

      <View style={[styles.tabBar, { backgroundColor: colors.muted }]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'settings' && { backgroundColor: colors.tint }]}
          onPress={() => setActiveTab('settings')}
        >
          <Text style={[styles.tabText, activeTab === 'settings' ? { color: '#fff' } : { color: colors.textSecondary }]}>
            {t('profile_security')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'stats' && { backgroundColor: colors.tint }]}
          onPress={() => setActiveTab('stats')}
        >
          <Text style={[styles.tabText, activeTab === 'stats' ? { color: '#fff' } : { color: colors.textSecondary }]}>
            {t('insights')}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.profileCard, { backgroundColor: colors.surface }]}>
          <TouchableOpacity onPress={handlePhotoAction} disabled={saving}>
            <View style={styles.photoWrapper}>
              {renderProfilePhoto()}
              <View ref={cameraIconRef} style={[styles.cameraBadge, { backgroundColor: colors.tint, borderColor: colors.surface }]}>
                <Ionicons name="camera" size={14} color={activeScheme === 'dark' ? colors.background : "#fff"} />
              </View>
            </View>
          </TouchableOpacity>

          <GenericMenu
            visible={showPhotoMenu}
            onClose={() => setShowPhotoMenu(false)}
            items={photoMenuItems}
            anchorPosition={photoMenuPosition}
          />

          {/* Web Camera Modal */}
          {isWeb && (
            <Modal
              visible={isCameraVisible}
              animationType="slide"
              transparent={false}
              onRequestClose={() => setIsCameraVisible(false)}
            >
              <View style={styles.cameraModalContent}>
                <PlatformCameraView
                  cameraRef={webCameraRef}
                  style={styles.webCamera}
                  facing="front"
                >
                  <View style={styles.cameraOverlay}>
                    <TouchableOpacity
                      onPress={() => setIsCameraVisible(false)}
                      style={styles.closeCameraButton}
                    >
                      <Ionicons name="close" size={30} color="white" />
                    </TouchableOpacity>

                    <View style={styles.cameraBottomControls}>
                      <TouchableOpacity
                        onPress={handleWebCapture}
                        style={styles.captureButton}
                        disabled={saving}
                      >
                        <View style={styles.captureButtonInner} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </PlatformCameraView>
                {saving && (
                  <View style={styles.cameraLoadingOverlay}>
                    <ActivityIndicator size="large" color="#fff" />
                    <Text style={styles.cameraLoadingText}>Optimizing...</Text>
                  </View>
                )}
              </View>
            </Modal>
          )}

          <View style={styles.nameSection}>
            {editNameMode ? (
              <View style={[styles.nameInputWrapper, { borderBottomColor: colors.tint }]}>
                <TextInput
                  ref={nameInputRef}
                  style={[styles.nameInput, { color: colors.text }]}
                  value={newName}
                  onChangeText={setNewName}
                  onBlur={handleNameUpdate}
                  onSubmitEditing={handleNameUpdate}
                  placeholderTextColor={activeScheme === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
                  returnKeyType="done"
                  keyboardAppearance={activeScheme}
                />
                {saving && <ActivityIndicator size="small" color={colors.tint} />}
              </View>
            ) : (
              <TouchableOpacity style={styles.nameRow} onPress={() => setEditNameMode(true)}>
                <Text style={[styles.userName, { color: colors.text }]}>{user?.name}</Text>
                <Ionicons name="pencil-outline" size={16} color={colors.tint} />
              </TouchableOpacity>
            )}
            <Text style={[styles.userRole, { color: colors.textSecondary }]}>{user?.is_admin ? t('role_admin') : t('role_member')}</Text>
          </View>
        </View>

        <AnimatePresence>
          {activeTab === 'settings' ? (
            <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} key="settings">
              {settingsSections.map((section) => (
                <View key={section.title} style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{section.title}</Text>
                  {section.items.map((item: any) => (
                    <SettingsItem
                      key={item.name}
                      name={item.name}
                      icon={item.icon}
                      color={item.color}
                      badge={item.badge}
                      onPress={item.onPress}
                      rightElement={item.rightElement}
                    />
                  ))}
                </View>
              ))}

              {/* iOS Web App Tip */}
              {isWeb && /iPhone|iPad|iPod/.test(navigator.userAgent) && (
                <View style={styles.tipCard}>
                  <Ionicons name="information-circle-outline" size={20} color="#0084ff" style={styles.tipIcon} />
                  <Text style={styles.tipText}>
                    To receive offline notifications on iOS, tap the "Share" button and select "Add to Home Screen".
                  </Text>
                </View>
              )}

              <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                <LinearGradient colors={['#F44336', '#D32F2F']} style={styles.logoutGradient}>
                  <Text style={styles.logoutText}>{t('logout')}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </MotiView>
          ) : (
            <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} key="stats">
              <View style={styles.statsGrid}>
                <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
                  <Text style={[styles.statValue, { color: colors.text }]}>{bookmarks?.length || 0}</Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Saves</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
                  <Text style={[styles.statValue, { color: colors.text }]}>0</Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>App Influence</Text>
                </View>
              </View>

              <View style={[styles.aiInsightsCard, { backgroundColor: colors.tint + '10', borderLeftColor: colors.tint }]}>
                <Text style={[styles.insightTitle, { color: colors.tint }]}>AI Engagement Trends</Text>
                <Text style={[styles.insightText, { color: colors.textSecondary }]}>Your activity suggests a high interest in creative communities. Your content interactions are 100% compliant.</Text>
                <View style={[styles.trendBar, { backgroundColor: colors.muted }]}>
                  <LinearGradient colors={[colors.tint, colors.tint + '80']} style={[styles.trendFill, { width: '85%' }]} />
                </View>
                <Text style={styles.trendLabel}>Account Health: Excellent</Text>
              </View>
            </MotiView>
          )}
        </AnimatePresence>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 20 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#1a1a1a', letterSpacing: -0.5 },
  closeButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.05)', justifyContent: 'center', alignItems: 'center' },
  tabBar: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 20, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 12, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  activeTab: { backgroundColor: '#0084ff' },
  tabText: { color: 'rgba(0,0,0,0.4)', fontWeight: '600', fontSize: 13 },
  activeTabText: { color: '#fff' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 80 },
  profileCard: { backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: 24, padding: 24, alignItems: 'center', marginBottom: 24 },
  photoWrapper: { position: 'relative', marginBottom: 16 },
  profilePhoto: { width: 100, height: 100, borderRadius: 50, borderWidth: 2, borderColor: '#0084ff', justifyContent: 'center', alignItems: 'center' },
  initials: { fontSize: 36, fontWeight: 'bold', color: '#fff' },
  cameraBadge: { position: 'absolute', bottom: -4, right: -4, backgroundColor: '#0084ff', width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 3 },
  nameSection: { alignItems: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  userName: { fontSize: 24, fontWeight: '700' },
  userRole: { fontSize: 14, marginTop: 4 },
  nameInputWrapper: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#0084ff', width: width * 0.6 },
  nameInput: { color: '#1a1a1a', fontSize: 24, fontWeight: '700', textAlign: 'center', flex: 1, padding: 0 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: 'rgba(0,0,0,0.6)', textTransform: 'uppercase', marginBottom: 16, letterSpacing: 1 },
  item: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 18, borderRadius: 20, marginBottom: 12, borderWidth: 1.5, borderColor: '#000' },
  iconContainer: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 15, borderWidth: 1 },
  itemText: { flex: 1, fontSize: 16, fontWeight: '700' },
  badge: { backgroundColor: '#F44336', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, marginRight: 8 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  logoutBtn: { marginTop: 8 },
  logoutGradient: { borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  logoutText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  statsGrid: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: 20, padding: 20, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '800', color: '#1a1a1a' },
  statLabel: { fontSize: 12, color: 'rgba(0,0,0,0.4)', marginTop: 4 },
  aiInsightsCard: { backgroundColor: 'rgba(0,132,255,0.05)', borderLeftWidth: 4, borderLeftColor: '#0084ff', borderRadius: 16, padding: 20 },
  insightTitle: { fontSize: 16, fontWeight: '700', color: '#0084ff', marginBottom: 8 },
  insightText: { fontSize: 14, color: 'rgba(0,0,0,0.6)', lineHeight: 20, marginBottom: 16 },
  trendBar: { height: 6, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 3, marginBottom: 8 },
  trendFill: { height: '100%', borderRadius: 3 },
  trendLabel: { fontSize: 12, color: '#4CAF50', fontWeight: 'bold' },
  tipCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,132,255,0.05)',
    padding: 16,
    marginBottom: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#0084ff',
    alignItems: 'center',
  },
  tipIcon: {
    marginRight: 12,
  },
  tipText: {
    flex: 1,
    color: '#1a1a1a',
    fontSize: 13,
    lineHeight: 18,
  },
  cameraModalContent: {
    flex: 1,
    backgroundColor: '#000',
  },
  webCamera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 40,
    paddingBottom: 40,
  },
  closeCameraButton: {
    alignSelf: 'flex-start',
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 25,
  },
  cameraBottomControls: {
    alignItems: 'center',
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 4,
    borderColor: 'white',
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
    backgroundColor: 'white',
  },
  cameraLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  cameraLoadingText: {
    color: '#fff',
    marginTop: 10,
    fontWeight: '600',
  }
});

export default Page;