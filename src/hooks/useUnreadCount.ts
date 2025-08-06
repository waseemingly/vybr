import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useRealtime } from '@/context/RealtimeContext';

export const useUnreadCount = () => {
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const { session } = useAuth();
  const { subscribeToEvent, unsubscribeFromEvent } = useRealtime();
  
  // Use ref to store the latest fetchUnreadCount function
  const fetchUnreadCountRef = useRef<(() => Promise<void>) | undefined>(undefined);

  // Function to fetch the latest unread count
  const fetchUnreadCount = useCallback(async () => {
    if (!session?.user?.id) {
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    try {
      // Call both individual and group chat functions to get complete unread count
      const [individualResult, groupResult] = await Promise.all([
        supabase.rpc('get_chat_list_with_unread'),
        supabase.rpc('get_group_chat_list_with_unread')
      ]);

      if (individualResult.error) {
        console.error('Error fetching individual chat unread count:', individualResult.error);
      }

      if (groupResult.error) {
        console.error('Error fetching group chat unread count:', groupResult.error);
      }

      // Calculate total unread count by summing unread counts from both lists
      const individualUnreadCount = individualResult.data?.reduce((sum: number, chat: any) => sum + (chat.unread_count || 0), 0) || 0;
      const groupUnreadCount = groupResult.data?.reduce((sum: number, chat: any) => sum + (chat.unread_count || 0), 0) || 0;
      
      const totalUnreadCount = individualUnreadCount + groupUnreadCount;
      
      console.log(`useUnreadCount: Individual unread: ${individualUnreadCount}, Group unread: ${groupUnreadCount}, Total: ${totalUnreadCount}`);
      
      setUnreadCount(totalUnreadCount);
    } catch (error) {
      console.error('Exception fetching unread count:', error);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  // Update the ref with the latest fetchUnreadCount function
  useEffect(() => {
    fetchUnreadCountRef.current = fetchUnreadCount;
  }, [fetchUnreadCount]);

  // Handle real-time message updates - now stable and doesn't depend on fetchUnreadCount
  const handleMessageUpdate = useCallback(() => {
    // Refresh the unread count when new messages arrive or status changes
    if (fetchUnreadCountRef.current) {
      fetchUnreadCountRef.current();
    }
  }, []); // No dependencies needed

  // Set up real-time subscriptions
  useEffect(() => {
    if (!session?.user?.id) {
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    // Initial fetch
    fetchUnreadCount();

    // Subscribe to real-time events
    subscribeToEvent('new_message_notification', handleMessageUpdate);
    subscribeToEvent('new_group_message_notification', handleMessageUpdate);
    subscribeToEvent('message_status_updated', handleMessageUpdate);
    subscribeToEvent('group_message_status_updated', handleMessageUpdate);

    // Cleanup subscriptions
    return () => {
      unsubscribeFromEvent('new_message_notification', handleMessageUpdate);
      unsubscribeFromEvent('new_group_message_notification', handleMessageUpdate);
      unsubscribeFromEvent('message_status_updated', handleMessageUpdate);
      unsubscribeFromEvent('group_message_status_updated', handleMessageUpdate);
    };
  }, [session?.user?.id, subscribeToEvent, unsubscribeFromEvent, handleMessageUpdate]);

  // Provide a manual refresh function for when messages are read
  const refreshUnreadCount = useCallback(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  return {
    unreadCount,
    loading,
    refreshUnreadCount,
  };
}; 