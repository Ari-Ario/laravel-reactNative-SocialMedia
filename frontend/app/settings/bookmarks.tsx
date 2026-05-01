import React, { useState, useEffect, useRef, useContext } from 'react';
import {
    View,
    Text,
    StyleSheet,
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
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlobalStyles } from '@/styles/GlobalStyles';
import { createShadow } from '@/utils/styles';
import Colors from '@/constants/Colors';
import { useAppTheme } from '@/hooks/useAppTheme';
import { BackButton } from '@/components/ui/IconButton';
import getApiBaseImage from '@/services/getApiBaseImage';
import { useBookmarkStore } from '@/stores/bookmarkStore';
import AuthContext from '@/context/AuthContext';
import { useTranslation } from '@/constants/i18n';

const isWeb = Platform.OS === 'web';
const isMobileWeb = isWeb && (
    (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches) ||
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        typeof navigator !== 'undefined' ? navigator.userAgent : ''
    )
);
const isDesktopWeb = isWeb && !isMobileWeb;

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = isDesktopWeb ? Math.min(width * 0.85, 1000) : width * 0.95;

const COLLECTIONS = [
    { id: 'all', name: 'all', icon: 'apps', color: '#0d0d0d', gradient: ['#0d0d0d', '#1a1a1a'] },
    { id: 'read', name: 'unread', icon: 'bookmark-outline', color: '#660000', gradient: ['#660000', '#800000'] },
    { id: 'inspire', name: 'insights', icon: 'bulb-outline', color: '#7b3f00', gradient: ['#7b3f00', '#8B4513'] },
    { id: 'share', name: 'connect', icon: 'share-social-outline', color: '#004d00', gradient: ['#004d00', '#006400'] },
    { id: 'personal', name: 'personal', icon: 'person-outline', color: '#310062', gradient: ['#310062', '#4b0082'] },
    { id: 'work', name: 'work', icon: 'briefcase-outline', color: '#003366', gradient: ['#003366', '#004080'] },
    { id: 'research', name: 'education', icon: 'flask-outline', color: '#4b0082', gradient: ['#4b0082', '#6a0dad'] },
    { id: 'favorites', name: 'favorites', icon: 'heart-outline', color: '#cc0000', gradient: ['#cc0000', '#ff3333'] },
];

const WebActionButtons = ({ onAddNote, onRemove, onNavigate }: any) => {
    const { t } = useTranslation();
    const { colors, activeScheme } = useAppTheme();
    const styles = getStyles(colors, activeScheme);
    return (
    <View style={styles.webActionButtons}>
        <TouchableOpacity style={styles.webActionButton} onPress={onNavigate}>
            <Ionicons name="open-outline" size={18} color={colors.text} />
            <Text style={styles.webActionText}>{t('open')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.webActionButton} onPress={onAddNote}>
            <Ionicons name="pencil" size={18} color={colors.text} />
            <Text style={styles.webActionText}>{t('edit')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.webActionButton, styles.webActionDelete]} onPress={onRemove}>
            <Ionicons name="trash-outline" size={18} color={colors.error} />
            <Text style={styles.webActionText}>{t('delete')}</Text>
        </TouchableOpacity>
    </View>
    );
};

