// app/(tabs)/chats/index.tsx
import {
  View, StyleSheet, ActivityIndicator, SectionList,
  TextInput, TouchableOpacity, Text, Modal, Alert,
  RefreshControl, Animated, ScrollView,
  Platform
} from "react-native";
import OfflineService from '@/services/ChatScreen/OfflineServiceChat';
import RealTimeService from '@/services/ChatScreen/RealTimeServiceChat';
import NotificationService from '@/services/ChatScreen/NotificationServiceChat';
import SearchService, { SearchResult } from '@/services/ChatScreen/SearchServiceChat';

import { router, useFocusEffect } from 'expo-router';
import { useState, useEffect, useContext, useMemo, useCallback, useRef } from "react";
import AuthContext from "@/context/AuthContext";
import { usePostStore } from '@/stores/postStore';
import EnhancedChatRow from '@/components/ChatScreen/EnhancedChatRow';
import { Ionicons } from '@expo/vector-icons';
import CollaborationService, { CollaborationSpace, CollaborativeActivity } from '@/services/ChatScreen/CollaborationService';
import * as Haptics from 'expo-haptics';
import { getToken } from "@/services/TokenService";
import getApiBase from "@/services/getApiBase";
import axios from '@/services/axios';
import { useSpaceStore } from '@/stores/spaceStore';
import { SynchronicityEngine } from '@/services/ChatScreen/SynchronicityEngine';
import { DatabaseIntegrator } from '@/services/ChatScreen/DatabaseIntegrator';
import debounce from 'lodash/debounce';
import CreativeGenerator from "@/components/AI/CreativeGenerator";
import CollaborativeActivities from "@/components/ChatScreen/CollaborativeActivities";
import { id } from "rn-emoji-keyboard";
import { useCollaborationStore } from "@/stores/collaborationStore";

interface Chat {
  id: string;
  name: string;
  lastMessage?: string;
  timestamp: string;
  unreadCount?: number;
  avatar?: string;
  isOnline?: boolean;
  isPinned?: boolean;
  user_id: string;
  type: 'chat' | 'contact' | 'space';
  spaceData?: CollaborationSpace;
  conversationId?: number;
  email?: string;
  username?: string;
  // For search results integration
  isSearchResult?: boolean;
  searchRelevance?: number;
  searchType?: string;
}

interface SectionData {
  title: string;
  data: Chat[];
  type: 'spaces' | 'chats' | 'contacts' | 'search';
  isSearchSection?: boolean;
}

