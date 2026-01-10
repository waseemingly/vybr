import { supabase } from '../lib/supabase';
import NotificationService from './NotificationService';

export interface CreateNotificationParams {
  user_id: string;
  type: 'new_message' | 'new_group_message' | 'new_match' | 'event_alert' | 'booking_confirmation' | 'system_alert' | 'organizer_new_booking' | 'friend_request' | 'friend_accept';
  title: string;
  body: string;
  data?: any;
  image_url?: string;
  deep_link?: string;
  sender_id?: string;
  related_id?: string;
  related_type?: string;
}

export interface SendNotificationParams extends CreateNotificationParams {
  // Additional parameters for immediate sending
  force_send?: boolean; // Skip preference checks
  skip_push?: boolean; // Only send web notification
  skip_web?: boolean; // Only send push notification
}

export interface NotifyOrganizerOfNewBookingParams {
  organizer_id: string;
  event_id: string;
  event_title: string;
  booking_id: string;
  user_name: string;
  quantity: number;
}

export class UnifiedNotificationService {
  private static instance: UnifiedNotificationService;

  private constructor() {}

  public static getInstance(): UnifiedNotificationService {
    if (!UnifiedNotificationService.instance) {
      UnifiedNotificationService.instance = new UnifiedNotificationService();
    }
    return UnifiedNotificationService.instance;
  }

  /**
   * Create a notification in the database
   * This will automatically trigger push notifications
   */
  async createNotification(params: CreateNotificationParams): Promise<string | null> {
    try {
      const { data, error } = await supabase.rpc('create_notification', {
        p_user_id: params.user_id,
        p_type: params.type,
        p_title: params.title,
        p_body: params.body,
        p_data: params.data || {},
        p_image_url: params.image_url || null,
        p_deep_link: params.deep_link || null,
        p_sender_id: params.sender_id || null,
        p_related_id: params.related_id || null,
        p_related_type: params.related_type || null,
      });

      if (error) {
        console.error('Error creating notification:', error);
        return null;
      }

      const notificationId = data as string;
      console.log('Notification created successfully:', notificationId);

      // Automatically send push notification after creating the notification
      // This ensures push notifications are sent even when createNotification is called directly
      try {
        const pushResponse = await supabase.functions.invoke('send-push-notifications', {
          body: {
            notification_id: notificationId,
            user_id: params.user_id,
            type: params.type,
            title: params.title,
            body: params.body,
            data: params.data,
            image_url: params.image_url,
            deep_link: params.deep_link,
          },
        });

        if (pushResponse.error) {
          console.error('Error sending push notification:', pushResponse.error);
        } else {
          console.log('Push notification sent successfully for notification:', notificationId);
        }
      } catch (pushError) {
        console.error('Exception sending push notification:', pushError);
        // Don't fail the notification creation if push fails
      }

      return notificationId;
    } catch (error) {
      console.error('Exception creating notification:', error);
      return null;
    }
  }

  /**
   * Notify an organizer about a new booking for their event
   */
  async notifyOrganizerOfNewBooking(params: NotifyOrganizerOfNewBookingParams): Promise<boolean> {
    const title = `New Booking for ${params.event_title}`;
    const body = `${params.user_name} has booked ${params.quantity} ticket(s).`;
    const deep_link = `/bookings/${params.event_id}`;

    return this.sendImmediateNotification({
      user_id: params.organizer_id,
      type: 'organizer_new_booking',
      title,
      body,
      data: {
        event_id: params.event_id,
        event_title: params.event_title,
        booking_id: params.booking_id,
      },
      deep_link,
      related_id: params.event_id,
      related_type: 'event',
      sender_id: params.organizer_id, // The user receiving the notification is the organizer.
    });
  }

