import { supabase } from '@/lib/supabase';

export class MessageStatusService {
  /**
   * Mark individual message as seen
   */
  static async markMessageSeen(messageId: string, userId: string): Promise<boolean> {
    try {
      console.log(`[MessageStatusService] Marking individual message ${messageId} as seen for user ${userId}`);
      
      const { error } = await supabase.rpc('mark_message_seen', {
        message_id_input: messageId,
        user_id_input: userId
      });

      if (error) {
        console.error('[MessageStatusService] Error marking individual message as seen:', error);
        return false;
      }

      console.log(`[MessageStatusService] Successfully marked individual message ${messageId} as seen`);
      return true;
    } catch (error) {
      console.error('[MessageStatusService] Exception marking individual message as seen:', error);
      return false;
    }
  }

  /**
   * Mark group message as seen
   */
  static async markGroupMessageSeen(messageId: string, userId: string): Promise<boolean> {
    try {
      console.log(`[MessageStatusService] Marking group message ${messageId} as seen for user ${userId}`);
      
      const { error } = await supabase.rpc('mark_group_message_seen', {
        message_id_input: messageId,
        user_id_input: userId
      });

      if (error) {
        console.error('[MessageStatusService] Error marking group message as seen:', error);
        return false;
      }

      console.log(`[MessageStatusService] Successfully marked group message ${messageId} as seen`);
      return true;
    } catch (error) {
      console.error('[MessageStatusService] Exception marking group message as seen:', error);
      return false;
    }
  }

  /**
   * Mark individual message as delivered
   */
  static async markMessageDelivered(messageId: string, userId: string): Promise<boolean> {
    try {
      console.log(`[MessageStatusService] Marking individual message ${messageId} as delivered for user ${userId}`);
      
      const { error } = await supabase.rpc('mark_message_delivered', {
        message_id_input: messageId,
        user_id_input: userId
      });

      if (error) {
        console.error('[MessageStatusService] Error marking individual message as delivered:', error);
        return false;
      }

      console.log(`[MessageStatusService] Successfully marked individual message ${messageId} as delivered`);
      return true;
    } catch (error) {
      console.error('[MessageStatusService] Exception marking individual message as delivered:', error);
      return false;
    }
  }

  /**
   * Mark group message as delivered
   */
  static async markGroupMessageDelivered(messageId: string, userId: string): Promise<boolean> {
    try {
      console.log(`[MessageStatusService] Marking group message ${messageId} as delivered for user ${userId}`);
      
      const { error } = await supabase.rpc('mark_group_message_delivered', {
        message_id_input: messageId,
        user_id_input: userId
      });

      if (error) {
        console.error('[MessageStatusService] Error marking group message as delivered:', error);
        return false;
      }

      console.log(`[MessageStatusService] Successfully marked group message ${messageId} as delivered`);
      return true;
    } catch (error) {
      console.error('[MessageStatusService] Exception marking group message as delivered:', error);
      return false;
    }
  }

  /**
   * Mark all messages from a user as seen (for individual chats)
   */
  static async markAllMessagesSeenFromUser(senderId: string, receiverId: string): Promise<boolean> {
    try {
      console.log(`[MessageStatusService] Marking all messages from ${senderId} as seen by ${receiverId}`);
      
      const { error } = await supabase.rpc('mark_all_messages_seen_from_user', {
        sender_id_input: senderId,
        receiver_id_input: receiverId
      });

      if (error) {
        console.error('[MessageStatusService] Error marking all messages as seen from user:', error);
        return false;
      }

      console.log(`[MessageStatusService] Successfully marked all messages from ${senderId} as seen`);
      return true;
    } catch (error) {
      console.error('[MessageStatusService] Exception marking all messages as seen from user:', error);
      return false;
    }
  }

  /**
   * Mark all group messages as seen
   */
  static async markAllGroupMessagesSeen(groupId: string, userId: string): Promise<boolean> {
    try {
      console.log(`[MessageStatusService] Marking all group messages in ${groupId} as seen by ${userId}`);
      
      const { error } = await supabase.rpc('mark_all_group_messages_seen', {
        group_id_input: groupId,
        user_id_input: userId
      });

      if (error) {
        console.error('[MessageStatusService] Error marking all group messages as seen:', error);
        return false;
      }

      console.log(`[MessageStatusService] Successfully marked all group messages in ${groupId} as seen`);
      return true;
    } catch (error) {
      console.error('[MessageStatusService] Exception marking all group messages as seen:', error);
      return false;
    }
  }

  /**
   * Get message status for individual message
   */
  static async getMessageStatus(messageId: string, userId: string): Promise<{
    isDelivered: boolean;
    isSeen: boolean;
    deliveredAt?: Date;
    seenAt?: Date;
  } | null> {
    try {
      const { data, error } = await supabase
        .from('message_status')
        .select('is_delivered, is_seen, delivered_at, seen_at')
        .eq('message_id', messageId)
        .eq('receiver_id', userId)
        .single();

      if (error) {
        console.error('[MessageStatusService] Error getting message status:', error);
        return null;
      }

      return {
        isDelivered: data.is_delivered || false,
        isSeen: data.is_seen || false,
        deliveredAt: data.delivered_at ? new Date(data.delivered_at) : undefined,
        seenAt: data.seen_at ? new Date(data.seen_at) : undefined,
      };
    } catch (error) {
      console.error('[MessageStatusService] Exception getting message status:', error);
      return null;
    }
  }

