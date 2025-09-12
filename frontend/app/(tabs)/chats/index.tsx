// app/(tabs)/chats/index.tsx
import { View, StyleSheet, ActivityIndicator, FlatList, Text, SectionList } from "react-native";
import { router } from 'expo-router';
import { useState, useEffect, useContext } from "react";
import AuthContext from "@/context/AuthContext";
import { usePostStore } from '@/stores/postStore';
import { usePostListService } from '@/services/PostListService';
import ChatRow from '@/components/ChatScreen/ChatRow';
import ContactRow from '@/components/ChatScreen/ContactRow';

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

    // Redirect effect - handles both initial load and logout cases
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
                if (post.user && post.user.id !== user?.id) {
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
                    // Keep the latest post
                    if (new Date(post.created_at) > new Date(userData.lastPost.created_at || 0)) {
                        userData.lastPost = post;
                    }
                }
            });

            // Convert to chat format
            const chatConversations: Chat[] = Array.from(uniqueUsers.values()).map(userData => ({
                id: userData.id,
                name: userData.name,
                lastMessage: userData.lastPost.caption || 'Media shared',
                timestamp: formatTimestamp(userData.lastPost.created_at),
                unreadCount: Math.floor(Math.random() * 5), // Random unread count for demo
                avatar: userData.avatar,
                isOnline: Math.random() > 0.3, // Random online status
                isPinned: Math.random() > 0.8, // Random pinned status
                user_id: userData.id,
                type: 'chat'
            }));

            // Sort by timestamp (most recent first)
            chatConversations.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

            // Create contacts list (could be from your actual contacts API)
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

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchChatsAndContacts();
    };

    // Show nothing or loading indicator while checking authentication
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

    const sections = [
        {
            title: 'Chats',
            data: chats,
        },
        {
            title: 'Contacts',
            data: contacts,
        }
    ];

    return (
        <View style={styles.container}>
            <SectionList
                sections={sections}
                keyExtractor={(item) => item.id}
                renderItem={({ item, section }) => (
                    section.title === 'Chats' ? (
                        <ChatRow {...item} />
                    ) : (
                        <ContactRow {...item} />
                    )
                )}
                renderSectionHeader={({ section: { title } }) => (
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionHeaderText}>{title}</Text>
                    </View>
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
                        <Text style={styles.emptyText}>No chats yet</Text>
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
    list: {
        flex: 1,
        width: '100%',
    },
    listContent: {
        paddingBottom: 20,
        backgroundColor: '#fff',
        flexGrow: 1
    },
    separator: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: '#e0e0e0',
        marginLeft: 80,
        marginRight: 16,
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
    sectionHeader: {
        backgroundColor: '#f8f8f8',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    sectionHeaderText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
        textTransform: 'uppercase',
    },
});

export default ChatPage;