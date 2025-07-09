import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { RealtimeChannel, RealtimePresenceState } from '@supabase/supabase-js';

type ListenerCallback = (payload: any) => void;

// Define the shape of the context
interface RealtimeContextType {
    channel: RealtimeChannel | null;
    presenceState: RealtimePresenceState;
    trackStatus: (status: object) => Promise<string>;
    untrackStatus: () => Promise<string>;
    subscribeToEvent: (eventName: string, callback: ListenerCallback) => void;
    unsubscribeFromEvent: (eventName: string, callback: ListenerCallback) => void;
    
    // Chat-specific methods
    subscribeToIndividualChat: (matchUserId: string, callbacks: {
        onMessage?: (payload: any) => void;
        onMessageUpdate?: (payload: any) => void;
        onMessageStatus?: (payload: any) => void;
    }) => () => void;
    
    subscribeToGroupChat: (groupId: string, callbacks: {
        onMessage?: (payload: any) => void;
        onMessageUpdate?: (payload: any) => void;
        onMessageStatus?: (payload: any) => void;
        onGroupUpdate?: (payload: any) => void;
        onTyping?: (payload: any) => void;
    }) => () => void;
    
    // Typing indicators
    sendTypingIndicator: (chatType: 'individual' | 'group', chatId: string, isTyping: boolean) => void;
    
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

    const cleanup = useCallback(() => {
        console.log(`[RealtimeContext] Cleaning up ${channelsRef.current.length} main channels and ${chatChannelsRef.current.size} chat channels.`);
        
        // Clear typing timeouts
        typingTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
        typingTimeoutsRef.current.clear();
        
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

    // Individual chat subscription
    const subscribeToIndividualChat = useCallback((matchUserId: string, callbacks: {
        onMessage?: (payload: any) => void;
        onMessageUpdate?: (payload: any) => void;
        onMessageStatus?: (payload: any) => void;
    }) => {
        if (!session?.user?.id) {
            console.warn('[RealtimeContext] No user session for individual chat subscription');
            return () => {};
        }

        const channelName = `individual_chat_${[session.user.id, matchUserId].sort().join('_')}`;
        
        // Check if channel already exists
        if (chatChannelsRef.current.has(channelName)) {
            console.log(`[RealtimeContext] Reusing existing individual chat channel: ${channelName}`);
            return () => {};
        }

        console.log(`[RealtimeContext] Creating individual chat channel: ${channelName}`);
        const chatChannel = supabase.channel(channelName);

        // Subscribe to new messages
        if (callbacks.onMessage) {
            chatChannel.on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `or(and(sender_id.eq.${session.user.id},receiver_id.eq.${matchUserId}),and(sender_id.eq.${matchUserId},receiver_id.eq.${session.user.id}))`
                },
                callbacks.onMessage
            );
        }

        // Subscribe to message updates
        if (callbacks.onMessageUpdate) {
            chatChannel.on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'messages',
                    filter: `or(and(sender_id.eq.${session.user.id},receiver_id.eq.${matchUserId}),and(sender_id.eq.${matchUserId},receiver_id.eq.${session.user.id}))`
                },
                callbacks.onMessageUpdate
            );
        }

