import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
  TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import debounce from 'lodash/debounce';
import { useTranslation } from '@/constants/i18n';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useModal } from '@/context/ModalContext';
import { useMarketStore } from '@/stores/marketStore';
import { startItemChat } from '@/services/MarketService';
import MarketCard from '@/components/Market/MarketCard';
import PusherService from '@/services/PusherService';
import * as Haptics from 'expo-haptics';
import CollaborationService from '@/services/ChatScreen/CollaborationService';
import getApiBaseImage from '@/services/getApiBaseImage';
import { MarketItem } from '@/services/MarketService';
import { MARKET_CATEGORIES } from '@/constants/MarketCategories';

export default function MarketTab() {
  const { t, isRTL } = useTranslation();
  const { colors, activeScheme } = useAppTheme();
  const styles = getStyles(colors, activeScheme, isRTL);
  const router = useRouter();

  const { 
    items, isLoading, isRefreshing, hasMore, loadItems, 
    myItems, myIsLoading, myIsRefreshing, myHasMore, loadMyItems,
    searchQuery, setSearchQuery 
  } = useMarketStore();
  const { openModal } = useModal();
  const [activeCategory, setActiveCategory] = useState<string | undefined>(undefined);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [viewType, setViewType] = useState<'browse' | 'mine'>('browse');
  const searchInputRef = React.useRef<import('react-native').TextInput>(null);

  const debouncedSearch = React.useCallback(
    debounce((query: string) => {
      if (viewType === 'browse') {
        loadItems(true, activeCategory);
      } else {
        loadMyItems(true);
      }
    }, 500),
    [activeCategory, viewType, loadItems, loadMyItems]
  );

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    debouncedSearch(text);
  };

  const categories = useMemo(() => [
    { id: 'all', name: t('all') },
    ...MARKET_CATEGORIES.map(cat => ({ ...cat, name: t(cat.name) }))
  ], [t]);

  useEffect(() => {
    if (viewType === 'browse') {
      loadItems(true, activeCategory);
    } else {
      loadMyItems(true);
    }

    // ✅ Real-time Market Updates
    PusherService.subscribeToMarket(
      (data: any) => {
        // New Comment
        const { itemId, comment } = data;
        useMarketStore.getState().updateItemLocally(itemId, (item) => ({
          ...item,
          comments: [...(item.comments || []).filter((c: any) => c.id !== comment.id), comment]
        }));
      },
      (data: any) => {
        // New Reaction
        const { itemId, reaction } = data;
        useMarketStore.getState().updateItemLocally(itemId, (item) => {
          const reactions = [...(item.reactions || []).filter((r: any) => r.user_id !== reaction.user_id), reaction];
          // Recalculate reaction counts
          const counts: any = {};
          reactions.forEach((r: any) => { counts[r.emoji] = (counts[r.emoji] || 0) + 1; });
          const reactionCounts = Object.keys(counts).map(emoji => ({ emoji, count: counts[emoji] }));

          return {
            ...item,
            reactions,
            reaction_counts: reactionCounts
          };
        });
      },
      (data: any) => {
        // Item Updated
        const { item } = data;
        useMarketStore.getState().addOrUpdateItem(item);
      },
      (data: any) => {
        // Item Deleted
        const { itemId } = data;
        useMarketStore.getState().removeItemLocally(itemId);
      }
    );

    return () => {
      PusherService.unsubscribeFromMarket();
    };
  }, [activeCategory, viewType]);

  const handleRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (viewType === 'browse') {
      loadItems(true, activeCategory);
    } else {
      loadMyItems(true);
    }
  };

  const handleLoadMore = () => {
    if (viewType === 'browse') {
      if (hasMore && !isLoading && !isRefreshing) {
        loadItems(false, activeCategory);
      }
    } else {
      if (myHasMore && !myIsLoading && !myIsRefreshing) {
        loadMyItems(false);
      }
    }
  };

  const handleChatPress = async (item: MarketItem) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const response = await startItemChat(item.id);
      if (response.space) {
        // Automatically send the item share so the owner knows the context
        const collaborationService = CollaborationService.getInstance();
        const baseUrl = getApiBaseImage();

        const metadata = {
          post_id: item.id,
          is_market: true,
          creator_name: item.user?.name || 'Anonymous',
          creator_avatar: item.user?.profile_photo,
          media: item.media || [],
          caption: item.description,
          is_internal_share: true,
          post_url: `${baseUrl}/post/${item.id}`,
        };

        await collaborationService.sendMessage(response.space.id, {
          content: `${t('market_inquiry_about')}: ${item.title}`,
          type: 'post_share',
          metadata
        });

        router.push(`/(spaces)/${response.space.id}`);
      }
    } catch (error) {
      console.error('Error starting chat:', error);
    }
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('market_marketplace')}</Text>
        <TouchableOpacity
          style={styles.searchBtn}
          onPress={() => {
            setIsSearchVisible(!isSearchVisible);
            if (!isSearchVisible) {
              setTimeout(() => searchInputRef.current?.focus(), 100);
            } else {
              setSearchQuery('');
              loadItems(true, activeCategory);
            }
          }}
        >
          <Ionicons name={isSearchVisible ? "close" : "search"} size={24} color={colors.text} />
        </TouchableOpacity>
      </View>
      {isSearchVisible && (
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            ref={searchInputRef as any}
            style={[styles.searchInput, { color: colors.text }]}
            placeholder={t('market_search_placeholder')}
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={handleSearchChange}
            clearButtonMode="while-editing"
          />
        </View>
      )}
      
      <View style={styles.switchWrapper}>
        <View style={styles.switchContainer}>
          <TouchableOpacity 
            style={[styles.switchTab, viewType === 'browse' && styles.switchTabActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setViewType('browse');
            }}
          >
            <Text style={[styles.switchText, viewType === 'browse' && styles.switchTextActive]}>
              {t('market_browse')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.switchTab, viewType === 'mine' && styles.switchTabActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setViewType('mine');
            }}
          >
            <Text style={[styles.switchText, viewType === 'mine' && styles.switchTextActive]}>
              {t('market_my_items')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderCategories = () => (
    <View style={styles.categoriesWrapper}>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={categories}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.categoriesList}
        renderItem={({ item }) => {
          const isActive = (activeCategory === item.id) || (!activeCategory && item.id === 'all');
          return (
            <TouchableOpacity
              style={[
                styles.categoryChip,
                isActive ? styles.categoryChipActive : { backgroundColor: colors.surface }
              ]}
              onPress={() => setActiveCategory(item.id === 'all' ? undefined : item.id)}
            >
              <Text style={[
                styles.categoryText,
                isActive ? styles.categoryTextActive : { color: colors.text }
              ]}>
                {item.name}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );

  const displayItems = viewType === 'browse' ? items : myItems;
  const isDisplayLoading = viewType === 'browse' ? isLoading : myIsLoading;
  const isDisplayRefreshing = viewType === 'browse' ? isRefreshing : myIsRefreshing;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {renderHeader()}
      {viewType === 'browse' && renderCategories()}

      <FlatList
        data={displayItems}
        keyExtractor={(item) => item.id.toString()}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <MarketCard
            item={item}
            onPress={() => {/* Future: Open detailed view */ }}
            onChatPress={() => handleChatPress(item)}
          />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isDisplayRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          isDisplayLoading && !isDisplayRefreshing ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          !isDisplayLoading && !isDisplayRefreshing ? (
            <View style={styles.emptyState}>
              <Ionicons name={viewType === 'browse' ? "storefront-outline" : "cube-outline"} size={64} color={colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {viewType === 'browse' ? t('market_no_items_found') : t('market_no_my_items')}
              </Text>
              {viewType === 'browse' && (
                <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
                  {t('market_be_first_to_sell')}
                </Text>
              )}
            </View>
          ) : null
        }
      />

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => openModal('create-market-item')}
      >
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>

    </SafeAreaView>
  );
}

const getStyles = (colors: any, scheme: string, isRTL: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerContainer: {
    paddingBottom: 8,
  },
  header: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
  },
  searchBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: colors.surface,
  },
  searchContainer: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  searchIcon: {
    marginRight: isRTL ? 0 : 8,
    marginLeft: isRTL ? 8 : 0,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
    textAlign: isRTL ? 'right' : 'left',
  },
  switchWrapper: {
    paddingHorizontal: 16,
    marginTop: 8,
  },
  switchContainer: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 4,
  },
  switchTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  switchTabActive: {
    backgroundColor: colors.primary,
  },
  switchText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  switchTextActive: {
    color: '#fff',
  },
  categoriesWrapper: {
    marginBottom: 8,
  },
  categoriesList: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  categoryChipActive: {
    backgroundColor: '#1DA1F2',
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  categoryTextActive: {
    color: '#fff',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100, // Space for FAB
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 16,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  }
});
