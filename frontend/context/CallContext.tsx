import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { Platform, Animated, Dimensions, Vibration } from 'react-native';
import { useRouter, useGlobalSearchParams } from 'expo-router';

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
  autostart?: boolean; // ✅ NEW: Signals to auto-join upon entry
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
  const globalParams = useGlobalSearchParams();
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [callPosition, setCallPosition] = useState({ x: SCREEN_WIDTH - 170, y: SCREEN_HEIGHT - 300 });

  // ─── Incoming Call State ─────────────────────────────────────────────────
  const [incomingCall, setIncomingCallState] = useState<IncomingCall | null>(null);
  const [isRinging, setIsRinging] = useState(false);
  const vibrationActive = useRef(false);
  const lastEndedAtRef = useRef<number>(0);

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
    lastEndedAtRef.current = Date.now();
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

  const clearIncomingCall = useCallback(() => {
    stopRinging();
    setIncomingCallState(null);
  }, [stopRinging]);

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

  // ─── URL Sync / Recovery / Notification Trigger ──────────────────────────
  const handledJoinIdRef = useRef<string | null>(null);

  const urlSyncDeps = [
    globalParams.call,
    globalParams.id,
    globalParams.type,
    globalParams.ringing,
    globalParams.joining,
    globalParams.callerName,
    activeCall,
    incomingCall,
    setIncomingCall,
    setActiveCall,
  ];

  useEffect(() => {
    const callId = globalParams.call as string;
    const spaceId = (globalParams.id || globalParams.spaceId) as string;
    const callType = (globalParams.callType || globalParams.type) as 'audio' | 'video';
    const isRingingIntent = globalParams.ringing === '1';

    // 1. Handle "Ringing" Intent from Notification / Deep Link
    if (isRingingIntent && callId && spaceId && !activeCall && !incomingCall) {
      console.log('🔔 Notification trigger: showing incoming call UI via URL params', { callId, spaceId });
      setIncomingCall({
        callId,
        spaceId,
        callerId: Number(globalParams.callerId) || 0,
        callerName: globalParams.callerName ? decodeURIComponent(globalParams.callerName as string) : 'Someone',
        callType: callType || 'video',
        spaceType: (globalParams.spaceType as string) || 'group',
      });

      // ✅ COMPETE INTENT: Clear the ringing parameters from the URL so they don't re-trigger.
      // This is critical for preventing loops when the user navigates or rejects the call.
      router.setParams({
        ringing: undefined,
        callerName: undefined,
        callType: undefined,
        spaceType: undefined,
        callerId: undefined,
        id: undefined,
        spaceId: undefined,
      });
      return; 
    }

    // 2. Handle "Call Recovery" / Joining Intent
    // ✅ IDEMPOTENT GUARD: Prevent re-joining the same callId from URL if we already handled it.
    // This stops the Ghost Re-call race condition when ending a call.
    if (callId && spaceId && !activeCall && globalParams.joining === '1') {
      // Suppression Window: Ignore joins within 2s of a deliberate endCall()
      if (Date.now() - lastEndedAtRef.current < 2000) {
          console.log('🔄 Suppression: Call recently ended, ignoring recovery trigger');
          return;
      }

      if (handledJoinIdRef.current === callId) {
        console.log('🔄 Suppression: callId already handled in this session, ignoring URL params');
        return;
      }

      console.log('🔄 Call recovery: restoring activeCall from URL params', { callId, spaceId });
      handledJoinIdRef.current = callId;

      setActiveCall({
        spaceId,
        callId,
        type: callType || 'video',
        spaceType: (globalParams.spaceType as string) || 'group',
        autostart: globalParams.autostart === 'true'
      });
      setIsMinimized(false);

      // ✅ CONSUME INTENT: Clear the joining parameters from the URL so they don't re-trigger.
      // This is crucial for preventing "Ghost Re-joins" when a call is later ended.
      router.setParams({
        joining: undefined,
        autostart: undefined,
        call: undefined,
      });
    }

    // Reset handledJoinIdRef if params cleared (allowing future re-joins to DIFFERENT calls)
    if (!callId && handledJoinIdRef.current) {
        handledJoinIdRef.current = null;
    }
  }, urlSyncDeps);


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
