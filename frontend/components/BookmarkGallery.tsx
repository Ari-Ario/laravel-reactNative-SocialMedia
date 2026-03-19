// components/BookmarkGallery.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Dimensions,
    Animated,
    FlatList,
    Image,
    Platform,
    Alert,
    StatusBar,
    TextInput,
    ScrollView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createShadow } from '@/utils/styles';
import getApiBaseImage from '@/services/getApiBaseImage';
import { useBookmarkStore } from '@/stores/bookmarkStore';
import AuthContext from '@/context/AuthContext';

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = Math.min(width * 0.85, 400);
const CARD_HEIGHT = Math.min(height * 0.6, 500);

// For web, use buttons instead of swipe gestures
const isWeb = Platform.OS === 'web';

interface Bookmark {
    id: number;
    post_id: number;
    user_id: number;
    collection: string;
    note: string | null;
    created_at: string;
    post: {
        id: number;
        caption: string;
        media: Array<{ file_path: string; type: string }>;
        user: {
            id: number;
            name: string;
            profile_photo: string | null;
        };
    };
}

interface BookmarkGalleryProps {
    visible: boolean;
    onClose: () => void;
    initialBookmark?: Bookmark | null;
    onBookmarkAdded?: (bookmark: Bookmark) => void;
    onBookmarkRemoved?: (postId: number) => void;
}

const COLLECTIONS = [
    { id: 'all', name: 'All Saves', icon: 'apps', color: '#0084ff', gradient: ['#0084ff', '#00c6ff'] },
    { id: 'read', name: 'Read Later', icon: 'bookmark-outline', color: '#FF6B6B', gradient: ['#FF6B6B', '#FF8E8E'] },
    { id: 'inspire', name: 'Inspiration', icon: 'bulb-outline', color: '#FFD93D', gradient: ['#FFD93D', '#FFB347'] },
    { id: 'share', name: 'To Share', icon: 'share-social-outline', color: '#4ECDC4', gradient: ['#4ECDC4', '#45B7D1'] },
    { id: 'personal', name: 'Personal', icon: 'person-outline', color: '#845EC2', gradient: ['#845EC2', '#B39CD0'] },
];

// Web-friendly action buttons
const WebActionButtons = ({
    onAddNote,
    onRemove,
    onNavigate
}: {
    onAddNote: () => void;
    onRemove: () => void;
    onNavigate: () => void;
}) => (
    <View style={styles.webActionButtons}>
        <TouchableOpacity style={styles.webActionButton} onPress={onNavigate}>
            <Ionicons name="open-outline" size={18} color="#fff" />
            <Text style={styles.webActionText}>Open</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.webActionButton} onPress={onAddNote}>
            <Ionicons name="pencil" size={18} color="#fff" />
            <Text style={styles.webActionText}>Note</Text>
        </TouchableOpacity>
        <TouchableOpacity
            style={[styles.webActionButton, styles.webActionDelete]}
            onPress={onRemove}
        >
            <Ionicons name="trash-outline" size={18} color="#fff" />
            <Text style={styles.webActionText}>Delete</Text>
        </TouchableOpacity>
    </View>
);

// Mobile swipeable row using the component you provided
const SwipeableRow = React.lazy(() => import('./SwipeableRow'));

