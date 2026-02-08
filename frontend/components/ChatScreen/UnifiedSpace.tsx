// components/ChatScreen/UnifiedSpace.tsx
import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  Animated,
  Dimensions,
  Platform,
  GestureResponderEvent,
} from 'react-native';
import { 
  Audio, 
  Video,
} from 'expo-av';
import { Camera, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { ResizeMode } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';

interface UnifiedSpaceProps {
  spaceId: string;
  initialType?: string;
}

export const UnifiedSpace: React.FC<UnifiedSpaceProps> = ({ spaceId, initialType = 'chat' }) => {
  const [spaceType, setSpaceType] = useState(initialType);
  const [spaceData, setSpaceData] = useState<any>(null);
  const [magicEvents, setMagicEvents] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  
  // Media states
  const [cameraPermission] = useCameraPermissions();
  const [microphonePermission] = useMicrophonePermissions();
  const [isRecording, setIsRecording] = useState(false);
  const [screenShareMode, setScreenShareMode] = useState<'none' | 'canvas' | 'camera'>('none');
  
  // Real-time state
  const [myCursor, setMyCursor] = useState({ x: 0, y: 0 });
  const [myReaction, setMyReaction] = useState<string>('');
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Magic discovery
  const [discoveredMagic, setDiscoveredMagic] = useState<string[]>([]);
  const [spaceEnergy, setSpaceEnergy] = useState(0); // 0-100, fuels magic

  // 🔥 UNIFIED REAL-TIME ENGINE
  useEffect(() => {
    // 1. Load space
    loadSpace(spaceId);
    
    // 2. Setup real-time subscriptions
    const spaceChannel = pusher.subscribe(`space-${spaceId}`);
    
    // Handle ANY participant update
    spaceChannel.bind('participant-updated', (data: any) => {
      setParticipants(prev => updateParticipant(prev, data));
    });
    
    // Handle ANY content change
    spaceChannel.bind('content-updated', (data: any) => {
      setSpaceData(prev => ({ ...prev, content_state: data.newState }));
    });
    
    // Handle MAGIC events in real-time
    spaceChannel.bind('magic-triggered', (event: any) => {
      setMagicEvents(prev => [event, ...prev]);
      triggerMagicDiscovery(event);
    });
    
    // Handle VOICE activity
    spaceChannel.bind('voice-activity', (data: any) => {
      if (data.userId !== currentUser.id) {
        updateVoiceVisualization(data);
      }
    });
    
    return () => spaceChannel.unsubscribe();
  }, [spaceId]);

  // 🎨 DYNAMIC RENDERER - ONE COMPONENT, ALL MODES
  const renderSpaceContent = () => {
    const renderers = {
      chat: () => (
        <ChatInterface 
          messages={spaceData?.content_state?.messages || []}
          onSend={handleSendMessage}
          onReact={handleReaction}
          participants={participants}
        />
      ),
      
      whiteboard: () => (
        <CollaborativeCanvas 
          canvasData={spaceData?.content_state?.canvas}
          onDraw={handleDraw}
          participants={participants}
          showCursors={true}
        />
      ),
      
      meeting: () => (
        <MeetingInterface 
          participants={participants}
          myVideoState={myVideoState}
          onToggleVideo={toggleVideo}
          onToggleAudio={toggleAudio}
          onScreenShare={toggleScreenShare}
          sharedScreen={spaceData?.content_state?.shared_screen}
        />
      ),
      
      document: () => (
        <CollaborativeEditor 
          content={spaceData?.content_state?.document}
          onChange={handleDocumentChange}
          participants={participants}
          showLiveEdits={true}
        />
      ),
      
      brainstorm: () => (
        <BrainstormBoard 
          ideas={spaceData?.content_state?.ideas}
          onAddIdea={handleAddIdea}
          onConnectIdeas={handleConnectIdeas}
          participants={participants}
        />
      ),
      
      story: () => (
        <StoryBuilder 
          story={spaceData?.content_state?.story}
          onAddSegment={handleAddSegment}
          onChooseBranch={handleChooseBranch}
          participants={participants}
        />
      ),
      
      voice_channel: () => (
        <VoiceChannel 
          participants={participants}
          onSpeak={handleStartSpeaking}
          onListen={handleListening}
          audioWaveforms={spaceData?.content_state?.waveforms}
        />
      )
    };

    return renderers[spaceType] ? renderers[spaceType]() : renderers.chat();
  };

  // 🔮 MAGIC TRIGGERS - SIMPLE RULES, COMPLEX OUTCOMES
  const checkForMagic = async () => {
    const rules = [
      {
        condition: () => participants.length >= 3 && spaceEnergy > 70,
        magic: 'collective_breakthrough',
        message: 'The group energy is high! Something amazing might happen...'
      },
      {
        condition: () => spaceData?.activity_metrics?.total_edits > 50,
        magic: 'evolution_unlock',
        message: 'Your persistent work is paying off!'
      },
      {
        condition: () => {
          const hour = new Date().getHours();
          return hour >= 22 || hour <= 6; // Late night
        },
        magic: 'dream_insight',
        message: 'The space is quiet... perfect for inspiration'
      },
      {
        condition: () => participants.some(p => p.reaction_stream?.includes('❤️')),
        magic: 'heart_resonance',
        message: 'Love is in the air!'
      }
    ];

    for (const rule of rules) {
      if (rule.condition() && !discoveredMagic.includes(rule.magic)) {
        await triggerMagic(rule.magic, rule.message);
        break;
      }
    }
  };

  const triggerMagic = async (magicType: string, message: string) => {
    // Create magic event
    const magicEvent = await axios.post(`/api/spaces/${spaceId}/magic`, {
      event_type: magicType,
      event_data: {
        message,
        timestamp: new Date().toISOString(),
        participants: participants.map(p => p.user_id)
      }
    });

    // Real-time broadcast
    pusher.trigger(`space-${spaceId}`, 'magic-triggered', magicEvent.data);
    
    // UI feedback
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    // Add to discovered
    setDiscoveredMagic(prev => [...prev, magicType]);
    
    // Space evolves
    if (magicType === 'evolution_unlock') {
      await evolveSpace();
    }
  };

  // 📱 INTEGRATION WITH YOUR EXISTING CHATPAGE
  const integrateWithChatPage = () => {
    // This function would be called from your existing ChatPage
    return {
      // Add collaboration button to ChatRow
      enhanceChatRow: (chatItem: any) => ({
        ...chatItem,
        hasSpace: chatItem.linked_space_id !== null,
        spaceType: chatItem.space_type,
        onStartCollaboration: () => startCollaborationFromChat(chatItem)
      }),
      
      // Add spaces section to SectionList
      getSpacesSection: async (userId: string) => {
        const spaces = await axios.get(`/api/users/${userId}/spaces`);
        return {
          title: 'Active Spaces',
          data: spaces.data.map((space: any) => ({
            id: space.id,
            name: space.title,
            lastMessage: getSpaceActivityText(space),
            timestamp: space.updated_at,
            type: 'space',
            spaceType: space.space_type,
            participantCount: space.participants_count,
            isLive: space.is_live,
            unreadCount: space.unread_messages || 0,
            avatar: space.icon || getDefaultSpaceIcon(space.space_type),
          }))
        };
      },
      
      // Quick actions from chat
      quickActions: {
        startWhiteboard: (conversationId: string) => createSpace('whiteboard', conversationId),
        startMeeting: (conversationId: string) => createSpace('meeting', conversationId),
        brainstorm: (conversationId: string) => createSpace('brainstorm', conversationId),
        coeditPost: (postId: string) => createSpace('document', null, postId),
        continueStory: (storyId: string) => createSpace('story', null, null, storyId),
      }
    };
  };

  return (
    <View style={styles.container}>
      {/* SPACE HEADER - Dynamic based on type */}
      <SpaceHeader 
        title={spaceData?.title}
        type={spaceType}
        participants={participants}
        energyLevel={spaceEnergy}
        onTypeChange={setSpaceType}
        discoveredMagic={discoveredMagic}
      />
      
      {/* MAIN CONTENT AREA */}
      <View style={styles.contentArea}>
        {renderSpaceContent()}
        
        {/* MAGIC EVENTS FLOATING ORBS */}
        {magicEvents
          .filter(e => !e.has_been_discovered)
          .map(event => (
            <MagicOrb 
              key={event.id}
              event={event}
              onDiscover={() => discoverMagic(event)}
            />
          ))
        }
      </View>
      
      {/* UNIFIED TOOLBAR - Adapts to space type */}
      <SpaceToolbar 
        type={spaceType}
        onToolSelect={handleToolSelect}
        myState={{
          isSpeaking,
          isSharing: screenShareMode !== 'none',
          reaction: myReaction,
        }}
        quickActions={[
          { icon: 'sparkles', action: () => checkForMagic() },
          { icon: 'people', action: () => showParticipants() },
          { icon: 'share', action: () => toggleScreenShare() },
          { icon: 'bulb', action: () => suggestIdea() },
        ]}
      />
      
      {/* PARTICIPANTS OVERLAY */}
      <ParticipantsOverlay 
        participants={participants}
        myCursor={myCursor}
        onParticipantPress={focusOnParticipant}
      />
    </View>
  );
};

// 🎯 SIMPLE INTEGRATION WITH YOUR EXISTING CHATPAGE
export const enhanceChatPage = (ChatPageComponent: React.FC) => {
  return function EnhancedChatPage(props: any) {
    const [spacesSection, setSpacesSection] = useState<any>(null);
    const collaboration = integrateWithChatPage();
    
    useEffect(() => {
      // Add spaces to your existing SectionList
      collaboration.getSpacesSection(props.user?.id).then(section => {
        setSpacesSection(section);
      });
    }, [props.user?.id]);
    
    // Enhance your existing filteredData
    const enhancedFilteredData = useMemo(() => {
      const original = props.filteredData || [];
      return spacesSection ? [spacesSection, ...original] : original;
    }, [props.filteredData, spacesSection]);
    
    return (
      <>
        <ChatPageComponent 
          {...props} 
          filteredData={enhancedFilteredData}
          // Pass collaboration methods to child components
          collaborationTools={collaboration}
        />
        
        {/* Floating "Start Collaboration" button */}
        <FloatingCollaborationButton 
          onPress={() => showCollaborationMenu(props.currentChat)}
          quickActions={collaboration.quickActions}
        />
      </>
    );
  };
};