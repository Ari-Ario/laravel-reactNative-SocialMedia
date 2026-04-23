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
    TextInput,
    ScrollView,
    useWindowDimensions,
    Platform,
    Alert,
    StatusBar,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlobalStyles } from '@/styles/GlobalStyles';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useTranslation } from '@/constants/i18n';
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

const WebActionButtons = ({
    onAddNote,
    onRemove,
    onNavigate,
    colors,
    styles,
    t,
    isRTL
}: {
    onAddNote: () => void;
    onRemove: () => void;
    onNavigate: () => void;
    colors: any;
    styles: any;
    t: any;
    isRTL: boolean;
}) => (
    <View style={[styles.webActionButtons, { backgroundColor: colors.surface, borderTopColor: colors.border, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <TouchableOpacity
            style={[styles.webActionButton, { backgroundColor: colors.muted, borderColor: colors.border, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
            onPress={onNavigate}
        >
            <Ionicons name={isRTL ? "open-outline" : "open-outline"} size={18} color={colors.text} />
            <Text style={[styles.webActionText, { color: colors.text, textAlign: isRTL ? 'right' : 'left', [isRTL ? 'marginRight' : 'marginLeft']: 8, [isRTL ? 'marginLeft' : 'marginRight']: 0 }]}>{t('open')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
            style={[styles.webActionButton, { backgroundColor: colors.muted, borderColor: colors.border, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
            onPress={onAddNote}
        >
            <Ionicons name="pencil" size={18} color={colors.text} />
            <Text style={[styles.webActionText, { color: colors.text, textAlign: isRTL ? 'right' : 'left', [isRTL ? 'marginRight' : 'marginLeft']: 8, [isRTL ? 'marginLeft' : 'marginRight']: 0 }]}>{t('note')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
            style={[styles.webActionButton, styles.webActionDelete, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
            onPress={onRemove}
        >
            <Ionicons name="trash-outline" size={18} color="#ff4444" />
            <Text style={[styles.webActionText, { color: "#ff4444", textAlign: isRTL ? 'right' : 'left', [isRTL ? 'marginRight' : 'marginLeft']: 8, [isRTL ? 'marginLeft' : 'marginRight']: 0 }]}>{t('delete')}</Text>
        </TouchableOpacity>
    </View>
);


export const BookmarkGallery = ({
    visible,
    onClose,
    initialBookmark,
    onBookmarkAdded,
    onBookmarkRemoved,
    isSettings
}: BookmarkGalleryProps) => {
    const { width, height } = useWindowDimensions();
    const { colors, activeScheme } = useAppTheme();
    const { t, isRTL } = useTranslation();
    const insets = useSafeAreaInsets();
    const { user } = React.useContext<any>(AuthContext);
    const { bookmarks, addBookmark, removeBookmark, updateBookmarkNote, moveToCollection } = useBookmarkStore();

    // Use memoized styles to prevent unnecessary re-renders
    const styles = React.useMemo(() => getStyles(colors, activeScheme as string, width, height, isRTL), [colors, activeScheme, width, height, isRTL]);

    const COLLECTIONS = [
        { id: 'all', name: t('all_saves'), icon: 'apps', color: '#0d0d0d', gradient: ['#0d0d0d', '#1a1a1a'] },
        { id: 'read', name: t('read_later'), icon: 'bookmark-outline', color: '#660000', gradient: ['#660000', '#800000'] },
        { id: 'inspire', name: t('inspiration'), icon: 'bulb-outline', color: '#7b3f00', gradient: ['#7b3f00', '#8B4513'] },
        { id: 'share', name: t('to_share'), icon: 'share-social-outline', color: '#004d00', gradient: ['#004d00', '#006400'] },
        { id: 'personal', name: t('personal'), icon: 'person-outline', color: '#310062', gradient: ['#310062', '#4b0082'] },
    ];
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

    // Track the last successfully automated note bookmark to prevent infinite loops
    const lastPromptedId = useRef<number | null>(null);

    useEffect(() => {
        if (visible && initialBookmark && lastPromptedId.current !== initialBookmark.id) {
            lastPromptedId.current = initialBookmark.id;
            handleAddNote(initialBookmark);
        }
    }, [visible, initialBookmark?.id]);

    // Get time-based greeting
    const getTimeBasedGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return t('good_morning');
        if (hour < 18) return t('good_afternoon');
        return t('good_evening');
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
            if (window.confirm(t('remove_bookmark_confirm'))) {
                removeBookmark(postId);
                onBookmarkRemoved?.(postId);
            }
        } else {
            // Mobile: use Alert
            Alert.alert(
                t('remove_bookmark_title'),
                t('remove_bookmark_desc'),
                [
                    { text: t('cancel'), style: 'cancel' },
                    {
                        text: t('remove'),
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
                Alert.alert(t('error'), t('failed_save_changes'));
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
                    <View style={[styles.timelineHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                        <View style={[styles.timelineDot, { [isRTL ? 'marginLeft' : 'marginRight']: 0, [isRTL ? 'marginRight' : 'marginLeft']: 0 }]} />
                        <Text style={[styles.timelineDate, { textAlign: isRTL ? 'right' : 'left' }]}>{date}</Text>
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
                                    {bookmark.post?.media?.[0] && (
                                        <Image
                                            source={{ uri: `${getApiBaseImage()}/storage/${bookmark.post.media[0].file_path}` }}
                                            style={styles.timelineThumb}
                                        />
                                    )}

                                    <View style={[styles.timelineInfo, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
                                        <View style={[styles.timelineRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                                            <Image
                                                source={{
                                                    uri: bookmark.post.user.profile_photo
                                                        ? `${getApiBaseImage()}/storage/${bookmark.post.user.profile_photo}`
                                                        : 'https://via.placeholder.com/20'
                                                }}
                                                style={[styles.timelineAvatar, { [isRTL ? 'marginLeft' : 'marginRight']: 8, [isRTL ? 'marginRight' : 'marginLeft']: 0 }]}
                                            />
                                            <Text style={[styles.timelineName, { textAlign: isRTL ? 'right' : 'left' }]}>{bookmark.post.user.name}</Text>
                                        </View>

                                        <Text style={[styles.timelineCaption, { textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={2}>
                                            {bookmark.post.caption || t('no_caption_provided')}
                                        </Text>

                                        {bookmark.note && (
                                            <View style={[styles.timelineNote, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                                                <Ionicons name="chatbubble" size={12} color={colors.tint} />
                                                <Text style={[styles.timelineNoteText, { textAlign: isRTL ? 'right' : 'left', [isRTL ? 'marginRight' : 'marginLeft']: 6, [isRTL ? 'marginLeft' : 'marginRight']: 0 }]}>{bookmark.note}</Text>
                                            </View>
                                        )}

                                        {!isWeb && (
                                            <View style={[styles.mobileActionButtons, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
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
                                        styles={styles}
                                        t={t}
                                        isRTL={isRTL}
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
                    {item.post?.media?.[0] && (
                        <Image
                            source={{ uri: `${getApiBaseImage()}/storage/${item.post.media[0].file_path}` }}
                            style={styles.gridImage}
                        />
                    )}
                    <View style={[styles.gridOverlay, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
                        <Text style={[styles.gridName, { textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={1}>{item.post.user.name}</Text>
                        {item.note && (
                            <View style={[styles.gridNote, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                                <Ionicons name="chatbubble" size={10} color={colors.text} />
                                <Text style={[styles.gridNoteText, { textAlign: isRTL ? 'right' : 'left', [isRTL ? 'marginRight' : 'marginLeft']: 4, [isRTL ? 'marginLeft' : 'marginRight']: 0 }]} numberOfLines={1}>{item.note}</Text>
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
                    style={[styles.listCard, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
                    onPress={() => navigateToPost(item.post_id)}
                    onLongPress={() => setSelectedBookmarks([item.post_id])}
                >
                    {item.post.media?.[0] && (
                        <Image
                            source={{ uri: `${getApiBaseImage()}/storage/${item.post.media[0].file_path}` }}
                            style={styles.listImage}
                        />
                    )}
                    <View style={[styles.listInfo, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
                        <View style={[styles.listHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                            <Image
                                source={{
                                    uri: item.post.user.profile_photo
                                        ? `${getApiBaseImage()}/storage/${item.post.user.profile_photo}`
                                        : 'https://via.placeholder.com/20'
                                }}
                                style={[styles.listAvatar, { [isRTL ? 'marginLeft' : 'marginRight']: 8, [isRTL ? 'marginRight' : 'marginLeft']: 0 }]}
                            />
                            <Text style={[styles.listName, { textAlign: isRTL ? 'right' : 'left' }]}>{item.post.user.name}</Text>
                        </View>
                        <Text style={[styles.listCaption, { textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={2}>
                            {item.post.caption || t('no_caption')}
                        </Text>
                        {item.note && (
                            <View style={[styles.listNote, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                                <Ionicons name="chatbubble" size={12} color={colors.textSecondary} />
                                <Text style={[styles.listNoteText, { textAlign: isRTL ? 'right' : 'left', [isRTL ? 'marginRight' : 'marginLeft']: 6, [isRTL ? 'marginLeft' : 'marginRight']: 0 }]}>{item.note}</Text>
                            </View>
                        )}
                    </View>
                </TouchableOpacity>
            )}
        />
    );

    // Common helper for collection name text style (moved inside to access result of getStyles properly if needed, but keeping it simple)
    const filteredChipTextStyle = (colId: string) => {
        return selectedCollection === colId ? { color: '#fff' } : { color: colors.text };
    };

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent
            onRequestClose={onClose}
        >
            <StatusBar barStyle={activeScheme === 'dark' ? 'light-content' : 'dark-content'} />

            <View style={[GlobalStyles.popupContainer as any, { zIndex: 6000 }]}>
                {/* Animated Background */}
                <LinearGradient
                    colors={getBackgroundGradient()}
                    style={StyleSheet.absoluteFill}
                />

                {/* Header */}
                <View style={[styles.header, { paddingTop: insets.top + 10, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                    <TouchableOpacity onPress={handleClose} style={styles.headerButton}>
                        <Ionicons name={isRTL ? "chevron-forward" : "close"} size={24} color={colors.text} />
                    </TouchableOpacity>

                    <View style={[styles.headerTitle, { alignItems: 'center' }]}>
                        <Text style={[styles.greeting, { textAlign: 'center' }]} numberOfLines={1}>{getTimeBasedGreeting()},</Text>
                        <Text style={[styles.headerMainTitle, { textAlign: 'center' }]}>{t('bookmarked_memories')}</Text>
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
                        <ScrollView 
                            horizontal 
                            showsHorizontalScrollIndicator={false} 
                            contentContainerStyle={[styles.filterScrollContent, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
                        >
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
                                    <Text style={[styles.filterChipText, filteredChipTextStyle(col.id), { textAlign: isRTL ? 'right' : 'left' }]}>{col.name}</Text>
                                    {col.id === 'all' && (
                                        <View style={[styles.filterBadge, { [isRTL ? 'marginRight' : 'marginLeft']: 4, [isRTL ? 'marginLeft' : 'marginRight']: 0 }]}>
                                            <Text style={styles.filterBadgeText}>{bookmarks.length}</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </MotiView>
                )}

                {/* Search Bar */}
                <View style={[styles.searchContainer, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                    <Ionicons name="search" size={18} color={colors.text} />
                    <TextInput
                        style={[styles.searchInput, { textAlign: isRTL ? 'right' : 'left' }]}
                        placeholder={t('search_collection_placeholder')}
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
                <View style={[styles.viewToggle, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
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
                        <Text style={[styles.emptyTitle, { textAlign: 'center' }]}>{t('empty_collection_title')}</Text>
                        <Text style={[styles.emptyText, { textAlign: 'center' }]}>
                            {t('empty_collection_desc')}
                        </Text>
                    </MotiView>
                ) : (
                    <View style={styles.content}>
                        {viewMode === 'timeline' && renderTimelineView()}
                        {viewMode === 'list' && renderListView()}
                        {viewMode === 'grid' && renderGridView()}
                    </View>
                )}

                {/* Note Modal - Restored as Modal per user request, but kept loop prevention logic */}
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
                             style={[styles.noteModal, GlobalStyles.responsiveModal as any, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}
                        >
                            <Text style={[styles.noteModalTitle, { textAlign: isRTL ? 'right' : 'left' }]}>{t('add_your_note')}</Text>
                            <Text style={[styles.noteModalSubtitle, { textAlign: isRTL ? 'right' : 'left' }]}>
                                {t('love_about_this')}
                            </Text>

                            <TextInput
                                style={[styles.noteInput, { textAlign: isRTL ? 'right' : 'left' }]}
                                placeholder={t('write_thoughts_placeholder')}
                                placeholderTextColor={colors.textSecondary}
                                multiline
                                value={noteText}
                                onChangeText={setNoteText}
                                autoFocus
                            />

                            <Text style={[styles.noteModalSubtitle, { marginBottom: 10, textAlign: isRTL ? 'right' : 'left' }]}>
                                {t('select_collection')}
                            </Text>
                             <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 10 }}
                                style={{ marginBottom: 20 }}
                            >
                                {COLLECTIONS.map((col) => (
                                    <TouchableOpacity
                                        key={`note-col-${col.id}`}
                                        style={[
                                            styles.filterChip,
                                            tempCollection === col.id && { backgroundColor: col.color },
                                            { flexDirection: isRTL ? 'row-reverse' : 'row' }
                                        ]}
                                        onPress={() => setTempCollection(col.id)}
                                    >
                                        <Ionicons name={col.icon as any} size={14} color={tempCollection === col.id ? "#fff" : colors.text} />
                                        <Text style={[styles.filterChipText, tempCollection === col.id && { color: '#fff' }, { textAlign: isRTL ? 'right' : 'left' }]}>{col.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            <View style={[styles.noteActions, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                                <TouchableOpacity
                                    style={[styles.noteButton, styles.noteCancel]}
                                    onPress={() => setShowNoteModal(false)}
                                >
                                    <Text style={styles.noteCancelText}>{t('cancel')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.noteButton, styles.noteSave]}
                                    onPress={saveNote}
                                >
                                    <Text style={styles.noteSaveText}>{t('save_note')}</Text>
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

const getStyles = (colors: any, activeScheme: string, width: number, height: number, isRTL: boolean) => StyleSheet.create({
    header: {
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
