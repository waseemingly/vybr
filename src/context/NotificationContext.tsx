import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import NotificationService from '../services/NotificationService';
import { parseDeepLink } from '../utils/navigationUtils';
import { navigationRef } from '../navigation/navigationRef';

export interface NotificationData {
  id: string;
  user_id: string;
  type: 'new_message' | 'new_group_message' | 'new_match' | 'event_alert' | 'booking_confirmation' | 'system_alert';
  title: string;
  body: string;
  data?: any;
  image_url?: string;
  deep_link?: string;
  is_read: boolean;
  is_seen: boolean;
  created_at: string;
  read_at?: string;
  seen_at?: string;
}

export interface WebNotificationProps {
  id: string;
  title: string;
  body: string;
  type: string;
  data?: any;
  image_url?: string;
  timestamp: Date;
  onRead?: () => void;
  onDismiss?: () => void;
  onClick?: () => void;
}

interface NotificationContextType {
  // Notification data
  notifications: NotificationData[];
  unreadCount: number;
  webNotifications: WebNotificationProps[];
  
  // Actions
  markAsRead: (notificationId: string) => Promise<void>;
  markAsSeen: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  dismissWebNotification: (notificationId: string) => void;
  showWebNotification: (notification: WebNotificationProps) => void;
  
  // Loading states
  loading: boolean;
  refreshing: boolean;
  
  // Functions
  refreshNotifications: () => Promise<void>;
  
  // Preferences
  preferences: NotificationPreferences | null;
  updatePreferences: (preferences: Partial<NotificationPreferences>) => Promise<void>;
}

