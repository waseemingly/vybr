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
    const listenersRef = useRef<Record<string, ListenerCallback[]>>({});

    // Use a ref to hold the channels so we can clean them up properly
    const channelsRef = useRef<RealtimeChannel[]>([]);

    const updateUserStatus = useCallback(async (userId: string, isOnline: boolean) => {
        try {
            await supabase.functions.invoke('update-user-status', {
                body: { userId, isOnline },
            });
        } catch (error) {
            console.error('Error updating user status:', error);
        }
    }, []);

    useEffect(() => {
        // Clear out old channels on session change or unmount
        const cleanup = () => {
            console.log(`[RealtimeContext] Cleaning up ${channelsRef.current.length} channels.`);
            channelsRef.current.forEach(ch => supabase.removeChannel(ch));
            channelsRef.current = [];
            setChannel(null);
        };

        if (!session?.user?.id) {
            cleanup();
            return;
        }
        
        const userId = session.user.id;
        
        // --- Channel for Presence (user-specific) ---
        console.log('[RealtimeContext] 🚀 Setting up presence channel for user:', userId);
        const userChannel = supabase.channel(`user:${userId}`, {
            config: { presence: { key: userId } },
        });

        userChannel
            .on('presence', { event: 'sync' }, () => {
                setPresenceState(userChannel.presenceState());
            })
            .subscribe((status, err) => {
                if (status === 'SUBSCRIBED') {
                    console.log(`[RealtimeContext] ✅ Subscribed to presence channel: ${userId}`);
                    userChannel.track({ user_id: userId, online_at: new Date().toISOString() });
                    setChannel(userChannel); // Set the main channel for presence tracking
                }
                 if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    console.error('[RealtimeContext] ❌ Presence channel error:', status, err);
                }
            });
        
        channelsRef.current.push(userChannel);

        // --- Channel for Database Changes ---
        console.log('[RealtimeContext] 🚀 Setting up database changes channel');
        const dbChangesChannel = supabase.channel('db-changes');

        dbChangesChannel
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, 
                (payload) => {
                    console.log('Realtime: New individual message detected via postgres_changes', payload);
                    if ((payload.new as any).receiver_id === userId) {
                        const eventName = 'new_message_notification';
                        if (listenersRef.current[eventName]) {
                            listenersRef.current[eventName].forEach(callback => callback(payload));
                        }
                    }
                }
            )
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_chat_messages' },
                (payload) => {
                    console.log('Realtime: New group message detected via postgres_changes', payload);
                    const eventName = 'new_group_message_notification';
                    if (listenersRef.current[eventName]) {
                        listenersRef.current[eventName].forEach(callback => callback(payload));
                    }
                }
            )
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'message_status', filter: `user_id=eq.${userId}` },
                (payload) => {
                    console.log('Realtime: Individual message status update detected', payload);
                    const eventName = 'message_status_updated';
                     if (listenersRef.current[eventName]) {
                        listenersRef.current[eventName].forEach(callback => callback(payload));
                    }
                }
            )
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'group_chat_message_status', filter: `user_id=eq.${userId}` },
                (payload) => {
                    console.log('Realtime: Group message status update detected', payload);
                    const eventName = 'group_message_status_updated';
                     if (listenersRef.current[eventName]) {
                        listenersRef.current[eventName].forEach(callback => callback(payload));
                    }
                }
            )
            .subscribe((status, err) => {
                if (status === 'SUBSCRIBED') {
                    console.log('[RealtimeContext] ✅ Subscribed to database changes channel');
                }
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    console.error('[RealtimeContext] ❌ DB changes channel error:', status, err);
                }
            });
            
        channelsRef.current.push(dbChangesChannel);

        return cleanup;
    }, [session, updateUserStatus]);

    useEffect(() => {
        const handleAppStateChange = (nextAppState: AppStateStatus) => {
            const presChannel = channelsRef.current.find(c => c.topic.startsWith('user:'));
            if (presChannel) {
                if (nextAppState === 'active') {
                    console.log('App is active, tracking presence.');
                    presChannel.track({ user_id: session?.user?.id, online_at: new Date().toISOString() });
                } else {
                    console.log('App is in background, untracking presence.');
                    presChannel.untrack();
                }
            }
        };

        const subscription = AppState.addEventListener('change', handleAppStateChange);

        return () => {
            subscription.remove();
        };
    }, [session]);

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
        listenersRef.current[eventName] = [...(listenersRef.current[eventName] || []), callback];
    }, []);

    const unsubscribeFromEvent = useCallback((eventName: string, callback: ListenerCallback) => {
        listenersRef.current[eventName] = (listenersRef.current[eventName] || []).filter(cb => cb !== callback);
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