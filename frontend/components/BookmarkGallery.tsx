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
import { GlobalStyles } from '@/styles/GlobalStyles';
import { useAppTheme } from '@/hooks/useAppTheme';
import { createShadow } from '@/utils/styles';
import getApiBaseImage from '@/services/getApiBaseImage';
import { useBookmarkStore } from '@/stores/bookmarkStore';
import AuthContext from '@/context/AuthContext';

// For web, use buttons instead of swipe gestures
const isWeb = Platform.OS === 'web';

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = isWeb ? Math.min(width * 0.85, 1000) : width * 0.98;
const CARD_HEIGHT = Math.min(height * 0.6, 500);

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
    isSettings?: boolean;
}

const COLLECTIONS = [
    { id: 'all', name: 'All Saves', icon: 'apps', color: '#0d0d0d', gradient: ['#0d0d0d', '#1a1a1a'] },
    { id: 'read', name: 'Read Later', icon: 'bookmark-outline', color: '#660000', gradient: ['#660000', '#800000'] },
    { id: 'inspire', name: 'Inspiration', icon: 'bulb-outline', color: '#7b3f00', gradient: ['#7b3f00', '#8B4513'] },
    { id: 'share', name: 'To Share', icon: 'share-social-outline', color: '#004d00', gradient: ['#004d00', '#006400'] },
    { id: 'personal', name: 'Personal', icon: 'person-outline', color: '#310062', gradient: ['#310062', '#4b0082'] },
];