interface NotificationPreferences {
  push_enabled: boolean;
  push_new_messages: boolean;
  push_new_matches: boolean;
  push_event_alerts: boolean;
  push_system_alerts: boolean;
  web_enabled: boolean;
  web_new_messages: boolean;
  web_new_matches: boolean;
  web_event_alerts: boolean;
  web_system_alerts: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  quiet_hours_timezone: string;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session } = useAuth();
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [webNotifications, setWebNotifications] = useState<WebNotificationProps[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const webNotificationTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Check if user is currently viewing a conversation to skip notifications
  const isViewingConversation = useCallback((data: any) => {
    // This would need to be implemented based on your navigation state
    // For now, we'll return false to show all notifications
    return false;
  }, []);

  // Show web notification (slide-in toast)
  const showWebNotification = useCallback((notification: WebNotificationProps) => {
    setWebNotifications(prev => {
      // Remove existing notification with same ID
      const filtered = prev.filter(n => n.id !== notification.id);
      return [...filtered, notification];
    });

    // Auto-dismiss after 5 seconds
    const timeout = setTimeout(() => {
      dismissWebNotification(notification.id);
    }, 5000);
    
    webNotificationTimeouts.current.set(notification.id, timeout);
  }, []);

  // Dismiss web notification
  const dismissWebNotification = useCallback((notificationId: string) => {
    setWebNotifications(prev => prev.filter(n => n.id !== notificationId));
    
    // Clear timeout if exists
    const timeout = webNotificationTimeouts.current.get(notificationId);
    if (timeout) {
      clearTimeout(timeout);
      webNotificationTimeouts.current.delete(notificationId);
    }
  }, []);

  // Handle new notification from real-time
  const handleNewNotification = useCallback(async (payload: any) => {
    console.log('[NotificationProvider] Received notification payload:', JSON.stringify(payload, null, 2));
    const notificationData = payload.new || payload;
    
    console.log('[NotificationProvider] New notification received:', notificationData);

    // Skip if user is viewing the conversation
    if (isViewingConversation(notificationData.data)) {
      console.log('[NotificationProvider] Skipping notification - user is viewing conversation');
      return;
    }

    // Check preferences for web notifications
    if (preferences?.web_enabled !== false) {
      let shouldShowWeb = true;
      
      switch (notificationData.type) {
        case 'new_message':
        case 'new_group_message':
          shouldShowWeb = preferences?.web_new_messages !== false;
          break;
        case 'new_match':
          shouldShowWeb = preferences?.web_new_matches !== false;
          break;
        case 'event_alert':
        case 'booking_confirmation':
          shouldShowWeb = preferences?.web_event_alerts !== false;
          break;
        case 'system_alert':
          shouldShowWeb = preferences?.web_system_alerts !== false;
          break;
      }

      if (shouldShowWeb) {
        showWebNotification({
          id: notificationData.notification_id || notificationData.id,
          title: notificationData.title,
          body: notificationData.body,
          type: notificationData.type,
          data: notificationData.data,
          image_url: notificationData.image_url,
          timestamp: new Date(notificationData.created_at || Date.now()),
          onRead: () => {
            if (notificationData.notification_id) {
              markAsRead(notificationData.notification_id);
            }
          },
          onDismiss: () => {
            dismissWebNotification(notificationData.notification_id || notificationData.id);
          },
          onClick: () => {
            // Handle navigation based on deep link
            if (notificationData.deep_link && navigationRef.current?.isReady()) {
              console.log('[NotificationProvider] Navigating to deep link:', notificationData.deep_link);
              const routeInfo = parseDeepLink(notificationData.deep_link);
              if (routeInfo) {
                let finalParams = { ...routeInfo.params };
                if (
                  routeInfo.routeName === 'MainApp' && 
                  finalParams.screen === 'ViewBookings' && 
                  notificationData.data?.event_title
                ) {
                  finalParams.params.eventTitle = notificationData.data.event_title;
                }
                (navigationRef.current as any)?.navigate(routeInfo.routeName, finalParams);
              } else {
                console.warn(`[NotificationProvider] Could not parse deep link: ${notificationData.deep_link}`);
              }
            }
            dismissWebNotification(notificationData.notification_id || notificationData.id);
          },
        });
      }
    }

    // Update notifications list
    await refreshNotifications();
  }, [preferences, isViewingConversation, showWebNotification, dismissWebNotification]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const { error } = await supabase.rpc('mark_notification_read', {
        p_notification_id: notificationId,
      });

      if (error) {
        console.error('Error marking notification as read:', error);
        return;
      }

      // Update local state
      setNotifications(prev => prev.map(n => 
        n.id === notificationId 
          ? { ...n, is_read: true, read_at: new Date().toISOString() }
          : n
      ));

      // Update unread count
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Exception marking notification as read:', error);
    }
  }, []);

  // Mark notification as seen
  const markAsSeen = useCallback(async (notificationId: string) => {
    try {
      const { error } = await supabase.rpc('mark_notification_seen', {
        p_notification_id: notificationId,
      });

      if (error) {
        console.error('Error marking notification as seen:', error);
        return;
      }

      // Update local state
      setNotifications(prev => prev.map(n => 
        n.id === notificationId 
          ? { ...n, is_seen: true, seen_at: new Date().toISOString() }
          : n
      ));
    } catch (error) {
      console.error('Exception marking notification as seen:', error);
    }
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!session?.user?.id) return;

    try {
      const unreadNotifications = notifications.filter(n => !n.is_read);
      
      const markPromises = unreadNotifications.map(n => 
        supabase.rpc('mark_notification_read', {
          p_notification_id: n.id,
        })
      );

      await Promise.all(markPromises);

      // Update local state
      setNotifications(prev => prev.map(n => ({ 
        ...n, 
        is_read: true, 
        read_at: new Date().toISOString() 
      })));

      setUnreadCount(0);
    } catch (error) {
      console.error('Exception marking all notifications as read:', error);
    }
  }, [notifications, session?.user?.id]);

  // Refresh notifications from database
  const refreshNotifications = useCallback(async () => {
    if (!session?.user?.id) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    setRefreshing(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching notifications:', error);
        return;
      }

      setNotifications(data || []);
      setUnreadCount(data?.filter(n => !n.is_read).length || 0);
    } catch (error) {
      console.error('Exception fetching notifications:', error);
    } finally {
      setRefreshing(false);
    }
  }, [session?.user?.id]);

  // Load notification preferences
  const loadPreferences = useCallback(async () => {
    if (!session?.user?.id) return;

    try {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading notification preferences:', error);
        return;
      }

      setPreferences(data || null);
    } catch (error) {
      console.error('Exception loading notification preferences:', error);
    }
  }, [session?.user?.id]);

  // Update notification preferences
  const updatePreferences = useCallback(async (updates: Partial<NotificationPreferences>) => {
    if (!session?.user?.id) return;

    try {
      const { data, error } = await supabase
        .from('notification_preferences')
        .upsert({
          user_id: session.user.id,
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error updating notification preferences:', error);
        throw error;
      }

      setPreferences(data);
    } catch (error) {
      console.error('Exception updating notification preferences:', error);
      throw error;
    }
  }, [session?.user?.id]);

  // Initialize when user session changes
  useEffect(() => {
    if (session?.user?.id) {
      setLoading(true);
      Promise.all([
        refreshNotifications(),
        loadPreferences(),
      ]).finally(() => setLoading(false));
    } else {
      setNotifications([]);
      setUnreadCount(0);
      setPreferences(null);
    }
  }, [session?.user?.id, refreshNotifications, loadPreferences]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!session?.user?.id) return;

    // Subscribe to notification broadcasts
    const channel = supabase
      .channel('web-notifications')
      .on('broadcast', { event: 'new_notification' }, ({ payload }) => {
        if (payload.user_id === session.user?.id) {
          handleNewNotification(payload);
        }
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [session?.user?.id, handleNewNotification]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      webNotificationTimeouts.current.forEach(timeout => clearTimeout(timeout));
      webNotificationTimeouts.current.clear();
    };
  }, []);

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      webNotifications,
      markAsRead,
      markAsSeen,
      markAllAsRead,
      dismissWebNotification,
      showWebNotification,
      loading,
      refreshing,
      refreshNotifications,
      preferences,
      updatePreferences,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}; 