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
import getApiBaseImage from '@/services/getApiBaseImage';
import { useBookmarkStore } from '@/stores/bookmarkStore';
import AuthContext from '@/context/AuthContext';

const isWeb = Platform.OS === 'web';
const { width, height } = Dimensions.get('window');
const CARD_WIDTH = isWeb ? Math.min(width * 0.85, 1000) : width * 0.98;

const COLLECTIONS = [
    { id: 'all', name: 'All Saves', icon: 'apps', color: '#0d0d0d', gradient: ['#0d0d0d', '#1a1a1a'] },
    { id: 'read', name: 'Read Later', icon: 'bookmark-outline', color: '#660000', gradient: ['#660000', '#800000'] },
    { id: 'inspire', name: 'Inspiration', icon: 'bulb-outline', color: '#7b3f00', gradient: ['#7b3f00', '#8B4513'] },
    { id: 'share', name: 'To Share', icon: 'share-social-outline', color: '#004d00', gradient: ['#004d00', '#006400'] },
    { id: 'personal', name: 'Personal', icon: 'person-outline', color: '#310062', gradient: ['#310062', '#4b0082'] },
    { id: 'work', name: 'Work', icon: 'briefcase-outline', color: '#003366', gradient: ['#003366', '#004080'] },
    { id: 'research', name: 'Research', icon: 'flask-outline', color: '#4b0082', gradient: ['#4b0082', '#6a0dad'] },
    { id: 'favorites', name: 'Favorites', icon: 'heart-outline', color: '#cc0000', gradient: ['#cc0000', '#ff3333'] },
];

const WebActionButtons = ({ onAddNote, onRemove, onNavigate }: any) => (
    <View style={styles.webActionButtons}>
        <TouchableOpacity style={styles.webActionButton} onPress={onNavigate}>
            <Ionicons name="open-outline" size={18} color="#fff" />
            <Text style={styles.webActionText}>Open</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.webActionButton} onPress={onAddNote}>
            <Ionicons name="pencil" size={18} color="#fff" />
            <Text style={styles.webActionText}>Note</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.webActionButton, styles.webActionDelete]} onPress={onRemove}>
            <Ionicons name="trash-outline" size={18} color="#fff" />
            <Text style={styles.webActionText}>Delete</Text>
        </TouchableOpacity>
    </View>
);

