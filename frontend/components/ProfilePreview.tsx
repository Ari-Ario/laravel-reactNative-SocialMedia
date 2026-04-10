// components/ProfilePreview.tsx
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  FlatList,
  ActivityIndicator,
  Modal,
  Platform,
  Dimensions,
  Animated,
  RefreshControl,
  Linking,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useRef, useContext, useCallback, useMemo } from 'react';
import { fetchProfile, followUser } from '@/services/UserService';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView, AnimatePresence } from 'moti';
import PostListItem from './PostListItem';
import getApiBaseImage from '@/services/getApiBaseImage';
import { useProfileView } from '@/context/ProfileViewContext';
import { useModal } from '@/context/ModalContext';
import { usePostStore } from '@/stores/postStore';
import AuthContext from '@/context/AuthContext';
import { commentOnPost } from '@/services/PostService';
import ReportPost from './ReportPost';
import { useToastStore } from '@/stores/toastStore';
import { useReportedContentStore } from '@/stores/reportedContentStore';
import { deleteReportByTarget } from '@/services/ReportService';
import { createShadow } from '@/utils/styles';

const { width, height } = Dimensions.get('window');

interface ProfilePreviewProps {
  userId: string;
  visible: boolean;
  onClose: () => void;
}

interface Post {
  id: number;
  caption: string;
  media: Array<{ file_path: string; type: string }>;
  user: any;
  reactions: any[];
  reaction_counts: any[];
  comments: any[];
  comments_count: number;
  created_at: string;
  is_reposted?: boolean;
  reposts_count?: number;
}

interface MediaItem {
  id: number;
  file_path: string;
  type: string;
}