const ChatPage = () => {
  const notificationService = NotificationService.getInstance();
  const searchService = SearchService.getInstance();
  const realTimeService = RealTimeService.getInstance();
  const offlineService = OfflineService.getInstance();

  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const { user } = useContext(AuthContext);
  const { posts } = usePostStore();
  const [chats, setChats] = useState<Chat[]>([]);
  const [contacts, setContacts] = useState<Chat[]>([]);
  const [spaces, setSpaces] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSpaceTypes, setShowSpaceTypes] = useState(false);
  const [showCreativeGenerator, setShowCreativeGenerator] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);

  const collaborationService = CollaborationService.getInstance();
  const synchronicityEngine = SynchronicityEngine.getInstance();
  const { currentSpace } = useSpaceStore();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-50)).current;
  const searchInputRef = useRef<TextInput>(null);

  const [activitiesCount, setActivitiesCount] = useState(0);
  const [activities, setActivities] = useState<CollaborativeActivity[]>([]);
  const [showActivities, setShowActivities] = useState(false);

  const [showSpaceNameInput, setShowSpaceNameInput] = useState(false);
  const [selectedSpaceType, setSelectedSpaceType] = useState<CollaborationSpace['space_type'] | null>(null);
  const [newSpaceName, setNewSpaceName] = useState('');

  // Configure notifications
  useEffect(() => {
    notificationService.configure();
    notificationService.clearBadgeCount();

    return () => {
      // Optional cleanup
    };
  }, []);

  // Initialize token
  useEffect(() => {
    const loadToken = async () => {
      const userToken = await getToken();
      setToken(userToken);
      if (userToken) {
        collaborationService.setToken(userToken);
      }
    };
    loadToken();
  }, []);

  // Redirect if no user
  useEffect(() => {
    if (!user) {
      router.replace('/LoginScreen');
    }
  }, [user]);

  // Initialize real-time service
  useEffect(() => {
    if (user?.id) {
      realTimeService.initialize(user.id);

      const handleNewSpace = (data: any) => {
        if (data.space && !spaces.some(s => s.id === data.space.id)) {
          const newChat: Chat = {
            id: data.space.id,
            name: data.space.title,
            lastMessage: getSpaceDescription(data.space),
            timestamp: 'Just now',
            unreadCount: 0,
            user_id: data.space.creator_id.toString(),
            type: 'space',
            spaceData: data.space,
          };

          setSpaces(prev => [newChat, ...prev]);
          if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }

          // Show notification
          notificationService.scheduleLocalNotification({
            title: 'New Space Created',
            body: `${data.space.title} is ready`,
            data: {
              type: 'space_created',
              spaceId: data.space.id,
            },
          });
        }
      };
    }

    return () => {
      // Cleanup
    };
  }, [user?.id]);

  // Add real-time refresh on focus
  useFocusEffect(
    useCallback(() => {
      if (user) {
        loadAllData();
      }

      return () => {
        // Optional cleanup
      };
    }, [user])
  );

  // Load all data
  useEffect(() => {
    if (user && token) {
      loadAllData();
      startAnimations();
    }
  }, [user, token]);

  // Animation on mount
  const startAnimations = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      })
    ]).start();
  };

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchChatsAndContacts(),
        fetchUserSpaces(),
        getAISuggestion(),
        fetchActivitiesCount()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const fetchActivitiesCount = async () => {
    if (!user?.id) return;

    // ✅ Use the store to prevent duplicate fetches
    const {
      hasSpaceActivities,
      setSpaceActivities,
      totalActivitiesCount
    } = useCollaborationStore.getState();

    try {
      // Fetch spaces first
      const userSpaces = await collaborationService.fetchUserSpaces(user.id);

      let totalActivities = 0;
      let allActivities: CollaborativeActivity[] = [];
      const spacesToFetch: CollaborationSpace[] = [];

      // Check which spaces need fresh data
      for (const space of userSpaces) {
        if (!hasSpaceActivities(space.id)) {
          spacesToFetch.push(space);
        }
      }

      // Only fetch spaces that need updating
      if (spacesToFetch.length > 0) {
        console.log(`📊 Fetching activities for ${spacesToFetch.length} spaces (cached: ${userSpaces.length - spacesToFetch.length})`);

        for (const space of spacesToFetch) {
          try {
            const result = await collaborationService.getSpaceActivities(space.id);
            setSpaceActivities(space.id, result.activities, result.total);
            totalActivities += result.activities.length;
            allActivities = [...allActivities, ...result.activities];
          } catch (error) {
            console.log(`No activities for space ${space.id}`);
          }
        }
      }

      // Get final total from store
      const finalTotal = useCollaborationStore.getState().totalActivitiesCount;
      setActivitiesCount(finalTotal);

    } catch (error) {
      console.error('Error fetching activities count:', error);
    }
  };
  // Debounced search
  const debouncedSearch = useCallback(
    debounce((query: string) => {
      handleSearch(query);
    }, 300),
    []
  );

  // Get AI suggestion for user
  const getAISuggestion = async () => {
    if (!user?.id || chats.length === 0) return;

    try {
      const recentChatCount = chats.length;
      const activeSpaces = spaces.filter(s => s.spaceData?.is_live).length;

      let suggestion = '';
      if (recentChatCount > 5 && activeSpaces === 0) {
        suggestion = 'You have several ongoing chats. Create a space to collaborate with multiple people at once?';
      } else if (spaces.length === 0) {
        suggestion = 'Try creating your first collaboration space! Start with a brainstorming session.';
      } else if (chats.length === 0) {
        suggestion = 'Start a conversation with someone you follow to begin chatting.';
      }

      setAiSuggestion(suggestion);
    } catch (error) {
      console.error('Error getting AI suggestion:', error);
    }
  };

  // Fixed fetchChatsAndContacts with better error handling
  const fetchChatsAndContacts = async () => {
    if (!user?.id || !token) return;

    setLoading(true);
    const API_BASE = getApiBase();

    try {
      // Fetch contacts from followers/following
      let followerContacts: Chat[] = [];
      let fallbackUsed = false;

      try {
        // Try followers endpoint first
        const followersResponse = await axios.get(`${API_BASE}/profile/followers`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        followerContacts = transformUsersToContacts(followersResponse.data, 'follower');
      } catch (followerError) {
        console.log('Followers endpoint failed, trying following...');

        try {
          const followingResponse = await axios.get(`${API_BASE}/profile/following`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          followerContacts = transformUsersToContacts(followingResponse.data, 'following');
        } catch (followingError) {
          console.log('Following endpoint failed, using users endpoint...');

          try {
            const usersResponse = await axios.get(`${API_BASE}/users`, {
              headers: { Authorization: `Bearer ${token}` },
            });

            followerContacts = transformUsersToContacts(usersResponse.data.slice(0, 10), 'user');
          } catch (usersError) {
            console.log('All endpoints failed, using fallback contacts');
            followerContacts = getFallbackContacts();
            fallbackUsed = true;
          }
        }
      }

      // Extract chats from posts
      const chatConversations = extractChatsFromPosts(posts, user.id);

      setChats(chatConversations);
      setContacts(followerContacts);

      if (fallbackUsed) {
        Alert.alert(
          'Limited Mode',
          'Using demo contacts. Check your backend is running.',
          [{ text: 'OK' }]
        );
      }

    } catch (error: any) {
      console.error('Error in fetchChatsAndContacts:', error);
      Alert.alert('Error', 'Failed to load conversations');

      // Set empty states
      setChats([]);
      setContacts(getFallbackContacts());
    } finally {
      setLoading(false);
    }
  };

  // Helper function to transform API data to contacts
  const transformUsersToContacts = (data: any[], source: string): Chat[] => {
    return data.map((item: any) => {
      const user = item.follower || item.following || item.user || item;
      return {
        id: user.id.toString(),
        name: user.name || 'User',
        lastMessage: 'Tap to start a conversation',
        timestamp: 'Recently active',
        avatar: user.profile_photo,
        isOnline: Math.random() > 0.5,
        user_id: user.id.toString(),
        type: 'contact' as const,
        email: user.email,
        username: user.username,
      };
    });
  };

  // Helper function to extract chats from posts
  const extractChatsFromPosts = (posts: any[], currentUserId: number): Chat[] => {
    const uniqueUsers = new Map();

    posts.forEach(post => {
      if (post.user && post.user.id !== currentUserId && post.is_following) {
        const userId = post.user.id.toString();
        if (!uniqueUsers.has(userId)) {
          uniqueUsers.set(userId, {
            id: userId,
            name: post.user.name,
            avatar: post.user.profile_photo,
            lastPost: post,
            postCount: 0
          });
        }

        const userData = uniqueUsers.get(userId);
        userData.postCount++;

        const postDate = new Date(post.created_at);
        const lastPostDate = new Date(userData.lastPost.created_at || 0);

        if (postDate > lastPostDate) {
          userData.lastPost = post;
        }
      }
    });

    return Array.from(uniqueUsers.values()).map(userData => ({
      id: userData.id,
      name: userData.name,
      lastMessage: userData.lastPost.caption?.substring(0, 50) + '...' || 'Media shared',
      timestamp: formatTimestamp(userData.lastPost.created_at),
      unreadCount: Math.floor(Math.random() * 5),
      avatar: userData.avatar,
      isOnline: Math.random() > 0.3,
      isPinned: Math.random() > 0.8,
      user_id: userData.id,
      type: 'chat' as const,
    })).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  };

  // Fallback contacts when API fails
  const getFallbackContacts = (): Chat[] => [
    {
      id: 'contact-1',
      name: 'Alex Johnson',
      lastMessage: 'Hey there! 👋',
      timestamp: '2:30 PM',
      avatar: 'https://i.pravatar.cc/150?img=1',
      isOnline: true,
      user_id: 'contact-1',
      type: 'contact'
    },
    {
      id: 'contact-2',
      name: 'Sam Wilson',
      lastMessage: 'Available for collaboration',
      timestamp: 'Yesterday',
      avatar: 'https://i.pravatar.cc/150?img=2',
      isOnline: false,
      user_id: 'contact-2',
      type: 'contact'
    },
  ];

  const fetchUserSpaces = async () => {
    if (!user?.id || !token) return;

    try {
      const userSpaces = await collaborationService.fetchUserSpaces(user.id);

      // Get the unread counts from the store
      const { spaceUnreadCounts } = useCollaborationStore.getState();

      const spaceChats: Chat[] = userSpaces.map(space => ({
        id: space.id,
        name: space.title,
        lastMessage: getSpaceDescription(space),
        timestamp: formatTimestamp(space.updated_at || space.created_at),
        unreadCount: spaceUnreadCounts[space.id] || 0, // ✅ Use store's unread count
        avatar: space.creator?.profile_photo,
        isOnline: space.is_live,
        user_id: space.creator_id.toString(),
        type: 'space' as const,
        spaceData: space,
        conversationId: space.linked_conversation_id,
      }));

      // Sort by activity
      spaceChats.sort((a, b) => {
        if (a.spaceData?.is_live && !b.spaceData?.is_live) return -1;
        if (!a.spaceData?.is_live && b.spaceData?.is_live) return 1;
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });

      setSpaces(spaceChats);

      // Cache the result
      await offlineService.cacheUserSpaces(user.id, spaceChats);
    } catch (error) {
      console.error('Error fetching spaces:', error);
      // ... rest of error handling
    }
  };

  // ============ HELPER FUNCTIONS (DEFINE FIRST) ============

  const getSpaceDescription = (space: CollaborationSpace): string => {
    const descriptions: Record<string, string> = {
      chat: `💬 Chat with ${space.participants_count || 0} people`,
      whiteboard: `🎨 Whiteboard collaboration`,
      meeting: `📹 Meeting room`,
      document: `📄 Document collaboration`,
      brainstorm: `💡 Brainstorming session`,
      story: `📖 Collaborative story`,
      voice_channel: `🎤 Voice channel`,
    };

    return descriptions[space.space_type] || 'Collaboration space';
  };

  const formatTimestamp = (timestamp: string | Date): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  // These are at the bottom of your file - move them up too
  const getSpaceTypeIcon = (type: string): string => {
    const icons: Record<string, string> = {
      whiteboard: 'easel',
      meeting: 'videocam',
      document: 'document-text',
      brainstorm: 'bulb',
      voice_channel: 'mic',
      chat: 'chatbubbles',
      story: 'book',
    };
    return icons[type] || 'cube';
  };

  const getSpaceTypeColor = (type: string): string => {
    const colors: Record<string, string> = {
      whiteboard: '#4CAF50',
      meeting: '#FF6B6B',
      document: '#FFA726',
      brainstorm: '#9C27B0',
      voice_channel: '#3F51B5',
      chat: '#2196F3',
      story: '#E91E63',
    };
    return colors[type] || '#666';
  };

  // Enhanced filtered data with search results integration
  const filteredData = useMemo(() => {
    const query = searchQuery.toLowerCase();

    let filteredSpaces = spaces;
    let filteredChats = chats;
    let filteredContacts = contacts;

    if (query.trim()) {
      filteredSpaces = spaces.filter(item =>
        item.name.toLowerCase().includes(query) ||
        item.spaceData?.description?.toLowerCase().includes(query)
      );

      filteredChats = chats.filter(item =>
        item.name.toLowerCase().includes(query) ||
        item.lastMessage?.toLowerCase().includes(query)
      );

      filteredContacts = contacts.filter(item =>
        item.name.toLowerCase().includes(query) ||
        item.email?.toLowerCase().includes(query) ||
        item.username?.toLowerCase().includes(query)
      );
    }

    const sections: SectionData[] = [];

    // Add regular sections FIRST
    if (filteredSpaces.length > 0) {
      sections.push({
        title: '🎯 Collaboration Spaces',
        data: filteredSpaces,
        type: 'spaces'
      });
    }

    if (filteredChats.length > 0) {
      sections.push({
        title: '💬 Recent Chats',
        data: filteredChats,
        type: 'chats'
      });
    }

    if (filteredContacts.length > 0) {
      sections.push({
        title: '👥 Contacts',
        data: filteredContacts,
        type: 'contacts'
      });
    }

    // Add search results section LAST when there's a search
    if (searchQuery.trim() && searchResults.length > 0) {
      sections.push({
        title: 'All Search Results',
        data: searchResults.map(result => ({
          id: result.id,
          name: result.title,
          lastMessage: result.description,
          timestamp: result.timestamp || 'Just now',
          avatar: result.avatar,
          user_id: result.data?.id?.toString() || result.id,
          type: result.type as 'chat' | 'contact' | 'space',
          spaceData: result.type === 'space' ? result.data : undefined,
          isSearchResult: true,
          searchRelevance: result.relevance,
          searchType: result.type,
        })),
        type: 'search',
        isSearchSection: true,
      });
    }

    return sections;
  }, [searchQuery, chats, contacts, spaces, searchResults]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchChatsAndContacts(),
        fetchUserSpaces()
      ]);
      if (Platform.OS !== 'web') {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleCreateSpace = async (spaceType: CollaborationSpace['space_type']) => {
    // Show name input modal first
    setSelectedSpaceType(spaceType);
    setNewSpaceName(`New ${spaceType.charAt(0).toUpperCase() + spaceType.slice(1)}`);
    setShowSpaceNameInput(true);
  };

  // Add new function to actually create space after name input
  const confirmCreateSpace = async () => {
    if (!selectedSpaceType) return;

    const createSpaceOperation = async () => {
      try {
        const space = await collaborationService.createSpace({
          title: newSpaceName.trim() || `New ${selectedSpaceType.charAt(0).toUpperCase() + selectedSpaceType.slice(1)}`,
          space_type: selectedSpaceType,
          ai_personality: 'helpful',
          ai_capabilities: ['summarize', 'suggest'],
        });

        if (Platform.OS !== 'web') {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }

        // Add to spaces list
        const newSpaceChat: Chat = {
          id: space.id,
          name: space.title,
          lastMessage: getSpaceDescription(space),
          timestamp: 'Just now',
          unreadCount: 0,
          avatar: space.creator?.profile_photo,
          isOnline: true,
          user_id: space.creator_id.toString(),
          type: 'space',
          spaceData: space,
        };

        setSpaces(prev => [newSpaceChat, ...prev]);
        setShowSpaceTypes(false);
        setShowSpaceNameInput(false);
        setSelectedSpaceType(null);
        setNewSpaceName('');

        // Navigate to the new space
        router.push(`/(spaces)/${space.id}`);

      } catch (error) {
        console.error('Error creating space:', error);
        Alert.alert('Error', 'Failed to create space. Please try again.');
      }
    };

    if (offlineService.isConnected()) {
      await createSpaceOperation();
    } else {
      offlineService.queueOperation(createSpaceOperation);
      setShowSpaceNameInput(false);
      Alert.alert(
        'Offline Mode',
        'Space will be created when you reconnect to the internet.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setIsSearching(false);
    debouncedSearch.cancel();
    searchInputRef.current?.blur();
  };

  // Update search handler
  const handleSearch = async (query: string) => {
    setSearchQuery(query);

    if (!query.trim() || !user?.id) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    try {
      console.log('Searching for:', query);
      const results = await searchService.searchAll(query, user.id);
      console.log('Search results:', results.length);
      setSearchResults(results);

      // Cache results for offline use
      searchService.cacheSearchData(user.id, results);
    } catch (error) {
      console.error('Search error:', error);

      // Fallback to local search
      const allItems = [
        ...spaces.map(item => ({ ...item, type: 'space' })),
        ...chats.map(item => ({ ...item, type: 'chat' })),
        ...contacts.map(item => ({ ...item, type: 'contact' })),
      ];

      const localResults = await searchService.localSearch(query, allItems);
      setSearchResults(localResults);
    } finally {
      setIsSearching(false);
    }
  };

  // Search Result Row Component
  const SearchResultRow = ({ item, index }: {
    item: Chat;
    index: number;
  }) => {
    const getSearchIcon = (type: string) => {
      const icons: Record<string, string> = {
        space: 'cube',
        chat: 'chatbubbles',
        contact: 'person',
        message: 'document-text',
        post: 'newspaper',
      };
      return icons[type] || 'search';
    };

    const getSearchColor = (type: string) => {
      const colors: Record<string, string> = {
        space: '#007AFF',
        chat: '#4CAF50',
        contact: '#FF6B6B',
        message: '#FFA726',
        post: '#9C27B0',
      };
      return colors[type] || '#666';
    };

    const handlePress = () => {
      if (item.searchType === 'space') {
        router.push(`/(spaces)/${item.id}`);
      } else if (item.searchType === 'chat') {
        router.push(`/(tabs)/chats/${item.id}`);
      } else if (item.searchType === 'contact') {
        router.push({
          pathname: '/(tabs)/chats/[id]',
          params: { id: item.id, contact: JSON.stringify(item) }
        });
      }
      handleClearSearch();
    };

    return (
      <TouchableOpacity
        style={[
          styles.searchResultItem,
          index % 2 === 0 && styles.searchResultItemEven
        ]}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <View style={styles.searchResultContent}>
          <View style={[
            styles.searchResultIcon,
            { backgroundColor: `${getSearchColor(item.searchType || '')}15` }
          ]}>
            <Ionicons
              name={getSearchIcon(item.searchType || '')}
              size={20}
              color={getSearchColor(item.searchType || '')}
            />
          </View>

          <View style={styles.searchResultText}>
            <Text style={styles.searchResultTitle}>
              {item.name}
            </Text>
            {item.lastMessage && (
              <Text style={styles.searchResultDescription} numberOfLines={1}>
                {item.lastMessage}
              </Text>
            )}
            <View style={styles.searchResultMeta}>
              <Text style={styles.searchResultType}>
                {item.searchType?.charAt(0).toUpperCase() + item.searchType?.slice(1)}
              </Text>
              <View style={styles.relevanceBadge}>
                <Text style={styles.relevanceText}>
                  {Math.round((item.searchRelevance || 0) * 100)}% match
                </Text>
              </View>
            </View>
          </View>

          <Ionicons name="chevron-forward" size={20} color="#ccc" />
        </View>
      </TouchableOpacity>
    );
  };

  const handleSearchResultTap = (result: SearchResult) => {
    switch (result.type) {
      case 'space':
        router.push(`/(spaces)/${result.id}`);
        break;
      case 'chat':
        router.push(`/(tabs)/chats/${result.id}`);
        break;
      case 'contact':
        // Start chat with contact
        router.push({
          pathname: '/(tabs)/chats/[id]',
          params: { id: result.id, contact: JSON.stringify(result.data) }
        });
        break;
    }
    handleClearSearch();
  };

  // Render loading skeleton
  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <View style={styles.searchContainer}>
          <View style={[styles.searchInput, { backgroundColor: '#f0f0f0' }]} />
        </View>
        <ActivityIndicator size="large" color="#007AFF" style={styles.loading} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      {/* AI Suggestion */}
      {aiSuggestion && (
        <TouchableOpacity
          style={styles.aiSuggestionContainer}
          onPress={() => {
            Alert.alert('AI Suggestion', aiSuggestion);
          }}
        >
          <Ionicons name="sparkles" size={16} color="#FFD700" />
          <Text style={styles.aiSuggestionText} numberOfLines={1}>
            {aiSuggestion}
          </Text>
          <Ionicons name="chevron-forward" size={16} color="#666" />
        </TouchableOpacity>
      )}

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          ref={searchInputRef}
          style={styles.searchInput}
          placeholder="Search chats, spaces, contacts..."
          value={searchQuery}
          // onChangeText={debouncedSearch}
          onChangeText={handleSearch}
          clearButtonMode="while-editing"
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="default"
          autoFocus={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={handleClearSearch} style={styles.closeButton}>
            <Ionicons name="close-circle" size={22} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      {/* Search Loading Indicator */}
      {isSearching && (
        <View style={styles.searchingContainer}>
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={styles.searchingText}>Searching...</Text>
        </View>
      )}

      {/* Action Buttons Row */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionButton, styles.primaryAction]}
          onPress={() => setShowSpaceTypes(!showSpaceTypes)}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.actionButtonText}>Create Space</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => setShowCreativeGenerator(true)}
        >
          <Ionicons name="bulb" size={20} color="#007AFF" />
          <Text style={styles.actionButtonText}>Ideas</Text>
        </TouchableOpacity>

        {/* Activities Button with Badge */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => setShowActivities(true)}
        >
          <View style={styles.buttonIconContainer}>
            <Ionicons name="people" size={20} color="#007AFF" />
            {/* Badge for activities count */}
            {activitiesCount > 0 && (
              <View style={styles.badgeContainer}>
                <Text style={styles.badgeText}>
                  {activitiesCount > 99 ? '99+' : activitiesCount}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.actionButtonText}>Activities</Text>
        </TouchableOpacity>
      </View>

      {/* Space Type Selector */}
      {showSpaceTypes && (
        <Animated.View style={styles.spaceTypeSelector}>
          <Text style={styles.spaceTypeTitle}>Choose Space Type:</Text>
          <View style={styles.spaceTypeGrid}>
            {(['whiteboard', 'meeting', 'document', 'brainstorm', 'voice_channel', 'chat'] as const).map((type) => (
              <TouchableOpacity
                key={type}
                style={styles.spaceTypeOption}
                onPress={() => handleCreateSpace(type)}
              >
                <View style={[styles.spaceTypeIcon, { backgroundColor: getSpaceTypeColor(type) }]}>
                  <Ionicons name={getSpaceTypeIcon(type)} size={24} color="#fff" />
                </View>
                <Text style={styles.spaceTypeLabel}>
                  {type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => setShowSpaceTypes(false)}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Creative Generator Modal */}
      <Modal
        visible={showCreativeGenerator}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <CreativeGenerator
          spaceId={currentSpace?.id || 'global'}
          context={{ type: 'chat', chats, contacts, spaces }}
          onClose={() => setShowCreativeGenerator(false)}
        />
      </Modal>

      {/* Space Name Input Modal */}
      <Modal
        visible={showSpaceNameInput}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowSpaceNameInput(false);
          setSelectedSpaceType(null);
          setNewSpaceName('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.nameInputModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Name Your Space</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowSpaceNameInput(false);
                  setSelectedSpaceType(null);
                  setNewSpaceName('');
                }}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDescription}>
              Choose a name for your {selectedSpaceType} space
            </Text>

            <TextInput
              style={styles.nameInput}
              placeholder="Space name"
              value={newSpaceName}
              onChangeText={setNewSpaceName}
              autoFocus
              maxLength={50}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowSpaceNameInput(false);
                  setSelectedSpaceType(null);
                  setNewSpaceName('');
                }}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={confirmCreateSpace}
              >
                <Text style={styles.modalButtonTextConfirm}>Create Space</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Collaborative Activities Modal - ADD THIS */}
      <Modal
        visible={showActivities}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowActivities(false)}
      >
        <CollaborativeActivities
          spaces={spaces.map(s => s.spaceData).filter(Boolean)}
          activities={activities}
          activitiesCount={activitiesCount}
          onClose={() => setShowActivities(false)}
          onActivitySelect={(activity) => {
            // Navigate to the space containing this activity
            const space = spaces.find(s => s.spaceData?.id === activity.space_id);
            if (space) {
              router.push(`/(spaces)/${activity.space_id}?activity=${activity.id}`);
            } else {
              Alert.alert('Error', 'Could not find the space for this activity');
            }
          }}
        />
      </Modal>

      {/* Main List with Integrated Search Results */}
      <SectionList
        sections={filteredData}
        keyExtractor={(item, index) => `${item.type}-${item.id}-${index}-${item.isSearchResult ? 'search' : ''}`}
        renderItem={({ item, index, section }) => {
          // Render search results differently
          if (section.isSearchSection) {
            return (
              <SearchResultRow
                item={item}
                index={index}
              />
            );
          }

          // Regular rows
          return (
            <EnhancedChatRow
              {...item}
              index={index}
              onLongPress={() => {
                if (Platform.OS !== 'web') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }
                Alert.alert(
                  item.name,
                  `Type: ${item.type}\nLast activity: ${item.timestamp}`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'View', onPress: () => {
                        if (item.type === 'chat') {
                          router.push(`/(tabs)/chats/${item.id}`);
                        } else if (item.type === 'space') {
                          router.push(`/(spaces)/${item.id}`);
                        }
                      }
                    },
                    {
                      text: 'Message', onPress: () => {
                        // Start new conversation
                      }
                    }
                  ]
                );
              }}
            />

          );
        }}
        renderSectionHeader={({ section: { title, data, isSearchSection } }) => {
          if (data.length === 0) return null;

          // Special styling for search results section
          if (isSearchSection) {
            return (
              <View style={styles.searchSectionHeader}>
                <View style={styles.searchSectionHeaderContent}>
                  <Ionicons name="search" size={18} color="#007AFF" />
                  <Text style={styles.searchSectionHeaderText}>{title}</Text>
                  <TouchableOpacity
                    onPress={handleClearSearch}
                    style={styles.clearSearchButton}
                  >
                    <Text style={styles.clearSearchText}>Clear</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.searchSectionCount}>
                  {data.length} results • Tap to select
                </Text>
              </View>
            );
          }

          // Regular section headers
          return (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>{title}</Text>
              <Text style={styles.sectionCount}>{data.length}</Text>
            </View>
          );
        }}
        ItemSeparatorComponent={({ section }) => {
          // Different separator for search results
          if (section.isSearchSection) {
            return <View style={styles.searchSeparator} />;
          }
          return <View style={styles.separator} />;
        }}
        contentContainerStyle={styles.listContent}
        style={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#007AFF']}
            tintColor="#007AFF"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={80} color="#ddd" />
            <Text style={styles.emptyTitle}>No conversations yet</Text>
            <Text style={styles.emptySubtitle}>
              Start by creating a collaboration space or messaging a contact
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => setShowSpaceTypes(true)}
            >
              <Text style={styles.emptyButtonText}>Create Your First Space</Text>
            </TouchableOpacity>
          </View>
        }
        stickySectionHeadersEnabled={true}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          // Load more if needed
        }}
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  activitiesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
  },
  activitiesButtonText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  loading: {
    marginTop: 50,
  },
  aiSuggestionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F7FF',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1E8FF',
  },
  aiSuggestionText: {
    flex: 1,
    marginLeft: 8,
    marginRight: 8,
    fontSize: 14,
    color: '#1A73E8',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 8,
  },
  searchingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    height: '100%',
  },
  closeButton: {
    padding: 4,
  },

  // Search Section Header
  searchSectionHeader: {
    backgroundColor: '#f8f9ff',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e7ff',
  },
  searchSectionHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  searchSectionHeaderText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#007AFF',
    marginLeft: 8,
    flex: 1,
  },
  clearSearchButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#e0e7ff',
    borderRadius: 12,
  },
  clearSearchText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
  },
  searchSectionCount: {
    fontSize: 12,
    color: '#666',
  },

  // Search Result Item
  searchResultItem: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  searchResultItemEven: {
    backgroundColor: '#fafafa',
  },
  searchResultContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchResultIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  searchResultText: {
    flex: 1,
  },
  searchResultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  searchResultDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  searchResultMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchResultType: {
    fontSize: 12,
    color: '#999',
    marginRight: 8,
    textTransform: 'capitalize',
  },
  relevanceBadge: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  relevanceText: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
  },
  searchSeparator: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginLeft: 68,
  },

  actionRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  primaryAction: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  actionButtonText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  spaceTypeSelector: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
      }
    }),
  },
  spaceTypeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  spaceTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  spaceTypeOption: {
    width: '30%',
    alignItems: 'center',
    marginBottom: 12,
  },
  spaceTypeIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  spaceTypeLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  cancelButton: {
    marginTop: 8,
    padding: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  // loading: {
  //   marginTop: 100,
  // },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#666',
    letterSpacing: 0.5,
  },
  sectionCount: {
    fontSize: 13,
    color: '#999',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  separator: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginLeft: 72,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginTop: 24,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Old modal styles (kept for reference but not used in new design)
  searchResultsModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  searchResultsContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  searchResultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  searchResultsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  searchResultsList: {
    maxHeight: 400,
  },
  nameInputModal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  nameInput: {
    fontSize: 16,
    padding: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  modalInput: {
    fontSize: 16,
    padding: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalCancelButton: {
    backgroundColor: '#f0f0f0',
  },
  modalCancelButtonText: {
    color: '#333',
  },
  modalConfirmButton: {
    backgroundColor: '#007AFF',
  },
  modalConfirmButtonText: {
    color: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalHeaderCloseButton: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
});

export default ChatPage;