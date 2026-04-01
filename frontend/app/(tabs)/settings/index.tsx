import { useState, useRef, useEffect, useContext, useMemo } from 'react';
import {
  View,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  Platform,
  Dimensions,
  ActivityIndicator,
  StatusBar,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView, AnimatePresence } from 'moti';
import AuthContext from "@/context/AuthContext";
import { logout, loadUser } from "@/services/AuthService";
import { uploadProfilePhoto, updateUserName } from '@/services/SettingService';
import * as ImagePicker from 'expo-image-picker';
import getApiBaseImage from '@/services/getApiBaseImage';
import { router } from 'expo-router';
import { GlobalStyles } from '@/styles/GlobalStyles';
import { useNotificationStore } from '@/stores/notificationStore';
import { useBookmarkStore } from '@/stores/bookmarkStore';
import PushNotificationService from '@/services/PushNotificationService';

const { width } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

const SettingsItem = ({ name, icon, color, onPress, badge, rightElement }: any) => (
  <TouchableOpacity style={styles.item} onPress={onPress} activeOpacity={0.7} disabled={!!rightElement}>
    <View style={[styles.iconContainer, { backgroundColor: color + '40' }]}>
      <Ionicons name={icon} size={22} color={color} />
    </View>
    <Text style={styles.itemText}>{name}</Text>
    {!!badge && badge > 0 && (
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
      </View>
    )}
    {rightElement ? rightElement : <Ionicons name="chevron-forward" size={20} color="rgba(0,0,0,0.3)" />}
  </TouchableOpacity>
);

