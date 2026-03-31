// app/(spaces)/[id].tsx
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Alert,
  Modal,
  TextInput,
  FlatList,
  Platform,
  ActivityIndicator,
  Image,
  useWindowDimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useContext, useCallback, useRef } from 'react';
import AuthContext from '@/context/AuthContext';
import { useCall } from '@/context/CallContext';
import CollaborationService, { CollaborativeActivity } from '@/services/ChatScreen/CollaborationService';
import { deleteReportByTarget } from '@/services/ReportService';
import GenericMenu, { MenuItem } from '@/components/GenericMenu';
import { calculateAnchor, AnchorPosition } from '@/utils/layout';
import { AICollaborationAssistant } from '@/components/AI/AICollaborationAssistant';
import * as Haptics from 'expo-haptics';
import { getToken, setToken } from '@/services/TokenService';
import { GuestJoinView } from '@/components/ChatScreen/GuestJoinView';
import CalendarView from '@/components/ChatScreen/CalendarView';
import CreateActivityModal from '@/components/ChatScreen/CreateActivityModal';
import CollaborativeActivities from '@/components/ChatScreen/CollaborativeActivities';
import CalendarPrompt from '@/components/ChatScreen/CalendarPrompt';
import MediaUploader from '@/services/ChatScreen/MediaUploader';
import MessageList from '@/components/ChatScreen/MessageList';
import { useNotificationStore } from '@/stores/notificationStore';
import { useToastStore } from '@/stores/toastStore';
import { useCollaborationStore } from '@/stores/collaborationStore';
import { useReportedContentStore } from '@/stores/reportedContentStore';
import Avatar from '@/components/Image/Avatar';
import Animated, { FadeIn, FadeOut, SlideOutDown } from 'react-native-reanimated';
import EnhancedInviteModal from '@/components/ChatScreen/EnhancedInviteModal';
import PollViewer from '@/components/ChatScreen/PollViewer';
import PollComponent from '@/components/ChatScreen/PollComponent';
import { InviteRecipient } from '@/components/ChatScreen/EnhancedInviteModal';
import SpaceChatTab from '@/components/ChatScreen/SpaceChatTab';
import SpaceExportModal from '@/components/ChatScreen/SpaceExportModal';
import SpaceSettingsModal from '@/components/ChatScreen/SpaceSettingsModal';
import { createShadow } from '@/utils/styles';
import WhiteboardCanvas from '@/components/ChatScreen/WhiteboardCanvas';
import ReportPost from '@/components/ReportPost';
import Colors from '@/constants/Colors';