export default function BookmarksScreen() {
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const { bookmarks, removeBookmark, updateBookmarkNote, moveToCollection } = useBookmarkStore();
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
        }
    }, [params.initialPostId, bookmarks]);

    const getTimeBasedGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 18) return 'Good Afternoon';
        return 'Good Evening';
    };

    const getBackgroundGradient = () => {
        const collection = COLLECTIONS.find(c => c.id === selectedCollection);
        if (collection && selectedCollection !== 'all') return collection.gradient as [string, string, ...string[]];
        return ['#0f0c29', '#302b63', '#24243e'] as [string, string, ...string[]];
    };

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

    const groupedByDate = filteredBookmarks.reduce((groups, bookmark) => {
        if (!bookmark || !bookmark.created_at) return groups;
        const date = new Date(bookmark.created_at).toLocaleDateString();
        if (!groups[date]) groups[date] = [];
        groups[date].push(bookmark);
        return groups;
    }, {} as Record<string, any[]>);

    const handleRemoveBookmark = (postId: number) => {
        const confirm = () => {
            removeBookmark(postId);
        };
        if (isWeb) {
            if (window.confirm('Remove this bookmark?')) confirm();
        } else {
            Alert.alert('Remove Bookmark', 'Remove this from your collection?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Remove', style: 'destructive', onPress: confirm },
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
            try {
                if (noteText !== currentBookmark.note) await updateBookmarkNote(currentBookmark.post_id, noteText);
                if (tempCollection !== currentBookmark.collection) await moveToCollection(currentBookmark.post_id, tempCollection);
                setShowNoteModal(false);
            } catch (error) {
                Alert.alert('Error', 'Failed to save changes');
            }
        }
    };

    const navigateToPost = (postId: number) => {
        router.push(`/post/${postId}`);
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
                    {items.map((bookmark: any, index: number) => (
                        <MotiView
                            key={`timeline-${bookmark.id}`}
                            from={{ opacity: 0, translateX: -20 }}
                            animate={{ opacity: 1, translateX: 0 }}
                            transition={{ delay: index * 50 }}
                            style={styles.timelineCard}
                        >
                            <LinearGradient colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']} style={styles.timelineGradient}>
                                <TouchableOpacity style={styles.timelineContent} onPress={() => navigateToPost(bookmark.post_id)}>
                                    {bookmark.post.media?.[0] && (
                                        <Image source={{ uri: `${getApiBaseImage()}/storage/${bookmark.post.media[0].file_path}` }} style={styles.timelineThumb} />
                                    )}
                                    <View style={styles.timelineInfo}>
                                        <View style={styles.timelineRow}>
                                            <Image source={{ uri: bookmark.post.user.profile_photo ? `${getApiBaseImage()}/storage/${bookmark.post.user.profile_photo}` : 'https://via.placeholder.com/20' }} style={styles.timelineAvatar} />
                                            <Text style={styles.timelineName}>{bookmark.post.user.name}</Text>
                                        </View>
                                        <Text style={styles.timelineCaption} numberOfLines={2}>{bookmark.post.caption || 'No caption'}</Text>
                                        {bookmark.note && (
                                            <View style={styles.timelineNote}>
                                                <Ionicons name="chatbubble" size={12} color="#fff" />
                                                <Text style={styles.timelineNoteText}>{bookmark.note}</Text>
                                            </View>
                                        )}
                                        {!isWeb && (
                                            <View style={styles.mobileActionButtons}>
                                                <TouchableOpacity style={styles.mobileActionButton} onPress={() => handleAddNote(bookmark)}><Ionicons name="pencil" size={18} color="#fff" /></TouchableOpacity>
                                                <TouchableOpacity style={[styles.mobileActionButton, styles.mobileActionDelete]} onPress={() => handleRemoveBookmark(bookmark.post_id)}><Ionicons name="trash-outline" size={18} color="#fff" /></TouchableOpacity>
                                            </View>
                                        )}
                                    </View>
                                </TouchableOpacity>
                                {isWeb && <WebActionButtons onAddNote={() => handleAddNote(bookmark)} onRemove={() => handleRemoveBookmark(bookmark.post_id)} onNavigate={() => navigateToPost(bookmark.post_id)} />}
                            </LinearGradient>
                        </MotiView>
                    ))}
                </View>
            )}
            contentContainerStyle={styles.timelineList}
        />
    );

    return (
        <View style={GlobalStyles.popupContainer}>
            <StatusBar barStyle="dark-content" />

            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}><Ionicons name="arrow-back" size={24} color="#333" /></TouchableOpacity>
                <View style={styles.headerTitle}>
                    <Text style={styles.greeting}>{getTimeBasedGreeting()},</Text>
                    <Text style={styles.headerMainTitle}>Your Collection</Text>
                </View>
                <TouchableOpacity style={styles.headerButton} onPress={() => setShowFilters(!showFilters)}><Ionicons name="options-outline" size={22} color="#333" /></TouchableOpacity>
            </View>

            {showFilters && (
                <MotiView from={{ opacity: 0, translateY: -20 }} animate={{ opacity: 1, translateY: 0 }} style={styles.filterBar}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {COLLECTIONS.map((col) => (
                            <TouchableOpacity key={col.id} style={[styles.filterChip, selectedCollection === col.id && { backgroundColor: col.color }]} onPress={() => setSelectedCollection(col.id)}>
                                <Ionicons name={col.icon as any} size={14} color={selectedCollection === col.id ? "#fff" : "#666"} />
                                <Text style={[styles.filterChipText, selectedCollection === col.id && { color: '#fff' }]}>{col.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </MotiView>
            )}

            <View style={styles.searchContainer}>
                <Ionicons name="search" size={18} color="rgba(255,255,255,0.5)" />
                <TextInput style={styles.searchInput} placeholder="Search your collection..." placeholderTextColor="rgba(255,255,255,0.5)" value={searchQuery} onChangeText={setSearchQuery} />
            </View>

            <View style={styles.content}>{renderTimelineView()}</View>

            {showNoteModal && (
                <View style={styles.modalOverlay}>
                    <MotiView from={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={styles.noteModal}>
                        <Text style={styles.noteModalTitle}>Save to Collection</Text>
                        
                        <View style={styles.collectionSelection}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                {COLLECTIONS.filter(c => c.id !== 'all').map((col) => (
                                    <TouchableOpacity 
                                        key={col.id} 
                                        style={[styles.modalTag, tempCollection === col.id && { backgroundColor: col.color, borderColor: col.color }]} 
                                        onPress={() => setTempCollection(col.id)}
                                    >
                                        <Ionicons name={col.icon as any} size={14} color={tempCollection === col.id ? "#fff" : "#666"} />
                                        <Text style={[styles.modalTagText, tempCollection === col.id && { color: '#fff' }]}>{col.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>

                        <TextInput 
                            style={styles.noteInput} 
                            placeholder="Add a note..." 
                            placeholderTextColor="#999" 
                            multiline 
                            value={noteText} 
                            onChangeText={setNoteText} 
                            autoFocus 
                        />
                        <View style={styles.noteActions}>
                            <TouchableOpacity style={[styles.noteButton, styles.noteCancel]} onPress={() => setShowNoteModal(false)}><Text style={styles.noteCancelText}>Cancel</Text></TouchableOpacity>
                            <TouchableOpacity style={[styles.noteButton, styles.noteSave]} onPress={saveNote}><Text style={styles.noteSaveText}>Save</Text></TouchableOpacity>
                        </View>
                    </MotiView>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 20 },
    headerButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.05)', justifyContent: 'center', alignItems: 'center' },
    headerTitle: { alignItems: 'center' },
    greeting: { fontSize: 12, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', letterSpacing: 1 },
    headerMainTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
    filterBar: { paddingHorizontal: 20, marginBottom: 15 },
    filterChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.05)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 25, marginRight: 10, gap: 6 },
    filterChipText: { color: '#666', fontSize: 13, fontWeight: '500' },
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.05)', marginHorizontal: 20, marginBottom: 15, paddingHorizontal: 15, paddingVertical: 10, borderRadius: 30, gap: 8 },
    searchInput: { flex: 1, color: '#333', fontSize: 14 },
    content: { flex: 1 },
    timelineSection: { marginBottom: 25 },
    timelineHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, paddingHorizontal: 20 },
    timelineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#333', marginRight: 10 },
    timelineDate: { color: '#333', fontSize: 14, fontWeight: '600', opacity: 0.8 },
    timelineCard: { width: CARD_WIDTH, marginHorizontal: 'auto', borderRadius: 24, marginBottom: 16, overflow: 'hidden', backgroundColor: '#fcfcfc', borderWidth: 1, borderColor: '#eee' },
    timelineGradient: { padding: 16 },
    timelineContent: { flexDirection: 'row', gap: 16 },
    timelineThumb: { width: 80, height: 80, borderRadius: 12 },
    timelineInfo: { flex: 1 },
    timelineRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 },
    timelineAvatar: { width: 18, height: 18, borderRadius: 9 },
    timelineName: { color: '#333', fontSize: 13, fontWeight: '600' },
    timelineCaption: { color: 'rgba(0,0,0,0.6)', fontSize: 12, marginBottom: 4 },
    timelineNote: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.05)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, gap: 6 },
    timelineNoteText: { color: '#666', fontSize: 11 },
    mobileActionButtons: { flexDirection: 'row', marginTop: 10, gap: 12, justifyContent: 'flex-end' },
    mobileActionButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 16 },
    mobileActionDelete: { backgroundColor: 'rgba(255,59,48,0.1)' },
    webActionButtons: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10, gap: 8 },
    webActionButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.05)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 4 },
    webActionDelete: { backgroundColor: 'rgba(255,68,68,0.1)' },
    webActionText: { color: '#666', fontSize: 12 },
    modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
    noteModal: { backgroundColor: '#fff', borderRadius: 24, padding: 24, width: '85%', maxWidth: 400 },
    noteModalTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', marginBottom: 16 },
    collectionSelection: { marginBottom: 20 },
    modalTag: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#eee', marginRight: 8, gap: 6 },
    modalTagText: { fontSize: 12, color: '#666', fontWeight: '500' },
    noteInput: { backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: 12, padding: 12, color: '#333', minHeight: 80, marginBottom: 20 },
    noteActions: { flexDirection: 'row', gap: 12 },
    noteButton: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
    noteCancel: { backgroundColor: 'rgba(0,0,0,0.05)' },
    noteSave: { backgroundColor: '#0084ff' },
    noteCancelText: { color: '#666', fontWeight: '600' },
    noteSaveText: { color: '#fff', fontWeight: '700' },
    timelineList: { paddingBottom: 100 },
});
