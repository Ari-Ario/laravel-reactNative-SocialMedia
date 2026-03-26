import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { Animated, Dimensions, Platform, Vibration } from 'react-native';
import { useRouter } from 'expo-router';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── Incoming Call Types ────────────────────────────────────────────────────
export interface IncomingCall {
  callId: string;
  spaceId: string;
  callerId: number;
  callerName: string;
  callerAvatar?: string;
  callType: 'audio' | 'video';
  spaceType: string;
}

// ─── Active Call Types ───────────────────────────────────────────────────────
interface ActiveCall {
  spaceId: string;
  spaceType?: string;
  callId?: string;
  type: 'audio' | 'video';
}

interface CallContextType {
  activeCall: ActiveCall | null;
  isMinimized: boolean;
  callPosition: { x: number; y: number };
  startCall: (callData: ActiveCall) => void;
  endCall: () => void;
  minimizeCall: () => void;
  maximizeCall: () => void;
  updateCallPosition: (x: number, y: number) => void;
  // ─── Incoming Call ───────────────────────────────────────────────────────
  incomingCall: IncomingCall | null;
  isRinging: boolean;
  setIncomingCall: (call: IncomingCall | null) => void;
  acceptIncomingCall: () => void;
  rejectIncomingCall: () => Promise<void>;
  messageIncomingCall: () => Promise<void>;
  clearIncomingCall: () => void;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within CallProvider');
  }
  return context;
};

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [callPosition, setCallPosition] = useState({ x: SCREEN_WIDTH - 170, y: SCREEN_HEIGHT - 300 });

  // ─── Incoming Call State ─────────────────────────────────────────────────
  const [incomingCall, setIncomingCallState] = useState<IncomingCall | null>(null);
  const [isRinging, setIsRinging] = useState(false);
  const vibrationActive = useRef(false);

  // ─── Ringing helpers (declared early so startCall can reference them) ───────
  const stopRinging = useCallback(() => {
    if (Platform.OS !== 'web') {
      try { Vibration.cancel(); } catch { }
    }
    vibrationActive.current = false;
    setIsRinging(false);
  }, []);

  const startRinging = useCallback(() => {
    setIsRinging(true);
    if (Platform.OS !== 'web') {
      try {
        vibrationActive.current = true;
        Vibration.vibrate([500, 1000, 500, 1000, 500, 1000, 500, 1000, 500, 1000], true);
      } catch { }
    }
  }, []);

  const startCall = useCallback((callData: ActiveCall) => {
    setActiveCall(callData);
    setIsMinimized(false);
    // Clear any incoming call alert when actively starting/joining a call
    setIncomingCallState(null);
    stopRinging();
  }, [stopRinging]);

  const endCall = useCallback(() => {
    setActiveCall(null);
    setIsMinimized(false);
  }, []);

  const minimizeCall = useCallback(() => {
    setIsMinimized(true);
  }, []);

  const maximizeCall = useCallback(() => {
    setIsMinimized(false);
  }, []);

  const updateCallPosition = useCallback((x: number, y: number) => {
    setCallPosition({ x, y });
  }, []);


  // Stop vibration when ringing clears
  useEffect(() => {
    if (!isRinging && vibrationActive.current) {
      try { Vibration.cancel(); } catch { }
      vibrationActive.current = false;
    }
  }, [isRinging]);

  // Auto-dismiss incoming call after 60 seconds (missed call)
  useEffect(() => {
    if (!incomingCall) return;
    const timeout = setTimeout(() => {
      console.log('📞 Incoming call auto-dismissed (missed)');
      stopRinging();
      setIncomingCallState(null);
    }, 60000);
    return () => clearTimeout(timeout);
  }, [incomingCall, stopRinging]);

  // ─── Incoming Call Actions ───────────────────────────────────────────────
  const setIncomingCall = useCallback((call: IncomingCall | null) => {
    if (call) {
      setIncomingCallState(call);
      startRinging();
    } else {
      setIncomingCallState(null);
      stopRinging();
    }
  }, [startRinging, stopRinging]);

  const acceptIncomingCall = useCallback(() => {
    if (!incomingCall) return;
    const call = incomingCall;
    stopRinging();
    setIncomingCallState(null);

    // ─── CRITICAL: Set activeCall BEFORE navigating so the meeting tab renders
    // ImmersiveCallView (it checks `activeCall && activeCall.spaceId === id`).
    // We join an existing call that was started by the caller, so we mark it
    // as active from our side immediately and let ImmersiveCallView do the WebRTC join.
    startCall({
      spaceId: call.spaceId,
      spaceType: call.spaceType || 'direct',
      callId: call.callId,
      type: call.callType,
    });

    // Navigate to the space meeting tab — ImmersiveCallView will now render
    // because activeCall is set for this spaceId.
    router.push({
      pathname: '/(spaces)/[id]',
      params: {
        id: call.spaceId,
        tab: 'meeting',
        call: call.callId,
        type: call.callType,
        joining: '1',   // signals ImmersiveCallView to join (not start) the call
      },
    });
  }, [incomingCall, router, startCall, stopRinging]);

  const rejectIncomingCall = useCallback(async () => {
    if (!incomingCall) return;
    const call = incomingCall;
    stopRinging();
    setIncomingCallState(null);
    try {
      const CollaborationService = require('@/services/ChatScreen/CollaborationService').default;
      const cs = CollaborationService.getInstance();
      // 1. Tell backend we rejected — best-effort (non-blocking)
      cs.rejectCall(call.spaceId, call.callId).catch(() => {});
      // 2. For DIRECT spaces only: end the call entirely so the caller's
      //    ImmersiveCallView receives `call.ended` and is dismissed.
      //    For protected/channel spaces the call continues for other participants.
      if (call.spaceType === 'direct') {
        await cs.endCall(call.spaceId, call.callId);
        console.log('📞 Direct call rejected + ended — caller notified via call.ended event');
      } else {
        console.log('📞 Call rejected (non-direct) — caller\'s ImmersiveCallView stays open');
      }
    } catch (error) {
      console.warn('📞 Error on rejection (non-fatal):', error);
    }
  }, [incomingCall, stopRinging]);

  // ─── Message: reject notification + navigate to space chat ──────────────
  const messageIncomingCall = useCallback(async () => {
    if (!incomingCall) return;
    const call = incomingCall;
    // First reject so the caller is notified
    await rejectIncomingCall();
    // Then navigate the callee directly to the space chat tab
    router.push({
      pathname: '/(spaces)/[id]',
      params: {
        id: call.spaceId,
        tab: 'chat',
      },
    });
    console.log('📞 Message action: rejected call + navigated to space chat', call.spaceId);
  }, [incomingCall, rejectIncomingCall, router]);

  const clearIncomingCall = useCallback(() => {
    stopRinging();
    setIncomingCallState(null);
  }, [stopRinging]);

  return (
    <CallContext.Provider
      value={{
        activeCall,
        isMinimized,
        callPosition,
        startCall,
        endCall,
        minimizeCall,
        maximizeCall,
        updateCallPosition,
        // ─── Incoming Call ─────────────────────────────────────────────
        incomingCall,
        isRinging,
        setIncomingCall,
        acceptIncomingCall,
        rejectIncomingCall,
        messageIncomingCall,
        clearIncomingCall,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};
