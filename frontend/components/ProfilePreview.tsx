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
} from 'react-native';
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

  // Deduplicate media items by ID
  const uniqueMediaItems = useMemo(() => {
    const seen = new Set();
    return mediaItems.filter(item => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [mediaItems]);

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
    if (!hasMorePosts || loadingMore || activeTab !== 'posts') return;
    if (postsPage < postsLastPage) {
      fetchProfileData(postsPage + 1, false);
    }
  }, [hasMorePosts, loadingMore, activeTab, postsPage, postsLastPage, fetchProfileData]);

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
      showToast(isFollowing ? 'Unfollowed successfully' : 'Followed successfully', 'success');
    } catch (error) {
      console.error('Error following user:', error);
      showToast('Failed to update follow status', 'error');
    } finally {
      setFollowLoading(false);
    }
  };

  const renderProfilePhoto = () => {
    if (profile?.profile_photo) {
      return (
        <Image
          source={{ uri: `${getApiBaseImage()}/storage/${profile.profile_photo}` }}
          style={styles.profilePhoto}
        />
      );
    }
    const initials = `${profile?.name?.charAt(0) || ''}${profile?.last_name?.charAt(0) || ''}`;
    return (
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={[styles.profilePhoto, styles.initialsContainer]}
      >
        <Text style={styles.initials}>{initials.toUpperCase()}</Text>
      </LinearGradient>
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
    const hasBio = profile?.bio;
    const hasLocation = profile?.location;
    const hasWebsite = profile?.website;
    const hasJob = profile?.job_title || profile?.company;
    const hasEducation = profile?.education;
    const hasBirthday = profile?.birthday;
    const hasSocialLinks = profile?.social_links && Object.keys(profile.social_links).length > 0;

    if (!hasBio && !hasLocation && !hasWebsite && !hasJob && !hasEducation && !hasBirthday && !hasSocialLinks) {
      return (
        <MotiView
          from={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          style={styles.emptyAbout}
        >
          <Ionicons name="person-outline" size={48} color="#ccc" />
          <Text style={styles.emptyAboutText}>No additional information provided</Text>
        </MotiView>
      );
    }

    return (
      <View style={styles.aboutContainer}>
        {profile?.bio && (
          <MotiView
            from={{ opacity: 0, translateX: -20 }}
            animate={{ opacity: 1, translateX: 0 }}
            transition={{ delay: 50 }}
            style={styles.aboutItem}
          >
            <View style={styles.aboutIcon}>
              <Ionicons name="chatbubble-outline" size={18} color="#666" />
            </View>
            <View style={styles.aboutContent}>
              <Text style={styles.aboutLabel}>Bio</Text>
              <Text style={styles.aboutText}>{profile.bio}</Text>
            </View>
          </MotiView>
        )}

        {(profile?.job_title || profile?.company) && (
          <MotiView
            from={{ opacity: 0, translateX: -20 }}
            animate={{ opacity: 1, translateX: 0 }}
            transition={{ delay: 100 }}
            style={styles.aboutItem}
          >
            <View style={styles.aboutIcon}>
              <Ionicons name="briefcase-outline" size={18} color="#666" />
            </View>
            <View style={styles.aboutContent}>
              <Text style={styles.aboutLabel}>Work</Text>
              <Text style={styles.aboutText}>
                {profile.job_title}{profile.job_title && profile.company ? ' at ' : ''}{profile.company}
              </Text>
            </View>
          </MotiView>
        )}

        {profile?.education && (
          <MotiView
            from={{ opacity: 0, translateX: -20 }}
            animate={{ opacity: 1, translateX: 0 }}
            transition={{ delay: 150 }}
            style={styles.aboutItem}
          >
            <View style={styles.aboutIcon}>
              <Ionicons name="school-outline" size={18} color="#666" />
            </View>
            <View style={styles.aboutContent}>
              <Text style={styles.aboutLabel}>Education</Text>
              <Text style={styles.aboutText}>{profile.education}</Text>
            </View>
          </MotiView>
        )}

        {profile?.location && (
          <MotiView
            from={{ opacity: 0, translateX: -20 }}
            animate={{ opacity: 1, translateX: 0 }}
            transition={{ delay: 200 }}
            style={styles.aboutItem}
          >
            <View style={styles.aboutIcon}>
              <Ionicons name="location-outline" size={18} color="#666" />
            </View>
            <View style={styles.aboutContent}>
              <Text style={styles.aboutLabel}>Location</Text>
              <Text style={styles.aboutText}>{profile.location}</Text>
            </View>
          </MotiView>
        )}

        {profile?.website && (
          <MotiView
            from={{ opacity: 0, translateX: -20 }}
            animate={{ opacity: 1, translateX: 0 }}
            transition={{ delay: 250 }}
            style={styles.aboutItem}
          >
            <View style={styles.aboutIcon}>
              <Ionicons name="link-outline" size={18} color="#666" />
            </View>
            <View style={styles.aboutContent}>
              <Text style={styles.aboutLabel}>Website</Text>
              <TouchableOpacity onPress={() => openModal('webview', { url: profile.website })}>
                <Text style={[styles.aboutText, styles.linkText]} numberOfLines={1}>
                  {profile.website}
                </Text>
              </TouchableOpacity>
            </View>
          </MotiView>
        )}

        {profile?.birthday && (
          <MotiView
            from={{ opacity: 0, translateX: -20 }}
            animate={{ opacity: 1, translateX: 0 }}
            transition={{ delay: 300 }}
            style={styles.aboutItem}
          >
            <View style={styles.aboutIcon}>
              <Ionicons name="cake-outline" size={18} color="#666" />
            </View>
            <View style={styles.aboutContent}>
              <Text style={styles.aboutLabel}>Birthday</Text>
              <Text style={styles.aboutText}>
                {new Date(profile.birthday).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </Text>
            </View>
          </MotiView>
        )}

        {profile?.social_links && Object.keys(profile.social_links).length > 0 && (
          <MotiView
            from={{ opacity: 0, translateX: -20 }}
            animate={{ opacity: 1, translateX: 0 }}
            transition={{ delay: 350 }}
            style={styles.aboutItem}
          >
            <View style={styles.aboutIcon}>
              <Ionicons name="share-social-outline" size={18} color="#666" />
            </View>
            <View style={styles.aboutContent}>
              <Text style={styles.aboutLabel}>Social Links</Text>
              <View style={styles.socialLinks}>
                {Object.entries(profile.social_links).map(([platform, url]) => (
                  <TouchableOpacity
                    key={platform}
                    style={styles.socialLink}
                    onPress={() => openModal('webview', { url: url as string })}
                  >
                    <Ionicons
                      name={getSocialIcon(platform) as any}
                      size={16}
                      color="#666"
                    />
                    <Text style={styles.socialLinkText} numberOfLines={1}>
                      {platform}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </MotiView>
        )}
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

      {user?.id !== String(userId) && (
        <TouchableOpacity
          style={[
            styles.followButton,
            isFollowing && styles.followingButton
          ]}
          onPress={handleFollow}
          disabled={followLoading}
          activeOpacity={0.7}
        >
          {followLoading ? (
            <ActivityIndicator size="small" color={isFollowing ? '#000' : '#fff'} />
          ) : (
            <>
              <Ionicons
                name={isFollowing ? "checkmark" : "person-add"}
                size={18}
                color={isFollowing ? '#000' : '#fff'}
              />
              <Text style={[
                styles.followButtonText,
                isFollowing && styles.followingButtonText
              ]}>
                {isFollowing ? 'Following' : 'Follow'}
              </Text>
            </>
          )}
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
    if (activeTab === 'media' && uniqueMediaItems.length === 0 && !loading) {
      return (
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={styles.emptyState}
        >
          <Ionicons name="images-outline" size={48} color="#ccc" />
          <Text style={styles.emptyStateText}>No media uploads found</Text>
        </MotiView>
      );
    }
    return null;
  };

  // Get unique key for each item
  const getItemKey = (item: any) => {
    if (activeTab === 'media') {
      return `media-${item.id}`;
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

            {user?.id !== String(userId) && (
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
            data={activeTab === 'posts' ? uniqueUserPosts : (activeTab === 'media' ? uniqueMediaItems : [])}
            keyExtractor={getItemKey}
            numColumns={activeTab === 'media' ? 3 : 1}
            key={activeTab === 'media' ? 'media-grid' : 'post-list'}
            renderItem={({ item }) => {
              if (activeTab === 'media') {
                const mediaItem = item as MediaItem;
                return (
                  <TouchableOpacity
                    style={styles.mediaItem}
                    onPress={() => openModal('image', { url: `${getApiBaseImage()}/storage/${mediaItem.file_path}` })}
                  >
                    <Image
                      source={{ uri: `${getApiBaseImage()}/storage/${mediaItem.file_path}` }}
                      style={styles.mediaThumbnail}
                    />
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
    backgroundColor: '#3897f0',
    marginHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
    ...createShadow({
      width: 0,
      height: 2,
      opacity: 0.1,
      radius: 4,
      elevation: 2,
    }),
  },
  followingButton: {
    backgroundColor: '#efefef',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  followButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  followingButtonText: {
    color: '#000',
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
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
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
});

export default ProfilePreview;