  /**
   * Get message status for group message
   */
  static async getGroupMessageStatus(messageId: string, userId: string): Promise<{
    isDelivered: boolean;
    isSeen: boolean;
    deliveredAt?: Date;
    seenAt?: Date;
  } | null> {
    try {
      const { data, error } = await supabase
        .from('group_message_status')
        .select('is_delivered, is_seen, delivered_at, seen_at')
        .eq('message_id', messageId)
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('[MessageStatusService] Error getting group message status:', error);
        return null;
      }

      return {
        isDelivered: data.is_delivered || false,
        isSeen: data.is_seen || false,
        deliveredAt: data.delivered_at ? new Date(data.delivered_at) : undefined,
        seenAt: data.seen_at ? new Date(data.seen_at) : undefined,
      };
    } catch (error) {
      console.error('[MessageStatusService] Exception getting group message status:', error);
      return null;
    }
  }

  /**
   * Get all seen users for a group message
   */
  static async getGroupMessageSeenUsers(messageId: string): Promise<Array<{
    userId: string;
    userName: string;
    seenAt: Date;
  }>> {
    try {
      const { data, error } = await supabase
        .from('group_message_status')
        .select(`
          user_id,
          seen_at,
          music_lover_profiles!inner(first_name, last_name)
        `)
        .eq('message_id', messageId)
        .eq('is_seen', true);

      if (error) {
        console.error('[MessageStatusService] Error getting group message seen users:', error);
        return [];
      }

      return (data || []).map((item: any) => ({
        userId: item.user_id,
        userName: `${item.music_lover_profiles.first_name || ''} ${item.music_lover_profiles.last_name || ''}`.trim() || 'User',
        seenAt: new Date(item.seen_at)
      }));
    } catch (error) {
      console.error('[MessageStatusService] Exception getting group message seen users:', error);
      return [];
    }
  }

  /**
   * Check if user has seen a message
   */
  static async hasUserSeenMessage(
    messageId: string, 
    userId: string, 
    chatType: 'individual' | 'group'
  ): Promise<boolean> {
    try {
      const table = chatType === 'individual' ? 'message_status' : 'group_message_status';
      const userIdField = chatType === 'individual' ? 'receiver_id' : 'user_id';

      const { data, error } = await supabase
        .from(table)
        .select('is_seen')
        .eq('message_id', messageId)
        .eq(userIdField, userId)
        .single();

      if (error) {
        console.error(`[MessageStatusService] Error checking if user has seen ${chatType} message:`, error);
        return false;
      }

      return data.is_seen || false;
    } catch (error) {
      console.error(`[MessageStatusService] Exception checking if user has seen ${chatType} message:`, error);
      return false;
    }
  }

  /**
   * Get unread count for individual chat
   */
  static async getIndividualChatUnreadCount(userId: string, partnerId: string): Promise<number> {
    try {
      // First get message IDs from the partner
      const { data: messageIds, error: messagesError } = await supabase
        .from('messages')
        .select('id')
        .eq('sender_id', partnerId)
        .eq('receiver_id', userId);

      if (messagesError || !messageIds) {
        console.error('[MessageStatusService] Error getting message IDs for unread count:', messagesError);
        return 0;
      }

      const messageIdList = messageIds.map(msg => msg.id);
      
      if (messageIdList.length === 0) {
        return 0;
      }

      // Then count unread status entries
      const { count, error } = await supabase
        .from('message_status')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', userId)
        .eq('is_seen', false)
        .in('message_id', messageIdList);

      if (error) {
        console.error('[MessageStatusService] Error getting individual chat unread count:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('[MessageStatusService] Exception getting individual chat unread count:', error);
      return 0;
    }
  }

  /**
   * Get unread count for group chat
   */
  static async getGroupChatUnreadCount(groupId: string, userId: string): Promise<number> {
    try {
      // First get message IDs not sent by current user
      const { data: messageIds, error: messagesError } = await supabase
        .from('group_chat_messages')
        .select('id')
        .eq('group_id', groupId)
        .neq('sender_id', userId);

      if (messagesError || !messageIds) {
        console.error('[MessageStatusService] Error getting group message IDs for unread count:', messagesError);
        return 0;
      }

      const messageIdList = messageIds.map(msg => msg.id);
      
      if (messageIdList.length === 0) {
        return 0;
      }

      // Then count unread status entries
      const { count, error } = await supabase
        .from('group_message_status')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', groupId)
        .eq('user_id', userId)
        .eq('is_seen', false)
        .in('message_id', messageIdList);

      if (error) {
        console.error('[MessageStatusService] Error getting group chat unread count:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('[MessageStatusService] Exception getting group chat unread count:', error);
      return 0;
    }
  }
} 