// Split styles to avoid prop errors - WebActionButtons now accepts styles
const WebActionButtons = ({
    onAddNote,
    onRemove,
    onNavigate,
    colors
}: {
    onAddNote: () => void;
    onRemove: () => void;
    onNavigate: () => void;
    colors: any;
}) => (
    <View style={[styles.webActionButtons, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <TouchableOpacity 
            style={[styles.webActionButton, { backgroundColor: colors.muted, borderColor: colors.border }]} 
            onPress={onNavigate}
        >
            <Ionicons name="open-outline" size={18} color={colors.text} />
            <Text style={[styles.webActionText, { color: colors.text }]}>Open</Text>
        </TouchableOpacity>
        <TouchableOpacity 
            style={[styles.webActionButton, { backgroundColor: colors.muted, borderColor: colors.border }]} 
            onPress={onAddNote}
        >
            <Ionicons name="pencil" size={18} color={colors.text} />
            <Text style={[styles.webActionText, { color: colors.text }]}>Note</Text>
        </TouchableOpacity>
        <TouchableOpacity
            style={[styles.webActionButton, styles.webActionDelete]}
            onPress={onRemove}
        >
            <Ionicons name="trash-outline" size={18} color="#ff4444" />
            <Text style={[styles.webActionText, { color: "#ff4444" }]}>Delete</Text>
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
    onBookmarkRemoved,
    isSettings
}: BookmarkGalleryProps) => {
    const { colors, activeScheme } = useAppTheme();
    const styles = getStyles(colors, activeScheme as string);
    const insets = useSafeAreaInsets();
    const { user } = React.useContext<any>(AuthContext);
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
            return collection.gradient as [string, string, ...string[]];
        }

        const hour = new Date().getHours();
        if (activeScheme === 'dark') {
            return ['#000000', '#121212', '#1a1a1a'] as [string, string, ...string[]];
        }
        if (hour < 6) return ['#0f0c29', '#302b63', '#24243e'] as [string, string, ...string[]];
        if (hour < 12) return ['#2980b9', '#6dd5fa', '#ffffff'] as [string, string, ...string[]];
        if (hour < 18) return ['#f7971e', '#ffd200'] as [string, string, ...string[]];
        return ['#2c3e50', '#3498db'] as [string, string, ...string[]];
    };

    // Filter bookmarks
    const filteredBookmarks = bookmarks.filter(bookmark => {
        if (!bookmark || !bookmark.post) return false;
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
        if (!bookmark || !bookmark.created_at) return groups;
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

    const handleClose = () => {
        onClose();
        if (isSettings) {
            router.back();
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
            renderItem={({ item: [date, items] }: any) => (
                <View style={styles.timelineSection}>
                    <View style={styles.timelineHeader}>
                        <View style={styles.timelineDot} />
                        <Text style={styles.timelineDate}>{date}</Text>
                    </View>

                    {items.map((bookmark: Bookmark, index: number) => (
                        <MotiView
                            key={`timeline-${bookmark.id}-${index}`}
                            from={{ opacity: 0, scale: 0.95, translateY: 20 }}
                            animate={{ opacity: 1, scale: 1, translateY: 0 }}
                            transition={{ delay: index * 40, type: 'timing', duration: 400 }}
                            style={styles.timelineCard}
                        >
                            <View style={styles.timelineGradient}>
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
                                            {bookmark.post.caption || 'No caption provided'}
                                        </Text>

                                        {bookmark.note && (
                                            <View style={styles.timelineNote}>
                                                <Ionicons name="chatbubble" size={12} color={colors.primary} />
                                                <Text style={styles.timelineNoteText}>{bookmark.note}</Text>
                                            </View>
                                        )}

                                        {!isWeb && (
                                            <View style={styles.mobileActionButtons}>
                                                <TouchableOpacity
                                                    style={styles.mobileActionButton}
                                                    onPress={() => handleAddNote(bookmark)}
                                                >
                                                    <Ionicons name="pencil" size={18} color={colors.text} />
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[styles.mobileActionButton, styles.mobileActionDelete]}
                                                    onPress={() => handleRemoveBookmark(bookmark.post_id)}
                                                >
                                                    <Ionicons name="trash-outline" size={18} color="#a00101" />
                                                </TouchableOpacity>
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

                                {/* Web Actions */}
                                {isWeb && (
                                    <WebActionButtons
                                        onAddNote={() => handleAddNote(bookmark)}
                                        onRemove={() => handleRemoveBookmark(bookmark.post_id)}
                                        onNavigate={() => navigateToPost(bookmark.post_id)}
                                        colors={colors}
                                    />
                                )}
                            </View>
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
                    <View style={styles.gridOverlay}>
                        <Text style={styles.gridName} numberOfLines={1}>{item.post.user.name}</Text>
                        {item.note && (
                            <View style={styles.gridNote}>
                                <Ionicons name="chatbubble" size={10} color={colors.text} />
                                <Text style={styles.gridNoteText} numberOfLines={1}>{item.note}</Text>
                            </View>
                        )}
                    </View>
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
            <StatusBar barStyle={activeScheme === 'dark' ? 'light-content' : 'dark-content'} />

            <View style={[GlobalStyles.popupContainer, { zIndex: 6000 }]}>
                {/* Animated Background */}
                <LinearGradient
                    colors={getBackgroundGradient()}
                    style={StyleSheet.absoluteFill}
                />

                {/* Header */}
                <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                    <TouchableOpacity onPress={handleClose} style={styles.headerButton}>
                        <Ionicons name="close" size={24} color={colors.text} />
                    </TouchableOpacity>

                    <View style={styles.headerTitle}>
                        <Text style={styles.greeting} numberOfLines={1}>{getTimeBasedGreeting()},</Text>
                        <Text style={styles.headerMainTitle}>Bookmarked Memories</Text>
                    </View>

                    <TouchableOpacity
                        style={styles.headerButton}
                        onPress={() => setShowFilters(!showFilters)}
                    >
                        <Ionicons name="options-outline" size={22} color={colors.text} />
                    </TouchableOpacity>
                </View>

                {/* Filter Bar */}
                {showFilters && (
                    <MotiView
                        from={{ opacity: 0, translateY: -10 }}
                        animate={{ opacity: 1, translateY: 0 }}
                        style={styles.filterBar}
                    >
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScrollContent}>
                            {COLLECTIONS.map((col) => (
                                <TouchableOpacity
                                    key={col.id}
                                    style={[
                                        styles.filterChip,
                                        selectedCollection === col.id && { backgroundColor: col.color, borderColor: '#000', borderWidth: 1 }
                                    ]}
                                    onPress={() => setSelectedCollection(col.id)}
                                >
                                    <Ionicons name={col.icon as any} size={16} color={selectedCollection === col.id ? "#fff" : colors.text} />
                                    <Text style={[styles.filterChipText, filteredChipTextStyle(col.id)]}>{col.name}</Text>
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
                    <Ionicons name="search" size={18} color={colors.text} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search your collection..."
                        placeholderTextColor={colors.textSecondary}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery !== '' && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={18} color={colors.text} />
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
                            color={viewMode === 'timeline' ? '#fff' : colors.text}
                        />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.viewToggleButton, viewMode === 'list' && styles.viewToggleActive]}
                        onPress={() => setViewMode('list')}
                    >
                        <Ionicons
                            name="list-outline"
                            size={18}
                            color={viewMode === 'list' ? '#fff' : colors.text}
                        />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.viewToggleButton, viewMode === 'grid' && styles.viewToggleActive]}
                        onPress={() => setViewMode('grid')}
                    >
                        <Ionicons
                            name="grid-outline"
                            size={18}
                            color={viewMode === 'grid' ? '#fff' : colors.text}
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
                            <Ionicons name="bookmark" size={60} color={colors.muted} />
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
                    <View style={styles.modalOverlay}>
                        <MotiView
                            from={{ scale: 0.8, opacity: 0, translateY: 50 }}
                            animate={{ scale: 1, opacity: 1, translateY: 0 }}
                            transition={{ type: 'spring' }}
                            style={[styles.noteModal, GlobalStyles.responsiveModal]}
                        >
                            <Text style={styles.noteModalTitle}>Add Your Note</Text>
                            <Text style={styles.noteModalSubtitle}>
                                What did you love about this?
                            </Text>

                            <TextInput
                                style={styles.noteInput}
                                placeholder="Write your thoughts..."
                                placeholderTextColor={colors.textSecondary}
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
                                        <Ionicons name={col.icon as any} size={14} color={tempCollection === col.id ? "#fff" : colors.text} />
                                        <Text style={[styles.filterChipText, tempCollection === col.id && { color: '#fff' }]}>{col.name}</Text>
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
                    </View>
                </Modal>
            </View>
        </Modal>
    );
};

// Moved outside to use it in multiple places
const filteredChipTextStyle = (colId: string) => {
    // This is just a conceptual helper, implementation uses ternary in JSX
    return {};
};

const getStyles = (colors: any, activeScheme: string) => StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 20,
        zIndex: 10,
    },
    headerButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.surface,
        borderWidth: 1.5,
        borderColor: colors.border,
        justifyContent: 'center',
        alignItems: 'center',
        ...createShadow({ opacity: 0.15, radius: 8 }),
    },
    headerTitle: {
        alignItems: 'center',
        flex: 1,
        paddingHorizontal: 10,
    },
    greeting: {
        fontSize: 14,
        color: activeScheme === 'dark' ? colors.text : '#000000',
        textTransform: 'uppercase',
        letterSpacing: 2,
        fontWeight: '700',
    },
    headerMainTitle: {
        fontSize: 26,
        fontWeight: '900',
        color: activeScheme === 'dark' ? colors.text : '#000000',
    },
    filterBar: {
        marginBottom: 20,
    },
    filterScrollContent: {
        paddingHorizontal: 20,
        gap: 12,
    },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderWidth: 1.5,
        borderColor: colors.border,
        paddingHorizontal: 18,
        paddingVertical: 12,
        borderRadius: 30,
        gap: 10,
    },
    filterChipText: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '600',
    },
    filterBadge: {
        backgroundColor: colors.primary || '#1063FD',
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 3,
        marginLeft: 4,
    },
    filterBadgeText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '900',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderWidth: 2,
        borderColor: colors.border,
        marginHorizontal: 20,
        marginBottom: 25,
        paddingHorizontal: 20,
        paddingVertical: Platform.OS === 'ios' ? 16 : 12,
        borderRadius: 35,
        gap: 12,
        ...createShadow({ opacity: 0.15, height: 6 }),
    },
    searchInput: {
        flex: 1,
        color: colors.text,
        fontSize: 17,
        fontWeight: '600',
        ...Platform.select({
            web: {
                outlineStyle: 'none',
            } as any,
        }),
    },
    viewToggle: {
        flexDirection: 'row',
        backgroundColor: colors.surface,
        borderWidth: 1.5,
        borderColor: colors.border,
        alignSelf: 'center',
        borderRadius: 30,
        padding: 5,
        marginBottom: 30,
    },
    viewToggleButton: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
    },
    viewToggleActive: {
        backgroundColor: colors.primary || '#1063FD',
        borderColor: colors.border,
        borderWidth: 0.5,
    },
    content: {
        flex: 1,
        paddingHorizontal: isWeb ? 20 : 0,
    },
    // Timeline Styles
    timelineSection: {
        marginBottom: 35,
    },
    timelineHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        paddingHorizontal: isWeb ? 0 : 25,
    },
    timelineDot: {
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: colors.primary || '#1063FD',
        marginRight: 15,
        borderWidth: 3,
        borderColor: colors.border,
    },
    timelineDate: {
        color: activeScheme === 'dark' ? colors.text : '#000000',
        fontSize: 17,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 2,
    },
    timelineCard: {
        width: isWeb ? CARD_WIDTH : width * 0.94,
        marginHorizontal: 'auto',
        borderRadius: 28,
        marginBottom: 25,
        overflow: 'hidden',
        backgroundColor: colors.surface,
        borderWidth: 2,
        borderColor: colors.border,
        ...createShadow({
            width: 0,
            height: 12,
            opacity: 0.1,
            radius: 20,
            elevation: 10,
        }),
    },
    timelineGradient: {
        flex: 1,
    },
    timelineContent: {
        flexDirection: 'row',
        padding: 24,
        gap: 24,
    },
    timelineThumb: {
        width: 110,
        height: 110,
        borderRadius: 20,
        backgroundColor: colors.muted,
        borderWidth: 1,
        borderColor: colors.border,
    },
    timelineInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    timelineRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        gap: 12,
    },
    timelineAvatar: {
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: colors.border,
    },
    timelineName: {
        color: colors.textSecondary,
        fontSize: 14,
        fontWeight: '800',
    },
    timelineCaption: {
        color: colors.text,
        fontSize: 18,
        fontWeight: '700',
        lineHeight: 24,
        marginBottom: 15,
    },
    timelineNote: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: colors.muted,
        padding: 15,
        borderRadius: 15,
        marginTop: 5,
        gap: 10,
        borderLeftWidth: 4,
        borderLeftColor: colors.primary || '#1063FD',
    },
    timelineNoteText: {
        color: colors.textSecondary,
        fontSize: 14,
        fontStyle: 'italic',
        lineHeight: 20,
        flex: 1,
    },
    mobileActionButtons: {
        flexDirection: 'row',
        marginTop: 20,
        gap: 15,
    },
    mobileActionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.muted,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 25,
        borderWidth: 1.5,
        borderColor: colors.border,
    },
    mobileActionDelete: {
        backgroundColor: activeScheme === 'dark' ? 'rgba(255, 68, 68, 0.2)' : '#FFE5E5',
        borderColor: '#CC0000',
    },
    collectionBadge: {
        position: 'absolute',
        top: 24,
        right: 24,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: colors.border,
    },
    // Grid Styles
    gridRow: {
        paddingHorizontal: 20,
        gap: 20,
        marginBottom: 20,
    },
    gridCard: {
        flex: 1,
        aspectRatio: 0.8,
        borderRadius: 25,
        overflow: 'hidden',
        backgroundColor: colors.surface,
        borderWidth: 2,
        borderColor: colors.border,
        ...createShadow({ opacity: 0.15, elevation: 8 }),
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
        padding: 20,
        backgroundColor: activeScheme === 'dark' ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)',
    },
    gridName: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '900',
        marginBottom: 6,
    },
    gridNote: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    gridNoteText: {
        color: colors.textSecondary,
        fontSize: 12,
        fontStyle: 'italic',
    },
    // List Styles
    listCard: {
        flexDirection: 'row',
        backgroundColor: colors.surface,
        marginHorizontal: 20,
        marginBottom: 20,
        borderRadius: 25,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: colors.border,
        ...createShadow({ opacity: 0.15, elevation: 6 }),
    },
    listImage: {
        width: 130,
        height: '100%',
        backgroundColor: colors.muted,
    },
    listInfo: {
        flex: 1,
        padding: 20,
    },
    listHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        gap: 10,
    },
    listAvatar: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    listName: {
        color: colors.textSecondary,
        fontSize: 13,
        fontWeight: '800',
    },
    listCaption: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 12,
    },
    listNote: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.muted,
        padding: 10,
        borderRadius: 12,
        gap: 8,
    },
    listNoteText: {
        color: colors.textSecondary,
        fontSize: 13,
        fontStyle: 'italic',
    },
    // Web Actions
    webActionButtons: {
        flexDirection: 'row',
        padding: 15,
        gap: 15,
        borderTopWidth: 2,
    },
    webActionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 15,
        gap: 10,
        borderWidth: 1,
    },
    webActionDelete: {
        backgroundColor: activeScheme === 'dark' ? 'rgba(255, 68, 68, 0.2)' : '#FFE5E5',
        borderColor: '#CC0000',
    },
    webActionText: {
        fontSize: 14,
        fontWeight: '800',
    },
    // Common
    timelineList: {
        paddingBottom: 50,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 50,
    },
    emptyIcon: {
        width: 140,
        height: 140,
        borderRadius: 70,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 30,
        borderWidth: 2,
        borderColor: colors.border,
    },
    emptyTitle: {
        color: colors.text,
        fontSize: 24,
        fontWeight: '900',
        marginBottom: 15,
        textAlign: 'center',
    },
    emptyText: {
        color: colors.textSecondary,
        fontSize: 16,
        lineHeight: 24,
        textAlign: 'center',
    },
    // Note Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: activeScheme === 'dark' ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.95)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    noteModal: {
        width: Math.min(width * 0.92, 450),
        backgroundColor: colors.surface,
        borderRadius: 35,
        padding: 30,
        borderWidth: 2,
        borderColor: colors.border,
        ...createShadow({ opacity: 0.15, radius: 25 }),
    },
    noteModalTitle: {
        color: colors.text,
        fontSize: 26,
        fontWeight: '900',
        marginBottom: 10,
    },
    noteModalSubtitle: {
        color: colors.textSecondary,
        fontSize: 15,
        marginBottom: 25,
    },
    noteInput: {
        backgroundColor: colors.muted,
        borderRadius: 20,
        padding: 20,
        color: colors.text,
        fontSize: 18,
        height: 140,
        textAlignVertical: 'top',
        marginBottom: 25,
        borderWidth: 1.5,
        borderColor: colors.border,
    },
    noteActions: {
        flexDirection: 'row',
        gap: 15,
    },
    noteButton: {
        flex: 1,
        paddingVertical: 16,
        borderRadius: 20,
        alignItems: 'center',
    },
    noteCancel: {
        backgroundColor: colors.muted,
        borderWidth: 1,
        borderColor: colors.border,
    },
    noteSave: {
        backgroundColor: colors.primary || '#1063FD',
    },
    noteCancelText: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '800',
    },
    noteSaveText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '900',
    },
});