  /**
   * Send an immediate notification (bypasses queue)
   * This is useful for critical notifications that need immediate delivery
   */
  async sendImmediateNotification(params: SendNotificationParams): Promise<boolean> {
    try {
      // First create the notification in the database
      const notificationId = await this.createNotification(params);
      if (!notificationId) {
        return false;
      }

      // Send push notification if not skipped
      if (!params.skip_push) {
        try {
          await supabase.functions.invoke('send-push-notifications', {
            body: {
              notification_id: notificationId,
              user_id: params.user_id,
              type: params.type,
              title: params.title,
              body: params.body,
              data: params.data,
              image_url: params.image_url,
              deep_link: params.deep_link,
            },
          });
        } catch (pushError) {
          console.error('Error sending push notification:', pushError);
        }
      }

      // Send web notification if not skipped
      if (!params.skip_web) {
        try {
          const userChannel = `user:${params.user_id}`;
          await supabase
            .channel(userChannel)
            .send({
              type: 'broadcast',
              event: 'new_notification',
              payload: {
                user_id: params.user_id,
                notification_id: notificationId,
                type: params.type,
                title: params.title,
                body: params.body,
                data: params.data,
                image_url: params.image_url,
                deep_link: params.deep_link,
                created_at: new Date().toISOString(),
              },
            });
        } catch (webError) {
          console.error('Error sending web notification:', webError);
        }
      }

      return true;
    } catch (error) {
      console.error('Exception sending immediate notification:', error);
      return false;
    }
  }

  /**
   * Send a new message notification
   */
  async notifyNewMessage(params: {
    receiver_id: string;
    sender_id: string;
    sender_name: string;
    message_id: string;
    content: string;
    is_group?: boolean;
    group_id?: string;
    group_name?: string;
  }): Promise<boolean> {
    const isGroup = params.is_group || false;
    const title = isGroup
      ? `${params.sender_name} in ${params.group_name || 'Group Chat'}`
      : `New message from ${params.sender_name}`;

    const body = params.content.length > 100
      ? params.content.substring(0, 100) + '...'
      : params.content;

    const deep_link = isGroup
      ? `/group-chat/${params.group_id}`
      : `/chat/${params.sender_id}`;

    return this.sendImmediateNotification({
      user_id: params.receiver_id,
      type: isGroup ? 'new_group_message' : 'new_message',
      title,
      body,
      data: {
        sender_id: params.sender_id,
        sender_name: params.sender_name,
        message_id: params.message_id,
        chat_id: isGroup ? params.group_id : params.sender_id,
        is_group: isGroup,
        ...(isGroup && { group_id: params.group_id, group_name: params.group_name }),
      },
      deep_link,
      sender_id: params.sender_id,
      related_id: params.message_id,
      related_type: isGroup ? 'group_message' : 'message',
    });
  }

  /**
   * Send a new match notification
   */
  async notifyNewMatch(params: {
    user_id: string;
    match_id: string;
    match_name: string;
    match_image?: string;
  }): Promise<boolean> {
    return this.sendImmediateNotification({
      user_id: params.user_id,
      type: 'new_match',
      title: "You've got a new match!",
      body: `You and ${params.match_name} liked each other`,
      data: {
        match_id: params.match_id,
        match_name: params.match_name,
      },
      image_url: params.match_image,
      deep_link: `/matches/${params.match_id}`,
      related_id: params.match_id,
      related_type: 'match',
    });
  }

  /**
   * Send an event alert notification
   */
  async notifyEventAlert(params: {
    user_id: string;
    event_id: string;
    event_title: string;
    event_image?: string;
    alert_type: 'new_event' | 'event_update' | 'event_reminder' | 'booking_confirmation';
    custom_message?: string;
  }): Promise<boolean> {
    let title: string;
    let body: string;

    switch (params.alert_type) {
      case 'new_event':
        title = 'New Event For You';
        body = params.custom_message || `Check out "${params.event_title}" - it might be perfect for you!`;
        break;
      case 'event_update':
        title = 'Event Updated';
        body = params.custom_message || `"${params.event_title}" has been updated`;
        break;
      case 'event_reminder':
        title = 'Event Reminder';
        body = params.custom_message || `"${params.event_title}" is coming up soon`;
        break;
      case 'booking_confirmation':
        title = 'Booking Confirmed';
        body = params.custom_message || `Your booking for "${params.event_title}" is confirmed`;
        break;
      default:
        title = 'Event Alert';
        body = params.custom_message || `Update about "${params.event_title}"`;
    }

    return this.sendImmediateNotification({
      user_id: params.user_id,
      type: params.alert_type === 'booking_confirmation' ? 'booking_confirmation' : 'event_alert',
      title,
      body,
      data: {
        event_id: params.event_id,
        event_title: params.event_title,
        alert_type: params.alert_type,
      },
      image_url: params.event_image,
      deep_link: `/events/${params.event_id}`,
      related_id: params.event_id,
      related_type: 'event',
    });
  }