const BookmarkCard = React.memo(({ 
    bookmark, 
    colors, 
    activeScheme, 
    styles, 
    isDesktopWeb, 
    onAddNote, 
    onRemove, 
    onNavigate 
}: any) => {
    const { t } = useTranslation();
    const item = bookmark.post || bookmark.market_item;
    const isMarket = !!bookmark.market_item;
    const title = isMarket ? item.title : item.caption;
    const media = item.media?.[0];
    const user = item.user;
    const itemId = isMarket ? bookmark.market_item_id : bookmark.post_id;

    if (!item) return null;

    return (
        <MotiView
            from={{ opacity: 0, translateX: -20 }}
            animate={{ opacity: 1, translateX: 0 }}
            transition={{ type: 'timing', duration: 300 }}
            style={styles.timelineCard}
        >
            <View style={styles.timelineGradient}>
                <TouchableOpacity 
                    style={styles.timelineContent} 
                    onPress={() => onNavigate(itemId, isMarket)}
                >
                    {media && (
                        <Image 
                            source={{ uri: `${getApiBaseImage()}/storage/${media.file_path}` }} 
                            style={styles.timelineThumb} 
                        />
                    )}
                    <View style={styles.timelineInfo}>
                        <View style={styles.timelineRow}>
                            <Image 
                                source={{ uri: user?.profile_photo ? `${getApiBaseImage()}/storage/${user.profile_photo}` : 'https://via.placeholder.com/20' }} 
                                style={styles.timelineAvatar} 
                            />
                            <Text style={styles.timelineName}>{user?.name || t('user')}</Text>
                        </View>
                        <Text style={styles.timelineCaption} numberOfLines={2}>
                            {title || t('untitled')}
                        </Text>
                        {bookmark.note && (
                            <View style={styles.timelineNote}>
                                <Ionicons name="chatbubble" size={12} color={colors.tint} />
                                <Text style={styles.timelineNoteText}>{bookmark.note}</Text>
                            </View>
                        )}
                        {!isDesktopWeb && (
                            <View style={styles.mobileActionButtons}>
                                <TouchableOpacity 
                                    style={styles.mobileActionButton} 
                                    onPress={() => onAddNote(bookmark)}
                                >
                                    <Ionicons name="pencil" size={18} color={colors.text} />
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={[styles.mobileActionButton, styles.mobileActionDelete]} 
                                    onPress={() => onRemove(itemId, isMarket)}
                                >
                                    <Ionicons name="trash-outline" size={18} color={colors.error} />
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </TouchableOpacity>
                {isDesktopWeb && (
                    <WebActionButtons 
                        onAddNote={() => onAddNote(bookmark)} 
                        onRemove={() => onRemove(itemId, isMarket)} 
                        onNavigate={() => onNavigate(itemId, isMarket)} 
                    />
                )}
            </View>
        </MotiView>
    );
});

BookmarkCard.displayName = 'BookmarkCard';

export default function BookmarksScreen() {
    const { t } = useTranslation();
    const { colors, activeScheme } = useAppTheme();
    const styles = getStyles(colors, activeScheme);
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const { bookmarks, removeBookmark, removeMarketBookmark, updateBookmarkNote, moveToCollection } = useBookmarkStore();
    const [selectedCollection, setSelectedCollection] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [showNoteModal, setShowNoteModal] = useState(false);
    const [currentBookmark, setCurrentBookmark] = useState<any>(null);
    const [noteText, setNoteText] = useState('');
    const [tempCollection, setTempCollection] = useState('all');
    const [viewMode, setViewMode] = useState<'grid' | 'list' | 'timeline'>('timeline');
    const [showFilters, setShowFilters] = useState(false);

    useEffect(() => {
        if (params.initialPostId) {
            const bookmark = bookmarks.find(b => b.post_id === Number(params.initialPostId));
            if (bookmark) handleAddNote(bookmark);
        } else if (params.initialMarketItemId) {
            const bookmark = bookmarks.find(b => b.market_item_id === Number(params.initialMarketItemId));
            if (bookmark) handleAddNote(bookmark);
        }
    }, [params.initialPostId, params.initialMarketItemId, bookmarks]);

    const getTimeBasedGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return t('home'); // Use 'home' as a proxy for 'morning' if no better key
        if (hour < 18) return t('home');
        return t('home');
    };

    const getBackgroundGradient = () => {
        const collection = COLLECTIONS.find(c => c.id === selectedCollection);
        if (collection && selectedCollection !== 'all') return collection.gradient as [string, string, ...string[]];
        return ['#0f0c29', '#302b63', '#24243e'] as [string, string, ...string[]];
    };

    const filteredBookmarks = bookmarks.filter(bookmark => {
        const item = bookmark.post || bookmark.market_item;
        if (!item) return false;
        if (selectedCollection !== 'all' && bookmark.collection !== selectedCollection) return false;
        if (searchQuery) {
            const searchLower = searchQuery.toLowerCase();
            const title = bookmark.market_item ? bookmark.market_item.title : bookmark.post.caption;
            return (
                title?.toLowerCase().includes(searchLower) ||
                item.user?.name?.toLowerCase().includes(searchLower) ||
                bookmark.note?.toLowerCase().includes(searchLower)
            );
        }
        return true;
    });

    const groupedByDate = filteredBookmarks.reduce((groups, bookmark) => {
        if (!bookmark || !bookmark.created_at) return groups;
        const date = new Date(bookmark.created_at).toLocaleDateString();
        if (!groups[date]) groups[date] = [];
        groups[date].push(bookmark);
        return groups;
    }, {} as Record<string, any[]>);

    const handleRemoveBookmark = (itemId: number, isMarket: boolean = false) => {
        const confirm = () => {
            if (isMarket) {
                removeMarketBookmark(itemId);
            } else {
                removeBookmark(itemId);
            }
        };
        if (isWeb) {
            if (window.confirm(t('remove_bookmark_confirm'))) confirm();
        } else {
            Alert.alert(t('remove_bookmark_title'), t('remove_bookmark_confirm'), [
                { text: t('cancel'), style: 'cancel' },
                { text: t('delete'), style: 'destructive', onPress: confirm },
            ]);
        }
    };

    const handleAddNote = (bookmark: any) => {
        setCurrentBookmark(bookmark);
        setNoteText(bookmark.note || '');
        setTempCollection(bookmark.collection || 'all');
        setShowNoteModal(true);
    };

    const saveNote = async () => {
        if (currentBookmark) {
            const isMarket = !!currentBookmark.market_item;
            const itemId = isMarket ? currentBookmark.market_item_id : currentBookmark.post_id;
            try {
                if (noteText !== currentBookmark.note) await updateBookmarkNote(itemId, noteText, isMarket);
                if (tempCollection !== currentBookmark.collection) await moveToCollection(itemId, tempCollection, isMarket);
                setShowNoteModal(false);
            } catch (error) {
                Alert.alert(t('error'), t('failed_update'));
            }
        }
    };

    const navigateToPost = (itemId: number, isMarket: boolean = false) => {
        if (isMarket) {
            router.push(`/post/${itemId}?isMarket=true`);
        } else {
            router.push(`/post/${itemId}`);
        }
    };

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
                    {items.map((bookmark: any) => (
                        <BookmarkCard
                            key={`card-${bookmark.id}`}
                            bookmark={bookmark}
                            colors={colors}
                            activeScheme={activeScheme}
                            styles={styles}
                            isDesktopWeb={isDesktopWeb}
                            onAddNote={handleAddNote}
                            onRemove={handleRemoveBookmark}
                            onNavigate={navigateToPost}
                        />
                    ))}
                </View>
            )}
            contentContainerStyle={styles.timelineList}
            initialNumToRender={3}
            maxToRenderPerBatch={3}
            windowSize={5}
            removeClippedSubviews={Platform.OS !== 'web'}
        />
    );

    return (
        <View style={GlobalStyles.popupContainer}>
            <StatusBar barStyle={activeScheme === 'dark' ? 'light-content' : 'dark-content'} />

            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                <BackButton onPress={() => router.back()} />
                <View style={styles.headerTitle}>
                    <Text style={styles.greeting}>{getTimeBasedGreeting()},</Text>
                    <Text style={styles.headerMainTitle}>{t('save')}</Text>
                </View>
                <TouchableOpacity style={styles.headerButton} onPress={() => setShowFilters(!showFilters)}><Ionicons name="options-outline" size={22} color={colors.text} /></TouchableOpacity>
            </View>

            {showFilters && (
                <MotiView from={{ opacity: 0, translateY: -20 }} animate={{ opacity: 1, translateY: 0 }} style={styles.filterBar}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {COLLECTIONS.map((col) => (
                            <TouchableOpacity key={col.id} style={[styles.filterChip, selectedCollection === col.id && { backgroundColor: col.color, borderColor: colors.text, borderWidth: 1 }]} onPress={() => setSelectedCollection(col.id)}>
                                <Ionicons name={col.icon as any} size={14} color={selectedCollection === col.id ? "#fff" : colors.text} />
                                <Text style={[styles.filterChipText, selectedCollection === col.id && { color: '#fff', fontWeight: '700' }]}>{t(col.name)}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </MotiView>
            )}

            <View style={styles.searchContainer}>
                <Ionicons name="search" size={18} color={colors.textSecondary} />
                <TextInput style={styles.searchInput} placeholder={t('search_placeholder')} placeholderTextColor={colors.textSecondary + '80'} value={searchQuery} onChangeText={setSearchQuery} />
            </View>

            <View style={styles.content}>{renderTimelineView()}</View>

            {showNoteModal && (
                <View style={[styles.modalOverlay, { backgroundColor: activeScheme === 'dark' ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.95)' }]}>
                    <MotiView from={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={styles.noteModal}>
                        <Text style={styles.noteModalTitle}>{t('edit')}</Text>
                        
                        <View style={styles.collectionSelection}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                {COLLECTIONS.filter(c => c.id !== 'all').map((col) => (
                                    <TouchableOpacity 
                                        key={col.id} 
                                        style={[styles.modalTag, tempCollection === col.id && { backgroundColor: col.color, borderColor: colors.text }]} 
                                        onPress={() => setTempCollection(col.id)}
                                    >
                                        <Ionicons name={col.icon as any} size={14} color={tempCollection === col.id ? "#fff" : colors.text} />
                                        <Text style={[styles.modalTagText, tempCollection === col.id && { color: '#fff', fontWeight: '700' }]}>{t(col.name)}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>

                        <TextInput 
                            style={styles.noteInput} 
                            placeholder={t('add_your_note')} 
                            placeholderTextColor="#999" 
                            multiline 
                            value={noteText} 
                            onChangeText={setNoteText} 
                            autoFocus 
                        />
                        <View style={styles.noteActions}>
                            <TouchableOpacity style={[styles.noteButton, styles.noteCancel]} onPress={() => setShowNoteModal(false)}><Text style={styles.noteCancelText}>{t('cancel')}</Text></TouchableOpacity>
                            <TouchableOpacity style={[styles.noteButton, styles.noteSave]} onPress={saveNote}><Text style={styles.noteSaveText}>{t('save')}</Text></TouchableOpacity>
                        </View>
                    </MotiView>
                </View>
            )}
        </View>
    );
}

function getStyles(colors: any, activeScheme: string) {
  return StyleSheet.create({
    header: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        paddingHorizontal: 20, 
        paddingBottom: 25,
        zIndex: 10
    },
    backButton: { padding: 4 },
    headerButton: { 
        width: 44, 
        height: 44, 
        borderRadius: 22, 
        backgroundColor: colors.surface, 
        borderWidth: 1.5,
        borderColor: colors.border,
        justifyContent: 'center', 
        alignItems: 'center',
        ...createShadow({ opacity: 0.15, radius: 8 })
    },
    headerTitle: { alignItems: 'center', flex: 1 },
    greeting: { 
        fontSize: 14, 
        color: colors.text, 
        textTransform: 'uppercase', 
        letterSpacing: 2,
        fontWeight: '700'
    },
    headerMainTitle: { 
        fontSize: 26, 
        fontWeight: '900', 
        color: colors.text 
    },
    filterBar: { paddingHorizontal: 20, marginBottom: 20 },
    filterChip: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        backgroundColor: colors.surface, 
        borderWidth: 1.5,
        borderColor: colors.border,
        paddingHorizontal: 18, 
        paddingVertical: 12, 
        borderRadius: 30, 
        marginRight: 10, 
        gap: 10 
    },
    filterChipText: { color: colors.text, fontSize: 15, fontWeight: '600' },
    searchContainer: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        backgroundColor: colors.surface, 
        borderWidth: 2,
        borderColor: colors.border,
        marginHorizontal: 20, 
        marginBottom: 25, 
        paddingHorizontal: 20, 
        paddingVertical: isDesktopWeb ? 12 : 16, 
        borderRadius: 35, 
        gap: 12,
        ...createShadow({ opacity: 0.15, height: 6 })
    },
    searchInput: { flex: 1, color: colors.text, fontSize: 17, fontWeight: '600' },
    content: { flex: 1 },
    timelineSection: { marginBottom: 35 },
    timelineHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, paddingHorizontal: 25 },
    timelineDot: { 
        width: 14, 
        height: 14, 
        borderRadius: 7, 
        backgroundColor: colors.tint, 
        marginRight: 15,
        borderWidth: 3,
        borderColor: colors.text
    },
    timelineDate: { 
        color: colors.text, 
        fontSize: 17, 
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 2
    },
    timelineCard: { 
        width: CARD_WIDTH, 
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
            elevation: 10
        })
    },
    timelineGradient: { padding: 24 },
    timelineContent: { flexDirection: 'row', gap: 24 },
    timelineThumb: { 
        width: 110, 
        height: 110, 
        borderRadius: 20,
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border
    },
    timelineInfo: { flex: 1, justifyContent: 'center' },
    timelineRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 12 },
    timelineAvatar: { 
        width: 28, 
        height: 28, 
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: colors.border
    },
    timelineName: { color: colors.textSecondary, fontSize: 14, fontWeight: '800' },
    timelineCaption: { 
        color: colors.text, 
        fontSize: 18, 
        fontWeight: '700', 
        lineHeight: 24, 
        marginBottom: 15 
    },
    timelineNote: { 
        flexDirection: 'row', 
        alignItems: 'flex-start', 
        backgroundColor: colors.background, 
        padding: 15, 
        borderRadius: 15, 
        marginTop: 5,
        gap: 10,
        borderLeftWidth: 4,
        borderLeftColor: colors.tint
    },
    timelineNoteText: { 
        color: colors.textSecondary, 
        fontSize: 14, 
        fontStyle: 'italic',
        lineHeight: 20,
        flex: 1 
    },
    mobileActionButtons: { flexDirection: 'row', marginTop: 20, gap: 15, justifyContent: 'flex-end' },
    mobileActionButton: { 
        width: 44, 
        height: 44, 
        alignItems: 'center', 
        justifyContent: 'center', 
        backgroundColor: colors.background, 
        borderRadius: 22,
        borderWidth: 1.5,
        borderColor: colors.border
    },
    mobileActionDelete: { 
        backgroundColor: activeScheme === 'dark' ? '#330000' : '#FFE5E5',
        borderColor: colors.error
    },
    webActionButtons: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 15, gap: 12 },
    webActionButton: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        backgroundColor: colors.background, 
        paddingHorizontal: 20, 
        paddingVertical: 12, 
        borderRadius: 15, 
        gap: 10,
        borderWidth: 1,
        borderColor: colors.border
    },
    webActionDelete: { 
        backgroundColor: activeScheme === 'dark' ? '#330000' : '#FFE5E5',
        borderColor: colors.error
    },
    webActionText: { color: colors.text, fontSize: 14, fontWeight: '800' },
    modalOverlay: { 
        ...StyleSheet.absoluteFillObject, 
        backgroundColor: 'rgba(255, 255, 255, 0.95)', 
        justifyContent: 'center', 
        alignItems: 'center', 
        zIndex: 1000 
    },
    noteModal: { 
        backgroundColor: colors.surface, 
        borderRadius: 35, 
        padding: 30, 
        width: '92%', 
        maxWidth: 450,
        borderWidth: 2,
        borderColor: colors.border,
        ...createShadow({ opacity: 0.15, radius: 25 })
    },
    noteModalTitle: { fontSize: 26, fontWeight: '900', color: colors.text, marginBottom: 20 },
    collectionSelection: { marginBottom: 25 },
    modalTag: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        paddingHorizontal: 16, 
        paddingVertical: 10, 
        borderRadius: 25, 
        borderWidth: 1.5, 
        borderColor: colors.border, 
        marginRight: 10, 
        gap: 8,
        backgroundColor: colors.background
    },
    modalTagText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
    noteInput: { 
        backgroundColor: colors.background, 
        borderRadius: 20, 
        padding: 20, 
        color: colors.text, 
        fontSize: 18,
        minHeight: 120, 
        marginBottom: 25,
        borderWidth: 1.5,
        borderColor: colors.border
    },
    noteActions: { flexDirection: 'row', gap: 15 },
    noteButton: { flex: 1, paddingVertical: 16, borderRadius: 20, alignItems: 'center' },
    noteCancel: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
    noteSave: { backgroundColor: colors.tint },
    noteCancelText: { color: colors.text, fontWeight: '800', fontSize: 16 },
    noteSaveText: { color: '#fff', fontWeight: '900', fontSize: 16 },
    timelineList: { paddingBottom: 100 },
});
}
