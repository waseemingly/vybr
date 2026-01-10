import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { RealtimeChannel, RealtimePresenceState } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

type ListenerCallback = (payload: any) => void;

// Define the shape of the context
interface RealtimeContextType {
    channel: RealtimeChannel | null;
    presenceState: RealtimePresenceState;
    isNetworkConnected: boolean; // Add network state to context
    trackStatus: (status: object) => Promise<string>;
    untrackStatus: () => Promise<string>;
    subscribeToEvent: (eventName: string, callback: ListenerCallback) => void;
    unsubscribeFromEvent: (eventName: string, callback: ListenerCallback) => void;
    
    // Network-aware subscription method
    createNetworkAwareSubscription: (channelName: string, config: any) => RealtimeChannel | null;
    
    // Chat-specific methods
    subscribeToIndividualChat: (matchUserId: string, callbacks: {
        onMessage?: (payload: any) => void;
        onMessageUpdate?: (payload: any) => void;
        onMessageStatus?: (payload: any) => void;
        onTyping?: (payload: any) => void;
        onTypingStop?: () => void;
    }) => () => void;
    
    subscribeToGroupChat: (groupId: string, callbacks: {
        onMessage?: (payload: any) => void;
        onMessageUpdate?: (payload: any) => void;
        onMessageStatus?: (payload: any) => void;
        onGroupUpdate?: (payload: any) => void;
        onTyping?: (payload: any) => void;
        onTypingStop?: (userId: string) => void;
    }) => () => void;
    
    sendBroadcast: (chatType: 'individual' | 'group', id: string, event: string, payload: object) => void;
    
    // Typing indicators
    sendIndividualTypingIndicator: (matchUserId: string, isTyping: boolean) => void;
    sendGroupTypingIndicator: (groupId: string, isTyping: boolean, senderName?: string) => void;
    
    // Group member presence
    getGroupMemberPresence: (memberIds: string[]) => Record<string, boolean>;
}

// Create the context with a default value
const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined);