  /**
   * Send a system alert notification
   */
  async notifySystemAlert(params: {
    user_id: string;
    title: string;
    message: string;
    alert_type?: 'info' | 'warning' | 'error' | 'success';
    action_url?: string;
  }): Promise<boolean> {
    return this.sendImmediateNotification({
      user_id: params.user_id,
      type: 'system_alert',
      title: params.title,
      body: params.message,
      data: {
        alert_type: params.alert_type || 'info',
      },
      deep_link: params.action_url,
      related_type: 'system',
    });
  }

  /**
   * Send a friend request notification
   */
  async notifyFriendRequest(params: {
    receiver_id: string;
    sender_id: string;
    sender_name: string;
    sender_image?: string;
  }): Promise<boolean> {
    return this.sendImmediateNotification({
      user_id: params.receiver_id,
      type: 'friend_request',
      title: 'New Friend Request',
      body: `${params.sender_name} sent you a friend request`,
      data: {
        sender_id: params.sender_id,
        sender_name: params.sender_name,
      },
      image_url: params.sender_image,
      deep_link: `/profile/${params.sender_id}`,
      sender_id: params.sender_id,
      related_id: params.sender_id,
      related_type: 'friend_request',
    });
  }

  /**
   * Send a friend accept notification
   */
  async notifyFriendAccept(params: {
    user_id: string;
    friend_id: string;
    friend_name: string;
    friend_image?: string;
  }): Promise<boolean> {
    return this.sendImmediateNotification({
      user_id: params.user_id,
      type: 'friend_accept',
      title: 'Friend Request Accepted',
      body: `${params.friend_name} accepted your friend request`,
      data: {
        friend_id: params.friend_id,
        friend_name: params.friend_name,
      },
      image_url: params.friend_image,
      deep_link: `/profile/${params.friend_id}`,
      sender_id: params.friend_id,
      related_id: params.friend_id,
      related_type: 'friend_accept',
    });
  }

  /**
   * Send bulk notifications to multiple users
   */
  async sendBulkNotifications(
    userIds: string[],
    notificationParams: Omit<SendNotificationParams, 'user_id'>
  ): Promise<number> {
    const promises = userIds.map(userId =>
      this.sendImmediateNotification({
        ...notificationParams,
        user_id: userId,
      })
    );

    const results = await Promise.allSettled(promises);
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value === true).length;

    console.log(`Bulk notifications sent: ${successCount}/${userIds.length}`);
    return successCount;
  }

  /**
   * Get user notification preferences
   */
  async getUserPreferences(userId: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching user preferences:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Exception fetching user preferences:', error);
      return null;
    }
  }

  /**
   * Update user notification preferences
   */
  async updateUserPreferences(userId: string, preferences: any): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notification_preferences')
        .upsert({
          user_id: userId,
          ...preferences,
          updated_at: new Date().toISOString(),
        });

      if (error) {
        console.error('Error updating user preferences:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Exception updating user preferences:', error);
      return false;
    }
  }

  /**
   * Process notification queue (for batch processing)
   */
  async processNotificationQueue(): Promise<void> {
    try {
      await supabase.functions.invoke('process-notification-queue');
    } catch (error) {
      console.error('Error processing notification queue:', error);
    }
  }

  /**
   * Get notification history for a user
   */
  async getNotificationHistory(userId: string, limit: number = 50): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching notification history:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Exception fetching notification history:', error);
      return [];
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<boolean> {
    try {
      const { error } = await supabase.rpc('mark_notification_read', {
        p_notification_id: notificationId,
      });

      if (error) {
        console.error('Error marking notification as read:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Exception marking notification as read:', error);
      return false;
    }
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const { data, error } = await supabase.rpc('get_unread_notification_count', {
        p_user_id: userId,
      });

      if (error) {
        console.error('Error getting unread count:', error);
        return 0;
      }

      return data || 0;
    } catch (error) {
      console.error('Exception getting unread count:', error);
      return 0;
    }
  }
}

export default UnifiedNotificationService.getInstance(); 