const SpaceDetailScreen = () => {
  const { showToast } = useToastStore();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, setUser, logout } = useContext(AuthContext);
  const { activeCall, startCall, endCall, maximizeCall } = useCall();
  const [space, setSpace] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [magicEvents, setMagicEvents] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'chat' | 'whiteboard' | 'meeting' | 'document' | 'brainstorm' | 'calendar' | 'files' | 'ai' | 'polls'>('chat');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCalendarPrompt, setShowCalendarPrompt] = useState(false);
  const [showCreateActivity, setShowCreateActivity] = useState(false);
  const params = useLocalSearchParams();
  const [showMediaUploader, setShowMediaUploader] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const { unreadModerationCount } = useNotificationStore();
  
  // 🛡️ Route Isolation Guard: If the dynamic ID matches a known system route,
  // it means we've hit a collision (likely from a misspelled link). 
  // We return null to allow the top-level Router to find the correct static route or handle the cleanup.
  const isSystemRoute = ['Login', 'LoginScreen', 'RegisterScreen', 'VerificationScreen', 'ForgotPasswordScreen', 'ResetPasswordScreen', 'index'].includes(id || '');
  if (isSystemRoute) {
    console.log(`🛡️ Collision detected in (spaces)/[id]: Refusing to load space for system word: "${id}"`);
    return null;
  }

  // Dropdown menu states
  const [showCallMenu, setShowCallMenu] = useState(false);
  const [showSpaceMenu, setShowSpaceMenu] = useState(false);
  const [callMenuPosition, setCallMenuPosition] = useState<AnchorPosition>();
  const [spaceMenuPosition, setSpaceMenuPosition] = useState<AnchorPosition>();

  // Refs for button measurements
  const callButtonRef = useRef<any>(null);
  const spaceButtonRef = useRef<any>(null);

  const collaborationService = CollaborationService.getInstance();
  const windowHeight = Dimensions.get('window').height;
  const { width: windowWidth } = useWindowDimensions();

  // ✅ Web-compatible alert/confirm helpers
  const simpleAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const confirmAction = (title: string, message: string, confirmText: string, onConfirm: () => void) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n\n${message}`)) {
        onConfirm();
      }
    } else {
      Alert.alert(title, message, [
        { text: 'Cancel', style: 'cancel' },
        { text: confirmText, onPress: onConfirm, style: 'destructive' }
      ]);
    }
  };

  // ✅ Phase 57: Security Fallback for stale/unauthorized spaces
  const handleSpaceSecurityFallback = (error: any, context: string) => {
    const status = error?.response?.status;
    const errorMsg = error?.response?.data?.message || error?.message || '';
    const isModelNotFound = errorMsg.includes('No query results') || errorMsg.includes('not found') || status === 404;

    if (status === 404 || status === 403 || isModelNotFound) {
      console.log(`🛡️ Security/Stale fallback triggered (${status}) from ${context} for space ${id}`);

      // If there is no user, this is a guest trying to view a protected/unavailable space. Let GuestJoinView handle the UI state.
      if (!user) {
         console.log('Skipping security fallback for guest user, allowing GuestJoinView to render');
         return false; 
      }

      // Remove from collaboration store instantly
      const store = useCollaborationStore.getState();
      store.removeSpace(id as string);

      if (store.activeSpace?.id === id) {
        store.setActiveSpace(null);
      }

      const title = status === 404 || isModelNotFound ? 'Space Deleted' : 'Access Denied';
      const msg = status === 404 || isModelNotFound
        ? 'This space no longer exists and has been removed from your list.'
        : 'You are no longer a participant in this space.';

      Alert.alert(title, msg, [
        { text: 'OK', onPress: () => router.replace('/(tabs)/chats') }
      ]);
      return true; // Error was handled by cleanup/redirect
    }
    return false; // Error was not a security/stale fallback case
  };

  // Space Settings States
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const [showAdminsModal, setShowAdminsModal] = useState(false);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingDescription, setEditingDescription] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<any>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showActivitiesModal, setShowActivitiesModal] = useState(false);

  // poll states
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [polls, setPolls] = useState<any[]>([]);
  const [hasInitialTabSet, setHasInitialTabSet] = useState(false); // ✅ Add this flag
  const [showExportModal, setShowExportModal] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [isArchived, setIsArchived] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  // ✅ Strict "Locked" UI Logic
  const spaceUpcomingCounts = useCollaborationStore(state => state.spaceUpcomingCounts);
  const myParticipation = space?.my_participation || space?.participation;
  const isPending = myParticipation?.role === 'pending';
  const isLocked = (space?.space_type === 'protected') &&
    (isPending || !myParticipation);

  const myPermissions = space?.my_permissions || myParticipation?.permissions || {};
  const canInvite = myPermissions?.can_invite !== false;
  const canStartCalls = myPermissions?.can_start_calls !== false;
  const canEditSpace = myPermissions?.can_edit_space === true || myParticipation?.role === 'owner';
  const canRemove = myPermissions?.can_remove === true || myParticipation?.role === 'owner';
  const canChangeRoles = myPermissions?.can_change_roles === true || myParticipation?.role === 'owner';



  const loadSpaceDetails = async (force: boolean = false) => {
    if (!force && space && space.id === id) {
      console.log('♻️ Space details already loaded, skipping re-fetch:', id);
      setLoading(false);
      return;
    }
    console.log('Loading space details for ID:', id);
    setLoading(true);
    try {
      let spaceData;
      if (user) {
        spaceData = await collaborationService.fetchSpaceDetails(id as string);
      } else {
        spaceData = await collaborationService.fetchGuestSpaceInfo(id as string);
      }

      // 🛡️ Guest Access Restriction: Only allow 'channel' and 'general' types
      const isGuest = !user || user.is_guest;
      if (isGuest && !['channel', 'general'].includes(spaceData.space_type)) {
        console.log(`🛡️ User identified as guest (${isGuest ? 'guest session' : 'no session'}) and blocked from restricted space type: "${spaceData.space_type}"`);
        setLoading(false);
        setSpace(null);
        return;
      }

      console.log('Space data loaded:', {
        id: spaceData.id,
        title: spaceData.title,
        type: spaceData.space_type,
        participants: spaceData.participants?.length
      });

      setSpace(spaceData);
      setParticipants(spaceData.participants || []);
      setMagicEvents(spaceData.magic_events || []);

      // Initialize management states (for logged in users)
      if (user) {
        const perms = spaceData.my_permissions || {};
        setIsMuted(perms.is_muted || false);
        setIsPinned(perms.is_pinned || false);
        setIsArchived(perms.is_archived || false);

        // Fetch activities for this space to ensure badges and popups are fresh
        useCollaborationStore.getState().fetchSpaceActivities(id as string).catch(err =>
          console.error('Error fetching space activities in [id].tsx:', err)
        );
      }

      // ✅ FIX: Default to chat always, unless tab or call param explicitly passed
      if (!hasInitialTabSet) {
        const validTabs = ['chat', 'whiteboard', 'meeting', 'document', 'brainstorm', 'calendar', 'files', 'ai', 'polls'];
        if (params.call) {
          setActiveTab('meeting');
        } else if (params.tab && validTabs.includes(params.tab as string)) {
          setActiveTab(params.tab as any);
        } else {
          setActiveTab('chat');
        }
        setHasInitialTabSet(true);
      }

      if (params.justCreated === 'true') {
        const groupSpaces = ['meeting', 'brainstorm', 'workshop', 'document', 'whiteboard'];
        if (groupSpaces.includes(spaceData.space_type)) {
          setTimeout(() => {
            setShowCalendarPrompt(true);
          }, 1500);
        }
      }

      // Fetch space-specific activities for badge
      useCollaborationStore.getState().fetchSpaceActivities(id as string);
    } catch (error: any) {
      console.error('Error loading space:', error, JSON.stringify(error?.response?.data || {}));

      // ✅ Phase 57: Centralized security/stale fallback
      if (handleSpaceSecurityFallback(error, 'loadSpaceDetails')) return;

      if (user) {
         Alert.alert('Error', 'Failed to load space details');
      }
    } finally {
      setLoading(false);
    }
  };

  // Add poll loading function
  const loadPolls = async () => {
    try {
      const spacePolls = await collaborationService.getPolls(id);
      setPolls(prev => {
        // Create a map of existing polls
        const pollMap = new Map(prev.map(p => [p.id, p]));

        // Update with new data
        spacePolls.forEach(poll => {
          pollMap.set(poll.id, poll);
        });

        // Convert back to array and sort by date
        return Array.from(pollMap.values())
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      });
    } catch (error) {
      console.error('Error loading polls:', error);
      // ✅ Phase 57: Fallback if polls fail due to deletion/auth
      handleSpaceSecurityFallback(error, 'loadPolls');
    }
  };

  const subscribeToSpace = async () => {
    try {
      await collaborationService.subscribeToSpace(id as string, 'space-root', {
        onSpaceUpdate: (updatedData) => {
          // updatedData is the payload containing { space: {...}, changes: {...} }
          console.log('🔄 Space updated via Pusher:', updatedData?.space?.title || id);
          if (updatedData?.space) {
            setSpace((prev: any) => {
              if (!prev) return updatedData.space;
              // Only merge the 'space' object from the payload
              return { ...prev, ...updatedData.space };
            });
          }
        },
        onParticipantJoined: (participant) => {
          setParticipants(prev => {
            const pId = participant.user_id || participant.user?.id;
            if (!pId) return prev;
            if (prev.some(p => String(p.user_id) === String(pId))) return prev;
            return [...prev, participant];
          });
        },
        onParticipantLeft: (participant) => {
          const pId = participant.user_id || participant.user?.id;
          console.log(`👤 Removing participant ${pId} from space ${id}`);
          if (pId) {
            setParticipants(prev => prev.filter(p => String(p.user_id) !== String(pId)));

            // ✅ Redundant redirect removed.
            // Authority for space access resides in loadSpaceDetails and handleSpaceSecurityFallback (403/404 handling).
            // Misfiring here causes "Access Denied" errors when simply leaving a WebRTC call.
            console.log(`👤 Participant ${pId} left space ${id}`);
          }
        },
        onSpaceDeleted: () => {
          console.log('🗑️ Space deleted event received, redirecting...');
          router.replace('/(tabs)/chats');
          simpleAlert('Space Deleted', 'This space has been deleted by the owner.');
        },
        onParticipantUpdate: (participant) => {
          setParticipants(prev => {
            const pId = participant.user_id || participant.user?.id;
            if (!pId) return prev;

            const existingIndex = prev.findIndex(p => String(p.user_id) === String(pId));
            if (existingIndex >= 0) {
              const updated = [...prev];
              // Merge existing with updated data to preserve fields like 'user' object
              updated[existingIndex] = { ...updated[existingIndex], ...participant };
              return updated;
            } else {
              // If not found and it's an update, we still add it for consistency
              return [...prev, participant];
            }
          });

          if (`${participant.user_id}` !== `${user?.id}`) {
            useNotificationStore.getState().addNotification({
              type: 'participant_joined',
              title: 'New Participant',
              message: `${participant.user?.name || 'Someone'} joined the space`,
              data: participant,
              spaceId: id,
              userId: participant.user_id,
              avatar: participant.user?.profile_photo,
              createdAt: new Date()
            });
          }
        },
        onContentUpdate: (contentState) => {
          setSpace((prev: any) => ({
            ...prev,
            content_state: contentState,
            updated_at: new Date().toISOString()
          }));
        },

        // chat real-time granular updates
        onMessage: (message) => {
          console.log('💬 New message (onMessage):', message);
          setSpace((prev: any) => {
            const msgs = prev?.content_state?.messages || [];
            // message might be nested under { message: {...} } or raw
            const newMsg = message.message || message;
            
            // Avoid duplicates
            if (msgs.some((m: any) => m.id === newMsg.id)) {
              return prev;
            }
            
            return {
              ...prev,
              content_state: {
                ...prev?.content_state,
                messages: [newMsg, ...msgs] // Prepend for standard chat list order
              }
            };
          });
        },
        onMessageReplied: (data) => {
          console.log('↩️ Message replied (live chat):', data);
          setSpace((prev: any) => {
            const msgs = prev?.content_state?.messages || [];
            // Assuming data.message contains the newly created reply message from the backend
            const replyMsg = data.message || data;
            if (msgs.find((m: any) => m.id === replyMsg.id)) return prev; // Avoid dupes
            return {
              ...prev,
              content_state: {
                ...prev?.content_state,
                messages: [...msgs, replyMsg]
              }
            };
          });
        },

        onMessageReacted: (data) => {
          console.log('👍 Message reacted (live chat):', data);
          setSpace((prev: any) => {
            const msgs = [...(prev?.content_state?.messages || [])];
            // backend sends: { message: {...}, user: {...}, reaction: "👍", id: message_id }
            const msgId = data.id || data.message?.id || data.messageId;
            const updatedMsgObj = data.message;
            if (!msgId) return prev;

            const index = msgs.findIndex((m: any) => m.id === msgId);
            if (index !== -1) {
              // If backend sends the fully updated message object, replace it
              if (updatedMsgObj && updatedMsgObj.reactions) {
                msgs[index] = { ...msgs[index], reactions: updatedMsgObj.reactions };
              } else {
                // otherwise manually append reaction to existing list
                const emoji = data.reaction || data.emoji;
                const reactorId = data.user?.id || data.userId;
                if (emoji && reactorId) {
                  const existingReactions = msgs[index].reactions || [];
                  const existingIdx = existingReactions.findIndex((r: any) => r.user_id === reactorId && r.reaction === emoji);

                  if (existingIdx !== -1) {
                    existingReactions.splice(existingIdx, 1); // toggle off
                  } else {
                    existingReactions.push({
                      user_id: reactorId,
                      reaction: emoji,
                      created_at: new Date().toISOString()
                    });
                  }
                  msgs[index] = { ...msgs[index], reactions: [...existingReactions] };
                }
              }
            }
            return {
              ...prev,
              content_state: {
                ...prev?.content_state,
                messages: msgs
              }
            };
          });
        },

        onMessageDeleted: (data) => {
          console.log('🗑️ Message deleted (live chat):', data);
          setSpace((prev: any) => {
            const msgs = prev?.content_state?.messages || [];
            const msgId = data.id || data.messageId;
            return {
              ...prev,
              content_state: {
                ...prev?.content_state,
                messages: msgs.filter((m: any) => m.id !== msgId)
              }
            };
          });
        },

        // poll events
        onPollCreated: (poll) => {
          console.log('📊 New poll received:', poll);
          setPolls(prev => {
            if (prev.some(p => p.id === poll.id)) {
              return prev;
            }
            return [poll, ...prev];
          });

          useNotificationStore.getState().addNotification({
            type: 'poll_created',
            title: '📊 New Poll',
            message: `${poll.creator?.name || 'Someone'} created a poll: ${poll.question.substring(0, 50)}${poll.question.length > 50 ? '...' : ''}`,
            data: poll,
            spaceId: id,
            userId: poll.created_by,
            createdAt: new Date()
          });

          if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        },

        onPollDeleted: (pollId) => {
          console.log('🗑️ Poll deleted:', pollId);
          setPolls(prev => {
            // Filter out the deleted poll
            const filtered = prev.filter(p => p.id !== pollId);

            // If we're on the polls tab, force a re-render
            if (activeTab === 'polls') {
              return [...filtered];
            }

            return filtered;
          });

          // Optional: Show a notification
          useNotificationStore.getState().addNotification({
            type: 'poll_deleted',
            title: '🗑️ Poll Deleted',
            message: `A poll has been deleted`,
            data: { pollId },
            spaceId: id,
            createdAt: new Date()
          });

          if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          }
        },

        onPollUpdated: (poll) => {
          console.log('📊 Poll updated:', poll.id);
          setPolls(prev => {
            const updated = prev.map(p =>
              p.id === poll.id || p.parent_poll_id === poll.id ? { ...poll, id: p.id } : p
            );
            return activeTab === 'polls' ? [...updated] : updated;
          });
        },

        onMagicEvent: (event) => {
          console.log('Magic event received:', event.event_type);
          setMagicEvents(prev => [event, ...prev]);
          if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }

          useNotificationStore.getState().addNotification({
            type: 'magic_event',
            title: '✨ Magic Event!',
            message: `A magical event occurred in the space`,
            data: event,
            spaceId: id,
            userId: event.triggered_by,
            createdAt: new Date()
          });
        },
        onCallStarted: (data) => {
          console.log('Call started:', data);
          useNotificationStore.getState().addNotification({
            type: 'call_started',
            title: 'Call Started',
            message: `${data.user?.name || 'Someone'} started a call`,
            data: data,
            spaceId: id,
            userId: data.user?.id,
            avatar: data.user?.profile_photo,
            createdAt: new Date()
          });
        },
        onCallEnded: (data) => {
          console.log('Call ended:', data);
          useNotificationStore.getState().addNotification({
            type: 'call_ended',
            title: 'Call Ended',
            message: `The call has ended`,
            data: data,
            spaceId: id,
            userId: data.user?.id || data.user_id,
            createdAt: new Date()
          });
        },
        onScreenShareStarted: (data) => {
          console.log('Screen share started:', data);
          useNotificationStore.getState().addNotification({
            type: 'screen_share',
            title: 'Screen Sharing',
            message: `${data.user?.name || 'Someone'} started sharing screen`,
            data: data,
            spaceId: id,
            userId: data.user?.id,
            avatar: data.user?.profile_photo,
            createdAt: new Date()
          });
        },
        onScreenShareEnded: (data) => {
          console.log('Screen share ended:', data);
        },
        onMuteStateChanged: (data) => {
          console.log('Mute state changed:', data);
        },
        onvideoStateChanged: (data) => {
          console.log('Video state changed:', data);
        },
      });
      console.log('Subscribed to space updates');
    } catch (error) {
      console.error('Error subscribing to space:', error);
      handleSpaceSecurityFallback(error, 'subscribeToSpace');
    }
  };

  const unsubscribeFromSpace = () => {
    try {
      collaborationService.unsubscribeFromSpace(id as string, 'space-root');
      console.log('Unsubscribed from space');
    } catch (error) {
      console.error('Error unsubscribing from space:', error);
    }
  };

  // Space Settings Functions
  const handleOpenSettings = () => {
    setEditingTitle(space?.title || '');
    setEditingDescription(space?.description || '');
    setShowSettingsModal(true);
    setShowSpaceMenu(false);
  };

  const handleUpdateSpace = async () => {
    try {
      const updatedSpace = await collaborationService.updateSpace(id as string, {
        title: editingTitle,
        description: editingDescription,
      });

      setSpace(updatedSpace);
      setShowSettingsModal(false);

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      Alert.alert('Success', 'Space updated successfully');
    } catch (error) {
      console.error('Error updating space:', error);
      Alert.alert('Error', 'Failed to update space');
    }
  };

  const handleUpdateSpacePhoto = async () => {
    setShowMediaUploader(true);
  };

  const handleChangeRole = async (participantId: number, newRole: string) => {
    try {
      await collaborationService.updateParticipantRole(id as string, participantId, newRole);

      setParticipants(prev => prev.map(p =>
        p.user_id === participantId ? { ...p, role: newRole } : p
      ));

      setShowRoleModal(false);

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      Alert.alert('Success', `Role updated to ${newRole}`);
    } catch (error) {
      console.error('Error updating role:', error);
      Alert.alert('Error', 'Failed to update role');
    }
  };

  const handleRemoveParticipant = async (participantId: number) => {
    Alert.alert(
      'Remove Participant',
      'Are you sure you want to remove this participant?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await collaborationService.removeParticipant(id as string, participantId);
              setParticipants(prev => prev.filter(p => p.user_id !== participantId));

              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              }
            } catch (error) {
              console.error('Error removing participant:', error);
              Alert.alert('Error', 'Failed to remove participant');
            }
          }
        }
      ]
    );
  };

  const handleLeaveSpace = async () => {
    confirmAction(
      'Leave Space',
      'Are you sure you want to leave this space?',
      'Leave',
      async () => {
        try {
          await collaborationService.leaveSpace(id as string);
          router.replace('/(tabs)/chats');
        } catch (error: any) {
          console.error('Error leaving space:', error);
          if (error.response?.status === 403 && error.response?.data?.message) {
            simpleAlert('Cannot Leave', error.response.data.message);
          } else {
            simpleAlert('Error', 'Failed to leave space');
          }
        }
      }
    );
    setShowSpaceMenu(false);
  };

  const handleDeleteSpace = async () => {
    const warningMessage = 'The space will be deleted forever for all participants with all messages and belongings. Proceed?';

    confirmAction(
      'Delete Space Forever',
      warningMessage,
      'Delete',
      async () => {
        setIsDeleting(true);
        try {
          await collaborationService.deleteSpace(id as string);
          router.replace('/(tabs)/chats');
          simpleAlert('Success', 'Space deleted forever.');
        } catch (error) {
          console.error('Error deleting space:', error);
          simpleAlert('Error', 'Failed to delete space');
        } finally {
          setIsDeleting(false);
        }
      }
    );
    setShowSpaceMenu(false);
  };

  const handleExportContentClick = () => {
    setShowSpaceMenu(false);
    setShowExportModal(true);
  };

  const handleStartCall = async (type: 'video' | 'audio') => {
    try {
      console.log(`📞 Starting ${type} call via global context`);
      // Start call via API first to get the call ID
      const response = await collaborationService.startCall(id as string, type);
      const call = response.call || response;
      
      startCall({
        spaceId: id as string,
        spaceType: 'group',
        type,
        callId: call.id
      });
      
      // ✅ Close the call menu dropdown
      setShowCallMenu(false);
      setActiveTab('meeting');
      router.setParams({ tab: 'meeting', type });
    } catch (error) {
      console.error('Error starting call:', error);
      Alert.alert('Error', 'Failed to start call');
    }
  };
  const handleGuestJoin = async (guestName: string) => {
    try {
      const { user: guestUser, token, space: joinedSpace } = await collaborationService.joinSpaceAsGuest(id as string, guestName);

      // Save token so subsequent calls work
      await setToken(token);

      // Update global auth state with the temporary guest user
      setUser(guestUser);

      // Initialize real-time connection for guest
      try {
        const PusherService = require('@/services/PusherService').default;
        PusherService.initialize(token);
      } catch (e) {
        console.log("Pusher init failed for guest", e);
      }

      // Update local state
      setSpace(joinedSpace);
      setParticipants(joinedSpace.participants || []);

      // Haptics
      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      // Re-subscribe with the new token identity
      subscribeToSpace();
    } catch (error) {
      console.error('Guest join failed:', error);
      showToast('Failed to join as guest', 'error');
    }
  };

  const handleJoin = async () => {
    if (!id || isJoining) return;

    setIsJoining(true);
    try {
      const { participation, space: joinedSpace } = await collaborationService.joinSpace(id as string);

      // ✅ Update global store immediately
      useCollaborationStore.getState().addSpace(joinedSpace);

      setSpace((prev: any) => ({
        ...prev,
        ...joinedSpace,
        my_participation: participation,
        my_permissions: participation.permissions,
        my_role: participation.role,
      }));

      setParticipants(joinedSpace.participants || []);

      // ✅ Clear all local notifications related to this space (binding Join & Accept)
      useNotificationStore.getState().removeSpaceNotifications(id as string);

      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      // Force re-subscription to pick up new permissions
      subscribeToSpace();
    } catch (error) {
      console.error('Error joining space:', error);
      showToast('Failed to join space. Please try again.', 'error');
    } finally {
      setIsJoining(false);
    }
  };

  const handleInviteUsers = async (recipients: InviteRecipient[]) => {
    const userIds = recipients
      .filter(r => r.type !== 'space' && r.userData?.id)
      .map(r => r.userData.id);

    const spaceIds = recipients
      .filter(r => r.type === 'space' && r.userData?.id)
      .map(r => r.userData.id);

    try {
      if (userIds.length > 0) {
        await collaborationService.inviteToSpace(id as string, userIds, 'participant');
      }

      if (spaceIds.length > 0) {
        console.log('Would link spaces:', spaceIds);
      }

      showToast(`Invited ${userIds.length} user(s) to the space${spaceIds.length > 0 ? ` and linked ${spaceIds.length} space(s)` : ''}`, 'success');
    } catch (error) {
      console.error('Error inviting users:', error);
      showToast('Failed to send some invites. Please try again.', 'error');
      throw error;
    }
  };

  const handleDiscoverMagic = async (eventId: string) => {
    try {
      await collaborationService.discoverMagicEvent(eventId);
      setMagicEvents(prev => prev.map(event =>
        event.id === eventId ? { ...event, has_been_discovered: true } : event
      ));
      showToast('Magic Discovered! You found a hidden surprise!', 'success');
    } catch (error) {
      console.error('Error discovering magic:', error);
    }
  };

  const measureCallButton = () => {
    if (callButtonRef.current) {
      callButtonRef.current.measure((x: number, y: number, width: number, height: number, pageX: number, pageY: number) => {
        setCallMenuPosition(calculateAnchor(pageX, pageY, width, height, 220));
        setShowCallMenu(true);
      });
    }
  };

  const measureSpaceButton = () => {
    if (spaceButtonRef.current) {
      spaceButtonRef.current.measure((x: number, y: number, width: number, height: number, pageX: number, pageY: number) => {
        setSpaceMenuPosition(calculateAnchor(pageX, pageY, width, height, 220));
        setShowSpaceMenu(true);
      });
    }
  };

  const getSpaceTypeIcon = (type: string): string => {
    const icons: Record<string, string> = {
      chat: 'chatbubble',
      whiteboard: 'easel',
        voice_channel: 'mic',
    };
    return icons[type] || 'cube';
  };

  // ✅ Re-ordered Effects (after handlers)
  // ✅ Real-time space management listener
  useEffect(() => {
    // We listen to the notification store for system events we added in PusherService
    const unsubscribe = useNotificationStore.subscribe((state) => {
      const lastNotif = state.notifications[0];
      if (!lastNotif || lastNotif.spaceId !== id) return;

      switch (lastNotif.type) {
        case 'space_muted':
          setIsMuted(lastNotif.data.is_muted);
          break;
        case 'space_pinned':
          setIsPinned(lastNotif.data.is_pinned);
          break;
        case 'space_archived':
          setIsArchived(lastNotif.data.is_archived);
          break;
      }
    });

    return () => unsubscribe();
  }, [id]);

  // ✅ Load initial details
  useEffect(() => {
    if (id && id !== 'Login' && id !== 'undefined' && id !== '[id]') {
      loadSpaceDetails();
    }
  }, [id, user]);

  // ✅ Manage real-time subscription - reactive to participation changes
  useEffect(() => {
    // 🛡️ Only subscribe if we have a user and a VALID participation record
    if (id && user && id !== 'Login' && id !== 'undefined' && id !== '[id]') {
      const hasParticipation = !!space?.my_participation;
      const isPending = space?.my_participation?.role === 'pending';
      const isGuest = user.is_guest;

      // Log subscription attempt context for debugging
      console.log(`🔌 Pusher: Subscription Check (Space: ${id})`, {
        hasUser: !!user,
        isGuest: isGuest,
        hasParticipation: hasParticipation,
        isPending: isPending
      });

      if (hasParticipation && !isPending) {
        subscribeToSpace();
      }
    }

    return () => {
      if (id !== 'Login' && id !== 'undefined') {
        unsubscribeFromSpace();
      }
    };
  }, [id, user, !!space?.my_participation, space?.my_participation?.role]);

  // Eagerly load polls when space loads
  useEffect(() => {
    if (space?.id) {
      loadPolls();
    }
  }, [space?.id, !!space?.my_participation, space?.my_participation?.role]);

  useEffect(() => {
    if (activeTab === 'polls' && space?.id) {
      loadPolls();
    }
  }, [activeTab]);

  useEffect(() => {
    if (space?.id && params.justCreated === 'true') {
      const groupSpaces = ['meeting', 'brainstorm', 'workshop', 'document', 'whiteboard'];
      if (groupSpaces.includes(space.space_type)) {
        if (participants.length > 2 || space.space_type !== 'voice_channel') {
          const timer = setTimeout(() => setShowCalendarPrompt(true), 1500);
          return () => clearTimeout(timer);
        }
      }
    }
  }, [space?.id, space?.space_type, participants.length, params.justCreated]);

  // ✅ AUTO-JOIN if routed from "Accept" notification
  useEffect(() => {
    if (params.justInvited === 'true' && space && !myParticipation && !isJoining) {
      console.log('🚀 Auto-joining space as requested from notification');
      handleJoin();
    }
  }, [params.justInvited, !!space, !!myParticipation]);

  // ✅ Re-activate tab from params
  useEffect(() => {
    if (!params.tab) return;
    const validTabs = ['chat', 'whiteboard', 'meeting', 'document', 'brainstorm', 'calendar', 'files', 'ai', 'polls'];
    if (validTabs.includes(params.tab as string) && activeTab !== params.tab) {
      setActiveTab(params.tab as any);
    }
  }, [params.tab]);

  // ✅ Auto-open activities modal if activity param is present
  useEffect(() => {
    if (params.activity && !showActivitiesModal && params.tab !== 'meeting') {
      setShowActivitiesModal(true);
    }
  }, [params.activity, params.tab]);

  // ✅ Auto-start meeting if joining from a session
  useEffect(() => {
    if (params.tab === 'meeting' && params.activity && space && !space.is_live && !loading) {
      handleStartCall('video');
    }
  }, [params.tab, params.activity, !!space, space?.is_live, loading]);

  // ✅ Phase 57: Auto-redirect from meeting tab to chat if call ends
  useEffect(() => {
    if (!activeCall && activeTab === 'meeting') {
      console.log('📞 Call ended, redirecting from meeting to chat');
      setActiveTab('chat');
      router.setParams({ tab: 'chat', type: undefined, call: undefined });
    }
  }, [activeCall, activeTab, id]);

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading space...</Text>
        </View>
      );
    }

    switch (activeTab) {
      case 'chat':
        return (
          <SpaceChatTab
            spaceId={id as string}
            currentUserId={Number(user?.id) || 0}
            space={space}
            setSpace={setSpace}
            setShowPollCreator={setShowPollCreator}
            polls={polls}
            currentUserRole={space?.my_role}
            onNavigateToAllPolls={() => setActiveTab('polls')}
            highlightMessageId={params.highlightMessageId as string}
            onStartCall={handleStartCall}
          />
        );

      case 'whiteboard':
        return (
          <View style={{ flex: 1 }}>
            <WhiteboardCanvas
              spaceId={id as string}
              initialElements={space?.content_state?.whiteboard?.elements || []}
              onElementsChange={(elements) => {
                // Update local state but don't trigger full sync - we already sync via service
                setSpace((prev: any) => ({
                  ...prev,
                  content_state: {
                    ...prev.content_state,
                    whiteboard: {
                      ...prev.content_state?.whiteboard,
                      elements,
                    },
                  },
                }));
              }}
              onError={(error) => {
                console.error('Whiteboard error:', error);
                showToast('Whiteboard something went wrong. Please try again.', 'error');
              }}
            />
          </View>
        );

      case 'polls':
        return (
          <ScrollView style={styles.pollsContainer}>
            <TouchableOpacity
              style={styles.createPollButton}
              onPress={() => setShowPollCreator(true)}
            >
              <Ionicons name="add-circle" size={24} color="#007AFF" />
              <Text style={styles.createPollText}>Create New Poll</Text>
            </TouchableOpacity>

            {polls.length === 0 ? (
              <View style={styles.emptyPolls}>
                <Ionicons name="bar-chart" size={64} color="#ccc" />
                <Text style={styles.emptyPollsTitle}>No polls yet</Text>
                <Text style={styles.emptyPollsSubtext}>
                  Create your first poll to gather opinions
                </Text>
              </View>
            ) : (
              polls.map(poll => (
                <PollViewer
                  key={poll.id}
                  poll={poll}
                  spaceId={id as string}
                  currentUserId={Number(user?.id) || 0}
                  currentUserRole={space?.my_role}
                  onRefresh={loadPolls}
                />
              ))
            )}
          </ScrollView>
        );

      case 'meeting':
        if (activeCall && activeCall.spaceId === id) {
          // Render chat background during active call in meeting tab
          return (
            <SpaceChatTab
              spaceId={id as string}
              currentUserId={Number(user?.id) || 0}
              space={space}
              setSpace={setSpace}
              setShowPollCreator={setShowPollCreator}
              polls={polls}
              currentUserRole={space?.my_role}
              onNavigateToAllPolls={() => setActiveTab('polls')}
              highlightMessageId={params.highlightMessageId as string}
              onStartCall={handleStartCall}
            />
          );
        }

        return (
          <View style={styles.meetingContainer}>
            <Ionicons name="videocam" size={64} color="#007AFF" />
            <Text style={styles.placeholderText}>Video Meeting Room</Text>
            <Text style={styles.placeholderSubtext}>
              Start a video call with {participants.length} participants
            </Text>
            <View style={styles.meetingActions}>
              <TouchableOpacity
                style={[styles.callButton, styles.videoButton]}
                onPress={() => handleStartCall('video')}
              >
                <Ionicons name="videocam" size={24} color="#fff" />
                <Text style={styles.callButtonText}>Start Video Call</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.callButton, styles.audioButton]}
                onPress={() => handleStartCall('audio')}
              >
                <Ionicons name="call" size={24} color="#fff" />
                <Text style={styles.callButtonText}>Start Audio Call</Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      case 'calendar':
        return (
          <CalendarView
            spaceId={id}
            initialActivityId={params.activity as string}
            onActivityCreated={() => loadSpaceDetails(true)}
            onCreateActivity={() => setShowCreateActivity(true)}
          />
        );

      case 'document':
        return (
          <View style={styles.documentContainer}>
            <Ionicons name="document-text" size={64} color="#007AFF" />
            <Text style={styles.placeholderText}>Document Collaboration</Text>
            <Text style={styles.placeholderSubtext}>
              Edit documents together in real-time
            </Text>
            <TouchableOpacity style={styles.placeholderButton}>
              <Text style={styles.placeholderButtonText}>Create Document</Text>
            </TouchableOpacity>
          </View>
        );

      case 'brainstorm':
        return (
          <View style={styles.brainstormContainer}>
            <Ionicons name="bulb" size={64} color="#007AFF" />
            <Text style={styles.placeholderText}>Brainstorming Session</Text>
            <Text style={styles.placeholderSubtext}>
              Generate and organize ideas together
            </Text>
            <TouchableOpacity style={styles.placeholderButton}>
              <Text style={styles.placeholderButtonText}>Start Brainstorming</Text>
            </TouchableOpacity>
          </View>
        );

      default:
        return (
          <View style={styles.defaultContainer}>
            <Ionicons name="cube" size={64} color="#007AFF" />
            <Text style={styles.placeholderText}>{activeTab.toUpperCase()} Collaboration</Text>
            <Text style={styles.placeholderSubtext}>
              {space?.description || 'Work together in real-time'}
            </Text>
          </View>
        );
    }
  };

  // 🌀 High-level Loader (Prevents crashes while space data is missing)
  if (loading && !space) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading space...</Text>
      </View>
    );
  }

  // 🛡️ Unauthorized Guest State (For non-channel/general spaces)
  if (!user && !loading && !space) {
    return (
      <View style={styles.lockedContainer}>
        <View style={styles.lockedCard}>
          <View style={styles.lockedIconBg}>
            <Ionicons name="lock-closed" size={40} color="#FF6B6B" />
          </View>
          <Text style={styles.lockedTitle}>Login Required</Text>
          <Text style={styles.lockedDescription}>
            This type of space is private and only accessible to registered members.
          </Text>
          <TouchableOpacity 
            style={styles.joinSpaceButton}
            onPress={() => router.replace('/LoginScreen')}
          >
            <Text style={styles.joinSpaceButtonText}>Go to Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // 🧬 Identification Logic (Refined for guests)
  const isDirectChat = (space?.settings?.is_direct || space?.space_type === 'direct' || space?.space_type === 'chat') && !!space?.other_participant;
  
  // For guests (user === null), we MUST NOT pick a random participant as "other participant"
  const otherParticipant = space?.other_participant || (isDirectChat && user
    ? participants.find(p => String(p.user?.id || p.user_id) !== String(user?.id))?.user
    : null);

  const displayTitle = isDirectChat && otherParticipant
    ? (otherParticipant?.name || otherParticipant?.username)
    : (space?.title && space.title !== 'Direct Message' ? space.title : (loading ? 'Loading...' : 'Space Detail'));

  const displaySubtitle = isDirectChat && otherParticipant
    ? (otherParticipant?.is_online ? 'Online' : 'Direct Message')
    : `${participants.length} ${participants.length === 1 ? 'participant' : 'participants'}`;

  const displayPhoto = isDirectChat && otherParticipant
    ? ((otherParticipant?.profile_photo_url || otherParticipant?.profile_photo) as string)
    : (space?.image_url || space?.creator?.profile_photo || null);

  if (!user && space) {
    return (
      <GuestJoinView
        space={space}
        onJoin={handleGuestJoin}
        onLogin={() => router.replace('/LoginScreen')}
        activityId={params.activity as string}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          disabled={!!user?.is_guest}
          onPress={() => {
            if (params.returnTo) {
              router.replace(params.returnTo as any);
            } else {
              router.back();
            }
          }}
          style={[styles.backButton, user?.is_guest && { opacity: 0 }]}
        >
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerContent}
          onPress={() => Alert.alert(
            'Space Info',
            `Title: ${displayTitle} \nType: ${space?.space_type || 'chat'} \nParticipants: ${participants.length} \nCreated: ${space?.created_at ? new Date(space.created_at).toLocaleDateString() : 'N/A'} `
          )}
        >
          {displayPhoto ? (
            <View style={styles.headerAvatar}>
              <Avatar source={displayPhoto} size={36} name={displayTitle} />
            </View>
          ) : (
            <View style={[styles.headerAvatar, { backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center' }]}>
              <Ionicons name="cube" size={20} color="#fff" />
            </View>
          )}
          <View style={styles.headerTextContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.title} numberOfLines={1}>
                {displayTitle}
              </Text>
              {useReportedContentStore.getState().isReported('space', id as string) && (
                <Ionicons name="flag" size={14} color="#ff4444" style={{ marginLeft: 4 }} />
              )}
              {isPinned && <Ionicons name="pin" size={12} color="#007AFF" style={{ marginLeft: 4 }} />}
              {isMuted && <Ionicons name="volume-mute" size={12} color="#666" style={{ marginLeft: 4 }} />}
            </View>
            <View style={styles.subtitleRow}>
              {(!isDirectChat || !otherParticipant) && <Ionicons name="people" size={12} color="#666" />}
              {(!isDirectChat || !otherParticipant) && <Text style={styles.subtitle}>{displaySubtitle}</Text>}
              {(!isDirectChat || !otherParticipant) && <View style={styles.dotSeparator} />}
              <Text style={styles.subtitle}>
                {isDirectChat && otherParticipant ? displaySubtitle : (space?.space_type || 'chat')}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          {/* Priority 1: Add People (only for non-direct spaces, and if allowed) */}
          {!isDirectChat && space?.space_type !== 'channel' && (canInvite || myParticipation?.role === 'owner') && (
            <TouchableOpacity
              style={[styles.headerButton, isLocked && { opacity: 0.5 }]}
              onPress={() => setShowInviteModal(true)}
              disabled={isLocked}
            >
              <Ionicons name="person-add-outline" size={24} color="#007AFF" />
            </TouchableOpacity>
          )}

          {/* Priority 2: Call (if allowed, hide for channels unless admin) */}
          {canStartCalls && (space?.space_type !== 'channel' || canEditSpace) && (
            <TouchableOpacity
              ref={callButtonRef}
              style={[styles.headerButton, isLocked && { opacity: 0.3 }]}
              onPress={() => !isLocked && measureCallButton()}
              disabled={isLocked}
            >
              <Ionicons
                name={isDirectChat ? "call-outline" : "videocam-outline"}
                size={24}
                color={isLocked ? "#999" : "#007AFF"}
              />
            </TouchableOpacity>
          )}

          {/* Activities Popup with Badge (Hidden when 0) */}
          {((spaceUpcomingCounts[id as string] || 0) > 0) && (
            <TouchableOpacity
              style={[styles.headerButton, isLocked && { opacity: 0.5 }]}
              onPress={() => setShowActivitiesModal(true)}
              disabled={isLocked}
            >
              <Ionicons name="calendar-outline" size={24} color={isLocked ? "#999" : "#007AFF"} />
              <View style={styles.activitiesBadge}>
                <Text style={styles.badgeText}>{spaceUpcomingCounts[id as string]}</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Priority 3: Generic Menu (Always Last) */}
          <TouchableOpacity
            ref={spaceButtonRef}
            style={[styles.headerButton, isLocked && { opacity: 0.5 }]}
            onPress={measureSpaceButton}
            disabled={isLocked}
          >
            <Ionicons name="ellipsis-vertical" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Active Tab Return Banner */}
      {activeTab !== 'chat' && (
        <TouchableOpacity 
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#F8F9FA',
            paddingVertical: 10,
            paddingHorizontal: 16,
            borderBottomWidth: 1,
            borderColor: '#EFEFEF',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 2,
            elevation: 2,
            zIndex: 10
          }}
          activeOpacity={0.8}
          onPress={() => setActiveTab('chat')}
        >
          <Ionicons name="return-up-back" size={18} color="#444" />
          <Text style={{ marginLeft: 8, fontSize: 13, fontWeight: '600', color: '#444' }}>
            Back to Conversation
          </Text>
          <View style={{ flex: 1 }} />
          <Ionicons name="chatbubbles-outline" size={18} color="#999" />
        </TouchableOpacity>
      )}

      {/* Archived Banner */}
      {isArchived && (
        <View style={styles.archivedBanner}>
          <Ionicons name="archive" size={16} color="#007AFF" />
          <Text style={styles.archivedBannerText}>This chat is archived</Text>
        </View>
      )}

      {/* Unified Menus */}
      <GenericMenu
        visible={showCallMenu}
        onClose={() => setShowCallMenu(false)}
        anchorPosition={callMenuPosition}
        items={[
          {
            icon: 'videocam',
            label: 'Video Call',
            color: '#525df8ff',
            onPress: () => handleStartCall('video'),
          },
          {
            icon: 'call',
            label: 'Audio Call',
            color: '#4CAF50',
            onPress: () => handleStartCall('audio'),
          },
        ]}
      />

      <GenericMenu
        visible={showSpaceMenu}
        onClose={() => setShowSpaceMenu(false)}
        anchorPosition={spaceMenuPosition}
        items={[
          ...(canEditSpace ? [{
            icon: 'settings-outline',
            label: 'Space Settings',
            onPress: handleOpenSettings,
          } as MenuItem] : []),
          {
            icon: 'people-outline',
            label: 'View Participants',
            onPress: () => setShowParticipantsModal(true),
          } as MenuItem,
          ...(canEditSpace ? [{
            icon: 'shield-outline',
            label: 'Manage Admins',
            onPress: () => setShowAdminsModal(true),
          } as MenuItem] : []),
          ...(myPermissions.write !== false ? [{
            icon: 'bar-chart-outline',
            label: 'Create Poll',
            onPress: () => setShowPollCreator(true),
          } as MenuItem] : []),
          {
            icon: 'easel-outline',
            label: 'Whiteboard',
            onPress: () => {
              setActiveTab('whiteboard');
              setShowSpaceMenu(false);
            },
          } as MenuItem,
          {
            icon: 'calendar-outline',
            label: 'Calendar',
            badge: spaceUpcomingCounts[id as string] || 0,
            onPress: () => {
              setShowActivitiesModal(true);
              setShowSpaceMenu(false);
            },
          } as MenuItem,
          {
            icon: 'download-outline',
            label: 'Export Content',
            onPress: handleExportContentClick,
          } as MenuItem,
          ...(myParticipation?.role !== 'owner' ? [{
            icon: 'exit-outline',
            label: 'Leave Space',
            destructive: true,
            onPress: handleLeaveSpace,
          } as MenuItem] : []),
          ...(myParticipation?.role === 'owner' ? [{
            icon: 'trash-outline',
            label: 'Delete Space',
            destructive: true,
            onPress: handleDeleteSpace,
          } as MenuItem] : []),
          {
            icon: 'flag-outline',
            label: useReportedContentStore.getState().isReported('space', id as string) ? 'Un-report Space' : 'Report Space',
            color: useReportedContentStore.getState().isReported('space', id as string) ? '#ff4444' : undefined,
            onPress: async () => {
              setShowSpaceMenu(false);
              const reported = useReportedContentStore.getState().isReported('space', id as string);
              if (reported) {
                try {
                  await deleteReportByTarget('space', id as string);
                  useReportedContentStore.getState().removeReportedItem('space', id as string);
                  showToast('Report removed', 'success');
                } catch (error) {
                  showToast('Failed to remove report', 'error');
                }
              } else {
                setShowReportModal(true);
              }
            },
          } as MenuItem,
        ]}
      />

      {/* Tab Navigation Removed - Tools are now in the generic menu */}

      <PollComponent
        spaceId={id as string}
        currentUserId={Number(user?.id) || 0}
        currentUserRole={space?.my_role}
        isVisible={showPollCreator}
        onClose={() => setShowPollCreator(false)}
        onPollCreated={() => {
          loadPolls();
          setShowPollCreator(false);
        }}
      />

      {/* Main Content Area */}
      <View style={styles.contentArea}>
        {renderContent()}

        {/* ✅ Phase 70: Strict Protected Space Access UI */}
        {isLocked && (
          <View style={StyleSheet.absoluteFill}>
            <BlurView intensity={Platform.OS === 'ios' ? 80 : 100} tint="light" style={StyleSheet.absoluteFill}>
              <View style={styles.lockedContainer}>
                <View style={styles.lockedCard}>
                  <View style={styles.lockedIconBg}>
                    <Ionicons name="lock-closed" size={40} color="#007AFF" />
                  </View>
                  <Text style={styles.lockedTitle}>Private Space</Text>
                  <Text style={styles.lockedDescription}>
                    This is a protected space. You must join to see the conversation and participate.
                  </Text>
                  <TouchableOpacity
                    style={styles.joinSpaceButton}
                    onPress={handleJoin}
                    disabled={isJoining}
                  >
                    {isJoining ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <Ionicons name="enter-outline" size={20} color="#fff" />
                        <Text style={styles.joinSpaceButtonText}>Join Space</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </BlurView>
          </View>
        )}

        {/* Deleting Overlay */}
        {isDeleting && (
          <View style={styles.deletingOverlay}>
            <View style={styles.deletingContent}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.deletingText}>Deleting space...</Text>
              <Text style={styles.deletingSubtext}>Permanently removing all messages and media</Text>
            </View>
          </View>
        )}

        {/* Magic Events Floating Orbs */}
        {magicEvents
          .filter(event => !event.has_been_discovered)
          .slice(0, 3)
          .map((event, index) => (
            <TouchableOpacity
              key={event.id}
              style={[
                styles.magicOrb,
                {
                  top: 80 + (index * 80),
                  right: 10,
                  transform: [{ scale: 1 - (index * 0.1) }]
                }
              ]}
              onPress={() => handleDiscoverMagic(event.id)}
            >
              <Ionicons name="sparkles" size={20} color="#fff" />
            </TouchableOpacity>
          ))}

        {/* Floating AI Assistant Trigger */}
        {space?.has_ai_assistant && !showAIAssistant && (
          <TouchableOpacity
            style={styles.aiFloatingButton}
            onPress={() => setShowAIAssistant(true)}
          >
            <Ionicons name="sparkles" size={28} color="#007AFF" />
          </TouchableOpacity>
        )}
      </View>

      {/* AI Assistant - Only if enabled and toggled */}
      {space?.has_ai_assistant && showAIAssistant && (
        <AICollaborationAssistant
          spaceId={id as string}
          spaceType={space?.space_type}
          spaceData={space}
          participants={participants}
          currentContent={space?.content_state}
          visible={showAIAssistant}
          onClose={() => setShowAIAssistant(false)}
        />
      )}

      {/* Enhanced Invite Modal */}
      <EnhancedInviteModal
        visible={showInviteModal}
        spaceId={id as string}
        spaceTitle={space?.title || 'Space'}
        onClose={() => setShowInviteModal(false)}
        onInvite={handleInviteUsers}
      />

      {/* Space Settings Modal – new high-performance component */}
      <SpaceSettingsModal
        visible={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        space={space}
        participants={participants}
        currentUserRole={space?.my_role || 'participant'}
        onSpaceUpdated={(updatedSpace) => {
          setSpace(updatedSpace);
          setShowSettingsModal(false);
        }}
        onParticipantRoleChanged={(participantId, newRole) => {
          setParticipants(prev =>
            prev.map(p => p.user_id === participantId ? { ...p, role: newRole } : p)
          );
        }}
        onParticipantRemoved={(participantId) => {
          setParticipants(prev => prev.filter(p => p.user_id !== participantId));
        }}
      />

      {/* Participants Modal */}
      <Modal
        visible={showParticipantsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowParticipantsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentLarge}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Participants ({participants.length})</Text>
              <TouchableOpacity onPress={() => setShowParticipantsModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.participantsList}>
              {participants.map((participant) => (
                <TouchableOpacity
                  key={participant.user_id}
                  style={styles.participantItem}
                  onPress={() => {
                    if (canChangeRoles || canRemove) {
                      setSelectedParticipant(participant);
                      setShowRoleModal(true);
                    }
                  }}
                  disabled={participant.user_id === user?.id}
                >
                  <Avatar
                    source={participant.user?.profile_photo}
                    size={44}
                    name={participant.user?.name}
                  />
                  <View style={styles.participantInfo}>
                    <Text style={styles.participantName}>
                      {participant.user?.name}
                      {participant.user_id === user?.id && ' (You)'}
                    </Text>
                    <View style={styles.participantMeta}>
                      <View style={[styles.roleBadge, {
                        backgroundColor: participant.role === 'owner' ? '#FFD70020' :
                          participant.role === 'moderator' ? '#007AFF20' : '#f0f0f0'
                      }]}>
                        <Text style={[styles.roleText, {
                          color: participant.role === 'owner' ? '#B8860B' :
                            participant.role === 'moderator' ? '#007AFF' : '#666'
                        }]}>
                          {participant.role}
                        </Text>
                      </View>
                      {participant.presence_data?.is_online && (
                        <View style={styles.onlineDot} />
                      )}
                    </View>
                  </View>
                  {(canChangeRoles || canRemove) &&
                    participant.user_id !== user?.id && (
                      <Ionicons name="chevron-forward" size={20} color="#999" />
                    )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.inviteButton}
              onPress={() => {
                setShowParticipantsModal(false);
                setShowInviteModal(true);
              }}
            >
              <Ionicons name="person-add" size={20} color="#007AFF" />
              <Text style={styles.inviteButtonText}>Invite People</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {/* Admins Modal */}
      <Modal
        visible={showAdminsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAdminsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentLarge}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Manage Admins</Text>
              <TouchableOpacity onPress={() => setShowAdminsModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.participantsList}>
              {participants.filter(p => p.role === 'owner' || p.role === 'moderator').map((participant) => (
                <TouchableOpacity
                  key={`admin - ${participant.user_id} `}
                  style={styles.participantItem}
                  onPress={() => {
                    if (canChangeRoles || canRemove) {
                      setSelectedParticipant(participant);
                      setShowRoleModal(true);
                    }
                  }}
                  disabled={participant.user_id === user?.id || (!canChangeRoles && !canRemove)}
                >
                  <Avatar
                    source={participant.user?.profile_photo}
                    size={44}
                    name={participant.user?.name}
                  />
                  <View style={styles.participantInfo}>
                    <Text style={styles.participantName}>
                      {participant.user?.name}
                      {participant.user_id === user?.id && ' (You)'}
                    </Text>
                    <View style={styles.participantMeta}>
                      <View style={[styles.roleBadge, {
                        backgroundColor: participant.role === 'owner' ? '#FFD70020' : '#007AFF20'
                      }]}>
                        <Text style={[styles.roleText, {
                          color: participant.role === 'owner' ? '#B8860B' : '#007AFF'
                        }]}>
                          {participant.role}
                        </Text>
                      </View>
                    </View>
                  </View>
                  {(canChangeRoles || canRemove) && participant.user_id !== user?.id && (
                    <Ionicons name="chevron-forward" size={20} color="#999" />
                  )}
                </TouchableOpacity>
              ))}
              {participants.filter(p => p.role === 'owner' || p.role === 'moderator').length === 0 && (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Text style={{ color: '#666' }}>No admins found.</Text>
                </View>
              )}
            </ScrollView>

            {space?.my_role === 'owner' && (
              <TouchableOpacity
                style={styles.inviteButton}
                onPress={() => {
                  setShowAdminsModal(false);
                  setShowParticipantsModal(true);
                  Alert.alert("Manage Admins", "To add an admin, select a Participant and change their role.");
                }}
              >
                <Ionicons name="person-add" size={20} color="#007AFF" />
                <Text style={styles.inviteButtonText}>Add Admin</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
      {/* Role Selection Modal */}
      <Modal
        visible={showRoleModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowRoleModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.roleModal}>
            <Text style={styles.roleModalTitle}>
              Change role for {selectedParticipant?.user?.name}
            </Text>

            {['participant', 'moderator', 'owner'].map((role) => (
              <TouchableOpacity
                key={role}
                style={[
                  styles.roleOption,
                  selectedParticipant?.role === role && styles.roleOptionSelected
                ]}
                onPress={() => handleChangeRole(selectedParticipant.user_id, role)}
              >
                <View style={styles.roleOptionLeft}>
                  <Ionicons
                    name={(
                      role === 'owner' ? 'crown' :
                        role === 'moderator' ? 'shield' : 'person'
                    ) as any}
                    size={20}
                    color={
                      role === 'owner' ? '#FFD700' :
                        role === 'moderator' ? '#007AFF' : '#666'
                    }
                  />
                  <View style={styles.roleOptionText}>
                    <Text style={styles.roleOptionTitle}>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </Text>
                    <Text style={styles.roleOptionDescription}>
                      {role === 'owner' ? 'Full control over space' :
                        role === 'moderator' ? 'Can manage participants and content' :
                          'Can participate and send messages'}
                    </Text>
                  </View>
                </View>
                {selectedParticipant?.role === role && (
                  <Ionicons name="checkmark-circle" size={24} color="#007AFF" />
                )}
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => {
                setShowRoleModal(false);
                handleRemoveParticipant(selectedParticipant?.user_id);
              }}
            >
              <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
              <Text style={styles.removeButtonText}>Remove from Space</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelRoleButton}
              onPress={() => setShowRoleModal(false)}
            >
              <Text style={styles.cancelRoleText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Calendar Prompt */}
      <CalendarPrompt
        visible={showCalendarPrompt}
        onClose={() => setShowCalendarPrompt(false)}
        onScheduleNow={() => {
          setShowCalendarPrompt(false);
          setShowActivitiesModal(true);
          setTimeout(() => {
            setShowCreateActivity(true);
          }, 300);
        }}
        spaceTitle={space?.title}
        spaceType={space?.space_type}
        participantCount={participants.length}
      />

      <CreateActivityModal
        spaceId={id as string}
        visible={showCreateActivity}
        onClose={() => setShowCreateActivity(false)}
        onActivityCreated={() => loadSpaceDetails(true)}
      />

      {/* Collaborative Activities Modal - Popup for Sessions */}
      <Modal
        visible={showActivitiesModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowActivitiesModal(false)}
      >
        <CollaborativeActivities
          spaceId={id as string} // Filter by current space
          initialActivityId={params.activity as string}
          onClose={() => setShowActivitiesModal(false)}
          onActivitySelect={(activity) => {
            // Since we are already in the space, we can just close or update state
            setShowActivitiesModal(false);
            // Optionally switch to calendar tab if not already there, 
            // though the modal should handle the details.
          }}
        />
      </Modal>

      <MediaUploader
        spaceId={id as string}
        isVisible={showMediaUploader}
        onClose={() => setShowMediaUploader(false)}
        onUploadComplete={(media) => {
          console.log('Media uploaded:', media);
          // Currently not handling text insertion for chat tab here
        }}
      />

      <SpaceExportModal
        visible={showExportModal}
        onClose={() => setShowExportModal(false)}
        space={space}
        participants={participants}
        polls={polls}
      />

      {/* Report Modal */}
      <ReportPost
        visible={showReportModal}
        spaceId={id as string}
        type="space"
        onClose={() => setShowReportModal(false)}
        onReportSubmitted={(reportId) => {
          console.log('Report submitted for space:', reportId);
          useToastStore.getState().showToast('Report Received: Our AI is analyzing this space.', 'success');
          setShowReportModal(false);
        }}
      />
    </SafeAreaView>
  );
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 4,
    marginRight: 8,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  headerTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  dotSeparator: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#999',
    marginHorizontal: 6,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButton: {
    padding: 4,
  },
  pollsBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  activitiesBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#007AFF', // Blue for activities
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  pollsBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  tabContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    maxHeight: 60,
    alignSelf: 'center',
  },
  tabContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  activeTab: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#fff',
  },
  contentArea: {
    flex: 1,
    position: 'relative',
  },
  chatArea: {
    flex: 1,
  },
  chatContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },

  chatInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },

  messageInput: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 8,
    fontSize: 16,
    maxHeight: 100,
  },

  sendButton: {
    backgroundColor: '#007AFF',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },

  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },

  mediaButton: {
    padding: 8,
  },


  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#f0f0f0',
    borderBottomLeftRadius: 4,
  },
  messageAuthor: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  messageText: {
    fontSize: 16,
    color: '#333',
  },
  myMessageText: {
    color: '#fff',
  },
  messageTime: {
    fontSize: 10,
    color: '#999',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  emptyChat: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyChatText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  emptyChatSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  whiteboardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  meetingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  documentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  brainstormContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  defaultContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  placeholderText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  placeholderSubtext: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  placeholderButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  placeholderButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  meetingActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  videoButton: {
    backgroundColor: '#007AFF',
  },
  audioButton: {
    backgroundColor: '#4CAF50',
  },
  callButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  magicOrb: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FF6B6B',
    justifyContent: 'center',
    alignItems: 'center',
    ...createShadow({
      width: 0,
      height: 2,
      opacity: 0.25,
      radius: 3.84,
      elevation: 8,
    }),
  },
  aiFloatingButton: {
    position: 'absolute',
    bottom: 110,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    ...createShadow({
      width: 0,
      height: 4,
      opacity: 0.3,
      radius: 4.65,
      elevation: 8,
    }),
    zIndex: 999,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  modalDescription: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    lineHeight: 24,
  },
  modalInput: {
    fontSize: 16,
    padding: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#f0f0f0',
  },
  modalButtonConfirm: {
    backgroundColor: '#007AFF',
  },
  modalButtonDisabled: {
    opacity: 0.5,
  },
  modalButtonTextCancel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  modalButtonTextConfirm: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  modalContentLarge: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
  },
  settingsScrollView: {
    maxHeight: 400,
  },
  settingsSection: {
    marginBottom: 24,
  },
  settingsSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsInput: {
    flex: 1,
    fontSize: 16,
    padding: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  photoUploadArea: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 20,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
  },
  spacePhoto: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  photoPlaceholder: {
    alignItems: 'center',
  },
  photoPlaceholderText: {
    marginTop: 8,
    color: '#999',
    fontSize: 14,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    padding: 12,
    borderRadius: 8,
  },
  infoText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#333',
  },
  infoSubtext: {
    marginTop: 4,
    fontSize: 14,
    color: '#666',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#f8f8f8',
    padding: 12,
    borderRadius: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#666',
  },
  participantsList: {
    maxHeight: 400,
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  participantInfo: {
    flex: 1,
    marginLeft: 12,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  participantMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '500',
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    padding: 12,
    backgroundColor: '#007AFF10',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  inviteButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  roleModal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  roleModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  roleOptionSelected: {
    backgroundColor: '#f0f8ff',
  },
  roleOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  roleOptionText: {
    marginLeft: 12,
    flex: 1,
  },
  roleOptionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  roleOptionDescription: {
    fontSize: 12,
    color: '#999',
  },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    padding: 12,
    backgroundColor: '#FF6B6B10',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF6B6B',
  },
  removeButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#FF6B6B',
  },
  cancelRoleButton: {
    marginTop: 12,
    padding: 12,
    alignItems: 'center',
  },
  cancelRoleText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  // Dropdown menu styles
  menuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 999,
  },
  dropdownMenu: {
    position: 'absolute',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 8,
    minWidth: 200,
    ...createShadow({
      width: 0,
      height: 2,
      opacity: 0.25,
      radius: 3.84,
      elevation: 5,
    }),
    zIndex: 1000,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  menuItemDestructive: {
    // No extra styling needed, just for type
  },
  menuItemText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  menuItemTextDestructive: {
    color: '#FF6B6B',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 4,
  },
  pollsContainer: {
    flex: 1,
    padding: 16,
  },
  createPollButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF10',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
    marginBottom: 16,
  },
  createPollText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  emptyPolls: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyPollsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  emptyPollsSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 32,
  },
  archivedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF08',
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#007AFF15',
  },
  archivedBannerText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  deletingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  deletingContent: {
    alignItems: 'center',
    padding: 24,
  },
  deletingText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  deletingSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  // Phase 70: Locked UI Styles
  lockedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  lockedCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    ...createShadow({
      width: 0,
      height: 10,
      opacity: 0.1,
      radius: 20,
      elevation: 10,
    }),
  },
  lockedIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#007AFF10',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  lockedTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  lockedDescription: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  joinSpaceButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 28,
    gap: 10,
    width: '100%',
  },
  joinSpaceButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  activeCallPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#f8f9ff',
    borderRadius: 16,
    width: '100%',
  },
  iconGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    ...createShadow({
      width: 0,
      height: 4,
      opacity: 0.2,
      radius: 5,
      elevation: 6,
    }),
  },
});

export default SpaceDetailScreen;