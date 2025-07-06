import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useRealtime } from '@/context/RealtimeContext';

export const useUnreadCount = () => {
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const { session } = useAuth();
  const { subscribeToEvent, unsubscribeFromEvent } = useRealtime();

  // Function to fetch the latest unread count
  const fetchUnreadCount = useCallback(async () => {
    if (!session?.user?.id) {
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.rpc('get_total_unread_count');
      
      if (error) {
        console.error('Error fetching unread count:', error);
        setUnreadCount(0);
      } else {
        setUnreadCount(data || 0);
      }
    } catch (error) {
      console.error('Exception fetching unread count:', error);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  // Handle real-time message updates
  const handleMessageUpdate = useCallback(() => {
    // Refresh the unread count when new messages arrive or status changes
    fetchUnreadCount();
  }, [fetchUnreadCount]);

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
  }, [session?.user?.id, subscribeToEvent, unsubscribeFromEvent, handleMessageUpdate, fetchUnreadCount]);

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