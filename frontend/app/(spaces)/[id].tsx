// app/(spaces)/[id].tsx
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
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
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useContext, useCallback, useRef } from 'react';
import AuthContext from '@/context/AuthContext';
import CollaborationService, { CollaborativeActivity } from '@/services/ChatScreen/CollaborationService';
import { AICollaborationAssistant } from '@/components/AI/AICollaborationAssistant';
import * as Haptics from 'expo-haptics';
import { getToken } from '@/services/TokenService';
import CalendarView from '@/components/ChatScreen/CalendarView';
import CreateActivityModal from '@/components/ChatScreen/CreateActivityModal';
import CalendarPrompt from '@/components/ChatScreen/CalendarPrompt';
import ImmersiveCallView from '@/components/ChatScreen/ImmersiveCallView';
import MediaUploader from '@/services/ChatScreen/MediaUploader';
import MessageList from '@/components/ChatScreen/MessageList';
import { useNotificationStore } from '@/stores/notificationStore';
import { useCollaborationStore } from '@/stores/collaborationStore';
import Avatar from '@/components/Image/Avatar';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import EnhancedInviteModal from '@/components/ChatScreen/EnhancedInviteModal';

const SpaceDetailScreen = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useContext(AuthContext);
  const [space, setSpace] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [magicEvents, setMagicEvents] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'chat' | 'whiteboard' | 'meeting' | 'document' | 'brainstorm' | 'calendar' | 'files' | 'ai'>('chat');
  const [content, setContent] = useState<string>('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCalendarPrompt, setShowCalendarPrompt] = useState(false);
  const [showCreateActivity, setShowCreateActivity] = useState(false);
  const params = useLocalSearchParams(); // ✅ top level
  const [showMediaUploader, setShowMediaUploader] = useState(false);

  // Dropdown menu states
  const [showCallMenu, setShowCallMenu] = useState(false);
  const [showSpaceMenu, setShowSpaceMenu] = useState(false);
  const [callMenuPosition, setCallMenuPosition] = useState({ top: 0, right: 0 });
  const [spaceMenuPosition, setSpaceMenuPosition] = useState({ top: 0, right: 0 });

  // Refs for button measurements
  const callButtonRef = useRef<TouchableOpacity>(null);
  const spaceButtonRef = useRef<TouchableOpacity>(null);

  const collaborationService = CollaborationService.getInstance();
  const windowHeight = Dimensions.get('window').height;
  const { width: windowWidth } = useWindowDimensions();

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

  useEffect(() => {
    if (id && user) {
      loadSpaceDetails();
      subscribeToSpace();
    }

    return () => {
      unsubscribeFromSpace();
    };
  }, [id, user]);


  useEffect(() => {
    if (space?.id) {
      if (params.justCreated === 'true') {
        const groupSpaces = ['meeting', 'brainstorm', 'workshop', 'document', 'whiteboard'];

        if (groupSpaces.includes(space.space_type)) {
          if (participants.length > 2 || space.space_type !== 'voice_channel') {
            const timer = setTimeout(() => {
              setShowCalendarPrompt(true);
            }, 1500);

            return () => clearTimeout(timer); // cleanup
          }
        }
      }
    }
  }, [space?.id, space?.space_type, participants.length, params.justCreated]);

  // Check if this is a newly created space
  // const params = useLocalSearchParams(); // ✅ top level

  const loadSpaceDetails = async () => {
    console.log('Loading space details for ID:', id);
    setLoading(true);
    try {
      const spaceData = await collaborationService.fetchSpaceDetails(id as string);
      console.log('Space data loaded:', {
        id: spaceData.id,
        title: spaceData.title,
        type: spaceData.space_type,
        participants: spaceData.participants?.length
      });

      setSpace(spaceData);
      setParticipants(spaceData.participants || []);
      setMagicEvents(spaceData.magic_events || []);

      // Set default tab based on space type
      if (spaceData.space_type && ['chat', 'whiteboard', 'meeting', 'document', 'brainstorm'].includes(spaceData.space_type)) {
        setActiveTab(spaceData.space_type as any);
      }


      if (params.justCreated === 'true') {
        const groupSpaces = ['meeting', 'brainstorm', 'workshop', 'document', 'whiteboard'];
        if (groupSpaces.includes(spaceData.space_type)) {
          setTimeout(() => {
            setShowCalendarPrompt(true);
          }, 1500);
        }
      }
    } catch (error) {
      console.error('Error loading space:', error);
      Alert.alert('Error', 'Failed to load space details');
    } finally {
      setLoading(false);
    }
  };

  const subscribeToSpace = async () => {
    try {
      await collaborationService.subscribeToSpace(id as string, {
        onSpaceUpdate: (updatedSpace) => {
          console.log('Space updated:', updatedSpace.title);
          setSpace(updatedSpace);
        },
        onParticipantUpdate: (participant) => {
          setParticipants(prev => {
            const existingIndex = prev.findIndex(p => p.user_id === participant.user_id);
            if (existingIndex >= 0) {
              const updated = [...prev];
              updated[existingIndex] = participant;
              return updated;
            } else {
              return [...prev, participant];
            }
          });

          // ✅ FIX: Use template literals for robust ID comparison
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
          setSpace(prev => ({
            ...prev,
            content_state: contentState,
            updated_at: new Date().toISOString()
          }));
        },
        onMagicEvent: (event) => {
          console.log('Magic event received:', event.event_type);
          setMagicEvents(prev => [event, ...prev]);
          if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }

          // ✅ ADD THIS: Send to notification store
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
        // ✅ ADD THESE MISSING CALLBACKS:
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
            userId: data.user?.id || data.user_id, // ✅ Pass at top level
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
        onVideoStateChanged: (data) => {
          console.log('Video state changed:', data);
        },
      });
      console.log('Subscribed to space updates');
    } catch (error) {
      console.error('Error subscribing to space:', error);
    }
  };

  const unsubscribeFromSpace = () => {
    try {
      collaborationService.unsubscribeFromSpace(id as string);
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
    // This would integrate with your media uploader
    setShowMediaUploader(true);
  };

  const handleChangeRole = async (participantId: number, newRole: string) => {
    try {
      await collaborationService.updateParticipantRole(id as string, participantId, newRole);

      // Update local state
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
    Alert.alert(
      'Leave Space',
      'Are you sure you want to leave this space?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await collaborationService.leaveSpace(id as string);
              router.back();
            } catch (error) {
              console.error('Error leaving space:', error);
              Alert.alert('Error', 'Failed to leave space');
            }
          }
        }
      ]
    );
    setShowSpaceMenu(false);
  };

  const handleDeleteSpace = async () => {
    Alert.alert(
      'Delete Space',
      'Are you sure you want to permanently delete this space? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await collaborationService.deleteSpace(id as string);
              router.back();
            } catch (error) {
              console.error('Error deleting space:', error);
              Alert.alert('Error', 'Failed to delete space');
            }
          }
        }
      ]
    );
    setShowSpaceMenu(false);
  };

  const handleSendMessage = async () => {
    if (!content.trim() || !space) return;

    try {
      const message = await collaborationService.sendMessage(id as string, {
        content: content.trim(),
        type: 'text',
      });

      // Update local state optimistically
      setSpace(prev => ({
        ...prev,
        content_state: {
          ...prev.content_state,
          messages: [...(prev.content_state?.messages || []), message]
        }
      }));

      // ✅ FIX: Use the store function
      if (message.user_id !== user?.id) {
        useCollaborationStore.getState().incrementUnreadCount(id);
      }

      setContent('');

      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    }
  };

  const handleStartCall = async (type: 'audio' | 'video') => {
    try {
      const call = await collaborationService.startCall(id as string, type);

      // Update space state to show call is active
      setSpace(prev => ({
        ...prev,
        is_live: true,
        current_focus: 'call',
      }));

      // Switch to meeting tab
      setActiveTab('meeting');
      setShowCallMenu(false);

      Alert.alert('Call Started', `Starting ${type} call...`);
    } catch (error) {
      console.error('Error starting call:', error);
      Alert.alert('Error', 'Failed to start call');
    }
  };

  const handleInviteUsers = async (recipients: InviteRecipient[]) => {
    // Extract user IDs from valid recipients
    const userIds = recipients
      .filter(r => r.type !== 'space' && r.userData?.id)
      .map(r => r.userData.id);

    // Extract space IDs from space invites
    const spaceIds = recipients
      .filter(r => r.type === 'space' && r.userData?.id)
      .map(r => r.userData.id);

    try {
      // Invite users to the space
      if (userIds.length > 0) {
        await collaborationService.inviteToSpace(id as string, userIds, 'participant');
      }

      // For space invites, you might want to create a connection between spaces
      // This would require a new backend endpoint
      if (spaceIds.length > 0) {
        // You could call a new endpoint here to link spaces
        console.log('Would link spaces:', spaceIds);
      }

      // Show success message
      Alert.alert(
        'Success',
        `Invited ${userIds.length} user(s) to the space${spaceIds.length > 0 ? ` and linked ${spaceIds.length} space(s)` : ''
        }`,
        [{ text: 'OK' }]
      );

    } catch (error) {
      console.error('Error inviting users:', error);
      Alert.alert('Error', 'Failed to send some invites. Please try again.');
      throw error; // Re-throw to show in the modal
    }
  };

  const handleDiscoverMagic = async (eventId: string) => {
    try {
      await collaborationService.discoverMagicEvent(eventId);
      setMagicEvents(prev => prev.map(event =>
        event.id === eventId ? { ...event, has_been_discovered: true } : event
      ));
      Alert.alert('Magic Discovered!', 'You found a hidden surprise!');
    } catch (error) {
      console.error('Error discovering magic:', error);
    }
  };

  // Function to measure button position and show menu
  const measureCallButton = () => {
    if (callButtonRef.current) {
      callButtonRef.current.measure((x, y, width, height, pageX, pageY) => {
        setCallMenuPosition({
          top: pageY + height + 5,
          right: windowWidth - (pageX + width),
        });
        setShowCallMenu(true);
      });
    }
  };

  const measureSpaceButton = () => {
    if (spaceButtonRef.current) {
      spaceButtonRef.current.measure((x, y, width, height, pageX, pageY) => {
        setSpaceMenuPosition({
          top: pageY + height + 5,
          right: windowWidth - (pageX + width),
        });
        setShowSpaceMenu(true);
      });
    }
  };

  const getSpaceTypeIcon = (type: string): string => {
    const icons: Record<string, string> = {
      chat: 'chatbubble',
      whiteboard: 'easel',
      meeting: 'videocam',
      document: 'document-text',
      brainstorm: 'bulb',
      story: 'book',
      voice_channel: 'mic',
    };
    return icons[type] || 'cube';
  };

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
          <View style={styles.chatContainer}>
            <MessageList
              spaceId={id}
              currentUserId={user?.id || 0}
            />

            {/* Message Input Bar */}
            <View style={styles.chatInputContainer}>
              <TouchableOpacity
                onPress={() => setShowMediaUploader(true)}
                style={styles.mediaButton}
              >
                <Ionicons name="attach" size={24} color="#007AFF" />
              </TouchableOpacity>

              <TextInput
                style={styles.messageInput}
                placeholder={`Message in ${space?.title || 'space'}...`}
                value={content}
                onChangeText={setContent}
                multiline
                maxLength={500}
                placeholderTextColor="#999"
              />

              <TouchableOpacity
                style={[styles.sendButton, !content.trim() && styles.sendButtonDisabled]}
                onPress={handleSendMessage}
                disabled={!content.trim()}
              >
                <Ionicons name="send" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        );

      case 'whiteboard':
        return (
          <View style={styles.whiteboardContainer}>
            <Ionicons name="easel" size={64} color="#007AFF" />
            <Text style={styles.placeholderText}>Collaborative Whiteboard</Text>
            <Text style={styles.placeholderSubtext}>
              Draw together in real-time. Coming soon!
            </Text>
            <TouchableOpacity style={styles.placeholderButton}>
              <Text style={styles.placeholderButtonText}>Start Drawing</Text>
            </TouchableOpacity>
          </View>
        );

      case 'meeting':
        // If there's an active call, show immersive view
        if (space?.is_live && space?.current_focus === 'call') {
          return <ImmersiveCallView spaceId={id} />;
        }

        // Otherwise show the call start screen
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
            space={space}
            onActivityCreated={loadSpaceDetails}
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

  if (!user) {
    return (
      <View style={styles.container}>
        <Text>Please login first</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerContent}
          onPress={() => Alert.alert(
            'Space Info',
            `Title: ${space?.title || 'Loading...'}\nType: ${space?.space_type || 'chat'}\nParticipants: ${participants.length}\nCreated: ${space?.created_at ? new Date(space.created_at).toLocaleDateString() : 'N/A'}`
          )}
        >
          <Text style={styles.title} numberOfLines={1}>
            {space?.title || 'Loading Space...'}
          </Text>
          <View style={styles.subtitleRow}>
            <Ionicons name="people" size={12} color="#666" />
            <Text style={styles.subtitle}>
              {participants.length} {participants.length === 1 ? 'participant' : 'participants'}
            </Text>
            <View style={styles.dotSeparator} />
            <Text style={styles.subtitle}>
              {space?.space_type || 'chat'}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          {/* Invite Button */}
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setShowInviteModal(true)}
          >
            <Ionicons name="person-add" size={22} color="#007AFF" />
          </TouchableOpacity>

          {/* Call Button with Dropdown */}
          <TouchableOpacity
            ref={callButtonRef}
            style={styles.headerButton}
            onPress={measureCallButton}
          >
            <Ionicons name="videocam" size={22} color="#007AFF" />
          </TouchableOpacity>

          {/* Space Options Button with Dropdown */}
          <TouchableOpacity
            ref={spaceButtonRef}
            style={styles.headerButton}
            onPress={measureSpaceButton}
          >
            <Ionicons name="ellipsis-vertical" size={22} color="#007AFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Call Menu Dropdown */}
      {showCallMenu && (
        <>
          <TouchableOpacity
            style={styles.menuOverlay}
            activeOpacity={1}
            onPress={() => setShowCallMenu(false)}
          />
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(200)}
            style={[
              styles.dropdownMenu,
              {
                top: callMenuPosition.top,
                right: callMenuPosition.right,
              }
            ]}
          >
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowCallMenu(false);
                handleStartCall('video');
              }}
            >
              <Ionicons name="videocam" size={20} color="#007AFF" />
              <Text style={styles.menuItemText}>Video Call</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowCallMenu(false);
                handleStartCall('audio');
              }}
            >
              <Ionicons name="call" size={20} color="#4CAF50" />
              <Text style={styles.menuItemText}>Audio Call</Text>
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            {/* <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowCallMenu(false);
                setShowParticipantsModal(true);
              }}
            >
              <Ionicons name="people" size={20} color="#FFA726" />
              <Text style={styles.menuItemText}>All Participants</Text>
            </TouchableOpacity> */}
          </Animated.View>
        </>
      )}

      {/* Space Options Menu Dropdown */}
      {showSpaceMenu && (
        <>
          <TouchableOpacity
            style={styles.menuOverlay}
            activeOpacity={1}
            onPress={() => setShowSpaceMenu(false)}
          />
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(200)}
            style={[
              styles.dropdownMenu,
              {
                top: spaceMenuPosition.top,
                right: spaceMenuPosition.right,
              }
            ]}
          >
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowSpaceMenu(false);
                handleOpenSettings();
              }}
            >
              <Ionicons name="settings-outline" size={20} color="#666" />
              <Text style={styles.menuItemText}>Space Settings</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowSpaceMenu(false);
                setShowParticipantsModal(true);
              }}
            >
              <Ionicons name="people-outline" size={20} color="#666" />
              <Text style={styles.menuItemText}>View Participants</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowSpaceMenu(false);
                setShowAdminsModal(true);
              }}
            >
              <Ionicons name="shield-outline" size={20} color="#666" />
              <Text style={styles.menuItemText}>Manage Admins</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowSpaceMenu(false);
                Alert.alert('Export', 'Export space content');
              }}
            >
              <Ionicons name="download-outline" size={20} color="#666" />
              <Text style={styles.menuItemText}>Export Content</Text>
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity
              style={[styles.menuItem, styles.menuItemDestructive]}
              onPress={handleLeaveSpace}
            >
              <Ionicons name="exit-outline" size={20} color="#FF6B6B" />
              <Text style={[styles.menuItemText, styles.menuItemTextDestructive]}>Leave Space</Text>
            </TouchableOpacity>

            {space?.my_role === 'owner' && (
              <TouchableOpacity
                style={[styles.menuItem, styles.menuItemDestructive]}
                onPress={handleDeleteSpace}
              >
                <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
                <Text style={[styles.menuItemText, styles.menuItemTextDestructive]}>Delete Space</Text>
              </TouchableOpacity>
            )}
          </Animated.View>
        </>
      )}

      {/* Tab Navigation */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabContainer}
        contentContainerStyle={styles.tabContent}
      >
        {[
          { id: 'chat', icon: 'chatbubble-outline', label: 'Chat' },
          { id: 'whiteboard', icon: 'easel-outline', label: 'Whiteboard' },
          { id: 'meeting', icon: 'videocam-outline', label: 'Meeting' },
          { id: 'calendar', icon: 'calendar-outline', label: 'Calendar' },
          ...(space?.space_type === 'document' ? [{ id: 'document', icon: 'document-text-outline', label: 'Document' }] : []),
          ...(space?.space_type === 'brainstorm' ? [{ id: 'brainstorm', icon: 'bulb-outline', label: 'Brainstorm' }] : []),
          { id: 'files', icon: 'folder-outline', label: 'Files' },
          { id: 'ai', icon: 'sparkles', label: 'AI' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.activeTab]}
            onPress={() => {
              setActiveTab(tab.id as any);
              if (Platform.OS !== 'web') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
            }}
          >
            <Ionicons
              name={tab.icon as any}
              size={20}
              color={activeTab === tab.id ? '#007AFF' : '#666'}
            />
            <Text style={[
              styles.tabText,
              activeTab === tab.id && styles.activeTabText
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Main Content Area */}
      <View style={styles.contentArea}>
        {renderContent()}

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
                  top: 100 + (index * 80),
                  right: 20,
                  transform: [{ scale: 1 - (index * 0.1) }]
                }
              ]}
              onPress={() => handleDiscoverMagic(event.id)}
            >
              <Ionicons name="sparkles" size={20} color="#fff" />
            </TouchableOpacity>
          ))}
      </View>

      {/* AI Assistant - Only if enabled */}
      {space?.has_ai_assistant && (
        <AICollaborationAssistant
          spaceId={id as string}
          spaceType={space?.space_type}
          spaceData={space}
          participants={participants}
          currentContent={space?.content_state}
        />
      )}

      {/* Action Bar */}


      {/* Invite Modal */}
      {/* Enhanced Invite Modal */}
      <EnhancedInviteModal
        visible={showInviteModal}
        spaceId={id}
        spaceTitle={space?.title || 'Space'}
        onClose={() => setShowInviteModal(false)}
        onInvite={handleInviteUsers}
      />


      {/* Space Settings Modal */}
      <Modal
        visible={showSettingsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSettingsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentLarge}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Space Settings</Text>
              <TouchableOpacity onPress={() => setShowSettingsModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.settingsScrollView}>
              {/* Space Photo */}
              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionTitle}>Space Photo</Text>
                <TouchableOpacity
                  style={styles.photoUploadArea}
                  onPress={handleUpdateSpacePhoto}
                >
                  {space?.avatar ? (
                    <Image source={{ uri: space.avatar }} style={styles.spacePhoto} />
                  ) : (
                    <View style={styles.photoPlaceholder}>
                      <Ionicons name="camera" size={32} color="#999" />
                      <Text style={styles.photoPlaceholderText}>Upload Photo</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              {/* Space Name */}
              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionTitle}>Space Name</Text>
                <View style={styles.settingsRow}>
                  <TextInput
                    style={styles.settingsInput}
                    value={editingTitle}
                    onChangeText={setEditingTitle}
                    placeholder="Enter space name"
                    maxLength={50}
                  />
                </View>
              </View>

              {/* Space Description */}
              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionTitle}>Description</Text>
                <TextInput
                  style={[styles.settingsInput, styles.textArea]}
                  value={editingDescription}
                  onChangeText={setEditingDescription}
                  placeholder="Enter space description"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              {/* Space Type (Read-only) */}
              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionTitle}>Space Type</Text>
                <View style={styles.infoRow}>
                  <Ionicons name={getSpaceTypeIcon(space?.space_type)} size={20} color="#007AFF" />
                  <Text style={styles.infoText}>
                    {space?.space_type?.charAt(0).toUpperCase() + space?.space_type?.slice(1)}
                  </Text>
                </View>
              </View>

              {/* Created Info */}
              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionTitle}>Created</Text>
                <Text style={styles.infoText}>
                  {space?.created_at ? new Date(space.created_at).toLocaleDateString() : 'N/A'}
                </Text>
                <Text style={styles.infoSubtext}>
                  by {space?.creator?.name || 'Unknown'}
                </Text>
              </View>

              {/* Stats */}
              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionTitle}>Stats</Text>
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Ionicons name="people" size={16} color="#666" />
                    <Text style={styles.statText}>{participants.length} participants</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Ionicons name="chatbubble" size={16} color="#666" />
                    <Text style={styles.statText}>
                      {space?.content_state?.messages?.length || 0} messages
                    </Text>
                  </View>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowSettingsModal(false)}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handleUpdateSpace}
              >
                <Text style={styles.modalButtonTextConfirm}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
                    if (space?.my_role === 'owner' || space?.my_role === 'moderator') {
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
                  {(space?.my_role === 'owner' || space?.my_role === 'moderator') &&
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
                    name={
                      role === 'owner' ? 'crown' :
                        role === 'moderator' ? 'shield' : 'person'
                    }
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
          setActiveTab('calendar');
          setTimeout(() => {
            setShowCreateActivity(true);
          }, 300);
        }}
        spaceTitle={space?.title}
        spaceType={space?.space_type}
        participantCount={participants.length}
      />

      {/* Create Activity Modal */}
      <CreateActivityModal
        spaceId={id as string}
        visible={showCreateActivity}
        onClose={() => setShowCreateActivity(false)}
        onActivityCreated={loadSpaceDetails}
      />
      <MediaUploader
        spaceId={id as string}
        isVisible={showMediaUploader}
        onClose={() => setShowMediaUploader(false)}
        onUploadComplete={(media) => {
          console.log('Media uploaded:', media);
          // You could automatically send a message with the media
          if (activeTab === 'chat') {
            setContent(`Check out this file: ${media.url || media.file_name}`);
          }
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
    elevation: 8,
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 3.84px rgba(0, 0, 0, 0.25)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
      }
    }),
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
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
});

export default SpaceDetailScreen;