const Page = () => {
  const { user, setUser } = useContext(AuthContext);
  const { unreadModerationCount } = useNotificationStore();
  const { bookmarks } = useBookmarkStore();
  
  const [activeTab, setActiveTab] = useState<'settings' | 'stats'>('settings');
  const [editNameMode, setEditNameMode] = useState(false);
  const [newName, setNewName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(true);
  const nameInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (editNameMode) {
      setTimeout(() => nameInputRef.current?.focus(), 100);
    }
  }, [editNameMode]);

  const handlePushToggle = async (value: boolean) => {
    setPushEnabled(value);
    if (value) {
      await PushNotificationService.initialize();
    } else {
      await PushNotificationService.unregister();
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
        await PushNotificationService.unregister();
        await logout();
        setUser(null);
        router.replace('/LoginScreen');
      } catch (error) {
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

  const handlePhotoAction = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0].uri) {
      try {
        setSaving(true);
        await uploadProfilePhoto(result.assets[0].uri);
        const updated = await loadUser();
        setUser(updated);
      } catch (e) {
        Alert.alert('Error', 'Photo upload failed');
      } finally {
        setSaving(false);
      }
    }
  };

  const renderProfilePhoto = () => {
    if (user?.profile_photo) {
      return <Image source={{ uri: `${getApiBaseImage()}/storage/${user.profile_photo}` }} style={styles.profilePhoto} />;
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
        title: 'Personal',
        items: [
          { name: 'Account', icon: 'key-outline', color: '#075E54', onPress: () => Alert.alert('Coming Soon', 'Account settings are under development.') },
          { name: 'Privacy Settings', icon: 'lock-closed-outline', color: '#2196F3', onPress: () => Alert.alert('Coming Soon', 'Privacy settings are under development.') },
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
          { name: 'Storage and Data', icon: 'cloud-outline', color: '#25D366', onPress: () => Alert.alert('Coming Soon', 'Storage settings are under development.') },
        ]
      },
      {
        title: 'Connect',
        items: [
          { name: 'Broadcast Lists', icon: 'megaphone-outline', color: '#25D366', onPress: () => Alert.alert('Coming Soon', 'Broadcast lists are under development.') },
          { name: 'Linked Devices', icon: 'laptop-outline', color: '#25D366', onPress: () => Alert.alert('Coming Soon', 'Linked devices are under development.') },
          { name: 'Starred Messages', icon: 'star-outline', color: '#FFD700', onPress: () => Alert.alert('Coming Soon', 'Starred messages are under development.') },
        ]
      },
      {
        title: 'Support',
        items: [
          { name: 'Help Center', icon: 'information-circle-outline', color: '#075E54', onPress: () => Alert.alert('Coming Soon', 'Help Center is under development.') },
          { name: 'Tell a Friend', icon: 'heart-outline', color: '#FF3B30', onPress: () => Alert.alert('Share', 'Share this app with your friends!') },
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
    <View style={styles.mainContainer}>
      <StatusBar barStyle="dark-content" />
      
      <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 60 : 40 }]}>
        <Text style={styles.headerTitle}>Settings & Stats</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#1a1a1a" />
        </TouchableOpacity>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity style={[styles.tab, activeTab === 'settings' && styles.activeTab]} onPress={() => setActiveTab('settings')}>
          <Text style={[styles.tabText, activeTab === 'settings' && styles.activeTabText]}>Profile & Security</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'stats' && styles.activeTab]} onPress={() => setActiveTab('stats')}>
          <Text style={[styles.tabText, activeTab === 'stats' && styles.activeTabText]}>Insights</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.profileCard}>
          <TouchableOpacity onPress={handlePhotoAction} disabled={saving}>
            <View style={styles.photoWrapper}>
              {renderProfilePhoto()}
              <View style={styles.cameraBadge}>
                <Ionicons name="camera" size={14} color="#fff" />
              </View>
            </View>
          </TouchableOpacity>

          <View style={styles.nameSection}>
            {editNameMode ? (
              <View style={styles.nameInputWrapper}>
                <TextInput
                  ref={nameInputRef}
                  style={styles.nameInput}
                  value={newName}
                  onChangeText={setNewName}
                  onBlur={handleNameUpdate}
                  onSubmitEditing={handleNameUpdate}
                  placeholderTextColor="rgba(0,0,0,0.3)"
                  returnKeyType="done"
                />
                {saving && <ActivityIndicator size="small" color="#0084ff" />}
              </View>
            ) : (
              <TouchableOpacity style={styles.nameRow} onPress={() => setEditNameMode(true)}>
                <Text style={styles.userName}>{user?.name}</Text>
                <Ionicons name="pencil-outline" size={16} color="#0084ff" />
              </TouchableOpacity>
            )}
            <Text style={styles.userRole}>{user?.is_admin ? 'Elite Admin' : 'Premium Member'}</Text>
          </View>
        </View>

        <AnimatePresence>
          {activeTab === 'settings' ? (
            <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} key="settings">
              {settingsSections.map((section) => (
                <View key={section.title} style={styles.section}>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
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
                  <Text style={styles.logoutText}>Log Out Account</Text>
                </LinearGradient>
              </TouchableOpacity>
            </MotiView>
          ) : (
            <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} key="stats">
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{bookmarks?.length || 0}</Text>
                  <Text style={styles.statLabel}>Total Saves</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>0</Text>
                  <Text style={styles.statLabel}>App Influence</Text>
                </View>
              </View>
              
              <View style={styles.aiInsightsCard}>
                <Text style={styles.insightTitle}>AI Engagement Trends</Text>
                <Text style={styles.insightText}>Your activity suggests a high interest in creative communities. Your content interactions are 100% compliant.</Text>
                <View style={styles.trendBar}>
                  <LinearGradient colors={['#0084ff', '#00c6ff']} style={[styles.trendFill, { width: '85%' }]} />
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
  mainContainer: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 20 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#1a1a1a', letterSpacing: -0.5 },
  closeButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.05)', justifyContent: 'center', alignItems: 'center' },
  tabBar: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 20, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 12, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  activeTab: { backgroundColor: '#0084ff' },
  tabText: { color: 'rgba(0,0,0,0.4)', fontWeight: '600', fontSize: 13 },
  activeTabText: { color: '#fff' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 100 },
  profileCard: { backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: 24, padding: 24, alignItems: 'center', marginBottom: 24 },
  photoWrapper: { position: 'relative', marginBottom: 16 },
  profilePhoto: { width: 100, height: 100, borderRadius: 50, borderWidth: 2, borderColor: '#0084ff', justifyContent: 'center', alignItems: 'center' },
  initials: { fontSize: 36, fontWeight: 'bold', color: '#fff' },
  cameraBadge: { position: 'absolute', bottom: -4, right: -4, backgroundColor: '#0084ff', width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#fff' },
  nameSection: { alignItems: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  userName: { fontSize: 24, fontWeight: '700', color: '#1a1a1a' },
  userRole: { fontSize: 14, color: 'rgba(0,0,0,0.6)', marginTop: 4 },
  nameInputWrapper: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#0084ff', width: width * 0.6 },
  nameInput: { color: '#1a1a1a', fontSize: 24, fontWeight: '700', textAlign: 'center', flex: 1, padding: 0 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: 'rgba(0,0,0,0.6)', textTransform: 'uppercase', marginBottom: 16, letterSpacing: 1 },
  item: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.03)', padding: 16, borderRadius: 16, marginBottom: 12 },
  iconContainer: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  itemText: { flex: 1, color: '#1a1a1a', fontSize: 16, fontWeight: '500' },
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
  }
});

export default Page;