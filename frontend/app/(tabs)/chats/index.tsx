// app/(tabs)/chats/index.tsx
import { View, StyleSheet, ActivityIndicator, FlatList, Text, SectionList, TextInput } from "react-native";
import { router } from 'expo-router';
import { useState, useEffect, useContext, useMemo } from "react";
import AuthContext from "@/context/AuthContext";
import { usePostStore } from '@/stores/postStore';
import ChatRow from '@/components/ChatScreen/ChatRow';
import { Ionicons } from '@expo/vector-icons';

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
  type: 'chat' | 'contact';
}

const ChatPage = () => {
    const { user } = useContext(AuthContext);
    const { posts } = usePostStore();
    const [chats, setChats] = useState<Chat[]>([]);
    const [contacts, setContacts] = useState<Chat[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (!user) {
            router.replace('/LoginScreen');
        } else { 
            console.log("User authenticated from Chats Index");
            fetchChatsAndContacts();
        }
    }, [user, posts]);

    const fetchChatsAndContacts = async () => {
        setLoading(true);
        
        try {
            // Extract unique users from posts to create chat conversations
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
            console.log(posts[0])

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
                type: 'chat'
            }));

            chatConversations.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

            const contactList: Chat[] = [
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
                    id: 'contact-4',
                    name: 'ARI ARIO',
                    lastMessage: 'Hey YOu!',
                    timestamp: '8:07 PM',
                    avatar: 'https://via.placeholder.com/50',
                    isOnline: true,
                    user_id: 'contact-4',
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
                {
                    id: 'contact-3',
                    name: 'Carol Williams',
                    lastMessage: 'Online now',
                    timestamp: '12:45 PM',
                    avatar: 'https://via.placeholder.com/50',
                    isOnline: true,
                    user_id: 'contact-3',
                    type: 'contact'
                }
            ];

            setChats(chatConversations);
            setContacts(contactList);

        } catch (error) {
            console.error('Error fetching chats:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
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
            return date.toLocaleDateString();
        }
    };

    const filteredData = useMemo(() => {
        if (!searchQuery.trim()) {
            return [
                { title: 'Chats', data: chats },
                { title: 'Contacts', data: contacts }
            ];
        }

        const query = searchQuery.toLowerCase();
        
        const filteredChats = chats.filter(item =>
            item.name.toLowerCase().includes(query) ||
            item.lastMessage?.toLowerCase().includes(query)
        );

        const filteredContacts = contacts.filter(item =>
            item.name.toLowerCase().includes(query)
        );

        return [
            { title: 'Chats', data: filteredChats },
            { title: 'Contacts', data: filteredContacts }
        ].filter(section => section.data.length > 0);
    }, [searchQuery, chats, contacts]);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchChatsAndContacts();
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
                    placeholder="Search..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    clearButtonMode="while-editing"
                />
                {searchQuery.length > 0 && (
                    <Ionicons
                        name="close-outline"
                        size={20}
                        color="#666"
                        style={styles.closeIcon}
                        onPress={() => setSearchQuery('')}
                        accessibilityLabel="Clear search"
                    />
                )}
            </View>

            <SectionList
                sections={filteredData}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <ChatRow {...item} />
                )}
                renderSectionHeader={({ section: { title, data } }) => (
                    data.length > 0 && (
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionHeaderText}>{title}</Text>
                        </View>
                    )
                )}
                ItemSeparatorComponent={() => (
                    <View style={styles.separator} />
                )}
                contentContainerStyle={styles.listContent}
                style={styles.list}
                refreshing={refreshing}
                onRefresh={onRefresh}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>
                            {searchQuery ? 'No results found' : 'No chats yet'}
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
        borderRadius: 10,
        paddingHorizontal: 12,
        height: 44,
    },
    searchIcon: {
        marginRight: 8,
    },
    closeIcon: {
        marginLeft: 8,
        alignSelf: 'center',
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        height: '100%',
    },
    list: {
        flex: 1,
    },
    listContent: {
        paddingBottom: 20,
    },
    sectionHeader: {
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
    emptyText: {
        fontSize: 16,
        color: '#666',
    },
});

export default ChatPage;