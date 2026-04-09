// app/(settings)/BroadcastListsScreen.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    StatusBar,
    FlatList,
    Dimensions,
    Animated,
    TextInput,
    Modal,
    Alert,
    Platform,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MotiView, AnimatePresence } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createShadow } from '@/utils/styles';
import { fetchFullSettings, updatePreferences } from '@/services/SettingService';

const { width } = Dimensions.get('window');

interface BroadcastList {
    id: string;
    name: string;
    members: number;
    lastActive: string;
    avatar?: string;
    color?: string;
}

const BroadcastCard = ({ item, index, onPress, onLongPress }: { item: BroadcastList; index: number; onPress: () => void; onLongPress?: () => void }) => {
    const [isHovered, setIsHovered] = useState(false);
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
        Animated.spring(scaleAnim, { toValue: 0.98, useNativeDriver: true, friction: 5 }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 5 }).start();
    };

    const colors = ['#1063FD', '#4CAF50', '#FF9800', '#9C27B0', '#F44336'];
    const bgColor = item.color || colors[index % colors.length];

    return (
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={onPress}
                onLongPress={onLongPress}
                delayLongPress={400}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                <LinearGradient
                    colors={isHovered ? ['#fff', '#f8f9fa'] : ['#fff', '#fff']}
                    style={styles.broadcastCard}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                >
                    <View style={styles.broadcastContent}>
                        <View style={[styles.broadcastIcon, { backgroundColor: bgColor + '15' }]}>
                            <LinearGradient
                                colors={[bgColor, bgColor + '80']}
                                style={styles.iconGradient}
                            >
                                <Ionicons name="megaphone" size={24} color="#fff" />
                            </LinearGradient>
                        </View>
                        <View style={styles.broadcastInfo}>
                            <Text style={styles.broadcastName}>{item.name}</Text>
                            <View style={styles.broadcastMetaRow}>
                                <View style={styles.metaBadge}>
                                    <Ionicons name="people" size={10} color="#666" />
                                    <Text style={styles.metaText}>{item.members} members</Text>
                                </View>
                                <View style={styles.metaDot} />
                                <View style={styles.metaBadge}>
                                    <Ionicons name="time" size={10} color="#666" />
                                    <Text style={styles.metaText}>Active {item.lastActive}</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                    <View style={styles.broadcastAction}>
                        <Ionicons name="chevron-forward" size={18} color="rgba(0,0,0,0.3)" />
                    </View>
                </LinearGradient>
            </TouchableOpacity>
        </Animated.View>
    );
};