const ProfilePreview = ({ userId, visible, onClose }: ProfilePreviewProps) => {
  const isWeb = Platform.OS === 'web';
  const { openModal } = useModal();
  const { profilePreviewVisible, setProfilePreviewVisible } = useProfileView();
  const { showToast } = useToastStore();
  const { user } = useContext(AuthContext);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'about' | 'media'>('posts');
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [postsPage, setPostsPage] = useState(1);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [postsLastPage, setPostsLastPage] = useState(1);
  const [photoModalVisible, setPhotoModalVisible] = useState(false);

  const headerAnim = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Deduplicate posts by ID
  const uniqueUserPosts = useMemo(() => {
    const seen = new Set();
    return userPosts.filter(post => {
      if (seen.has(post.id)) return false;
      seen.add(post.id);
      return true;
    });
  }, [userPosts]);

  // Deduplicate media items by ID - sourced EXCLUSIVELY from posts
  const uniqueMediaFromPosts = useMemo(() => {
    const allMedia: any[] = [];
    uniqueUserPosts.forEach(post => {
      if (post.media && Array.isArray(post.media)) {
        post.media.forEach((m, index) => {
          allMedia.push({
            ...m,
            // Create a pseudo-unique ID if m.id is missing, but post.id + index is safer
            uniqueKey: `post-${post.id}-media-${index}`,
            postId: post.id
          });
        });
      }
    });
    return allMedia;
  }, [uniqueUserPosts]);

  // Fetch profile data with deduplication
  const fetchProfileData = useCallback(async (page = 1, isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else if (page === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const response = await fetchProfile(userId, page);
      const profileData = response.data || response;

      setProfile(profileData.user);
      setIsFollowing(profileData.user.is_following);

      // Handle media items - deduplicate
      const newMediaItems = profileData.user.media || [];
      if (isRefresh || page === 1) {
        setMediaItems(newMediaItems);
      } else {
        setMediaItems(prev => {
          const combined = [...prev, ...newMediaItems];
          const seen = new Set();
          return combined.filter(item => {
            if (seen.has(item.id)) return false;
            seen.add(item.id);
            return true;
          });
        });
      }

      // Handle posts pagination with deduplication
      const newPosts = profileData.posts?.data || [];
      const currentPage = profileData.posts?.current_page || page;
      const lastPage = profileData.posts?.last_page || 1;

      setPostsLastPage(lastPage);

      if (isRefresh || page === 1) {
        setUserPosts(newPosts);
      } else {
        setUserPosts(prev => {
          const combined = [...prev, ...newPosts];
          const seen = new Set();
          return combined.filter(post => {
            if (seen.has(post.id)) return false;
            seen.add(post.id);
            return true;
          });
        });
      }

      setHasMorePosts(currentPage < lastPage);
      setPostsPage(currentPage);

    } catch (error) {
      console.error('Error fetching profile:', error);
      showToast('Failed to load profile', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [userId, showToast]);

  const parsedLocation = useMemo(() => {
    if (!profile?.location) return null;
    try {
      if (typeof profile.location === 'string' && profile.location.startsWith('{')) {
        return JSON.parse(profile.location);
      }
      return { name: profile.location };
    } catch (e) {
      return { name: profile.location };
    }
  }, [profile?.location]);

  const handleLocationPress = useCallback(() => {
    if (parsedLocation) {
      openModal('location', { location: parsedLocation });
      if (!isWeb) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [parsedLocation, openModal, isWeb]);

  useEffect(() => {
    if (visible && userId) {
      fetchProfileData(1, true);
      Animated.spring(headerAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();
    }

    if (!visible) {
      headerAnim.setValue(0);
      setUserPosts([]);
      setMediaItems([]);
      setPostsPage(1);
      setHasMorePosts(true);
    }
  }, [visible, userId, fetchProfileData, headerAnim]);

  const handleRefresh = useCallback(() => {
    fetchProfileData(1, true);
  }, [fetchProfileData]);

  const handleLoadMore = useCallback(() => {
    // Both posts and media tab now trigger more post fetching
    if (!hasMorePosts || loadingMore || (activeTab !== 'posts' && activeTab !== 'media')) return;
    if (postsPage < postsLastPage) {
      fetchProfileData(postsPage + 1, false);
    }
  }, [hasMorePosts, loadingMore, activeTab, postsPage, postsLastPage, fetchProfileData]);

  const handleLinkPress = async (url: string) => {
    if (!url) return;
    try {
      if (!isWeb) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      // Basic sanitization
      let finalUrl = url.trim();
      if (!finalUrl.startsWith('http')) {
        finalUrl = `https://${finalUrl}`;
      }
      
      const supported = await Linking.canOpenURL(finalUrl);
      if (supported) {
        await Linking.openURL(finalUrl);
      } else {
        // Fallback to in-app webview if Linking fails
        openModal('webview', { url: finalUrl });
      }
    } catch (error) {
      console.error('Error opening URL:', error);
      showToast('Could not open link', 'error');
    }
  };

  const handleFollow = async () => {
    try {
      setFollowLoading(true);
      const action = isFollowing ? 'unfollow' : 'follow';
      await followUser(userId, action);
      setIsFollowing(!isFollowing);
      setProfile((prev: any) => {
        if (!prev) return null;
        return {
          ...prev,
          followers_count: isFollowing
            ? (prev.followers_count || 0) - 1
            : (prev.followers_count || 0) + 1,
        };
      });
      if (!isWeb) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(isFollowing ? 'Unfollowed successfully' : 'Followed successfully', 'success');
    } catch (error) {
      console.error('Error following user:', error);
      showToast('Failed to update follow status', 'error');
    } finally {
      setFollowLoading(false);
    }
  };

  const renderProfilePhoto = () => {
    const photoContent = profile?.profile_photo ? (
      <Image
        source={{ uri: `${getApiBaseImage()}/storage/${profile.profile_photo}` }}
        style={styles.profilePhoto}
      />
    ) : (
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={[styles.profilePhoto, styles.initialsContainer]}
      >
        <Text style={styles.initials}>
          {`${profile?.name?.charAt(0) || ''}${profile?.last_name?.charAt(0) || ''}`.toUpperCase()}
        </Text>
      </LinearGradient>
    );

    return (
      <TouchableOpacity 
        activeOpacity={0.9} 
        onPress={() => setPhotoModalVisible(true)}
      >
        {photoContent}
      </TouchableOpacity>
    );
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const StatCard = ({ value, label, icon }: { value: number; label: string; icon: string }) => (
    <MotiView
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'spring', delay: 100 }}
      style={styles.statCard}
    >
      <View style={styles.statIconContainer}>
        <Ionicons name={icon as any} size={20} color="#666" />
      </View>
      <Text style={styles.statNumber}>{formatNumber(value)}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </MotiView>
  );

  const AboutSection = () => {
    const isRestricted = profile?.is_private && !isFollowing && user?.id && String(user.id) !== String(userId);

    if (isRestricted) {
      return (
        <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} style={styles.privateContainer}>
          <View style={styles.privateIconCircle}>
            <Ionicons name="lock-closed" size={32} color="#666" />
          </View>
          <Text style={styles.privateTitle}>This Account is Private</Text>
          <Text style={styles.privateSubtitle}>Follow this account to see their full profile and media uploads.</Text>
        </MotiView>
      );
    }

    const sections = [
      {
        title: 'Professional',
        icon: 'briefcase',
        show: profile?.job_title || profile?.company || profile?.education,
        items: [
          { label: 'Work', value: profile?.job_title && profile?.company ? `${profile.job_title} at ${profile.company}` : (profile?.job_title || profile?.company), icon: 'business-outline' },
          { label: 'Education', value: profile?.education, icon: 'school-outline' },
        ]
      },
      {
        title: 'Personal',
        icon: 'person',
        show: profile?.bio || profile?.location || profile?.birthday || profile?.gender,
        items: [
          { label: 'Bio', value: profile?.bio, icon: 'chatbubble-outline' },
          { 
            label: 'Location', 
            value: parsedLocation?.name || parsedLocation?.address || profile?.location, 
            icon: 'location-outline',
            onPress: handleLocationPress 
          },
          { 
            label: 'Gender', 
            value: profile?.gender, 
            icon: 'transgender-outline' 
          },
          { 
            label: 'Birthday', 
            value: profile?.birthday ? new Date(profile.birthday).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null, 
            icon: 'cake-outline',
            private: profile?.preferences && !profile.preferences.show_birthday
          },
        ]
      },
      {
        title: 'Connect',
        icon: 'link',
        show: profile?.website || (profile?.social_links && Object.keys(profile.social_links).length > 0) || profile?.phone || profile?.email,
        items: [
          { label: 'Website', value: profile?.website, icon: 'globe-outline', isLink: true },
          { 
            label: 'Email', 
            value: profile?.email, 
            icon: 'mail-outline', 
            isEmail: true,
            private: profile?.preferences && !profile.preferences.show_email
          },
          { 
            label: 'Phone', 
            value: profile?.phone, 
            icon: 'call-outline', 
            isPhone: true,
            private: profile?.preferences && !profile.preferences.show_phone
          },
        ]
      }
    ];

    if (!sections.some(s => s.show)) {
      return (
        <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} style={styles.emptyAbout}>
          <Ionicons name="person-outline" size={48} color="#ccc" />
          <Text style={styles.emptyAboutText}>No additional information provided</Text>
        </MotiView>
      );
    }

    return (
      <View style={styles.aboutContainer}>
        {sections.filter(s => s.show).map((section, sIndex) => (
          <MotiView
            key={section.title}
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ delay: sIndex * 100 }}
            style={styles.aboutSection}
          >
            <View style={styles.sectionHeader}>
              <Ionicons name={section.icon as any} size={18} color="#3897f0" />
              <Text style={styles.sectionTitleText}>{section.title}</Text>
            </View>

            {section.items.filter(i => i.value).map((item, iIndex) => (
              <TouchableOpacity
                key={item.label}
                disabled={!item.onPress && !item.isLink && !item.isEmail && !item.isPhone}
                onPress={async () => {
                  if (item.onPress) {
                    item.onPress();
                  } else if (item.isLink) {
                    handleLinkPress(item.value as string);
                  } else if (item.isEmail || item.isPhone) {
                    try {
                      if (!isWeb) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      const url = item.isEmail ? `mailto:${item.value}` : `tel:${item.value}`;
                      const supported = await Linking.canOpenURL(url);
                      if (supported) {
                        await Linking.openURL(url);
                      } else {
                        showToast(`Could not open ${item.isEmail ? 'email' : 'phone'}`, 'error');
                      }
                    } catch (error) {
                      console.error('Link Error:', error);
                    }
                  }
                }}
                style={styles.aboutItem}
              >
                <View style={[styles.aboutIconCircle, { backgroundColor: '#f1f1f1' }]}>
                  <Ionicons name={item.icon as any} size={16} color="#555" />
                </View>
                <View style={styles.aboutContent}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={styles.aboutLabel}>{item.label}</Text>
                    {String(user?.id) === String(userId) && item.private && (
                      <View style={styles.privateBadge}>
                        <Ionicons name="lock-closed" size={10} color="#FF9800" />
                        <Text style={styles.privateBadgeText}>Hidden</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.aboutText, (item.isLink || item.isEmail || item.isPhone) && styles.linkText]}>
                    {item.value}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}

            {section.title === 'Connect' && profile?.social_links && Object.keys(profile.social_links).length > 0 && (
              <View style={styles.socialGrid}>
                {Object.entries(profile.social_links).map(([platform, url]) => (
                  <TouchableOpacity
                    key={platform}
                    style={styles.socialBadge}
                    onPress={() => handleLinkPress(url as string)}
                  >
                    <Ionicons name={getSocialIcon(platform) as any} size={16} color="#666" />
                    <Text style={styles.socialBadgeText}>{platform}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </MotiView>
        ))}
      </View>
    );
  };

  const getSocialIcon = (platform: string) => {
    const icons: Record<string, string> = {
      twitter: 'logo-twitter',
      instagram: 'logo-instagram',
      facebook: 'logo-facebook',
      linkedin: 'logo-linkedin',
      github: 'logo-github',
      youtube: 'logo-youtube',
      tiktok: 'logo-tiktok',
    };
    return icons[platform.toLowerCase()] || 'link-outline';
  };

  const renderProfileHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.profileHeader}>
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          {renderProfilePhoto()}
        </Animated.View>

        <View style={styles.statsRow}>
          <StatCard value={profile.posts_count || 0} label="Posts" icon="document-text-outline" />
          <StatCard value={profile.followers_count || 0} label="Followers" icon="people-outline" />
          <StatCard value={profile.following_count || 0} label="Following" icon="person-add-outline" />
        </View>
      </View>

      <View style={styles.userInfo}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{profile.name} {profile.last_name}</Text>
          {profile.is_private && (
            <Ionicons name="lock-closed" size={16} color="#666" style={{ marginLeft: 6 }} />
          )}
        </View>
        <View style={styles.usernameRow}>
          {profile.username && <Text style={styles.username}>@{profile.username}</Text>}
          <Text style={styles.joinedDate}> • Joined {new Date(profile.created_at).getFullYear()}</Text>
        </View>
      </View>

      {user?.id && String(user.id) !== String(userId) && (
        <TouchableOpacity
          style={styles.followButton}
          onPress={handleFollow}
          disabled={followLoading}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={isFollowing ? ['#efefef', '#e0e0e0'] : ['#3897f0', '#005ed3']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.followButtonGradient}
          >
            {followLoading ? (
              <ActivityIndicator size="small" color={isFollowing ? '#000' : '#fff'} />
            ) : (
              <>
                <Ionicons
                  name={isFollowing ? "checkmark-circle" : "person-add"}
                  size={18}
                  color={isFollowing ? '#000' : '#fff'}
                />
                <Text style={[
                  styles.followButtonLabel,
                  isFollowing && { color: '#000' }
                ]}>
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      )}

      <View style={styles.tabsContainer}>
        {[
          { id: 'posts', label: 'Posts', icon: 'grid-outline' },
          { id: 'about', label: 'About', icon: 'information-circle-outline' },
          { id: 'media', label: 'Media', icon: 'images-outline' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id as any)}
          >
            <Ionicons
              name={tab.icon as any}
              size={18}
              color={activeTab === tab.id ? '#3897f0' : '#666'}
            />
            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
              {tab.label}
            </Text>
            {activeTab === tab.id && (
              <MotiView
                style={styles.tabIndicator}
                transition={{ type: 'timing', duration: 200 }}
              />
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderFooter = () => {
    if (activeTab === 'posts' && uniqueUserPosts.length > 0 && hasMorePosts) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator size="small" color="#3897f0" />
          <Text style={styles.footerText}>Loading more posts...</Text>
        </View>
      );
    }
    if (activeTab === 'posts' && uniqueUserPosts.length > 0 && !hasMorePosts) {
      return (
        <View style={styles.footerEnd}>
          <Text style={styles.footerEndText}>End of posts</Text>
        </View>
      );
    }
    return null;
  };

  const renderEmptyState = () => {
    if (activeTab === 'posts' && uniqueUserPosts.length === 0 && !loading) {
      return (
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={styles.emptyState}
        >
          <Ionicons name="grid-outline" size={48} color="#ccc" />
          <Text style={styles.emptyStateText}>No posts yet</Text>
        </MotiView>
      );
    }
    if (activeTab === 'media' && uniqueMediaFromPosts.length === 0 && !loading) {
      const isRestricted = profile?.is_private && !isFollowing && user?.id && String(user.id) !== String(userId);
      return (
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={styles.emptyState}
        >
          <Ionicons name={isRestricted ? "lock-closed-outline" : "images-outline"} size={48} color="#ccc" />
          <Text style={styles.emptyStateText}>
            {isRestricted ? "This account is private" : "No media uploads found in posts"}
          </Text>
        </MotiView>
      );
    }
    return null;
  };

  // Get unique key for each item
  const getItemKey = (item: any) => {
    if (activeTab === 'media') {
      return item.uniqueKey;
    }
    return `post-${item.id}`;
  };

  if (!visible || !profile) return null;

  return (
    <Modal
      visible={profilePreviewVisible}
      transparent={false}
      animationType="slide"
      onRequestClose={() => setProfilePreviewVisible(false)}
    >
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <LinearGradient
          colors={['#ffffff', '#f8f9fa']}
          style={styles.header}
        >
          <View style={styles.headerTop}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => setProfilePreviewVisible(false)}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={24} color="#000" />
            </TouchableOpacity>

            <Text style={styles.headerTitle} numberOfLines={1}>
              {profile.name}
            </Text>

            {user?.id && String(user.id) !== String(userId) && (
              <TouchableOpacity
                style={styles.headerButton}
                onPress={async () => {
                  const profileId = String(userId);
                  const reported = useReportedContentStore.getState().isReported('profile', profileId);
                  if (reported) {
                    try {
                      await deleteReportByTarget('profile', profileId);
                      useReportedContentStore.getState().removeReportedItem('profile', profileId);
                      showToast('Report removed', 'success');
                    } catch (error) {
                      showToast('Failed to remove report', 'error');
                    }
                  } else {
                    setShowReportModal(true);
                  }
                }}
              >
                <Ionicons
                  name={useReportedContentStore.getState().isReported('profile', userId) ? "flag" : "flag-outline"}
                  size={22}
                  color={useReportedContentStore.getState().isReported('profile', userId) ? "#ff4444" : "#666"}
                />
              </TouchableOpacity>
            )}
          </View>
        </LinearGradient>

        {loading && activeTab === 'posts' ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#3897f0" />
            <Text style={styles.loaderText}>Loading profile...</Text>
          </View>
        ) : (
          <Animated.FlatList
            data={activeTab === 'posts' ? uniqueUserPosts : (activeTab === 'media' && (!profile.is_private || isFollowing || user?.id === String(userId)) ? uniqueMediaFromPosts : [])}
            keyExtractor={getItemKey}
            numColumns={activeTab === 'media' ? 3 : 1}
            key={activeTab === 'media' ? 'media-grid' : 'post-list'}
            renderItem={({ item }) => {
              if (activeTab === 'media') {
                const mediaItem = item as any;
                const isVideo = mediaItem.type === 'video';
                return (
                  <TouchableOpacity
                    style={styles.mediaItem}
                    activeOpacity={0.9}
                    onPress={() => openModal(isVideo ? 'video' : 'image', { url: `${getApiBaseImage()}/storage/${mediaItem.file_path}` })}
                  >
                    <Image
                      source={{ uri: `${getApiBaseImage()}/storage/${mediaItem.file_path}` }}
                      style={styles.mediaThumbnail}
                    />
                    {isVideo && (
                      <View style={styles.videoOverlay}>
                        <Ionicons name="play-circle" size={32} color="rgba(255,255,255,0.9)" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }
              const postItem = item as Post;
              return (
                <PostListItem
                  post={postItem}
                  onReact={() => { }}
                  onCommentSubmit={commentOnPost}
                  onRepost={() => { }}
                  onShare={() => { }}
                  onBookmark={() => { }}
                  onReactComment={() => { }}
                />
              );
            }}
            ListHeaderComponent={renderProfileHeader}
            ListFooterComponent={
              <>
                {activeTab === 'about' && <AboutSection />}
                {renderEmptyState()}
                {renderFooter()}
              </>
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor="#3897f0"
                colors={['#3897f0']}
              />
            }
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.3}
            contentContainerStyle={[
              styles.scrollContent,
              (activeTab === 'posts' && uniqueUserPosts.length === 0) && styles.emptyScrollContent
            ]}
            showsVerticalScrollIndicator={false}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: true }
            )}
            style={{ opacity: headerAnim }}
            removeClippedSubviews={Platform.OS === 'ios'}
            maxToRenderPerBatch={10}
            windowSize={10}
            initialNumToRender={5}
          />
        )}
      </SafeAreaView>

      <ReportPost
        visible={showReportModal}
        userId={Number(userId)}
        type="profile"
        onClose={() => setShowReportModal(false)}
        onReportSubmitted={() => {
          showToast('Report submitted for AI review.', 'success');
          setShowReportModal(false);
        }}
      />

      {/* Profile Photo Popup Modal */}
      <Modal
        visible={photoModalVisible}
        transparent={true}
        animationType="none"
        onRequestClose={() => setPhotoModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.photoModalBackdrop} 
          activeOpacity={1} 
          onPress={() => setPhotoModalVisible(false)}
        >
          <AnimatePresence>
            {photoModalVisible && (
              <MotiView
                from={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ type: 'spring', damping: 15 }}
                style={styles.enlargedPhotoContainer}
              >
                <TouchableOpacity style={{ width: '100%', height: '100%' }} activeOpacity={1}>
                  {profile?.profile_photo ? (
                    <Image
                      source={{ uri: `${getApiBaseImage()}/storage/${profile.profile_photo}` }}
                      style={styles.enlargedPhoto}
                      resizeMode="cover"
                    />
                  ) : (
                    <LinearGradient
                      colors={['#667eea', '#764ba2']}
                      style={[styles.enlargedPhoto, styles.initialsContainer]}
                    >
                      <Text style={styles.enlargedInitials}>
                        {`${profile?.name?.charAt(0) || ''}${profile?.last_name?.charAt(0) || ''}`.toUpperCase()}
                      </Text>
                    </LinearGradient>
                  )}
                </TouchableOpacity>
              </MotiView>
            )}
          </AnimatePresence>
        </TouchableOpacity>
      </Modal>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 8 : 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    maxWidth: width * 0.5,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  emptyScrollContent: {
    flex: 1,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  profilePhoto: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 20,
  },
  initialsContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  statsRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statCard: {
    alignItems: 'center',
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  userInfo: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  username: {
    fontSize: 14,
    color: '#666',
  },
  joinedDate: {
    fontSize: 13,
    color: '#999',
  },
  followButton: {
    flexDirection: 'row',
    marginHorizontal: 20,
    borderRadius: 30,
    overflow: 'hidden',
    marginBottom: 20,
    ...createShadow({
      width: 0,
      height: 2,
      opacity: 0.1,
      radius: 4,
      elevation: 2,
    }),
  },
  followButtonGradient: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  followButtonLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  followingButton: {
    backgroundColor: '#efefef',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    position: 'relative',
  },
  tabActive: {
    backgroundColor: 'transparent',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  tabTextActive: {
    color: '#3897f0',
    fontWeight: '600',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: -1,
    left: '30%',
    right: '30%',
    height: 2,
    backgroundColor: '#3897f0',
    borderRadius: 1,
  },
  headerContainer: {
    paddingBottom: 10,
  },
  aboutContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  aboutItem: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  aboutIcon: {
    width: 32,
    marginRight: 12,
  },
  aboutContent: {
    flex: 1,
  },
  aboutLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  aboutText: {
    fontSize: 15,
    color: '#1a1a1a',
    lineHeight: 22,
  },
  linkText: {
    color: '#3897f0',
    textDecorationLine: 'underline',
  },
  emptyAbout: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyAboutText: {
    marginTop: 12,
    fontSize: 14,
    color: '#999',
  },
  socialLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 4,
  },
  socialLink: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  socialLinkText: {
    fontSize: 13,
    color: '#666',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    marginTop: 12,
    fontSize: 14,
    color: '#999',
  },
  mediaItem: {
    flex: 1 / 3,
    aspectRatio: 1,
    padding: 1,
  },
  mediaThumbnail: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f0f0',
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  photoModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  enlargedPhotoContainer: {
    width: width * 0.8,
    height: width * 0.8,
    maxWidth: 500,
    maxHeight: 500,
    borderRadius: Platform.OS === 'web' ? 250 : (width * 0.8) / 2,
    backgroundColor: '#000',
    overflow: 'hidden',
    ...createShadow({ opacity: 0.5, radius: 20 }),
  },
  enlargedPhoto: {
    width: '100%',
    height: '100%',
  },
  enlargedInitials: {
    fontSize: 80,
    fontWeight: '800',
    color: '#fff',
  },
  footerLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  footerText: {
    fontSize: 12,
    color: '#666',
  },
  footerEnd: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  footerEndText: {
    fontSize: 12,
    color: '#999',
  },
  // Enhanced About Styles
  aboutSection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    ...createShadow({ opacity: 0.05, radius: 10 }),
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  sectionTitleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3897f0',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  aboutIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  socialGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f5f5f5',
  },
  socialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
    gap: 6,
  },
  socialBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#444',
    textTransform: 'capitalize',
  },
  // Private Account Guard
  privateContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  privateIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#eee',
  },
  privateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  privateSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  privateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
    gap: 3,
  },
  privateBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FF9800',
    textTransform: 'uppercase',
  },
});

export default ProfilePreview;