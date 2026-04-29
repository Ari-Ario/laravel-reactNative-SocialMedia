# Marketplace Integration & Architectural Overview

The Marketplace in Zmzir is designed as a high-fidelity, real-time e-commerce layer integrated deeply with the platform's social and collaboration features. It leverages existing "Post" primitives to ensure feature parity and a consistent user experience while adding specialized P2P commerce capabilities.

## 1. Architectural Integration

### Core Components
- **`MarketTab` (`frontend/app/(tabs)/market/index.tsx`)**: The primary entry point. It implements a dual-mode interface ("Browse" vs. "My Items") with real-time state synchronization.
- **`MarketCard` (`frontend/components/Market/MarketCard.tsx`)**: The fundamental UI unit. It is a specialized interactive card that combines product metadata with social interaction layers.
- **`MarketStore`**: A Zustand-based store that manages pagination, searching, and local state updates for market items.

### Component Reuse (Social Parity)
The Marketplace achieves a "premium social commerce" feel by reusing core components from the Post system:
- **`PostActionButtons`**: Integrated at the bottom of each `MarketCard` to provide Likes (Reactions), Comments, Sharing, and Bookmarking.
- **`RenderComments`**: Enables full discussion threads on products, allowing buyers to ask questions publicly.
- **`MediaViewer`**: The platform's standard high-fidelity media carousel is used for inspecting product photos and videos.
- **`LinkPreviewCard`**: Reused to render rich metadata previews for external websites (e.g., official product pages or external reviews) found within item descriptions.

## 2. Link Preview System
As of the latest update, the Marketplace features an automated link detection system restricted to the **Description** field.
- **Logic**: A regex-based scanner (`useMemo`) identifies URLs in the description.
- **UI Placement**: The `LinkPreviewCard` renders immediately after the product description and location block, maintaining a "Text -> Preview" flow consistent with the main social feed.
- **Readability**: Links are prioritized from the description to avoid cluttering the product Title, ensuring a professional and scannable interface.

## 3. Chat & Communication Integration
The transition from "Browsing" to "Buying" is handled via the integrated Chat system:
- **Direct Inquiry**: Tapping "Message" on a Market item calls `startItemChat`.
- **Space Reuse Logic**: The system automatically checks for an existing 1-on-1 chat space between the buyer and seller. If a space already exists, it is reused; otherwise, a new one is created. This prevents redundant spaces while maintaining a clean chat history.
- **Contextual Sharing**: Upon creation or reuse, the system automatically sends a `post_share` message into the space. This message contains the product's title, price, and media preview, ensuring the seller immediately understands the context of the inquiry.
- **Settings Linkage**: The Space's `settings` object stores the `market_item_id` and `price`, allowing for potential future features like "Offer" or "Buy Now" buttons within the chat.

## 4. AI & Moderation Interactions
- **Translation**: `MarketCard` includes a built-in translation toggle (via MyMemory API) allowing users to translate product titles and descriptions into their preferred language.
- **Chatbot Knowledge**: The Zmzir AI Assistant has been trained with specific knowledge about the Marketplace, including how to sell items, understanding product conditions, and navigating the browse/mine tabs.
- **AI Moderation**: All marketplace content (titles, descriptions) is eligible for the platform's `quickCheck` AI moderation to ensure listings comply with community guidelines.

## 5. Real-time Synchronization (Pusher)
The Marketplace is "alive" thanks to deep Pusher integration:
- **Live Updates**: The `MarketTab` subscribes to the `market` channel.
- **Events Handled**:
  - `MarketItemUpdated`: Instantly updates price, description, or status across all viewing clients.
  - `MarketItemDeleted`: Removes items from the feed the moment they are taken down.
  - `MarketItemCommented / Reacted`: Synchronizes social feedback in real-time, keeping the engagement metrics accurate without refreshes.

## 6. Testing & Validation
- **Backend**: Verified via `MarketController` endpoints for CRUD and P2P logic.
- **Database**: `MarketItem` model correctly relates to `Media`, `Comments`, `Reactions`, `Bookmarks`, and `Reposts`.
- **Full Cleanup**: Deleting a market item now correctly removes all associated reactions, comments, bookmarks, and reposts to prevent database orphans.
- **Frontend**: Successfully tested with real-time event propagation and automated link preview rendering.

## 7. Future Algorithmic Roadmap
To further enhance the user experience, a specialized ranking algorithm will be implemented for the "Browse" feed, prioritizing items in the following order:
1. **Location Proximity**: Items closest to the user's registered or current location will be surfaced first.
2. **Personalized Interest**: AI-driven analysis of items previously viewed or interacted with by the user to suggest similar "interesting" listings.
3. **Global Engagement (Trending)**: High-activity items with the most views, reposts, reactions, and comments will be promoted to ensure the most relevant content is always visible.
