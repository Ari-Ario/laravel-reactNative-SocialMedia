// hooks/useIncomingCallBridge.ts
/**
 * Bridge hook: subscribes to CollaborationService incoming-call events
 * and feeds them into CallContext.setIncomingCall.
 *
 * Design:
 *  - Listener is registered ONCE per user session (no re-registration on activeCall change).
 *  - activeCall is read via ref so we always have the freshest value without re-subscribing.
 *  - This prevents missed-call gaps during re-subscription windows.
 */
import { useEffect, useRef, useContext } from 'react';
import AuthContext from '@/context/AuthContext';
import { useCall } from '@/context/CallContext';
import type { IncomingCall } from '@/context/CallContext';

export function useIncomingCallBridge() {
  const { user } = useContext(AuthContext);
  const { activeCall, setIncomingCall } = useCall();

  // Keep a ref to the latest activeCall so the stable listener can read it
  const activeCallRef = useRef(activeCall);
  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  // Keep a ref to the latest user id
  const userIdRef = useRef<number | null>(user ? Number(user.id) : null);
  useEffect(() => {
    userIdRef.current = user ? Number(user.id) : null;
  }, [user]);

  // Register listener ONCE per user (stable — does NOT depend on activeCall)
  useEffect(() => {
    if (!user) return;

    let CollaborationService: any;
    try {
      CollaborationService = require('@/services/ChatScreen/CollaborationService').default;
    } catch (e) {
      console.error('📞 [Bridge] Could not load CollaborationService:', e);
      return;
    }

    const service = CollaborationService.getInstance();

    const handleIncoming = (data: IncomingCall) => {
      console.log('📞 [Bridge] Incoming call received:', data.callerName, data.callType, 'callerId:', data.callerId);

      // Guard: ignore if already in a call
      if (activeCallRef.current) {
        console.log('📞 [Bridge] Already in a call — ignoring incoming');
        return;
      }

      // Guard: ignore own call.started events (caller is this user)
      if (data.callerId === userIdRef.current) {
        console.log('📞 [Bridge] Ignoring own call.started event (callerId matches local user)');
        return;
      }

      console.log('📞 [Bridge] Triggering incoming call UI for:', data.callerName);
      setIncomingCall(data);
    };

    service.onIncomingCall(handleIncoming);
    console.log('📞 [Bridge] Registered incoming call listener (userId:', user.id, ')');

    return () => {
      service.offIncomingCall(handleIncoming);
      console.log('📞 [Bridge] Removed incoming call listener');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]); // Only re-register when the user changes (login/logout), NOT on activeCall
}