export default function BroadcastListsScreen() {
    const insets = useSafeAreaInsets();
    const [lists, setLists] = useState<BroadcastList[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newListName, setNewListName] = useState('');
    const scrollY = useRef(new Animated.Value(0)).current;

    useEffect(() => { loadLists(); }, []);

    const getSynergyTraits = async () => {
        const data = await fetchFullSettings();
        return data.preferences?.synergy_traits || {};
    };

    const loadLists = async () => {
        try {
            setLoading(true);
            const traits = await getSynergyTraits();
            const savedLists = traits.broadcast_lists || [];
            setLists(savedLists.length > 0 ? savedLists : [
                { id: '1', name: 'Major Announcements', members: 0, lastActive: 'Just now', color: '#1063FD' },
            ]);
        } catch (error) {
            console.error('Failed to load broadcast lists:', error);
        } finally {
            setLoading(false);
        }
    };

    const saveLists = async (updatedLists: BroadcastList[]) => {
        try {
            const traits = await getSynergyTraits();
            await updatePreferences({ synergy_traits: { ...traits, broadcast_lists: updatedLists } });
        } catch (error) {
            Alert.alert('Error', 'Failed to save broadcast list.');
        }
    };

    const handleCreateList = async () => {
        if (newListName.trim()) {
            const newList: BroadcastList = {
                id: Date.now().toString(),
                name: newListName,
                members: 0,
                lastActive: 'Just now',
                color: ['#1063FD', '#4CAF50', '#FF9800', '#9C27B0', '#F44336'][Math.floor(Math.random() * 5)],
            };
            const updatedLists = [newList, ...lists];
            setLists(updatedLists);
            setNewListName('');
            setShowCreateModal(false);
            await saveLists(updatedLists);
        }
    };

    const handleDeleteList = (id: string) => {
        const isWeb = Platform.OS === 'web';
        const confirm = async () => {
            const updatedLists = lists.filter(l => l.id !== id);
            setLists(updatedLists);
            await saveLists(updatedLists);
        };
        if (isWeb) {
            if (window.confirm('Delete this broadcast list?')) confirm();
        } else {
            Alert.alert('Delete List', 'Remove this broadcast list?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: confirm }
            ]);
        }
    };

    const headerOpacity = scrollY.interpolate({
        inputRange: [0, 100],
        outputRange: [1, 0.9],
        extrapolate: 'clamp',
    });

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />

            <LinearGradient
                colors={['#fff', '#f8f9fa']}
                style={[styles.header, { paddingTop: insets.top + 10 }]}
            >
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Broadcast Hub</Text>
                <TouchableOpacity onPress={() => setShowCreateModal(true)} style={styles.createHeaderButton}>
                    <Ionicons name="add" size={24} color="#1063FD" />
                </TouchableOpacity>
            </LinearGradient>

            <Animated.ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                    { useNativeDriver: false }
                )}
                scrollEventThrottle={16}
            >
                <MotiView
                    from={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring' }}
                >
                    {/* Hero Section */}
                    <LinearGradient
                        colors={['#1063FD', '#0050CC']}
                        style={styles.heroSection}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <View style={styles.heroIconContainer}>
                            <View style={styles.heroIcon}>
                                <Ionicons name="radio-outline" size={32} color="#fff" />
                            </View>
                        </View>
                        <Text style={styles.heroTitle}>Reach Everyone at Once</Text>
                        <Text style={styles.heroDescription}>
                            Create broadcast lists to send messages to multiple contacts without creating a group chat.
                            Perfect for announcements and updates.
                        </Text>
                        <TouchableOpacity
                            style={styles.createButton}
                            onPress={() => setShowCreateModal(true)}
                        >
                            <LinearGradient
                                colors={['#fff', '#f0f0f0']}
                                style={styles.createButtonGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                            >
                                <Ionicons name="add" size={22} color="#1063FD" />
                                <Text style={styles.createButtonText}>New Broadcast List</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </LinearGradient>

                    {/* Stats Section */}
                    <View style={styles.statsContainer}>
                        <View style={styles.statCard}>
                            <Text style={styles.statNumber}>{lists.length}</Text>
                            <Text style={styles.statLabel}>Active Lists</Text>
                        </View>
                        <View style={styles.statCard}>
                            <Text style={styles.statNumber}>
                                {lists.reduce((sum, list) => sum + list.members, 0)}
                            </Text>
                            <Text style={styles.statLabel}>Total Members</Text>
                        </View>
                        <View style={styles.statCard}>
                            <Text style={styles.statNumber}>
                                {lists.filter(l => l.lastActive === 'Just now' || l.lastActive === '2h ago').length}
                            </Text>
                            <Text style={styles.statLabel}>Active Today</Text>
                        </View>
                    </View>

                    {/* Lists Section */}
                    <View style={styles.listsHeader}>
                        <Text style={styles.sectionTitle}>Your Broadcast Lists</Text>
                        <TouchableOpacity onPress={() => setShowCreateModal(true)}>
                            <Text style={styles.viewAllText}>Create New</Text>
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <View style={{ alignItems: 'center', paddingVertical: 30 }}>
                            <ActivityIndicator size="large" color="#1063FD" />
                            <Text style={{ marginTop: 12, color: '#666', fontSize: 13 }}>Loading your lists...</Text>
                        </View>
                    ) : lists.length === 0 ? (
                        <MotiView
                            from={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            style={styles.emptyContainer}
                        >
                            <View style={styles.emptyIcon}>
                                <Ionicons name="megaphone" size={48} color="rgba(0,0,0,0.2)" />
                            </View>
                            <Text style={styles.emptyTitle}>No broadcast lists yet</Text>
                            <Text style={styles.emptyText}>
                                Create your first broadcast list to start sending announcements
                            </Text>
                        </MotiView>
                    ) : (
                        <FlatList
                            data={lists}
                            keyExtractor={(item) => item.id}
                            renderItem={({ item, index }) => (
                                <BroadcastCard
                                    item={item}
                                    index={index}
                                    onPress={() => Alert.alert(item.name, 'Broadcast list detail coming soon!')}
                                    onLongPress={() => handleDeleteList(item.id)}
                                />
                            )}
                            scrollEnabled={false}
                            contentContainerStyle={styles.listContainer}
                        />
                    )}

                    {/* Tips Section */}
                    <View style={styles.tipsSection}>
                        <Text style={styles.tipsTitle}>💡 Pro Tips</Text>
                        <View style={styles.tipItem}>
                            <View style={styles.tipIcon}>
                                <Ionicons name="bulb" size={14} color="#FF9800" />
                            </View>
                            <Text style={styles.tipText}>Lists are private - members don't see each other</Text>
                        </View>
                        <View style={styles.tipItem}>
                            <View style={styles.tipIcon}>
                                <Ionicons name="trending-up" size={14} color="#4CAF50" />
                            </View>
                            <Text style={styles.tipText}>Track engagement metrics for each broadcast</Text>
                        </View>
                        <View style={styles.tipItem}>
                            <View style={styles.tipIcon}>
                                <Ionicons name="time" size={14} color="#1063FD" />
                            </View>
                            <Text style={styles.tipText}>Schedule broadcasts for optimal timing</Text>
                        </View>
                    </View>
                </MotiView>
            </Animated.ScrollView>

            {/* Create List Modal */}
            <Modal
                visible={showCreateModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowCreateModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <MotiView
                        from={{ opacity: 0, scale: 0.9, translateY: 50 }}
                        animate={{ opacity: 1, scale: 1, translateY: 0 }}
                        transition={{ type: 'spring', damping: 20 }}
                        style={styles.modalContainer}
                    >
                        <LinearGradient
                            colors={['#fff', '#f8f9fa']}
                            style={styles.modalContent}
                        >
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Create Broadcast List</Text>
                                <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                                    <Ionicons name="close" size={24} color="#000" />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.modalBody}>
                                <Text style={styles.inputLabel}>List Name</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g., Weekly Updates, Announcements"
                                    placeholderTextColor="#999"
                                    value={newListName}
                                    onChangeText={setNewListName}
                                    autoFocus
                                />

                                <View style={styles.modalPreview}>
                                    <Text style={styles.previewLabel}>Preview</Text>
                                    <View style={styles.previewCard}>
                                        <Ionicons name="megaphone" size={20} color="#1063FD" />
                                        <Text style={styles.previewName}>
                                            {newListName || 'New Broadcast List'}
                                        </Text>
                                    </View>
                                </View>

                                <TouchableOpacity
                                    style={[styles.modalCreateButton, !newListName.trim() && styles.modalCreateDisabled]}
                                    onPress={handleCreateList}
                                    disabled={!newListName.trim()}
                                >
                                    <LinearGradient
                                        colors={newListName.trim() ? ['#1063FD', '#0050CC'] : ['#ccc', '#ccc']}
                                        style={styles.modalCreateGradient}
                                    >
                                        <Text style={styles.modalCreateText}>Create List</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        </LinearGradient>
                    </MotiView>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    headerTitle: { fontSize: 22, fontWeight: '800', color: '#1a1a1a' },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F5F5F7',
        justifyContent: 'center',
        alignItems: 'center',
    },
    createHeaderButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F5F5F7',
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 100 },
    heroSection: {
        borderRadius: 30,
        padding: 28,
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 20,
        ...createShadow({ opacity: 0.2, height: 8, radius: 16 }),
    },
    heroIconContainer: {
        marginBottom: 16,
    },
    heroIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    heroTitle: {
        fontSize: 22,
        fontWeight: '900',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 8,
    },
    heroDescription: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
        textAlign: 'center',
        marginTop: 8,
        lineHeight: 20,
        paddingHorizontal: 10,
        marginBottom: 20,
    },
    createButton: {
        borderRadius: 25,
        overflow: 'hidden',
        ...createShadow({ opacity: 0.3, height: 4, radius: 8 }),
    },
    createButtonGradient: {
        flexDirection: 'row',
        paddingHorizontal: 24,
        paddingVertical: 12,
        alignItems: 'center',
        gap: 8,
    },
    createButtonText: {
        fontSize: 15,
        fontWeight: '800',
        color: '#1063FD'
    },
    statsContainer: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 24,
    },
    statCard: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e5e5e5',
        ...createShadow({ opacity: 0.05, radius: 8 }),
    },
    statNumber: {
        fontSize: 24,
        fontWeight: '800',
        color: '#1a1a1a',
    },
    statLabel: {
        fontSize: 11,
        color: '#666',
        marginTop: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    listsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: '#1063FD',
        textTransform: 'uppercase',
        letterSpacing: 1.5,
    },
    viewAllText: {
        fontSize: 13,
        color: '#1063FD',
        fontWeight: '600',
    },
    listContainer: {
        paddingBottom: 20,
    },
    broadcastCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderRadius: 20,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#e5e5e5',
        ...createShadow({ opacity: 0.05, radius: 8 }),
    },
    broadcastContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    broadcastIcon: {
        width: 52,
        height: 52,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
        overflow: 'hidden',
    },
    iconGradient: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    broadcastInfo: {
        flex: 1,
    },
    broadcastName: {
        fontSize: 17,
        fontWeight: '700',
        color: '#000',
        marginBottom: 4,
    },
    broadcastMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    metaBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
    },
    metaText: {
        fontSize: 12,
        color: 'rgba(0,0,0,0.5)',
    },
    metaDot: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    broadcastAction: {
        padding: 8,
    },
    emptyContainer: {
        alignItems: 'center',
        marginTop: 40,
        paddingVertical: 40,
    },
    emptyIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#F5F5F7',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1a1a1a',
        marginBottom: 8,
    },
    emptyText: {
        color: 'rgba(0,0,0,0.4)',
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
    },
    tipsSection: {
        marginTop: 20,
        padding: 20,
        backgroundColor: '#F8F9FA',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#e5e5e5',
    },
    tipsTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1a1a1a',
        marginBottom: 12,
    },
    tipItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 10,
    },
    tipIcon: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    tipText: {
        fontSize: 13,
        color: '#666',
        flex: 1,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContainer: {
        width: width - 40,
        maxWidth: 400,
    },
    modalContent: {
        borderRadius: 28,
        overflow: 'hidden',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#e5e5e5',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#1a1a1a',
    },
    modalBody: {
        padding: 20,
    },
    inputLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#666',
        marginBottom: 8,
    },
    input: {
        borderWidth: 1,
        borderColor: '#e5e5e5',
        borderRadius: 12,
        padding: 14,
        fontSize: 16,
        color: '#000',
        marginBottom: 20,
    },
    modalPreview: {
        marginBottom: 24,
    },
    previewLabel: {
        fontSize: 12,
        color: '#666',
        marginBottom: 8,
    },
    previewCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F5F7',
        padding: 12,
        borderRadius: 12,
        gap: 10,
    },
    previewName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1a1a1a',
    },
    modalCreateButton: {
        borderRadius: 16,
        overflow: 'hidden',
    },
    modalCreateDisabled: {
        opacity: 0.6,
    },
    modalCreateGradient: {
        paddingVertical: 14,
        alignItems: 'center',
    },
    modalCreateText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
});