export const RealtimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { session } = useAuth();
    const [channel, setChannel] = useState<RealtimeChannel | null>(null);
    const [presenceState, setPresenceState] = useState<RealtimePresenceState>({});
    const listenersRef = useRef<Record<string, ListenerCallback[]>>({});
    const channelsRef = useRef<RealtimeChannel[]>([]);
    const chatChannelsRef = useRef<Map<string, RealtimeChannel>>(new Map());
    const typingTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
    
    // Reconnection state
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const reconnectAttemptsRef = useRef<Map<string, number>>(new Map());
    const lastErrorTimeRef = useRef<Map<string, number>>(new Map());
    const maxReconnectAttempts = 3; // Reduced from 5 to 3
    const reconnectDelay = 2000; // 2 seconds
    const errorDebounceTime = 5000; // 5 seconds between error handling for same channel
    
    // App state
    const appState = useRef(AppState.currentState);

    // Network state
    const [isNetworkConnected, setIsNetworkConnected] = useState(true);
    const networkStateRef = useRef(true);
    const networkSubscriptionRef = useRef<any>(null);

    const updateUserStatus = async (userId: string, isOnline: boolean) => {
        // Add a guard to prevent calling the function with an invalid userId
        if (!userId || typeof userId !== 'string' || userId.trim() === '') {
            console.warn(`[RealtimeContext] updateUserStatus called with invalid userId: ${userId}. Aborting.`);
            return;
        }
        
        // Additional validation to ensure userId is a valid UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(userId)) {
            console.warn(`[RealtimeContext] updateUserStatus called with invalid UUID format: ${userId}. Aborting.`);
            return;
        }
        
        try {
            await supabase.functions.invoke('update-user-status', {
                body: { userId, isOnline },
            });
        } catch (error) {
            console.error('Error updating user status:', error);
        }
    };

    // Enhanced cleanup function
    const cleanup = useCallback(() => {
        console.log(`[RealtimeContext] Cleaning up ${channelsRef.current.length} main channels and ${chatChannelsRef.current.size} chat channels.`);
        
        // Clear reconnection timeouts
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }
        
        // Clear typing timeouts
        typingTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
        typingTimeoutsRef.current.clear();
        
        // Reset reconnection attempts
        reconnectAttemptsRef.current.clear();
        
        // Clean up chat channels
        chatChannelsRef.current.forEach(ch => {
            try {
                supabase.removeChannel(ch);
            } catch (error) {
                console.warn('[RealtimeContext] Error removing chat channel:', error);
            }
        });
        chatChannelsRef.current.clear();
        
        // Clean up main channels
        channelsRef.current.forEach(ch => {
            try {
                supabase.removeChannel(ch);
            } catch (error) {
                console.warn('[RealtimeContext] Error removing main channel:', error);
            }
        });
        channelsRef.current = [];
        
        setChannel(null);
        
        if (session?.user?.id) {
            updateUserStatus(session.user.id, false);
        }
    }, [session?.user?.id]);

    // Reconnection handler with improved error handling
    const handleChannelError = useCallback((channelName: string, channel: RealtimeChannel) => {
        console.warn(`[RealtimeContext] Channel error detected for: ${channelName}`);
        
        // Don't attempt reconnection if network is down
        if (!networkStateRef.current) {
            console.log(`[RealtimeContext] Network is down, skipping reconnection for ${channelName}`);
            return;
        }
        
        // Debounce error handling - ignore errors that happen too frequently
        const now = Date.now();
        const lastErrorTime = lastErrorTimeRef.current.get(channelName) || 0;
        if (now - lastErrorTime < errorDebounceTime) {
            console.log(`[RealtimeContext] Ignoring frequent error for ${channelName} (debounced)`);
            return;
        }
        lastErrorTimeRef.current.set(channelName, now);
        
        const currentAttempts = reconnectAttemptsRef.current.get(channelName) || 0;
        
        if (currentAttempts >= maxReconnectAttempts) {
            console.error(`[RealtimeContext] Max reconnection attempts reached for ${channelName}. Giving up.`);
            reconnectAttemptsRef.current.delete(channelName);
            return;
        }
        
        const nextAttempt = currentAttempts + 1;
        reconnectAttemptsRef.current.set(channelName, nextAttempt);
        
        console.log(`[RealtimeContext] Attempting to reconnect ${channelName} (attempt ${nextAttempt}/${maxReconnectAttempts})`);
        
        // Remove the failed channel
        try {
            supabase.removeChannel(channel);
        } catch (error) {
            console.warn(`[RealtimeContext] Error removing failed channel ${channelName}:`, error);
        }
        
        // Use a more reasonable delay with exponential backoff (capped at 30 seconds)
        const delay = Math.min(reconnectDelay * Math.pow(1.5, currentAttempts), 30000);
        
        // Clear any existing timeout for this channel
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
        }
        
        reconnectTimeoutRef.current = setTimeout(() => {
            // Double-check network state before attempting reconnection
            if (!networkStateRef.current) {
                console.log(`[RealtimeContext] Network still down, cancelling reconnection for ${channelName}`);
                return;
            }
            
            console.log(`[RealtimeContext] Reconnecting ${channelName} after ${delay}ms delay`);
            
            // Only reconnect main channels, let chat channels reconnect naturally
            if (channelName === 'user_presence' || channelName.startsWith('notifications_for_')) {
                // Trigger main channels setup only once
                if (session?.user?.id) {
                    console.log('[RealtimeContext] Triggering main channels re-setup');
                    setupMainChannels();
                }
            } else {
                console.log(`[RealtimeContext] Chat channel ${channelName} will reconnect naturally on next subscription`);
            }
            
            // Reset error tracking on successful reconnection
            reconnectAttemptsRef.current.delete(channelName);
            lastErrorTimeRef.current.delete(channelName);
        }, delay);
    }, [session?.user?.id]);

    // Setup main channels with error handling
    const setupMainChannels = useCallback(() => {
        if (!session?.user?.id) {
            console.log('[RealtimeContext] No session, skipping main channel setup');
            return;
        }
        
        if (!networkStateRef.current) {
            console.log('[RealtimeContext] Network is down, skipping main channel setup');
            return;
        }
        
        const userId = session.user.id;
        console.log(`[RealtimeContext] Setting up main channels for user: ${userId}`);

        // Clean up existing channels first
        channelsRef.current.forEach(ch => {
            try {
                supabase.removeChannel(ch);
            } catch (error) {
                console.warn('[RealtimeContext] Error removing existing channel:', error);
            }
        });
        channelsRef.current = [];

        // Create main presence channel
        const mainChannel = supabase.channel('user_presence', {
            config: {
                presence: {
                    key: userId,
                },
            },
        });

        // Handle presence sync
        mainChannel.on('presence', { event: 'sync' }, () => {
            const newPresenceState = mainChannel.presenceState();
            console.log('[RealtimeContext] 📡 Presence synced, users online:', Object.keys(newPresenceState));
            setPresenceState(newPresenceState);
        });

        // Handle presence joins
        mainChannel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
            console.log('[RealtimeContext] 👋 User joined:', key, newPresences);
        });

        // Handle presence leaves
        mainChannel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
            console.log('[RealtimeContext] 👋 User left:', key, leftPresences);
        });

        // Subscribe to message notifications
        const notificationChannel = supabase.channel(`notifications_for_${userId}`);
        notificationChannel.on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
            },
                (payload) => {
                if (session?.user?.id && (payload.new as any).receiver_id === session.user.id) {
                        const eventName = 'new_message_notification';
                        if (listenersRef.current[eventName]) {
                            listenersRef.current[eventName].forEach(callback => callback(payload));
                        }
                    }
                }
        );

        // Subscribe to group message notifications
        notificationChannel.on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'group_chat_messages',
            },
                (payload) => {
                const newMessage = payload.new as any;
                if (session?.user?.id && newMessage.sender_id !== session.user.id) {
                    const eventName = 'new_group_message_notification';
                    if (listenersRef.current[eventName]) {
                        listenersRef.current[eventName].forEach(callback => callback(payload));
                    }
                }
            }
        );

        // Subscribe to being added to a new group
        notificationChannel.on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'group_chat_participants',
                filter: `user_id=eq.${userId}`
            },
                (payload) => {
                console.log('[RealtimeContext] Current user added to a group, notifying listeners.', payload);
                const eventName = 'new_group_added_notification';
                     if (listenersRef.current[eventName]) {
                        listenersRef.current[eventName].forEach(callback => callback(payload));
                    }
                }
        );

        // Subscribe to message status updates (for seen/delivered status)
        notificationChannel.on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'message_status',
            },
            (payload) => {
                console.log('[RealtimeContext] Message status updated:', payload);
                const eventName = 'message_status_updated';
                if (listenersRef.current[eventName]) {
                    listenersRef.current[eventName].forEach(callback => callback(payload));
                }
            }
        );

        // Subscribe to group message status updates (for seen/delivered status)
        notificationChannel.on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'group_message_status',
            },
            (payload) => {
                console.log('[RealtimeContext] Group message status updated:', payload);
                const eventName = 'group_message_status_updated';
                if (listenersRef.current[eventName]) {
                    listenersRef.current[eventName].forEach(callback => callback(payload));
                }
            }
        );

        // Subscribe to channels with error handling
        Promise.all([
            mainChannel.subscribe(async (status) => {
                console.log(`[RealtimeContext] Main channel subscription status: ${status}`);
                if (status === 'SUBSCRIBED') {
                    console.log('[RealtimeContext] ✅ Successfully subscribed to main presence channel');
                    setChannel(mainChannel);
                    
                    // Reset reconnection attempts on successful connection
                    reconnectAttemptsRef.current.delete('user_presence');
                    
                    // Track initial presence
                    try {
                        await mainChannel.track({
                            user_id: userId,
                            online_at: new Date().toISOString(),
                        });
                        console.log('[RealtimeContext] ✅ Initial presence tracked');
                        
                        // Update database status
                        await updateUserStatus(userId, true);
                    } catch (error) {
                        console.error('[RealtimeContext] ❌ Error tracking initial presence:', error);
                    }
                } else if (status === 'CHANNEL_ERROR') {
                    // Check if app is in background - this is expected behavior
                    const isBackground = appState.current.match(/inactive|background/);
                    if (isBackground) {
                        console.log('[RealtimeContext] Main channel error in background (expected - will reconnect on foreground)');
                    } else {
                        console.error('[RealtimeContext] ❌ Main channel error');
                        // Only handle error if network is available
                        if (networkStateRef.current) {
                            handleChannelError('user_presence', mainChannel);
                        } else {
                            console.log('[RealtimeContext] Network is down, skipping error handling for main channel');
                        }
                    }
                }
            }),
            notificationChannel.subscribe((status) => {
                console.log(`[RealtimeContext] Notification channel subscription status: ${status}`);
                if (status === 'SUBSCRIBED') {
                    console.log('[RealtimeContext] ✅ Successfully subscribed to notification channel');
                    // Reset reconnection attempts on successful connection
                    reconnectAttemptsRef.current.delete(`notifications_for_${userId}`);
                } else if (status === 'CHANNEL_ERROR') {
                    // Check if app is in background - this is expected behavior
                    const isBackground = appState.current.match(/inactive|background/);
                    if (isBackground) {
                        console.log('[RealtimeContext] Notification channel error in background (expected - will reconnect on foreground)');
                    } else {
                        console.error('[RealtimeContext] ❌ Notification channel error');
                        // Only handle error if network is available
                        if (networkStateRef.current) {
                            handleChannelError(`notifications_for_${userId}`, notificationChannel);
                        } else {
                            console.log('[RealtimeContext] Network is down, skipping error handling for notification channel');
                        }
                    }
                }
            })
        ]);

        channelsRef.current = [mainChannel, notificationChannel];
    }, [session?.user?.id, handleChannelError]);

    // Network connectivity handler
    const handleNetworkChange = useCallback((state: any) => {
        const wasConnected = networkStateRef.current;
        
        // On web, be more lenient with network detection since isInternetReachable might not work properly
        let isConnected;
        if (Platform.OS === 'web') {
            // On web, just check if connected, don't require internet reachability
            isConnected = !!state.isConnected;
            console.log(`[RealtimeContext] Web platform - Network state: isConnected=${state.isConnected}, isInternetReachable=${state.isInternetReachable}`);
        } else {
            // On mobile, be more lenient - prioritize isConnected over isInternetReachable
            // isInternetReachable can be unreliable on some devices/networks
            isConnected = state.isConnected || (state.isConnected && state.isInternetReachable);
            console.log(`[RealtimeContext] Mobile platform - Network state: isConnected=${state.isConnected}, isInternetReachable=${state.isInternetReachable}, final=${isConnected}`);
        }
        
        networkStateRef.current = isConnected;
        setIsNetworkConnected(isConnected);
        
        console.log(`[RealtimeContext] Network state changed: ${wasConnected} -> ${isConnected} (Platform: ${Platform.OS})`);
        
        if (!wasConnected && isConnected) {
            // Network came back online, attempt to reconnect all channels
            console.log('[RealtimeContext] Network restored, attempting to reconnect channels...');
            
            // Clear any existing reconnection timeouts
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
            }
            
            // Reset reconnection attempts
            reconnectAttemptsRef.current.clear();
            
            // Reconnect main channels by triggering a re-setup
            if (session?.user?.id) {
                // Use setTimeout to avoid circular dependency
                setTimeout(() => {
                    setupMainChannels();
                }, 100);
            }
        } else if (wasConnected && !isConnected) {
            // Network went down, clear reconnection attempts
            console.log('[RealtimeContext] Network lost, clearing reconnection attempts');
            reconnectAttemptsRef.current.clear();
            
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
            }
        }
    }, [session?.user?.id, setupMainChannels]);

    const trackStatus = useCallback(async (status: object): Promise<string> => {
        if (!channel) {
            console.warn('[RealtimeContext] No channel available for tracking status');
            return 'error';
        }
        try {
            const result = await channel.track(status);
            console.log('[RealtimeContext] ✅ Status tracked successfully');
            return result;
        } catch (error) {
            console.error('[RealtimeContext] ❌ Error tracking status:', error);
            return 'error';
        }
    }, [channel]);

    const untrackStatus = useCallback(async (): Promise<string> => {
        if (!channel) {
            console.warn('[RealtimeContext] No channel available for untracking status');
            return 'error';
        }
        try {
            const result = await channel.untrack();
            console.log('[RealtimeContext] ✅ Status untracked successfully');
            return result;
        } catch (error) {
            console.error('[RealtimeContext] ❌ Error untracking status:', error);
            return 'error';
        }
    }, [channel]);

    // Individual chat subscription with error handling
    const subscribeToIndividualChat = useCallback((matchUserId: string, callbacks: {
        onMessage?: (payload: any) => void;
        onMessageUpdate?: (payload: any) => void;
        onMessageStatus?: (payload: any) => void;
        onTyping?: (payload: any) => void;
        onTypingStop?: () => void;
    }) => {
        if (!session?.user?.id) {
            console.warn('[RealtimeContext] No user session for individual chat subscription');
            return () => {};
        }
        
        if (!networkStateRef.current) {
            console.log('[RealtimeContext] Network is down, skipping individual chat subscription');
            return () => {};
        }

        const channelName = `chat_${[session.user.id, matchUserId].sort().join('_')}`;
        
        // Check if channel already exists
        if (chatChannelsRef.current.has(channelName)) {
            console.log(`[RealtimeContext] Reusing existing individual chat channel: ${channelName}`);
            // Return a cleanup function that does nothing since we're reusing the channel
            return () => {
                console.log(`[RealtimeContext] Cleanup called for reused individual chat channel: ${channelName}`);
            };
        }

        console.log(`[RealtimeContext] Creating individual chat channel: ${channelName}`);
        const chatChannel = supabase.channel(channelName);

        // Subscribe to new messages
        if (callbacks.onMessage) {
            chatChannel.on(
                'broadcast',
                { event: 'message' },
                (payload) => callbacks.onMessage!({ new: payload.payload })
            );
        }

        // Subscribe to message updates
        if (callbacks.onMessageUpdate) {
            chatChannel.on(
                'broadcast',
                { event: 'message_update' },
                (payload) => callbacks.onMessageUpdate!({ new: payload.payload })
            );
        }

        // Subscribe to message status updates
        if (callbacks.onMessageStatus) {
            chatChannel.on(
                'broadcast',
                { event: 'message_status' },
                (payload) => callbacks.onMessageStatus!({ new: payload.payload })
            );
        }

        // Subscribe to typing indicators
        chatChannel.on('broadcast', { event: 'typing' }, (payload) => {
            if (payload.sender_id === matchUserId) {
                if (callbacks.onTyping) {
                    callbacks.onTyping(payload);
                }
                
                // Auto-stop typing after 3 seconds
                const timeoutKey = `typing_${matchUserId}`;
                const existingTimeout = typingTimeoutsRef.current.get(timeoutKey);
                if (existingTimeout) {
                    clearTimeout(existingTimeout);
                }
                
                const timeout = setTimeout(() => {
                    if (callbacks.onTypingStop) {
                        callbacks.onTypingStop();
                    }
                    typingTimeoutsRef.current.delete(timeoutKey);
                }, 3000);
                
                typingTimeoutsRef.current.set(timeoutKey, timeout);
            }
        });

        chatChannel.subscribe((status) => {
            console.log(`[RealtimeContext] Individual chat channel ${channelName} status:`, status);
            if (status === 'SUBSCRIBED') {
                console.log(`[RealtimeContext] ✅ Successfully subscribed to individual chat: ${channelName}`);
                // Reset reconnection attempts on successful connection
                reconnectAttemptsRef.current.delete(channelName);
            } else if (status === 'CHANNEL_ERROR') {
                console.error(`[RealtimeContext] ❌ Individual chat channel error: ${channelName}`);
                // Only handle error if network is available
                if (networkStateRef.current) {
                    handleChannelError(channelName, chatChannel);
                } else {
                    console.log(`[RealtimeContext] Network is down, skipping error handling for individual chat channel: ${channelName}`);
                }
            }
        });

        chatChannelsRef.current.set(channelName, chatChannel);

        // Return cleanup function
        return () => {
            console.log(`[RealtimeContext] Cleaning up individual chat channel: ${channelName}`);
            if (chatChannelsRef.current.has(channelName)) {
                try {
                    supabase.removeChannel(chatChannel);
                    chatChannelsRef.current.delete(channelName);
                    // Clear reconnection attempts for this channel
                    reconnectAttemptsRef.current.delete(channelName);
                    
                    // Clear typing timeout for this chat
                    const timeoutKey = `typing_${matchUserId}`;
                    const existingTimeout = typingTimeoutsRef.current.get(timeoutKey);
                    if (existingTimeout) {
                        clearTimeout(existingTimeout);
                        typingTimeoutsRef.current.delete(timeoutKey);
                    }
                } catch (error) {
                    console.warn(`[RealtimeContext] Error cleaning up individual chat channel ${channelName}:`, error);
                }
            }
        };
    }, [session?.user?.id, handleChannelError]);

    // Group chat subscription with error handling
    const subscribeToGroupChat = useCallback((groupId: string, callbacks: {
        onMessage?: (payload: any) => void;
        onMessageUpdate?: (payload: any) => void;
        onMessageStatus?: (payload: any) => void;
        onGroupUpdate?: (payload: any) => void;
        onTyping?: (payload: any) => void;
        onTypingStop?: (userId: string) => void;
    }) => {
        if (!session?.user?.id) {
            console.warn('[RealtimeContext] No user session for group chat subscription');
            return () => {};
        }
        
        if (!networkStateRef.current) {
            console.log('[RealtimeContext] Network is down, skipping group chat subscription');
            return () => {};
        }

        const channelName = `group_chat_${groupId}`;
        
        // Check if channel already exists
        if (chatChannelsRef.current.has(channelName)) {
            console.log(`[RealtimeContext] Reusing existing group chat channel: ${channelName}`);
            return () => {};
        }

        console.log(`[RealtimeContext] Creating group chat channel: ${channelName}`);
        const chatChannel = supabase.channel(channelName);

        // Subscribe to new messages
        if (callbacks.onMessage) {
            chatChannel.on(
                'broadcast',
                { event: 'message' },
                (payload) => callbacks.onMessage!({ new: payload.payload })
            );
        }

        // Subscribe to message updates
        if (callbacks.onMessageUpdate) {
            chatChannel.on(
                'broadcast',
                { event: 'message_update' },
                (payload) => callbacks.onMessageUpdate!({ new: payload.payload })
            );
        }

        // Subscribe to message status updates
        if (callbacks.onMessageStatus) {
            chatChannel.on(
                'broadcast',
                { event: 'message_status' },
                (payload) => callbacks.onMessageStatus!({ new: payload.payload })
            );
        }

        // Subscribe to group updates
        if (callbacks.onGroupUpdate) {
            chatChannel.on(
                'broadcast',
                { event: 'group_update' },
                (payload) => callbacks.onGroupUpdate!({ new: payload.payload })
            );
        }

        // Subscribe to typing indicators
        if (callbacks.onTyping || callbacks.onTypingStop) {
            chatChannel.on('broadcast', { event: 'typing' }, (payload) => {
                if (payload.sender_id !== session?.user?.id) {
                    if (payload.typing && callbacks.onTyping) {
                        callbacks.onTyping(payload);
                        
                        // Auto-stop typing after 3 seconds
                        const timeoutKey = `group_typing_${groupId}_${payload.sender_id}`;
                        const existingTimeout = typingTimeoutsRef.current.get(timeoutKey);
                        if (existingTimeout) {
                            clearTimeout(existingTimeout);
                        }
                        
                        const timeout = setTimeout(() => {
                            if (callbacks.onTypingStop) {
                                callbacks.onTypingStop(payload.sender_id);
                            }
                            typingTimeoutsRef.current.delete(timeoutKey);
                        }, 3000);
                        
                        typingTimeoutsRef.current.set(timeoutKey, timeout);
                    } else if (!payload.typing && callbacks.onTypingStop) {
                        callbacks.onTypingStop(payload.sender_id);
                        
                        // Clear timeout
                        const timeoutKey = `group_typing_${groupId}_${payload.sender_id}`;
                        const existingTimeout = typingTimeoutsRef.current.get(timeoutKey);
                        if (existingTimeout) {
                            clearTimeout(existingTimeout);
                            typingTimeoutsRef.current.delete(timeoutKey);
                        }
                    }
                }
            });
        }

        chatChannel.subscribe((status) => {
            console.log(`[RealtimeContext] Group chat channel ${channelName} status:`, status);
            if (status === 'SUBSCRIBED') {
                console.log(`[RealtimeContext] ✅ Successfully subscribed to group chat: ${channelName}`);
                // Reset reconnection attempts on successful connection
                reconnectAttemptsRef.current.delete(channelName);
            } else if (status === 'CHANNEL_ERROR') {
                console.error(`[RealtimeContext] ❌ Group chat channel error: ${channelName}`);
                // Only handle error if network is available
                if (networkStateRef.current) {
                    handleChannelError(channelName, chatChannel);
                } else {
                    console.log(`[RealtimeContext] Network is down, skipping error handling for group chat channel: ${channelName}`);
                }
            }
        });

        chatChannelsRef.current.set(channelName, chatChannel);

        // Return cleanup function
        return () => {
            console.log(`[RealtimeContext] Cleaning up group chat channel: ${channelName}`);
            if (chatChannelsRef.current.has(channelName)) {
                try {
                    supabase.removeChannel(chatChannel);
                    chatChannelsRef.current.delete(channelName);
                    // Clear reconnection attempts for this channel
                    reconnectAttemptsRef.current.delete(channelName);
                    
                    // Clear all typing timeouts for this group
                    const groupTypingPrefix = `group_typing_${groupId}_`;
                    typingTimeoutsRef.current.forEach((timeout, key) => {
                        if (key.startsWith(groupTypingPrefix)) {
                            clearTimeout(timeout);
                            typingTimeoutsRef.current.delete(key);
                        }
                    });
                } catch (error) {
                    console.warn(`[RealtimeContext] Error cleaning up group chat channel ${channelName}:`, error);
                }
            }
        };
    }, [session?.user?.id, handleChannelError]);

    // Send broadcast message
    const sendBroadcast = useCallback((chatType: 'individual' | 'group', id: string, event: string, payload: object) => {
        if (!session?.user?.id) return;

        const channelName = chatType === 'individual'
            ? `chat_${[session.user.id, id].sort().join('_')}`
            : `group_chat_${id}`;
        
        const channel = chatChannelsRef.current.get(channelName);
        if (channel) {
            channel.send({
                type: 'broadcast',
                event: event,
                payload: payload
            });
        } else {
            console.warn(`[RealtimeContext] No channel found for broadcast to ${channelName}`);
        }
    }, [session?.user?.id]);


    const sendIndividualTypingIndicator = useCallback((matchUserId: string, isTyping: boolean) => {
        if (!session?.user?.id) return;
        
        const channelName = `chat_${[session.user.id, matchUserId].sort().join('_')}`;
        const channel = chatChannelsRef.current.get(channelName);
        if (channel) {
            channel.send({
                type: 'broadcast',
                event: 'typing',
                payload: { 
                    sender_id: session.user.id, 
                    typing: isTyping 
                },
            });
        }
    }, [session?.user?.id]);

    const sendGroupTypingIndicator = useCallback((groupId: string, isTyping: boolean, senderName?: string) => {
        if (!session?.user?.id) return;
        
        const channelName = `group_chat_${groupId}`;
        const channel = chatChannelsRef.current.get(channelName);
        if (channel) {
            channel.send({
                type: 'broadcast',
                event: 'typing',
                payload: { 
                    sender_id: session.user.id, 
                    sender_name: senderName,
                    typing: isTyping 
                },
            });
        }
    }, [session?.user?.id]);

    // Network-aware subscription method
    const createNetworkAwareSubscription = useCallback((channelName: string, config: any): RealtimeChannel | null => {
        console.log(`[RealtimeContext] createNetworkAwareSubscription called for ${channelName}, network state: ${networkStateRef.current}`);
        if (!networkStateRef.current) {
            console.log(`[RealtimeContext] Network is down, skipping subscription creation for ${channelName}`);
            return null;
        }
        
        console.log(`[RealtimeContext] Creating network-aware subscription for ${channelName}`);
        return supabase.channel(channelName, config);
    }, []);

    // Get group member presence
    const getGroupMemberPresence = useCallback((memberIds: string[]): Record<string, boolean> => {
        const onlineStatus: Record<string, boolean> = {};
        
        memberIds.forEach(memberId => {
            onlineStatus[memberId] = !!(presenceState[memberId] && presenceState[memberId].length > 0);
        });
        
        return onlineStatus;
    }, [presenceState]);

    const subscribeToEvent = useCallback((eventName: string, callback: ListenerCallback) => {
        if (!listenersRef.current[eventName]) {
            listenersRef.current[eventName] = [];
        }
        listenersRef.current[eventName].push(callback);
        console.log(`[RealtimeContext] Subscribed to event: ${eventName}, total listeners: ${listenersRef.current[eventName].length}`);
    }, []);

    const unsubscribeFromEvent = useCallback((eventName: string, callback: ListenerCallback) => {
        if (listenersRef.current[eventName]) {
            listenersRef.current[eventName] = listenersRef.current[eventName].filter(cb => cb !== callback);
            console.log(`[RealtimeContext] Unsubscribed from event: ${eventName}, remaining listeners: ${listenersRef.current[eventName].length}`);
        }
    }, []);

    // Handle app state changes for proper cleanup
    const handleAppStateChange = useCallback((nextAppState: AppStateStatus) => {
        console.log(`[RealtimeContext] App state changed to: ${nextAppState}`);

        if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
            console.log('[RealtimeContext] App has come to the foreground!');
            // More robust reconnection
            if (networkStateRef.current) {
                cleanup();
                setTimeout(() => setupMainChannels(), 250);
            } else {
                console.log('[RealtimeContext] App came to foreground but network is down, skipping reconnection');
            }
        }

        appState.current = nextAppState;
        
        if (!session?.user?.id) {
            console.log(`[RealtimeContext] No session or user ID available for app state change. Session: ${!!session}, User ID: ${session?.user?.id}`);
            return;
        }

        const userId = session.user.id;
        console.log(`[RealtimeContext] Updating user status for app state change. User ID: ${userId}, State: ${nextAppState}`);

        if (nextAppState === 'background' || nextAppState === 'inactive') {
            updateUserStatus(userId, false);
        } else if (nextAppState === 'active') {
            updateUserStatus(userId, true);
        }
    }, [session?.user?.id, cleanup, setupMainChannels]);

    useEffect(() => {
        if (!session?.user?.id) {
            console.log('[RealtimeContext] No session, cleaning up...');
            cleanup();
            return;
        }

        const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
            if ((event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') && session?.access_token) {
                console.log('[RealtimeContext] Auth token refreshed, setting realtime auth.');
                supabase.realtime.setAuth(session.access_token);
            }
        });

        // Check initial network state and setup channels if available
        if (Platform.OS === 'web') {
            // On web, assume network is available initially and set up channels
            console.log('[RealtimeContext] Web platform detected, assuming network is available initially');
            networkStateRef.current = true;
            setIsNetworkConnected(true);
            setupMainChannels();
        } else {
            // On mobile, use NetInfo but be more lenient with isInternetReachable
            NetInfo.fetch().then(state => {
                // On mobile, prioritize isConnected over isInternetReachable
                // isInternetReachable can be unreliable on some devices/networks
                const isConnected = state.isConnected || (state.isConnected && state.isInternetReachable);
                networkStateRef.current = isConnected;
                setIsNetworkConnected(isConnected);
                
                console.log(`[RealtimeContext] Mobile network state: isConnected=${state.isConnected}, isInternetReachable=${state.isInternetReachable}, final=${isConnected}`);
                
                if (isConnected) {
                    setupMainChannels();
                } else {
                    console.log('[RealtimeContext] Network not available, skipping initial main channels setup');
                }
            }).catch(error => {
                // If NetInfo fails, assume network is available and set up channels
                console.warn('[RealtimeContext] NetInfo.fetch() failed, assuming network is available:', error);
                networkStateRef.current = true;
                setIsNetworkConnected(true);
                setupMainChannels();
            });
        }

        let cleanupFn = () => {
            authListener.subscription.unsubscribe();
        };

        if (Platform.OS === 'web') {
            const handleVisibilityChange = () => {
                if (document.visibilityState === 'visible') {
                    console.log('[RealtimeContext] Web tab became visible, ensuring connection.');
                    if (networkStateRef.current) {
                        // More robust reconnection
                        cleanup();
                        setTimeout(() => setupMainChannels(), 250);
                    } else {
                        console.log('[RealtimeContext] Web tab became visible but network is down, skipping reconnection');
                    }
                }
            };

            const handleOnline = () => {
                console.log('[RealtimeContext] Web became online, ensuring connection.');
                handleNetworkChange({ isConnected: true, isInternetReachable: true });
            };
            const handleOffline = () => {
                console.log('[RealtimeContext] Web went offline.');
                handleNetworkChange({ isConnected: false, isInternetReachable: false });
            };

            document.addEventListener('visibilitychange', handleVisibilityChange);
            window.addEventListener('online', handleOnline);
            window.addEventListener('offline', handleOffline);

            cleanupFn = () => {
                console.log('[RealtimeContext] 🧹 Cleaning up web listeners...');
                document.removeEventListener('visibilitychange', handleVisibilityChange);
                window.removeEventListener('online', handleOnline);
                window.removeEventListener('offline', handleOffline);
                authListener.subscription.unsubscribe();
                cleanup();
            };
        } else {
            // Use native listeners
            const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
            const netInfoUnsubscribe = NetInfo.addEventListener(handleNetworkChange);

            cleanupFn = () => {
                console.log('[RealtimeContext] 🧹 Cleaning up native listeners...');
                appStateSubscription.remove();
                if (typeof netInfoUnsubscribe === 'function') {
                    netInfoUnsubscribe();
                }
                authListener.subscription.unsubscribe();
                cleanup();
            };
        }

        return cleanupFn;
    }, [session?.user?.id, cleanup, handleAppStateChange, setupMainChannels, handleNetworkChange]);

    const contextValue: RealtimeContextType = {
        channel,
        presenceState,
        isNetworkConnected,
        trackStatus,
        untrackStatus,
        subscribeToEvent,
        unsubscribeFromEvent,
        createNetworkAwareSubscription,
        subscribeToIndividualChat,
        subscribeToGroupChat,
        sendBroadcast,
        sendIndividualTypingIndicator,
        sendGroupTypingIndicator,
        getGroupMemberPresence,
    };

    return (
        <RealtimeContext.Provider value={contextValue}>
            {children}
        </RealtimeContext.Provider>
    );
};

export const useRealtime = () => {
    const context = useContext(RealtimeContext);
    if (context === undefined) {
        throw new Error('useRealtime must be used within a RealtimeProvider');
    }
    return context;
}; 