export const BookmarkGallery = ({
    visible,
    onClose,
    initialBookmark,
    onBookmarkAdded,
    onBookmarkRemoved
}: BookmarkGalleryProps) => {
    const insets = useSafeAreaInsets();
    const { user } = React.useContext(AuthContext);
    const { bookmarks, addBookmark, removeBookmark, updateBookmarkNote, moveToCollection } = useBookmarkStore();

    const [selectedCollection, setSelectedCollection] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedBookmarks, setSelectedBookmarks] = useState<number[]>([]);
    const [showNoteModal, setShowNoteModal] = useState(false);
    const [currentBookmark, setCurrentBookmark] = useState<Bookmark | null>(null);
    const [noteText, setNoteText] = useState('');
    const [tempCollection, setTempCollection] = useState('all');
    const [viewMode, setViewMode] = useState<'grid' | 'list' | 'timeline'>('timeline');
    const [showFilters, setShowFilters] = useState(false);

    const scrollY = useRef(new Animated.Value(0)).current;
    const rotateAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible && initialBookmark) {
            handleAddNote(initialBookmark);
        }
    }, [visible, initialBookmark]);

    // Get time-based greeting
    const getTimeBasedGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 18) return 'Good Afternoon';
        return 'Good Evening';
    };

    // Get background gradient based on collection and time
    const getBackgroundGradient = () => {
        const collection = COLLECTIONS.find(c => c.id === selectedCollection);
        if (collection && selectedCollection !== 'all') {
            return collection.gradient;
        }

        const hour = new Date().getHours();
        if (hour < 6) return ['#0f0c29', '#302b63', '#24243e'];
        if (hour < 12) return ['#2980b9', '#6dd5fa', '#ffffff'];
        if (hour < 18) return ['#f7971e', '#ffd200'];
        return ['#2c3e50', '#3498db'];
    };

    // Filter bookmarks
    const filteredBookmarks = bookmarks.filter(bookmark => {
        if (selectedCollection !== 'all' && bookmark.collection !== selectedCollection) return false;
        if (searchQuery) {
            const searchLower = searchQuery.toLowerCase();
            return (
                bookmark.post.caption?.toLowerCase().includes(searchLower) ||
                bookmark.post.user.name.toLowerCase().includes(searchLower) ||
                bookmark.note?.toLowerCase().includes(searchLower)
            );
        }
        return true;
    });

    // Group by date for timeline view
    const groupedByDate = filteredBookmarks.reduce((groups, bookmark) => {
        const date = new Date(bookmark.created_at).toLocaleDateString();
        if (!groups[date]) groups[date] = [];
        groups[date].push(bookmark);
        return groups;
    }, {} as Record<string, Bookmark[]>);

    const handleRemoveBookmark = (postId: number) => {
        if (isWeb) {
            // Web: use confirm dialog
            if (window.confirm('Remove this bookmark?')) {
                removeBookmark(postId);
                onBookmarkRemoved?.(postId);
            }
        } else {
            // Mobile: use Alert
            Alert.alert(
                'Remove Bookmark',
                'Remove this from your collection?',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Remove',
                        style: 'destructive',
                        onPress: () => {
                            removeBookmark(postId);
                            onBookmarkRemoved?.(postId);
                        },
                    },
                ]
            );
        }
    };

    const handleAddNote = (bookmark: Bookmark) => {
        setCurrentBookmark(bookmark);
        setNoteText(bookmark.note || '');
        setTempCollection(bookmark.collection || 'all');
        setShowNoteModal(true);
    };

    const saveNote = async () => {
        if (currentBookmark) {
            try {
                // Update note if changed
                if (noteText !== currentBookmark.note) {
                    await updateBookmarkNote(currentBookmark.post_id, noteText);
                }
                // Update collection if changed
                if (tempCollection !== currentBookmark.collection) {
                    await moveToCollection(currentBookmark.post_id, tempCollection);
                }
                setShowNoteModal(false);
            } catch (error) {
                Alert.alert('Error', 'Failed to save changes');
            }
        }
    };

    const navigateToPost = (postId: number) => {
        onClose();
        setTimeout(() => {
            router.push(`/post/${postId}`);
        }, 300);
    };

    // Timeline View (most creative)
    const renderTimelineView = () => (
        <FlatList
            data={Object.entries(groupedByDate)}
            keyExtractor={([date]) => date}
            showsVerticalScrollIndicator={false}
            renderItem={({ item: [date, items] }) => (
                <View style={styles.timelineSection}>
                    <View style={styles.timelineHeader}>
                        <View style={styles.timelineDot} />
                        <Text style={styles.timelineDate}>{date}</Text>
                    </View>

                    {items.map((bookmark, index) => (
                        <MotiView
                            key={bookmark.id}
                            from={{ opacity: 0, translateX: -20 }}
                            animate={{ opacity: 1, translateX: 0 }}
                            transition={{ delay: index * 50 }}
                            style={styles.timelineCard}
                        >
                            <LinearGradient
                                colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
                                style={styles.timelineGradient}
                            >
                                <TouchableOpacity
                                    style={styles.timelineContent}
                                    onPress={() => navigateToPost(bookmark.post_id)}
                                    onLongPress={() => setSelectedBookmarks([bookmark.post_id])}
                                >
                                    {/* Media Thumbnail */}
                                    {bookmark.post.media?.[0] && (
                                        <Image
                                            source={{ uri: `${getApiBaseImage()}/storage/${bookmark.post.media[0].file_path}` }}
                                            style={styles.timelineThumb}
                                        />
                                    )}

                                    <View style={styles.timelineInfo}>
                                        <View style={styles.timelineRow}>
                                            <Image
                                                source={{
                                                    uri: bookmark.post.user.profile_photo
                                                        ? `${getApiBaseImage()}/storage/${bookmark.post.user.profile_photo}`
                                                        : 'https://via.placeholder.com/20'
                                                }}
                                                style={styles.timelineAvatar}
                                            />
                                            <Text style={styles.timelineName}>{bookmark.post.user.name}</Text>
                                        </View>

                                        <Text style={styles.timelineCaption} numberOfLines={2}>
                                            {bookmark.post.caption || 'No caption'}
                                        </Text>

                                        {bookmark.note && (
                                            <View style={styles.timelineNote}>
                                                <Ionicons name="chatbubble" size={12} color="#0084ff" />
                                                <Text style={styles.timelineNoteText}>{bookmark.note}</Text>
                                            </View>
                                        )}
                                    </View>

                                    {/* Collection Badge */}
                                    {bookmark.collection && bookmark.collection !== 'all' && (
                                        <View style={[
                                            styles.collectionBadge,
                                            { backgroundColor: COLLECTIONS.find(c => c.id === bookmark.collection)?.color + '20' }
                                        ]}>
                                            <Ionicons
                                                name={COLLECTIONS.find(c => c.id === bookmark.collection)?.icon as any}
                                                size={10}
                                                color={COLLECTIONS.find(c => c.id === bookmark.collection)?.color}
                                            />
                                        </View>
                                    )}
                                </TouchableOpacity>

                                {/* Actions */}
                                {isWeb ? (
                                    <WebActionButtons
                                        onAddNote={() => handleAddNote(bookmark)}
                                        onRemove={() => handleRemoveBookmark(bookmark.post_id)}
                                        onNavigate={() => navigateToPost(bookmark.post_id)}
                                    />
                                ) : (
                                    <SwipeableRow onDelete={() => handleRemoveBookmark(bookmark.post_id)}>
                                        <View style={styles.timelineActions}>
                                            <TouchableOpacity
                                                style={styles.timelineAction}
                                                onPress={() => handleAddNote(bookmark)}
                                            >
                                                <Ionicons name="pencil" size={18} color="#666" />
                                            </TouchableOpacity>
                                        </View>
                                    </SwipeableRow>
                                )}
                            </LinearGradient>
                        </MotiView>
                    ))}
                </View>
            )}
            contentContainerStyle={styles.timelineList}
        />
    );

    // Grid View
    const renderGridView = () => (
        <FlatList
            data={filteredBookmarks}
            keyExtractor={(item) => item.id.toString()}
            numColumns={2}
            columnWrapperStyle={styles.gridRow}
            renderItem={({ item }) => (
                <TouchableOpacity
                    style={styles.gridCard}
                    onPress={() => navigateToPost(item.post_id)}
                    onLongPress={() => setSelectedBookmarks([item.post_id])}
                >
                    {item.post.media?.[0] && (
                        <Image
                            source={{ uri: `${getApiBaseImage()}/storage/${item.post.media[0].file_path}` }}
                            style={styles.gridImage}
                        />
                    )}
                    <BlurView intensity={80} style={styles.gridOverlay}>
                        <Text style={styles.gridName} numberOfLines={1}>{item.post.user.name}</Text>
                        {item.note && (
                            <View style={styles.gridNote}>
                                <Ionicons name="chatbubble" size={10} color="#fff" />
                                <Text style={styles.gridNoteText} numberOfLines={1}>{item.note}</Text>
                            </View>
                        )}
                    </BlurView>
                </TouchableOpacity>
            )}
        />
    );

    // List View
    const renderListView = () => (
        <FlatList
            data={filteredBookmarks}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
                <TouchableOpacity
                    style={styles.listCard}
                    onPress={() => navigateToPost(item.post_id)}
                    onLongPress={() => setSelectedBookmarks([item.post_id])}
                >
                    {item.post.media?.[0] && (
                        <Image
                            source={{ uri: `${getApiBaseImage()}/storage/${item.post.media[0].file_path}` }}
                            style={styles.listImage}
                        />
                    )}
                    <View style={styles.listInfo}>
                        <View style={styles.listHeader}>
                            <Image
                                source={{
                                    uri: item.post.user.profile_photo
                                        ? `${getApiBaseImage()}/storage/${item.post.user.profile_photo}`
                                        : 'https://via.placeholder.com/20'
                                }}
                                style={styles.listAvatar}
                            />
                            <Text style={styles.listName}>{item.post.user.name}</Text>
                        </View>
                        <Text style={styles.listCaption} numberOfLines={2}>
                            {item.post.caption || 'No caption'}
                        </Text>
                        {item.note && (
                            <View style={styles.listNote}>
                                <Ionicons name="chatbubble" size={12} color="#666" />
                                <Text style={styles.listNoteText}>{item.note}</Text>
                            </View>
                        )}
                    </View>
                </TouchableOpacity>
            )}
        />
    );

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent
            onRequestClose={onClose}
        >
            <StatusBar barStyle="light-content" />

            <View style={styles.container}>
                {/* Animated Background */}
                <LinearGradient
                    colors={getBackgroundGradient()}
                    style={StyleSheet.absoluteFill}
                />

                <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />

                {/* Header */}
                <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                    <TouchableOpacity onPress={onClose} style={styles.headerButton}>
                        <Ionicons name="close" size={24} color="#fff" />
                    </TouchableOpacity>

                    <View style={styles.headerTitle}>
                        <Text style={styles.greeting}>{getTimeBasedGreeting()},</Text>
                        <Text style={styles.headerMainTitle}>Your Collection</Text>
                    </View>

                    <TouchableOpacity
                        style={styles.headerButton}
                        onPress={() => setShowFilters(!showFilters)}
                    >
                        <Ionicons name="options-outline" size={22} color="#fff" />
                    </TouchableOpacity>
                </View>

                {/* Filter Bar */}
                {showFilters && (
                    <MotiView
                        from={{ opacity: 0, translateY: -20 }}
                        animate={{ opacity: 1, translateY: 0 }}
                        style={styles.filterBar}
                    >
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            {COLLECTIONS.map((col) => (
                                <TouchableOpacity
                                    key={col.id}
                                    style={[
                                        styles.filterChip,
                                        selectedCollection === col.id && { backgroundColor: col.color }
                                    ]}
                                    onPress={() => setSelectedCollection(col.id)}
                                >
                                    <Ionicons name={col.icon as any} size={14} color="#fff" />
                                    <Text style={styles.filterChipText}>{col.name}</Text>
                                    {col.id === 'all' && (
                                        <View style={styles.filterBadge}>
                                            <Text style={styles.filterBadgeText}>{bookmarks.length}</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </MotiView>
                )}

                {/* Search Bar */}
                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={18} color="rgba(255,255,255,0.5)" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search your collection..."
                        placeholderTextColor="rgba(255,255,255,0.5)"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery !== '' && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.5)" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* View Mode Toggle */}
                <View style={styles.viewToggle}>
                    <TouchableOpacity
                        style={[styles.viewToggleButton, viewMode === 'timeline' && styles.viewToggleActive]}
                        onPress={() => setViewMode('timeline')}
                    >
                        <Ionicons
                            name="time-outline"
                            size={18}
                            color={viewMode === 'timeline' ? '#fff' : 'rgba(255,255,255,0.5)'}
                        />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.viewToggleButton, viewMode === 'list' && styles.viewToggleActive]}
                        onPress={() => setViewMode('list')}
                    >
                        <Ionicons
                            name="list-outline"
                            size={18}
                            color={viewMode === 'list' ? '#fff' : 'rgba(255,255,255,0.5)'}
                        />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.viewToggleButton, viewMode === 'grid' && styles.viewToggleActive]}
                        onPress={() => setViewMode('grid')}
                    >
                        <Ionicons
                            name="grid-outline"
                            size={18}
                            color={viewMode === 'grid' ? '#fff' : 'rgba(255,255,255,0.5)'}
                        />
                    </TouchableOpacity>
                </View>

                {/* Content */}
                {filteredBookmarks.length === 0 ? (
                    <MotiView
                        from={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        style={styles.emptyState}
                    >
                        <View style={styles.emptyIcon}>
                            <Ionicons name="bookmark" size={60} color="rgba(255,255,255,0.2)" />
                        </View>
                        <Text style={styles.emptyTitle}>Your collection is empty</Text>
                        <Text style={styles.emptyText}>
                            Tap the bookmark icon on any post to start building your memory lane
                        </Text>
                    </MotiView>
                ) : (
                    <View style={styles.content}>
                        {viewMode === 'timeline' && renderTimelineView()}
                        {viewMode === 'list' && renderListView()}
                        {viewMode === 'grid' && renderGridView()}
                    </View>
                )}

                {/* Note Modal */}
                <Modal
                    visible={showNoteModal}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setShowNoteModal(false)}
                >
                    <BlurView intensity={90} tint="dark" style={styles.modalOverlay}>
                        <MotiView
                            from={{ scale: 0.8, opacity: 0, translateY: 50 }}
                            animate={{ scale: 1, opacity: 1, translateY: 0 }}
                            transition={{ type: 'spring' }}
                            style={styles.noteModal}
                        >
                            <Text style={styles.noteModalTitle}>Add Your Note</Text>
                            <Text style={styles.noteModalSubtitle}>
                                What did you love about this?
                            </Text>

                            <TextInput
                                style={styles.noteInput}
                                placeholder="Write your thoughts..."
                                placeholderTextColor="#666"
                                multiline
                                value={noteText}
                                onChangeText={setNoteText}
                                autoFocus
                            />

                            <Text style={[styles.noteModalSubtitle, { marginBottom: 10 }]}>
                                Select Collection
                            </Text>
                            <ScrollView 
                                horizontal 
                                showsHorizontalScrollIndicator={false} 
                                style={{ marginBottom: 20 }}
                            >
                                {COLLECTIONS.map((col) => (
                                    <TouchableOpacity
                                        key={`note-col-${col.id}`}
                                        style={[
                                            styles.filterChip,
                                            tempCollection === col.id && { backgroundColor: col.color }
                                        ]}
                                        onPress={() => setTempCollection(col.id)}
                                    >
                                        <Ionicons name={col.icon as any} size={14} color="#fff" />
                                        <Text style={styles.filterChipText}>{col.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            <View style={styles.noteActions}>
                                <TouchableOpacity
                                    style={[styles.noteButton, styles.noteCancel]}
                                    onPress={() => setShowNoteModal(false)}
                                >
                                    <Text style={styles.noteCancelText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.noteButton, styles.noteSave]}
                                    onPress={saveNote}
                                >
                                    <Text style={styles.noteSaveText}>Save Note</Text>
                                </TouchableOpacity>
                            </View>
                        </MotiView>
                    </BlurView>
                </Modal>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    headerButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        alignItems: 'center',
    },
    greeting: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.6)',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    headerMainTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
    },
    filterBar: {
        paddingHorizontal: 20,
        marginBottom: 15,
    },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 25,
        marginRight: 10,
        gap: 6,
    },
    filterChipText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '500',
    },
    filterBadge: {
        backgroundColor: 'rgba(255,255,255,0.3)',
        borderRadius: 12,
        paddingHorizontal: 6,
        paddingVertical: 2,
        marginLeft: 4,
    },
    filterBadgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '700',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginHorizontal: 20,
        marginBottom: 15,
        paddingHorizontal: 15,
        paddingVertical: Platform.OS === 'ios' ? 12 : 8,
        borderRadius: 30,
        gap: 8,
    },
    searchInput: {
        flex: 1,
        color: '#fff',
        fontSize: 14,
        outlineStyle: 'none',
    },
    viewToggle: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignSelf: 'center',
        borderRadius: 25,
        padding: 3,
        marginBottom: 20,
    },
    viewToggleButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    viewToggleActive: {
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
    },
    // Timeline Styles
    timelineSection: {
        marginBottom: 25,
    },
    timelineHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
    },
    timelineDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#fff',
        marginRight: 10,
    },
    timelineDate: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
        opacity: 0.8,
    },
    timelineCard: {
        marginBottom: 10,
        borderRadius: 16,
        overflow: 'hidden',
        ...createShadow({
            width: 0,
            height: 2,
            opacity: 0.2,
            radius: 8,
            elevation: 4,
        }),
    },
    timelineGradient: {
        padding: 12,
    },
    timelineContent: {
        flexDirection: 'row',
        gap: 12,
    },
    timelineThumb: {
        width: 60,
        height: 60,
        borderRadius: 8,
    },
    timelineInfo: {
        flex: 1,
    },
    timelineRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
        gap: 6,
    },
    timelineAvatar: {
        width: 20,
        height: 20,
        borderRadius: 10,
    },
    timelineName: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
    },
    timelineCaption: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 12,
        marginBottom: 4,
    },
    timelineNote: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(0,132,255,0.1)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
        alignSelf: 'flex-start',
    },
    timelineNoteText: {
        color: '#0084ff',
        fontSize: 11,
    },
    collectionBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    timelineActions: {
        marginTop: 8,
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    timelineAction: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    timelineList: {
        paddingBottom: 100,
    },
    // Grid Styles
    gridRow: {
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    gridCard: {
        width: (CARD_WIDTH - 30) / 2,
        height: 150,
        borderRadius: 16,
        overflow: 'hidden',
    },
    gridImage: {
        width: '100%',
        height: '100%',
    },
    gridOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 10,
    },
    gridName: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    gridNote: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        gap: 4,
    },
    gridNoteText: {
        color: '#fff',
        fontSize: 10,
        opacity: 0.8,
    },
    // List Styles
    listCard: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        marginBottom: 10,
        overflow: 'hidden',
        ...createShadow({
            width: 0,
            height: 2,
            opacity: 0.1,
            radius: 8,
            elevation: 3,
        }),
    },
    listImage: {
        width: 80,
        height: 80,
    },
    listInfo: {
        flex: 1,
        padding: 12,
    },
    listHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
        gap: 6,
    },
    listAvatar: {
        width: 18,
        height: 18,
        borderRadius: 9,
    },
    listName: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    listCaption: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 12,
        marginBottom: 4,
    },
    listNote: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    listNoteText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 11,
    },
    // Empty State
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    emptyIcon: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    emptyTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 10,
    },
    emptyText: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.6)',
        textAlign: 'center',
        lineHeight: 20,
    },
    // Web Action Buttons
    webActionButtons: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: 10,
        gap: 8,
    },
    webActionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 4,
    },
    webActionDelete: {
        backgroundColor: 'rgba(255,68,68,0.2)',
    },
    webActionText: {
        color: '#fff',
        fontSize: 12,
    },
    // Note Modal
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    noteModal: {
        backgroundColor: '#1a1a2e',
        borderRadius: 30,
        padding: 24,
        width: Math.min(width - 40, 400),
    },
    noteModalTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 6,
    },
    noteModalSubtitle: {
        fontSize: 14,
        color: '#aaa',
        marginBottom: 20,
    },
    noteInput: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 16,
        color: '#fff',
        fontSize: 14,
        minHeight: 100,
        textAlignVertical: 'top',
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    noteActions: {
        flexDirection: 'row',
        gap: 12,
    },
    noteButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 16,
        alignItems: 'center',
    },
    noteCancel: {
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    noteSave: {
        backgroundColor: '#0084ff',
    },
    noteCancelText: {
        color: '#aaa',
        fontSize: 15,
        fontWeight: '600',
    },
    noteSaveText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '700',
    },
});