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
}

// Create the context with a default value
const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined);

// Create the provider component
export const RealtimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { session } = useAuth();
    const [channel, setChannel] = useState<RealtimeChannel | null>(null);
    const [presenceState, setPresenceState] = useState<RealtimePresenceState>({});
    const channelRef = useRef<RealtimeChannel | null>(null);
    const [listeners, setListeners] = useState<Record<string, ListenerCallback[]>>({});

    const updateUserStatus = useCallback(async (userId: string, isOnline: boolean) => {
        try {
            await supabase.functions.invoke('update-user-status', {
                body: { userId, isOnline },
            });
        } catch (error) {
            console.error('Error updating user status:', error);
        }
    }, []);

    // Set up the channel when the user is authenticated
    useEffect(() => {
        console.log('[RealtimeContext] 🔄 Effect triggered:', {
            hasSession: !!session,
            userId: session?.user?.id,
            hasExistingChannel: !!channelRef.current
        });
        
        if (session?.user?.id && !channelRef.current) {
            const userId = session.user.id;
            console.log('[RealtimeContext] 🚀 Setting up realtime channel for user:', userId);
            
            const userChannel = supabase.channel(`user:${userId}`, {
                config: {
                    presence: {
                        key: userId, // Use user ID as the presence key
                    },
                },
            });

            userChannel
                .on('presence', { event: 'sync' }, () => {
                    const newState = userChannel.presenceState();
                    console.log('Presence sync:', newState);
                    setPresenceState(newState);
                })
                .on('presence', { event: 'join' }, ({ key, newPresences }) => {
                    console.log('Presence join:', key, newPresences);
                    // When *we* join, update our status
                    if (newPresences.some(p => p.user_id === userId)) {
                        updateUserStatus(userId, true);
                    }
                })
                .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
                    console.log('Presence leave:', key, leftPresences);
                    // When *we* leave, update our status
                    if (leftPresences.some(p => p.user_id === userId)) {
                         updateUserStatus(userId, false);
                    }
                })
                .on('broadcast', { event: 'new_message_notification' }, (payload) => {
                    console.log('Received new message notification:', payload);
                    const eventName = 'new_message_notification';
                    if (listeners[eventName]) {
                        listeners[eventName].forEach(callback => callback(payload));
                    }
                })
                .on('broadcast', { event: 'new_group_message_notification' }, (payload) => {
                    console.log('Received new group message notification:', payload);
                    const eventName = 'new_group_message_notification';
                    if (listeners[eventName]) {
                        listeners[eventName].forEach(callback => callback(payload));
                    }
                })
                .on('broadcast', { event: 'message_status_updated' }, (payload) => {
                    console.log('Received message status update:', payload);
                    const eventName = 'message_status_updated';
                    if (listeners[eventName]) {
                        listeners[eventName].forEach(callback => callback(payload));
                    }
                })
                .on('broadcast', { event: 'group_message_status_updated' }, (payload) => {
                    console.log('Received group message status update:', payload);
                    const eventName = 'group_message_status_updated';
                    if (listeners[eventName]) {
                        listeners[eventName].forEach(callback => callback(payload));
                    }
                })
                .subscribe((status, err) => {
                    console.log('[RealtimeContext] 📡 Channel subscription status:', status, err);
                    if (status === 'SUBSCRIBED') {
                        console.log(`[RealtimeContext] ✅ Subscribed to user channel: ${userId}`);
                        userChannel.track({ user_id: userId, online_at: new Date().toISOString() });
                    }
                    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                        console.error('[RealtimeContext] ❌ Realtime channel error:', status, err);
                    }
                });
            
            setChannel(userChannel);
            channelRef.current = userChannel;

        } else if (!session && channelRef.current) {
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
            setChannel(null);
        }

        // Return a cleanup function
        return () => {
            if (channelRef.current) {
                const ch = channelRef.current;
                channelRef.current = null;
                setChannel(null);
                ch.untrack().then(() => {
                    supabase.removeChannel(ch);
                });
            }
        };
    }, [session, updateUserStatus, listeners]);

    // Handle app state changes (foreground/background) for presence
    useEffect(() => {
        const handleAppStateChange = (nextAppState: AppStateStatus) => {
            if (channel) {
                if (nextAppState === 'active') {
                    console.log('App is active, tracking presence.');
                    channel.track({ user_id: session?.user?.id, online_at: new Date().toISOString() });
                } else {
                    console.log('App is in background, untracking presence.');
                    channel.untrack();
                }
            }
        };

        const subscription = AppState.addEventListener('change', handleAppStateChange);

        return () => {
            subscription.remove();
        };
    }, [channel, session]);

    const trackStatus = useCallback(async (status: object) => {
        if (channel && session?.user?.id) {
            return await channel.track({ ...status, user_id: session.user.id });
        }
        return 'error';
    }, [channel, session]);

    const untrackStatus = useCallback(async () => {
        if (channel) {
            return await channel.untrack();
        }
        return 'error';
    }, [channel]);

    const subscribeToEvent = useCallback((eventName: string, callback: ListenerCallback) => {
        setListeners(prevListeners => {
            const eventListeners = prevListeners[eventName] || [];
            return {
                ...prevListeners,
                [eventName]: [...eventListeners, callback],
            };
        });
    }, []);

    const unsubscribeFromEvent = useCallback((eventName: string, callback: ListenerCallback) => {
        setListeners(prevListeners => {
            const eventListeners = prevListeners[eventName] || [];
            return {
                ...prevListeners,
                [eventName]: eventListeners.filter(cb => cb !== callback),
            };
        });
    }, []);

    const value = {
        channel,
        presenceState,
        trackStatus,
        untrackStatus,
        subscribeToEvent,
        unsubscribeFromEvent
    };

    return (
        <RealtimeContext.Provider value={value}>
            {children}
        </RealtimeContext.Provider>
    );
};

// Custom hook to use the RealtimeContext
export const useRealtime = () => {
    const context = useContext(RealtimeContext);
    if (context === undefined) {
        throw new Error('useRealtime must be used within a RealtimeProvider');
    }
    return context;
}; 