        // Subscribe to message status updates
        if (callbacks.onMessageStatus) {
            chatChannel.on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'message_status',
                    filter: `or(sender_id.eq.${session.user.id},receiver_id.eq.${session.user.id})`
                },
                callbacks.onMessageStatus
            );
        }

        // Subscribe to typing indicators
        chatChannel.on('broadcast', { event: 'typing' }, (payload) => {
            // Handle typing in individual chat context if needed
            console.log('[RealtimeContext] Individual chat typing:', payload);
        });

        chatChannel.subscribe((status) => {
            console.log(`[RealtimeContext] Individual chat channel ${channelName} status:`, status);
            if (status === 'SUBSCRIBED') {
                console.log(`[RealtimeContext] ✅ Successfully subscribed to individual chat: ${channelName}`);
            } else if (status === 'CHANNEL_ERROR') {
                console.error(`[RealtimeContext] ❌ Individual chat channel error: ${channelName}`);
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
                } catch (error) {
                    console.warn(`[RealtimeContext] Error cleaning up individual chat channel ${channelName}:`, error);
                }
            }
        };
    }, [session?.user?.id]);

    // Group chat subscription
    const subscribeToGroupChat = useCallback((groupId: string, callbacks: {
        onMessage?: (payload: any) => void;
        onMessageUpdate?: (payload: any) => void;
        onMessageStatus?: (payload: any) => void;
        onGroupUpdate?: (payload: any) => void;
        onTyping?: (payload: any) => void;
    }) => {
        if (!session?.user?.id) {
            console.warn('[RealtimeContext] No user session for group chat subscription');
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

        // Subscribe to new group messages
        if (callbacks.onMessage) {
            chatChannel.on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'group_chat_messages',
                    filter: `group_id.eq.${groupId}`
                },
                callbacks.onMessage
            );
        }

        // Subscribe to group message updates
        if (callbacks.onMessageUpdate) {
            chatChannel.on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'group_chat_messages',
                    filter: `group_id.eq.${groupId}`
                },
                callbacks.onMessageUpdate
            );
        }

        // Subscribe to group message status updates
        if (callbacks.onMessageStatus) {
            chatChannel.on(
                'postgres_changes',
                {
                    event: '*', // Listen for INSERT and UPDATE
                    schema: 'public',
                    table: 'group_message_status',
                    // Use the new, efficient filter on the denormalized group_id
                    filter: `group_id.eq.${groupId}`
                },
                callbacks.onMessageStatus
            );
        }

        // Subscribe to group updates
        if (callbacks.onGroupUpdate) {
            chatChannel.on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'group_chats',
                    filter: `id.eq.${groupId}`
                },
                callbacks.onGroupUpdate
            );

            chatChannel.on(
                'postgres_changes',
                {
                    event: 'DELETE',
                    schema: 'public',
                    table: 'group_chats',
                    filter: `id.eq.${groupId}`
                },
                callbacks.onGroupUpdate
            );
        }

        // Subscribe to typing indicators
        if (callbacks.onTyping) {
            chatChannel.on('broadcast', { event: 'typing' }, callbacks.onTyping);
        }

        chatChannel.subscribe((status) => {
            console.log(`[RealtimeContext] Group chat channel ${channelName} status:`, status);
            if (status === 'SUBSCRIBED') {
                console.log(`[RealtimeContext] ✅ Successfully subscribed to group chat: ${channelName}`);
            } else if (status === 'CHANNEL_ERROR') {
                console.error(`[RealtimeContext] ❌ Group chat channel error: ${channelName}`);
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
                } catch (error) {
                    console.warn(`[RealtimeContext] Error cleaning up group chat channel ${channelName}:`, error);
                }
            }
        };
    }, [session?.user?.id]);

    // Send typing indicator
    const sendTypingIndicator = useCallback((chatType: 'individual' | 'group', chatId: string, isTyping: boolean) => {
        if (!session?.user?.id) return;

        const channelName = chatType === 'individual' 
            ? `individual_chat_${[session.user.id, chatId].sort().join('_')}`
            : `group_chat_${chatId}`;

        const chatChannel = chatChannelsRef.current.get(channelName);
        if (!chatChannel) {
            console.warn(`[RealtimeContext] No channel found for typing indicator: ${channelName}`);
            return;
        }

        // Clear existing timeout for this chat
        const timeoutKey = `${chatType}_${chatId}`;
        const existingTimeout = typingTimeoutsRef.current.get(timeoutKey);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
            typingTimeoutsRef.current.delete(timeoutKey);
        }

        // Send typing indicator
        chatChannel.send({
            type: 'broadcast',
            event: 'typing',
            payload: {
                sender_id: session.user.id,
                chat_id: chatId,
                chat_type: chatType,
                typing: isTyping
            }
        });

        // Auto-stop typing after 3 seconds if still typing
        if (isTyping && session.user?.id) {
            const userId = session.user.id;
            const timeout = setTimeout(() => {
                chatChannel.send({
                    type: 'broadcast',
                    event: 'typing',
                    payload: {
                        sender_id: userId,
                        chat_id: chatId,
                        chat_type: chatType,
                        typing: false
                    }
                });
                typingTimeoutsRef.current.delete(timeoutKey);
            }, 3000);
            typingTimeoutsRef.current.set(timeoutKey, timeout);
        }
    }, [session?.user?.id]);

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
    }, [session?.user?.id]);

    useEffect(() => {
        if (!session?.user?.id) {
            console.log('[RealtimeContext] No session, cleaning up...');
            cleanup();
            return;
        }

        const userId = session.user.id;
        console.log(`[RealtimeContext] Setting up realtime for user: ${userId}`);

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
                // This is a global listener. The actual message processing should happen
                // in the component-level subscription to avoid displaying messages from
                // groups the user is not currently viewing. However, we can use this
                // for global notifications.
                // We check if the sender is NOT the current user to trigger a notification.
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
                filter: `user_id=eq.${userId}` // Only listen for when the current user is added
            },
            (payload) => {
                console.log('[RealtimeContext] Current user added to a group, notifying listeners.', payload);
                const eventName = 'new_group_added_notification';
                if (listenersRef.current[eventName]) {
                    listenersRef.current[eventName].forEach(callback => callback(payload));
                }
            }
        );

        // Subscribe to channels
        Promise.all([
            mainChannel.subscribe(async (status) => {
                console.log(`[RealtimeContext] Main channel subscription status: ${status}`);
                if (status === 'SUBSCRIBED') {
                    console.log('[RealtimeContext] ✅ Successfully subscribed to main presence channel');
                    setChannel(mainChannel);
                    
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
                    console.error('[RealtimeContext] ❌ Main channel error');
                }
            }),
            notificationChannel.subscribe((status) => {
                console.log(`[RealtimeContext] Notification channel subscription status: ${status}`);
                if (status === 'SUBSCRIBED') {
                    console.log('[RealtimeContext] ✅ Successfully subscribed to notification channel');
                } else if (status === 'CHANNEL_ERROR') {
                    console.error('[RealtimeContext] ❌ Notification channel error');
                }
            })
        ]);

        channelsRef.current = [mainChannel, notificationChannel];

        // Add app state listener
        const subscription = AppState.addEventListener('change', handleAppStateChange);

        return () => {
            console.log('[RealtimeContext] 🧹 Cleaning up on session change...');
            subscription?.remove();
            cleanup();
        };
    }, [session?.user?.id, cleanup, handleAppStateChange]);

    const contextValue: RealtimeContextType = {
        channel,
        presenceState,
        trackStatus,
        untrackStatus,
        subscribeToEvent,
        unsubscribeFromEvent,
        subscribeToIndividualChat,
        subscribeToGroupChat,
        sendTypingIndicator,
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