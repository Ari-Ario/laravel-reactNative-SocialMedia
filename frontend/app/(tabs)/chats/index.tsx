// app/(tabs)/chats/index.tsx
import { View, StyleSheet, ActivityIndicator, SectionList, TextInput, TouchableOpacity, Text } from "react-native";
import { router } from 'expo-router';
import { useState, useEffect, useContext, useMemo } from "react";
import AuthContext from "@/context/AuthContext";
import { usePostStore } from '@/stores/postStore';
import EnhancedChatRow from '@/components/ChatScreen/EnhancedChatRow';
import { Ionicons } from '@expo/vector-icons';
import CollaborationService, { CollaborationSpace } from '@/services/CollaborationService';
import * as Haptics from 'expo-haptics';
import { getToken } from "@/services/TokenService";
import getApiBase from "@/services/getApiBase";
import axios from '@/services/axios';

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
}

const ChatPage = () => {
    const { user } = useContext(AuthContext);
    const { posts } = usePostStore();
    const [chats, setChats] = useState<Chat[]>([]);
    const [contacts, setContacts] = useState<Chat[]>([]);
    const [spaces, setSpaces] = useState<Chat[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showSpaceTypes, setShowSpaceTypes] = useState(false);
    const token = getToken();
    const collaborationService = CollaborationService.getInstance();

    useEffect(() => {
        if (token) {
            collaborationService.setToken(token);
        }
    }, [token]);

    useEffect(() => {
        if (!user) {
            router.replace('/LoginScreen');
        } else { 
            console.log("User authenticated from Chats Index");
            fetchChatsAndContacts();
            fetchUserSpaces();
        }
    }, [user, posts]);

    // app/(tabs)/chats/index.tsx - UPDATED fetchChatsAndContacts method
    const fetchChatsAndContacts = async () => {
    setLoading(true);
    const API_BASE = getApiBase();
    
    try {
        // Try to fetch followers
        let followerContacts: Chat[] = [];
        
        try {
        const followersResponse = await axios.get(`${API_BASE}/followers`, {
            headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            },
        });
        
        console.log('Followers response:', followersResponse.data);
        
        // Transform followers to contacts
        followerContacts = followersResponse.data.map((follower: any) => {
            // follower could be either follower or following depending on your API
            const followerUser = follower.follower || follower.user || follower;
            
            return {
            id: followerUser.id.toString(),
            name: followerUser.name || 'Unknown User',
            lastMessage: 'Tap to start a conversation',
            timestamp: 'Recently active',
            avatar: followerUser.profile_photo,
            isOnline: followerUser.is_online || Math.random() > 0.5,
            user_id: followerUser.id.toString(),
            type: 'contact' as const,
            email: followerUser.email,
            username: followerUser.username,
            };
        });
        } catch (followerError) {
        console.log('Followers API not available, fetching following instead');
        
        // Try /following endpoint
        try {
            const followingResponse = await axios.get(`${API_BASE}/following`, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
            },
            });
            
            followerContacts = followingResponse.data.map((following: any) => ({
            id: following.id.toString(),
            name: following.name || 'Following User',
            lastMessage: 'Tap to start a conversation',
            timestamp: 'Recently active',
            avatar: following.profile_photo,
            isOnline: following.is_online || Math.random() > 0.5,
            user_id: following.id.toString(),
            type: 'contact' as const,
            email: following.email,
            username: following.username,
            }));
        } catch (followingError) {
            console.log('Both endpoints failed, using fallback');
            throw new Error('No follower endpoints available');
        }
        }
        
        // 2. Extract unique users from posts for chat conversations
        const uniqueUsers = new Map();
        
        posts.forEach(post => {
        if (post.user && post.user.id !== user?.id && post.is_following) {
            if (!uniqueUsers.has(post.user.id)) {
            uniqueUsers.set(post.user.id, {
                id: post.user.id.toString(),
                name: post.user.name,
                avatar: post.user.profile_photo,
                lastPost: post,
                postCount: 0
            });
            }
            const userData = uniqueUsers.get(post.user.id);
            userData.postCount++;
            if (new Date(post.created_at) > new Date(userData.lastPost.created_at || 0)) {
            userData.lastPost = post;
            }
        }
        });

        const chatConversations: Chat[] = Array.from(uniqueUsers.values()).map(userData => ({
        id: userData.id,
        name: userData.name,
        lastMessage: userData.lastPost.caption || 'Media shared',
        timestamp: formatTimestamp(userData.lastPost.created_at),
        unreadCount: Math.floor(Math.random() * 5),
        avatar: userData.avatar,
        isOnline: Math.random() > 0.3,
        isPinned: Math.random() > 0.8,
        user_id: userData.id,
        type: 'chat' as const,
        }));

        chatConversations.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        // 3. Set both chats and contacts
        setChats(chatConversations);
        setContacts(followerContacts);

    } catch (error) {
        console.error('Error fetching chats and contacts:', error);
        
        // For debugging, show what endpoints are available
        console.log('Available endpoints to try:');
        console.log('- /api/followers');
        console.log('- /api/following');
        console.log('- /api/users (might have follower data)');
        
        // Fallback 1: Try to get users from your existing API
        try {
        const usersResponse = await axios.get(`${API_BASE}/users`, {
            headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            },
        });
        
        if (usersResponse.data && Array.isArray(usersResponse.data)) {
            const userContacts: Chat[] = usersResponse.data.slice(0, 5).map((user: any) => ({
            id: user.id.toString(),
            name: user.name || 'User',
            lastMessage: 'Available for chat',
            timestamp: 'Recently active',
            avatar: user.profile_photo,
            isOnline: Math.random() > 0.5,
            user_id: user.id.toString(),
            type: 'contact' as const,
            email: user.email,
            username: user.username,
            }));
            
            setContacts(userContacts);
            console.log('Loaded contacts from /users endpoint');
        }
        } catch (userError) {
        // Final fallback to hardcoded contacts
        const fallbackContacts: Chat[] = [
            {
            id: 'contact-1',
            name: 'Alice Johnson',
            lastMessage: 'Hi there!',
            timestamp: '2:30 PM',
            avatar: 'https://via.placeholder.com/50',
            isOnline: true,
            user_id: 'contact-1',
            type: 'contact'
            },
            {
            id: 'contact-2',
            name: 'Bob Smith',
            lastMessage: 'Available for chat',
            timestamp: 'Yesterday',
            avatar: 'https://via.placeholder.com/50',
            isOnline: false,
            user_id: 'contact-2',
            type: 'contact'
            },
        ];
        
        setContacts(fallbackContacts);
        console.log('Using hardcoded fallback contacts');
        }
    } finally {
        setLoading(false);
        setRefreshing(false);
    }
    };

    const fetchUserSpaces = async () => {
        if (!user?.id) return;
        
        try {
            const userSpaces = await collaborationService.fetchUserSpaces(user.id);
            
            const spaceChats: Chat[] = userSpaces.map(space => ({
                id: space.id,
                name: space.title,
                lastMessage: getSpaceDescription(space),
                timestamp: formatTimestamp(space.updated_at || space.created_at),
                unreadCount: 0,
                avatar: space.creator?.profile_photo,
                isOnline: space.is_live,
                user_id: space.creator_id.toString(),
                type: 'space' as const,
                spaceData: space,
                conversationId: space.linked_conversation_id,
            }));
            
            setSpaces(spaceChats);
        } catch (error) {
            console.error('Error fetching spaces:', error);
        }
    };

    const getSpaceDescription = (space: CollaborationSpace): string => {
        const descriptions = {
            chat: 'Chat space',
            whiteboard: 'Whiteboard collaboration',
            meeting: 'Video meeting room',
            document: 'Document collaboration',
            brainstorm: 'Brainstorming session',
            story: 'Collaborative story',
            voice_channel: 'Voice channel',
        };
        
        return descriptions[space.space_type] || 'Collaboration space';
    };

    const formatTimestamp = (timestamp: string) => {
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

    const filteredData = useMemo(() => {
        const query = searchQuery.toLowerCase();
        
        let filteredSpaces = spaces;
        let filteredChats = chats;
        let filteredContacts = contacts;

        if (searchQuery.trim()) {
            filteredSpaces = spaces.filter(item =>
                item.name.toLowerCase().includes(query) ||
                item.spaceData?.description?.toLowerCase().includes(query)
            );
            
            filteredChats = chats.filter(item =>
                item.name.toLowerCase().includes(query) ||
                item.lastMessage?.toLowerCase().includes(query)
            );

            filteredContacts = contacts.filter(item =>
                item.name.toLowerCase().includes(query)
            );
        }

        const sections = [];
        
        if (filteredSpaces.length > 0) {
            sections.push({ 
                title: 'Collaboration Spaces', 
                data: filteredSpaces,
                type: 'spaces' 
            });
        }
        
        if (filteredChats.length > 0) {
            sections.push({ 
                title: 'Chats', 
                data: filteredChats,
                type: 'chats' 
            });
        }
        
        if (filteredContacts.length > 0) {
            sections.push({ 
                title: 'Contacts', 
                data: filteredContacts,
                type: 'contacts' 
            });
        }

        return sections;
    }, [searchQuery, chats, contacts, spaces]);

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([
            fetchChatsAndContacts(),
            fetchUserSpaces()
        ]);
        setRefreshing(false);
    };

    const handleCreateSpace = async (spaceType: string) => {
        try {
            const space = await collaborationService.createSpace({
                title: `New ${spaceType.charAt(0).toUpperCase() + spaceType.slice(1)}`,
                space_type: spaceType as any,
                ai_personality: 'helpful',
                ai_capabilities: ['summarize', 'suggest'],
            });
            
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            
            // Add to spaces list
            const newSpaceChat: Chat = {
                id: space.id,
                name: space.title,
                lastMessage: getSpaceDescription(space),
                timestamp: 'Just now',
                unreadCount: 0,
                user_id: space.creator_id.toString(),
                type: 'space',
                spaceData: space,
            };
            
            setSpaces(prev => [newSpaceChat, ...prev]);
            setShowSpaceTypes(false);
            
            // Navigate to the new space
            router.push(`/(spaces)/${space.id}`);
            
        } catch (error) {
            console.error('Error creating space:', error);
        }
    };

    if (!user) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color="#0000ff" />
            </View>
        );
    }

    if (loading && !refreshing) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color="#0000ff" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Search Header */}
            <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search chats, spaces, contacts..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    clearButtonMode="while-editing"
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                        <Ionicons
                            name="close-outline"
                            size={20}
                            color="#666"
                            style={styles.closeIcon}
                        />
                    </TouchableOpacity>
                )}
            </View>

            {/* Create Space Button */}
            <TouchableOpacity 
                style={styles.createSpaceButton}
                onPress={() => setShowSpaceTypes(!showSpaceTypes)}
            >
                <Ionicons name="add-circle" size={24} color="#007AFF" />
                <Text style={styles.createSpaceText}>Create Collaboration Space</Text>
            </TouchableOpacity>

            {/* Space Type Selector */}
            {showSpaceTypes && (
                <View style={styles.spaceTypeSelector}>
                    <TouchableOpacity 
                        style={styles.spaceTypeButton}
                        onPress={() => handleCreateSpace('whiteboard')}
                    >
                        <Ionicons name="easel-outline" size={24} color="#4CAF50" />
                        <Text style={styles.spaceTypeText}>Whiteboard</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                        style={styles.spaceTypeButton}
                        onPress={() => handleCreateSpace('meeting')}
                    >
                        <Ionicons name="videocam-outline" size={24} color="#FF6B6B" />
                        <Text style={styles.spaceTypeText}>Meeting</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                        style={styles.spaceTypeButton}
                        onPress={() => handleCreateSpace('document')}
                    >
                        <Ionicons name="document-text-outline" size={24} color="#FFA726" />
                        <Text style={styles.spaceTypeText}>Document</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                        style={styles.spaceTypeButton}
                        onPress={() => handleCreateSpace('brainstorm')}
                    >
                        <Ionicons name="bulb-outline" size={24} color="#9C27B0" />
                        <Text style={styles.spaceTypeText}>Brainstorm</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                        style={styles.spaceTypeButton}
                        onPress={() => handleCreateSpace('voice_channel')}
                    >
                        <Ionicons name="mic-outline" size={24} color="#3F51B5" />
                        <Text style={styles.spaceTypeText}>Voice Chat</Text>
                    </TouchableOpacity>
                </View>
            )}

            <SectionList
                sections={filteredData}
                keyExtractor={(item) => `${item.type}-${item.id}`}
                renderItem={({ item }) => (
                    <EnhancedChatRow {...item} />
                )}
                renderSectionHeader={({ section: { title, data, type } }) => {
                    if (data.length === 0) return null;
                    return (
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionHeaderText}>{title}</Text>
                            {type === 'spaces' && (
                                <Text style={styles.sectionCount}>{data.length} active</Text>
                            )}
                        </View>
                    );
                }}
                ItemSeparatorComponent={() => (
                    <View style={styles.separator} />
                )}
                contentContainerStyle={styles.listContent}
                style={styles.list}
                refreshing={refreshing}
                onRefresh={onRefresh}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="chatbubble-outline" size={64} color="#ccc" />
                        <Text style={styles.emptyTitle}>No conversations yet</Text>
                        <Text style={styles.emptySubtitle}>
                            Start collaborating by creating a space or messaging a contact
                        </Text>
                    </View>
                }
                stickySectionHeadersEnabled={false}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f0f0f0',
        margin: 16,
        marginBottom: 12,
        borderRadius: 10,
        paddingHorizontal: 12,
        height: 44,
    },
    searchIcon: {
        marginRight: 8,
    },
    closeIcon: {
        marginLeft: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        height: '100%',
    },
    createSpaceButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8f8f8',
        marginHorizontal: 16,
        marginBottom: 12,
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e0e0e0',
        borderStyle: 'dashed',
    },
    createSpaceText: {
        marginLeft: 12,
        fontSize: 16,
        color: '#007AFF',
        fontWeight: '500',
    },
    spaceTypeSelector: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: 16,
        marginBottom: 16,
        gap: 8,
    },
    spaceTypeButton: {
        flex: 1,
        minWidth: '30%',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#f8f8f8',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e0e0e0',
    },
    spaceTypeText: {
        marginTop: 4,
        fontSize: 12,
        color: '#333',
        textAlign: 'center',
    },
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
        backgroundColor: '#f8f8f8',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    sectionHeaderText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
        textTransform: 'uppercase',
    },
    sectionCount: {
        fontSize: 12,
        color: '#999',
    },
    separator: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: '#e0e0e0',
        marginLeft: 80,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 100,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
        marginTop: 16,
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        marginTop: 8,
        paddingHorizontal: 32,
    },
});

export default ChatPage;