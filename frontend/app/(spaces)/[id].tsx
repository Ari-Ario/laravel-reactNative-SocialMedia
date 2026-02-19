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
  ActivityIndicator
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useContext, useCallback } from 'react';
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

const SpaceDetailScreen = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useContext(AuthContext);
  const [space, setSpace] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [magicEvents, setMagicEvents] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'chat' | 'whiteboard' | 'meeting' | 'document' | 'brainstorm' | 'calendar' | 'files' | 'ai'>('chat');
  const [content, setContent] = useState<string>('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteUserId, setInviteUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCalendarPrompt, setShowCalendarPrompt] = useState(false);
  const [showCreateActivity, setShowCreateActivity] = useState(false);
  const params = useLocalSearchParams(); // ✅ top level
  const [showMediaUploader, setShowMediaUploader] = useState(false);

  const collaborationService = CollaborationService.getInstance();
  const windowHeight = Dimensions.get('window').height;

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

      Alert.alert('Call Started', `Starting ${type} call...`);
    } catch (error) {
      console.error('Error starting call:', error);
      Alert.alert('Error', 'Failed to start call');
    }
  };

  const handleInviteUser = async () => {
    if (!inviteUserId.trim()) return;

    try {
      await collaborationService.inviteToSpace(id as string, [parseInt(inviteUserId)]);
      setShowInviteModal(false);
      setInviteUserId('');
      Alert.alert('Success', 'Invitation sent');
    } catch (error) {
      console.error('Error inviting user:', error);
      Alert.alert('Error', 'Failed to send invitation');
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
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setShowInviteModal(true)}
          >
            <Ionicons name="person-add" size={22} color="#007AFF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => Alert.alert(
              'Space Actions',
              'What would you like to do?',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Space Settings', onPress: () => { } },
                { text: 'View Participants', onPress: () => { } },
                { text: 'Export Content', onPress: () => { } },
                { text: 'Leave Space', style: 'destructive', onPress: () => { } },
              ]
            )}
          >
            <Ionicons name="ellipsis-vertical" size={22} color="#007AFF" />
          </TouchableOpacity>
        </View>
      </View>

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
      <Modal
        visible={showInviteModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowInviteModal(false);
          setInviteUserId('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Invite to Space</Text>
              <TouchableOpacity onPress={() => setShowInviteModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDescription}>
              Enter the user ID of the person you want to invite to "{space?.title}"
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Enter user ID"
              value={inviteUserId}
              onChangeText={setInviteUserId}
              keyboardType="number-pad"
              autoFocus
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowInviteModal(false);
                  setInviteUserId('');
                }}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm, !inviteUserId.trim() && styles.modalButtonDisabled]}
                onPress={handleInviteUser}
                disabled={!inviteUserId.trim()}
              >
                <Text style={styles.modalButtonTextConfirm}>Send Invite</Text>
              </TouchableOpacity>
            </View>
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
  messageInput: {
    flex: 1,
    backgroundColor: '#f8f8f8',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
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
  mediaButton: {
    padding: 8,
    marginRight: 8,
  },
});

export default SpaceDetailScreen;