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
  FlatList
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useContext } from 'react';
import AuthContext from '@/context/AuthContext';
import CollaborationService from '@/services/CollaborationService';
import { AICollaborationAssistant } from '@/components/AI/AICollaborationAssistant';
import * as Haptics from 'expo-haptics';
import { getToken } from '@/services/TokenService';

const SpaceDetailScreen = () => {
  const { id } = useLocalSearchParams();
  const { user } = useContext(AuthContext);
  const [space, setSpace] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [magicEvents, setMagicEvents] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'chat' | 'whiteboard' | 'meeting' | 'document' | 'brainstorm'>('chat');
  const [content, setContent] = useState<string>('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteUserId, setInviteUserId] = useState('');
  
  const collaborationService = CollaborationService.getInstance();
  const windowHeight = Dimensions.get('window').height;
  const token = getToken();
// app/(spaces)/[id].tsx - Add debugging
useEffect(() => {
  console.log('SpaceDetailScreen mounted with id:', id);
  console.log('User token exists:', !!user?.token);
  
  if (token) {
    collaborationService.setToken(token);
    console.log('Token set, loading space details...');
    loadSpaceDetails();
    subscribeToSpace();
  } else {
    console.log('No user token available');
  }
  
  return () => {
    console.log('SpaceDetailScreen unmounting');
    unsubscribeFromSpace();
  };
}, [id, token]);

const loadSpaceDetails = async () => {
  console.log('loadSpaceDetails called');
  try {
    const spaceData = await collaborationService.fetchSpaceDetails(id as string);
    console.log('Space data loaded:', spaceData);
    
    setSpace(spaceData);
    setParticipants(spaceData.participants || []);
    setMagicEvents(spaceData.magic_events || []);
    
    if (spaceData.space_type && ['chat', 'whiteboard', 'meeting', 'document', 'brainstorm'].includes(spaceData.space_type)) {
      setActiveTab(spaceData.space_type as any);
    }
  } catch (error) {
    console.error('Error loading space:', error);
    Alert.alert('Error', 'Failed to load space details');
  }
};

  const subscribeToSpace = async () => {
    await collaborationService.subscribeToSpace(id as string, {
      onSpaceUpdate: (updatedSpace) => {
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
      },
      onContentUpdate: (contentState) => {
        setSpace(prev => ({ ...prev, content_state: contentState }));
      },
      onMagicEvent: (event) => {
        setMagicEvents(prev => [event, ...prev]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
    });
  };

  const unsubscribeFromSpace = () => {
    collaborationService.unsubscribeFromSpace(id as string);
  };

  const handleSendMessage = async () => {
    if (!content.trim() || !space) return;
    
    try {
      const currentContent = space.content_state?.messages || [];
      const newMessage = {
        id: Date.now().toString(),
        user_id: user?.id,
        content: content.trim(),
        timestamp: new Date().toISOString(),
      };
      
      const updatedContent = {
        ...space.content_state,
        messages: [...currentContent, newMessage],
      };
      
      await collaborationService.updateContentState(id as string, updatedContent);
      setContent('');
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleStartCall = async (type: 'audio' | 'video') => {
    try {
      await collaborationService.startCall(id as string, type);
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
    } catch (error) {
      console.error('Error discovering magic:', error);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'chat':
        return (
          <ScrollView style={styles.chatContainer}>
            {(space?.content_state?.messages || []).map((message: any) => (
              <View 
                key={message.id} 
                style={[
                  styles.messageBubble,
                  message.user_id === user?.id ? styles.myMessage : styles.theirMessage
                ]}
              >
                <Text style={styles.messageText}>{message.content}</Text>
                <Text style={styles.messageTime}>
                  {new Date(message.timestamp).toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </Text>
              </View>
            ))}
          </ScrollView>
        );
        
      case 'whiteboard':
        return (
          <View style={styles.whiteboardContainer}>
            <Text style={styles.placeholderText}>Collaborative Whiteboard</Text>
            <Text style={styles.placeholderSubtext}>
              Draw together in real-time. Coming soon!
            </Text>
          </View>
        );
        
      case 'meeting':
        return (
          <View style={styles.meetingContainer}>
            <Text style={styles.placeholderText}>Video Meeting Room</Text>
            <Text style={styles.placeholderSubtext}>
              Start a video call with participants
            </Text>
          </View>
        );
        
      default:
        return (
          <View style={styles.defaultContainer}>
            <Text style={styles.placeholderText}>{activeTab.toUpperCase()} Collaboration</Text>
            <Text style={styles.placeholderSubtext}>
              {space?.description || 'Work together in real-time'}
            </Text>
          </View>
        );
    }
  };

  if (!space) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
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
        
        <View style={styles.headerContent}>
          <Text style={styles.title} numberOfLines={1}>{space.title}</Text>
          <Text style={styles.subtitle}>
            {participants.length} participants • {space.space_type}
          </Text>
        </View>
        
        <TouchableOpacity 
          style={styles.menuButton}
          onPress={() => setShowInviteModal(true)}
        >
          <Ionicons name="person-add" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {/* Tab Navigation */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'chat' && styles.activeTab]}
          onPress={() => setActiveTab('chat')}
        >
          <Ionicons name="chatbubble-outline" size={20} color={activeTab === 'chat' ? '#007AFF' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'chat' && styles.activeTabText]}>Chat</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'whiteboard' && styles.activeTab]}
          onPress={() => setActiveTab('whiteboard')}
        >
          <Ionicons name="easel-outline" size={20} color={activeTab === 'whiteboard' ? '#007AFF' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'whiteboard' && styles.activeTabText]}>Whiteboard</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'meeting' && styles.activeTab]}
          onPress={() => setActiveTab('meeting')}
        >
          <Ionicons name="videocam-outline" size={20} color={activeTab === 'meeting' ? '#007AFF' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'meeting' && styles.activeTabText]}>Meeting</Text>
        </TouchableOpacity>
        
        {space.space_type === 'document' && (
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'document' && styles.activeTab]}
            onPress={() => setActiveTab('document')}
          >
            <Ionicons name="document-text-outline" size={20} color={activeTab === 'document' ? '#007AFF' : '#666'} />
            <Text style={[styles.tabText, activeTab === 'document' && styles.activeTabText]}>Document</Text>
          </TouchableOpacity>
        )}
        
        {space.space_type === 'brainstorm' && (
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'brainstorm' && styles.activeTab]}
            onPress={() => setActiveTab('brainstorm')}
          >
            <Ionicons name="bulb-outline" size={20} color={activeTab === 'brainstorm' ? '#007AFF' : '#666'} />
            <Text style={[styles.tabText, activeTab === 'brainstorm' && styles.activeTabText]}>Brainstorm</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Main Content Area */}
      <View style={styles.contentArea}>
        {renderContent()}
        
        {/* Magic Events Floating Orbs */}
        {magicEvents
          .filter(event => !event.has_been_discovered)
          .slice(0, 3)
          .map(event => (
            <TouchableOpacity 
              key={event.id}
              style={styles.magicOrb}
              onPress={() => handleDiscoverMagic(event.id)}
            >
              <Ionicons name="sparkles" size={20} color="#fff" />
            </TouchableOpacity>
          ))}
      </View>

      {/* AI Assistant */}
      {space.has_ai_assistant && (
        <AICollaborationAssistant
          spaceId={id as string}
          spaceType={space.space_type}
          spaceData={space}
          participants={participants}
          currentContent={space.content_state}
        />
      )}

      {/* Action Bar */}
      <View style={styles.actionBar}>
        {activeTab === 'chat' ? (
          <>
            <TextInput
              style={styles.messageInput}
              placeholder="Type a message..."
              value={content}
              onChangeText={setContent}
              multiline
              maxLength={500}
            />
            <TouchableOpacity 
              style={[styles.sendButton, !content.trim() && styles.sendButtonDisabled]}
              onPress={handleSendMessage}
              disabled={!content.trim()}
            >
              <Ionicons name="send" size={20} color="#fff" />
            </TouchableOpacity>
          </>
        ) : activeTab === 'meeting' ? (
          <View style={styles.meetingActions}>
            <TouchableOpacity 
              style={styles.callButton}
              onPress={() => handleStartCall('video')}
            >
              <Ionicons name="videocam" size={24} color="#fff" />
              <Text style={styles.callButtonText}>Start Video Call</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.callButton, { backgroundColor: '#4CAF50' }]}
              onPress={() => handleStartCall('audio')}
            >
              <Ionicons name="call" size={24} color="#fff" />
              <Text style={styles.callButtonText}>Start Audio Call</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.collaborationHint}>
            Real-time collaboration enabled • {participants.filter(p => p.presence_data?.is_online).length} online
          </Text>
        )}
      </View>

      {/* Participants Sidebar */}
      <Modal
        visible={false}
        animationType="slide"
        transparent
      >
        {/* Implement participants sidebar */}
      </Modal>

      {/* Invite Modal */}
      <Modal
        visible={showInviteModal}
        animationType="slide"
        transparent
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Invite User to Space</Text>
            
            <TextInput
              style={styles.modalInput}
              placeholder="Enter user ID"
              value={inviteUserId}
              onChangeText={setInviteUserId}
              keyboardType="numeric"
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
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handleInviteUser}
                disabled={!inviteUserId.trim()}
              >
                <Text style={styles.modalButtonTextConfirm}>Invite</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  menuButton: {
    padding: 8,
  },
  tabContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingHorizontal: 16,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginRight: 8,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  tabText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#666',
  },
  activeTabText: {
    color: '#007AFF',
    fontWeight: '500',
  },
  contentArea: {
    flex: 1,
    position: 'relative',
  },
  chatContainer: {
    flex: 1,
    padding: 16,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 18,
    marginBottom: 8,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#f0f0f0',
  },
  messageText: {
    fontSize: 16,
    color: '#fff',
  },
  messageTime: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  whiteboardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  meetingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  defaultContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  placeholderSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  magicOrb: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#667EEA',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  messageInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    padding: 12,
    paddingHorizontal: 16,
    marginRight: 8,
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
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  meetingActions: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
  },
  callButtonText: {
    color: '#fff',
    fontWeight: '500',
    marginLeft: 8,
  },
  collaborationHint: {
    flex: 1,
    textAlign: 'center',
    color: '#666',
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#f0f0f0',
    marginRight: 8,
  },
  modalButtonConfirm: {
    backgroundColor: '#007AFF',
    marginLeft: 8,
  },
  modalButtonTextCancel: {
    color: '#333',
    fontWeight: '500',
  },
  modalButtonTextConfirm: {
    color: '#fff',
    fontWeight: '500',
  },
});

export default SpaceDetailScreen;