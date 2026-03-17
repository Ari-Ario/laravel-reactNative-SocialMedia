// app/(tabs)/chats/index.tsx
import React, { useState, useEffect, useContext, useMemo, useCallback, useRef } from "react";
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
import PusherService from '@/services/PusherService';

import { router, useFocusEffect } from 'expo-router';
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
import SpaceCreationModal from "@/components/ChatScreen/SpaceCreationModal";
import { useCollaborationStore } from "@/stores/collaborationStore";
import { createShadow } from "@/utils/styles";
import CreateTabModal from "@/components/ChatScreen/CreateTabModal";
import GenericMenu, { MenuItem } from '@/components/GenericMenu';
import { calculateAnchor, AnchorPosition } from '@/utils/layout';

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
  updatedAt: string;
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
  type: 'spaces' | 'contacts' | 'search';
  isSearchSection?: boolean;
}

// ============ HELPER FUNCTIONS (DEFINE OUTSIDE COMPONENT) ============

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

const ChatPage = () => {
  const notificationService = NotificationService.getInstance();
  const searchService = SearchService.getInstance();
  const realTimeService = RealTimeService.getInstance();
  const offlineService = OfflineService.getInstance();

  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const { user } = useContext(AuthContext);
  const { posts } = usePostStore();
  
  // ✅ Unified Space Store
  const { 
    spaces: storeSpaces, 
    spaceUnreadCounts, 
    fetchUserSpaces: fetchUserSpacesFromStore,
    customTabs, 
    createCustomTab, 
    deleteCustomTab, 
    renameCustomTab, 
    setSpacesInTab 
  } = useCollaborationStore();

  const [contacts, setContacts] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
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

  // New Unified Space Creation Flow State
  const [showSpaceCreationModal, setShowSpaceCreationModal] = useState(false);

  // Space Tabs state
  const [activeTab, setActiveTab] = useState<string>('all');

  // Custom Tab Modal State
  const [tabModalVisible, setTabModalVisible] = useState(false);
  const [tabModalMode, setTabModalMode] = useState<'create' | 'edit'>('create');
  const [tabModalStep, setTabModalStep] = useState<1 | 2>(1);
  const [editingTab, setEditingTab] = useState<any>(null);

  // Tab Context Menu State
  const [showTabMenu, setShowTabMenu] = useState(false);
  const [tabMenuPosition, setTabMenuPosition] = useState<AnchorPosition>();
  const [menuTargetTab, setMenuTargetTab] = useState<any>(null);

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

  // ✅ Map store spaces to Chat interface reactively
  const spaces = useMemo<Chat[]>(() => {
    return storeSpaces.map(space => {
      const isDirect = space.settings?.is_direct || space.space_type === 'direct';
      const otherUser = space.other_participant;

      let chatName = space.title || 'Direct Message';
      let chatAvatar = space.creator?.profile_photo || undefined;

      if (isDirect && otherUser) {
        chatName = otherUser.name || otherUser.username || chatName;
        chatAvatar = otherUser.profile_photo || chatAvatar;
      }

      const updatedAt = space.updated_at || space.created_at || new Date().toISOString();

      return {
        id: space.id,
        name: chatName,
        lastMessage: getSpaceDescription(space),
        timestamp: formatTimestamp(updatedAt),
        updatedAt: updatedAt,
        unreadCount: spaceUnreadCounts[space.id] || 0,
        avatar: chatAvatar,
        isOnline: isDirect && otherUser ? (otherUser as any).is_online ?? space.is_live : space.is_live,
        user_id: isDirect && otherUser ? otherUser.id?.toString() || '' : space.creator_id?.toString() || '',
        type: 'space' as const,
        spaceData: space,
        conversationId: space.linked_conversation_id,
        isPinned: space.my_permissions?.is_pinned || false,
        email: undefined,
        username: undefined,
      };
    }).sort((a, b) => {
      // 1. Pinned priority
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;

      // 2. Live priority
      if (a.spaceData?.is_live && !b.spaceData?.is_live) return -1;
      if (!a.spaceData?.is_live && b.spaceData?.is_live) return 1;

      // 3. Date-based sorting
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [storeSpaces, spaceUnreadCounts]);

  // Initialize real-time service (User channel only, rooms now handled by store)
  useEffect(() => {
    if (user?.id) {
      realTimeService.initialize(user.id);
      // NOTE: Room subscriptions and space_update events are now handled centrally 
      // by CollaborationStore and NotificationStore.
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
      const result = await collaborationService.fetchUserSpaces(Number(user.id));
      const userSpaces = result.spaces;

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
    if (!user?.id) return;

    try {
      const activeSpaces = spaces.filter(s => s.spaceData?.is_live).length;

      let suggestion = '';
      if (spaces.length === 0) {
        suggestion = 'Try creating your first collaboration space! Start with a brainstorming session.';
      } else if (activeSpaces === 0) {
        suggestion = 'You have no active spaces. Create a space to collaborate with multiple people at once.';
      }

      setAiSuggestion(suggestion || null);
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
      Alert.alert('Error', 'Failed to load contacts');

      // Set empty states
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
        updatedAt: new Date(0).toISOString(), // Contacts always at bottom
      };
    });
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
      type: 'contact',
      updatedAt: new Date(0).toISOString(),
    },
    {
      id: 'contact-2',
      name: 'Sam Wilson',
      lastMessage: 'Available for collaboration',
      timestamp: 'Yesterday',
      avatar: 'https://i.pravatar.cc/150?img=2',
      isOnline: false,
      user_id: 'contact-2',
      type: 'contact',
      updatedAt: new Date(0).toISOString(),
    },
  ];

  const fetchUserSpaces = async () => {
    if (!user?.id || !token) return;

    try {
      const result = await collaborationService.fetchUserSpaces(Number(user.id));
      const userSpaces = result.spaces;

      // Update the store with the fetched spaces
      useCollaborationStore.getState().setSpaces(userSpaces);

      // Store automatically sorts and updates
      console.log('🌐 Fetched spaces from store:', userSpaces.length);
      // Cache the raw spaces from store
      await offlineService.cacheUserSpaces(user.id, userSpaces);
    } catch (error) {
      console.error('Error fetching spaces:', error);
      // ... rest of error handling
    }
  };

  // Enhanced filtered data with search results integration
  const filteredData = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    // 1. Identify which contacts already have a direct space
    const directSpaceUserIds = new Set<string | number>(
      spaces
        .filter(s => s.spaceData?.other_participant?.id)
        .map(s => s.spaceData?.other_participant?.id!)
    );

    // 2. Filter contacts to exclude those already in a direct space
    const deduplicatedContacts = contacts.filter(c => {
      // Handle both string and number user_ids
      return !directSpaceUserIds.has(c.user_id) && !directSpaceUserIds.has(String(c.user_id));
    });

    // 3. Filtering by Tab
    let activeSpaces = spaces;

    switch (activeTab) {
      case 'all':
        // Show all non-archived spaces
        activeSpaces = spaces.filter(s => !s.spaceData?.my_permissions?.is_archived);
        break;
      case 'favorites':
        // Show only favorite spaces
        activeSpaces = spaces.filter(s => s.spaceData?.my_permissions?.is_favorite);
        break;
      case 'unread':
        // Show only unread spaces (either marked as unread or has new messages)
        activeSpaces = spaces.filter(s => s.unreadCount! > 0 || s.spaceData?.my_permissions?.is_unread);
        break;
      case 'archived':
        // Show only archived spaces
        activeSpaces = spaces.filter(s => s.spaceData?.my_permissions?.is_archived);
        break;
    }

    const customTab = customTabs.find(t => t.id === activeTab);
    if (customTab) {
      const filteredSpaces = spaces.filter(s => customTab.spaceIds.includes(s.id));
      const filteredContacts = contacts.filter(c => customTab.spaceIds.includes(c.id));
      activeSpaces = [...filteredSpaces, ...filteredContacts];
    }

    if (!query) {
      const sections: SectionData[] = [];
      if (activeSpaces.length > 0 || customTab) {
        let title = '🎯 Collaboration Spaces';
        if (activeTab === 'favorites') title = '❤️ Favorite Spaces';
        else if (activeTab === 'unread') title = '🔴 Unread Chats';
        else if (activeTab === 'archived') title = '📦 Archived Chats';
        else if (customTab) title = `📂 ${customTab.name}`;

        const data = activeSpaces.map(s => ({
          ...s,
          unreadCount: spaceUnreadCounts[s.id] || 0
        }));
        if (customTab) {
          data.push({
            id: 'add-to-tab',
            name: 'Add or Remove Items',
            type: 'space',
            timestamp: '',
            user_id: '',
          } as any);
        }

        sections.push({ title, data, type: 'spaces' });
      }

      // Only show contacts in the 'all' tab or when searching
      if (activeTab === 'all' && deduplicatedContacts.length > 0) {
        sections.push({ title: '👥 Contacts', data: deduplicatedContacts, type: 'contacts' });
      }
      return sections;
    }

    // When searching
    const localSpaces = activeSpaces.filter(item =>
      item.name.toLowerCase().includes(query) ||
      item.spaceData?.description?.toLowerCase().includes(query)
    );

    const localContacts = deduplicatedContacts.filter(item =>
      item.name.toLowerCase().includes(query) ||
      item.email?.toLowerCase().includes(query) ||
      item.username?.toLowerCase().includes(query)
    );

    const sections: SectionData[] = [];

    if (localSpaces.length > 0) {
      sections.push({ title: '🎯 Spaces in your list', data: localSpaces, type: 'spaces' });
    }

    if (localContacts.length > 0) {
      sections.push({ title: '👥 Contacts in your list', data: localContacts, type: 'contacts' });
    }

    // Filter global results to exclude those already in local lists
    const localIds = new Set([
      ...spaces.map(s => s.id),
      ...contacts.map(c => c.id),
      ...spaces.map(s => s.user_id),
      ...contacts.map(c => c.user_id)
    ]);

    const globalResults = searchResults.filter(result => !localIds.has(result.id) && !localIds.has(result.data?.id?.toString()));

    if (globalResults.length > 0) {
      sections.push({
        title: '🌍 Global Results',
        data: globalResults.map(result => ({
          id: result.id,
          name: result.title,
          lastMessage: result.description,
          timestamp: result.timestamp || 'Global User',
          avatar: result.avatar,
          user_id: result.data?.id?.toString() || result.id,
          type: result.type as 'chat' | 'contact' | 'space',
          spaceData: result.type === 'space' ? result.data : undefined,
          updatedAt: (result as any).updatedAt || new Date(0).toISOString(),
          isSearchResult: true,
          searchRelevance: result.relevance,
          searchType: result.type,
        })),
        type: 'search',
        isSearchSection: true,
      });
    }

    return sections;
  }, [searchQuery, contacts, spaces, searchResults, activeTab, customTabs, spaceUnreadCounts]);

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

  const handleCreateSpaceFlow = () => {
    setShowSpaceCreationModal(true);
  };

  const onSpaceCreated = (newSpace: CollaborationSpace) => {
    // Navigate to the newly created space
    router.push(`/(spaces)/${newSpace.id}`);
    onRefresh(); // Refresh the list in the background
  };

  // Calculate counts for badges
  const unreadCount = useMemo(() => spaces.filter(s => (spaceUnreadCounts[s.id] || 0) > 0 || s.spaceData?.my_permissions?.is_unread).length, [spaces, spaceUnreadCounts]);
  const favoritesCount = useMemo(() => spaces.filter(s => s.spaceData?.my_permissions?.is_favorite).length, [spaces]);
  const archivedCount = useMemo(() => spaces.filter(s => s.spaceData?.my_permissions?.is_archived).length, [spaces]);

  const SpaceTabsToolbar = () => (
    <View style={styles.tabsWrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsContainer}
      >
        <TouchableOpacity
          style={[styles.tab, activeTab === 'all' && styles.activeTab]}
          onPress={() => {
            setActiveTab('all');
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
        >
          <Text style={[styles.tabText, activeTab === 'all' && styles.activeTabText]}>All</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'favorites' && styles.activeTab]}
          onPress={() => {
            setActiveTab('favorites');
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
        >
          <View style={styles.tabContentWithIcon}>
            <Ionicons name="heart" size={14} color={activeTab === 'favorites' ? '#fff' : '#667781'} style={styles.tabIcon} />
            <Text style={[styles.tabText, activeTab === 'favorites' && styles.activeTabText]}>Favorites</Text>
          </View>
          {favoritesCount > 0 && activeTab !== 'favorites' && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{favoritesCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'unread' && styles.activeTab]}
          onPress={() => {
            setActiveTab('unread');
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
        >
          <Text style={[styles.tabText, activeTab === 'unread' && styles.activeTabText]}>Unread</Text>
          {unreadCount > 0 && (
            <View style={[styles.tabBadge, { backgroundColor: '#25D366' }]}>
              <Text style={styles.tabBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'archived' && styles.activeTab]}
          onPress={() => {
            setActiveTab('archived');
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
        >
          <Text style={[styles.tabText, activeTab === 'archived' && styles.activeTabText]}>Archived</Text>
          {archivedCount > 0 && (
            <View style={[styles.tabBadge, { backgroundColor: '#667781' }]}>
              <Text style={styles.tabBadgeText}>{archivedCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        {customTabs.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.activeTab]}
            onPress={() => {
              setActiveTab(tab.id);
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            onLongPress={(e) => {
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

              const { pageX, pageY } = e.nativeEvent;
              // Use 40/40 as approximate trigger size or just center on touch
              const position = calculateAnchor(pageX - 20, pageY - 20, 40, 40, 220);
              setTabMenuPosition(position);
              setMenuTargetTab(tab);
              setShowTabMenu(true);
            }}
          >
            <Text style={[styles.tabText, activeTab === tab.id && styles.activeTabText]}>{tab.name}</Text>
            {tab.spaceIds.length > 0 && (
              <View style={[styles.tabBadge, { backgroundColor: '#007AFF' }]}>
                <Text style={styles.tabBadgeText}>{tab.spaceIds.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={styles.addTabButton}
          onPress={() => {
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setTabModalMode('create');
            setTabModalStep(1);
            setEditingTab(null);
            setTabModalVisible(true);
          }}
        >
          <Ionicons name="add" size={20} color="#007AFF" />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

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
      const allItems: Chat[] = [
        ...spaces,
        ...contacts,
      ];

      // Basic matching logic
      const matchesQuery = (text?: string) => text?.toLowerCase().includes(query.toLowerCase());

      const localResults = allItems.filter(item =>
        matchesQuery(item.name) ||
        matchesQuery(item.lastMessage) ||
        (item.username && matchesQuery(item.username)) ||
        (item.email && matchesQuery(item.email))
      ).map(item => ({
        ...item,
        isSearchResult: true,
        searchRelevance: 0, // Simplified for fallback
        searchType: item.type === 'space' ? 'space' : 'contact' // Cast to match SearchResult type
      })) as unknown as SearchResult[];

      setSearchResults(localResults);
    } finally {
      setIsSearching(false);
    }
  };

  // Search Result Row Component (Memoized for performance)
  const SearchResultRow = React.memo(({ item, index }: {
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

    const handlePress = async () => {
      if (item.searchType === 'space') {
        router.push(`/(spaces)/${item.id}`);
      } else if (item.searchType === 'chat') {
        router.push(`/(spaces)/${item.id}`);
      } else if (item.searchType === 'contact') {
        try {
          // Add loading state ideally, but instant request should be fast
          const space = await CollaborationService.getInstance().getOrCreateDirectSpace(item.id);
          if (space && space.id) {
            router.push(`/(spaces)/${space.id}`);
          }
        } catch (error) {
          console.error('Failed to create or fetch direct space from search:', error);
          Alert.alert('Error', 'Could not start chat with this contact.');
        }
      }
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
              name={getSearchIcon(item.searchType || '') as any}
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
                {item.searchType ? item.searchType.charAt(0).toUpperCase() + item.searchType.slice(1) : ''}
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
  }, (prevProps, nextProps) => {
    return prevProps.item.id === nextProps.item.id && prevProps.item.timestamp === nextProps.item.timestamp;
  });

  const handleSearchResultTap = async (result: SearchResult) => {
    switch (result.type) {
      case 'space':
        router.push(`/(spaces)/${result.id}`);
        break;
      case 'chat':
        router.push(`/(spaces)/${result.id}`);
        break;
      case 'contact':
        try {
          const space = await CollaborationService.getInstance().getOrCreateDirectSpace(result.id);
          if (space && space.id) {
            router.push(`/(spaces)/${space.id}`);
          }
        } catch (error) {
          console.error('Failed to create or fetch direct space from search:', error);
          Alert.alert('Error', 'Could not start chat with this contact.');
        }
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
          onPress={handleCreateSpaceFlow}
        >
          <Ionicons name="create-outline" size={20} color="#fff" />
          <Text style={styles.actionButtonText}>New Chat</Text>
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
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="people" size={20} color="#007AFF" />
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

      <SpaceTabsToolbar />

      <Modal
        visible={showCreativeGenerator}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <CreativeGenerator
          spaceId={currentSpace?.id || 'global'}
          context={{ type: 'chat', contacts, spaces }}
          onClose={() => setShowCreativeGenerator(false)}
        />
      </Modal>

      {/* Unified Space Creation Modal */}
      <SpaceCreationModal
        visible={showSpaceCreationModal}
        onClose={() => setShowSpaceCreationModal(false)}
        contacts={contacts}
        onSpaceCreated={onSpaceCreated}
      />

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

          // Extra row for adding spaces to custom tab if empty or just because
          if (item.id === 'add-to-tab') {
            return (
              <TouchableOpacity
                style={styles.addSpaceRow}
                onPress={() => {
                  const currentCustomTab = customTabs.find(t => t.id === activeTab);
                  if (currentCustomTab) {
                    setTabModalMode('edit');
                    setTabModalStep(2);
                    setEditingTab(currentCustomTab);
                    setTabModalVisible(true);
                  }
                }}
              >
                <View style={styles.addSpaceIconContainer}>
                  <Ionicons name="add" size={24} color="#007AFF" />
                </View>
                <Text style={styles.addSpaceText}>Add or Remove Spaces</Text>
              </TouchableOpacity>
            );
          }

          // Regular rows
          return (
            <EnhancedChatRow
              {...item}
              onLeave={(leftId) => {
                useCollaborationStore.getState().removeSpace(leftId);
              }}
              onDelete={(deletedId) => {
                useCollaborationStore.getState().removeSpace(deletedId);
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
              Start by creating a space or messaging a contact
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={handleCreateSpaceFlow}
            >
              <Text style={styles.emptyButtonText}>Start Chatting</Text>
            </TouchableOpacity>
          </View>
        }
        stickySectionHeadersEnabled={true}
        onEndReachedThreshold={0.5}
        initialNumToRender={10}
        windowSize={5}
        maxToRenderPerBatch={10}
        removeClippedSubviews={Platform.OS === 'android'}
      />
      <CreateTabModal
        visible={tabModalVisible}
        onClose={() => setTabModalVisible(false)}
        mode={tabModalMode}
        initialStep={tabModalStep}
        initialData={editingTab}
        allSpaces={[...spaces, ...contacts]}
        onSave={(data) => {
          if (tabModalMode === 'create') {
            createCustomTab(data.name, data.spaceIds);
          } else if (data.id) {
            renameCustomTab(data.id, data.name);
            setSpacesInTab(data.id, data.spaceIds);
          }
        }}
      />

      <GenericMenu
        visible={showTabMenu}
        onClose={() => setShowTabMenu(false)}
        anchorPosition={tabMenuPosition}
        items={[
          {
            icon: 'pencil',
            label: 'Rename Tab',
            onPress: () => {
              setTabModalMode('edit');
              setTabModalStep(1);
              setEditingTab(menuTargetTab);
              setTabModalVisible(true);
            }
          },
          {
            icon: 'list',
            label: 'Edit Items',
            onPress: () => {
              setTabModalMode('edit');
              setTabModalStep(2);
              setEditingTab(menuTargetTab);
              setTabModalVisible(true);
            }
          },
          {
            icon: 'trash',
            label: 'Delete Tab',
            destructive: true,
            onPress: () => {
              const tabToDelete = menuTargetTab;
              if (tabToDelete) {
                const performDelete = () => {
                  deleteCustomTab(tabToDelete.id);
                  if (activeTab === tabToDelete.id) {
                    setActiveTab('all');
                  }
                };

                if (Platform.OS === 'web') {
                  if (window.confirm(`Are you sure you want to delete "${tabToDelete.name}"?`)) {
                    performDelete();
                  }
                } else {
                  Alert.alert(
                    'Delete Tab',
                    `Are you sure you want to delete "${tabToDelete.name}"?`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: performDelete
                      }
                    ]
                  );
                }
              }
            }
          }
        ]}
      />

      {showSpaceCreationModal && (
        <SpaceCreationModal
          visible={showSpaceCreationModal}
          onClose={() => setShowSpaceCreationModal(false)}
          contacts={contacts}
          onSpaceCreated={onSpaceCreated}
        />
      )}
    </Animated.View >
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F2F5',
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
  badgeContainer: {
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    position: 'absolute',
    top: -8,
    right: -10,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
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
  tabsWrapper: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E9EDEF',
    paddingVertical: 10,
  },
  tabsContainer: {
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 8,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F0F2F5',
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#007AFF',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#667781',
  },
  activeTabText: {
    color: '#fff',
  },
  tabContentWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabIcon: {
    marginRight: 4,
  },
  tabBadge: {
    marginLeft: 6,
    backgroundColor: '#007AFF',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  addTabButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F2F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
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
    ...createShadow({
      width: 0,
      height: 2,
      opacity: 0.1,
      radius: 8,
      elevation: 4,
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
    backgroundColor: '#F0F2F5',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#667781',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
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
    backgroundColor: '#E9EDEF',
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
  addSpaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F5',
  },
  addSpaceIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E7F3FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  addSpaceText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
});

export default ChatPage;