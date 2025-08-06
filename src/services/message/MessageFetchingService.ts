import { supabase } from '@/lib/supabase';
import { MessageMappingUtils } from '@/utils/message/MessageMappingUtils';
import type { ChatMessage, DbMessage, DbGroupMessage, UserProfileInfo, FetchMessagesResult } from '@/types/message';

export class MessageFetchingService {
  /**
   * Fetch messages (online only)
   */
  static async fetchMessages(
    chatType: 'individual' | 'group',
    chatId: string,
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<FetchMessagesResult> {
    try {
      console.log(`[MessageFetchingService] Fetching messages for ${chatType} chat:`, chatId);

      let result: FetchMessagesResult;
      
      if (chatType === 'individual') {
        result = await this.fetchIndividualMessages(userId, chatId, limit, offset);
      } else {
        result = await this.fetchGroupMessages(chatId, userId, limit, offset);
      }

      return result;
    } catch (error: any) {
      console.error('[MessageFetchingService] Error fetching messages:', error);
      return { messages: [], hasMore: false, error: error.message };
    }
  }

  /**
   * Fetch group messages with status information
   */
  static async fetchGroupMessages(
    groupId: string, 
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<FetchMessagesResult> {
    try {
      console.log(`[MessageFetchingService] Fetching group messages for group ${groupId}`);
      
      const { data: messagesData, error: messagesError } = await supabase
        .from('group_chat_messages')
        .select(`
          id, created_at, sender_id, group_id, content, image_url, is_system_message, metadata, 
          original_content, is_edited, edited_at, is_deleted, deleted_at, reply_to_message_id,
          group_message_status(*)
        `)
        .eq('group_id', groupId)
        .order('created_at', { ascending: true })
        .range(offset, offset + limit - 1);

      if (messagesError) {
        console.error('[MessageFetchingService] Error fetching group messages:', messagesError);
        return { messages: [], hasMore: false, error: messagesError.message };
      }

      if (!messagesData || messagesData.length === 0) {
        return { messages: [], hasMore: false };
      }

      // Fetch user profiles for message mapping
      const senderIds = Array.from(new Set(messagesData.map(msg => msg.sender_id).filter(id => id)));
      const profilesMap = await this.fetchUserProfiles(senderIds);

      // Map database messages to UI messages
      const visibleMessages = messagesData.filter(msg => !msg.is_system_message && msg.sender_id);
      const mappedMessages = visibleMessages.map((dbMsg: any) => {
        const chatMsg = MessageMappingUtils.mapGroupDbMessageToChatMessage(dbMsg as DbGroupMessage, profilesMap);
        
        // Handle message status
        const allStatuses = dbMsg.group_message_status || [];
                 chatMsg.seenBy = allStatuses
           .filter((s: any) => s.is_seen && s.user_id !== dbMsg.sender_id)
           .map((s: any) => {
             const profile = profilesMap.get(s.user_id);
             const userName = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'User' : 'Someone';
             return {
               userId: s.user_id,
               userName,
               seenAt: new Date(s.seen_at)
             };
           });

        // Set seen status
        if (chatMsg.user._id === userId) {
          chatMsg.isSeen = (chatMsg.seenBy || []).length > 0;
        } else {
          const currentUserStatus = allStatuses.find((s: any) => s.user_id === userId && s.is_seen);
          chatMsg.isSeen = !!currentUserStatus;
          chatMsg.seenAt = currentUserStatus ? new Date(currentUserStatus.seen_at) : null;
        }

        return chatMsg;
      });

      // Enhance shared events with missing eventDateTime
      const enhancedMessages = await MessageMappingUtils.enhanceSharedEventsWithDateTime(mappedMessages);

      const hasMore = messagesData.length === limit;
      
      console.log(`[MessageFetchingService] Successfully fetched ${enhancedMessages.length} group messages`);
      
      return { messages: enhancedMessages, hasMore };
      
    } catch (error: any) {
      console.error('[MessageFetchingService] Exception fetching group messages:', error);
      return { messages: [], hasMore: false, error: error.message };
    }
  }

  /**
   * Fetch individual messages with status information
   */
  static async fetchIndividualMessages(
    userId: string,
    partnerId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<FetchMessagesResult> {
    try {
      console.log(`[MessageFetchingService] Fetching individual messages between ${userId} and ${partnerId}`);
      
      const { data, error: fetchError } = await supabase
        .from('messages')
        .select('*, message_status(is_delivered, delivered_at, is_seen, seen_at)')
        .or(`and(sender_id.eq.${userId},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${userId})`)
        .order('created_at', { ascending: true })
        .range(offset, offset + limit - 1);

      if (fetchError) {
        console.error('[MessageFetchingService] Error fetching individual messages:', fetchError);
        return { messages: [], hasMore: false, error: fetchError.message };
      }

      // Fetch hidden messages for the current user
      const { data: hiddenMessagesData, error: hiddenMessagesError } = await supabase
        .from('user_hidden_messages')
        .select('message_id')
        .eq('user_id', userId);
      
      if (hiddenMessagesError) {
        console.error("Error fetching hidden messages:", hiddenMessagesError);
      }
      
      const hiddenMessageIds = new Set(hiddenMessagesData?.map((h: {message_id: string}) => h.message_id) || []);

      if (data) {
        const visibleMessages = data.filter((msg: DbMessage) => !hiddenMessageIds.has(msg.id));
        const fetchedChatMessages = visibleMessages.map((dbMsg: any) => {
          const chatMsg = MessageMappingUtils.mapDbMessageToChatMessage(dbMsg as DbMessage, userId, 'Partner');
          
          // Handle message status
          const status = dbMsg.message_status && Array.isArray(dbMsg.message_status) ? dbMsg.message_status[0] : dbMsg.message_status;
          if (status) {
            chatMsg.isDelivered = status.is_delivered;
            chatMsg.deliveredAt = status.delivered_at ? new Date(status.delivered_at) : null;
            chatMsg.isSeen = status.is_seen;
            chatMsg.seenAt = status.seen_at ? new Date(status.seen_at) : null;
          }
          
          return chatMsg;
        });

        // Enhance shared events with missing eventDateTime
        const enhancedMessages = await MessageMappingUtils.enhanceSharedEventsWithDateTime(fetchedChatMessages);

        const hasMore = data.length === limit;
        
        console.log(`[MessageFetchingService] Successfully fetched ${enhancedMessages.length} individual messages`);
        
        return { messages: enhancedMessages, hasMore };
      } else {
        return { messages: [], hasMore: false };
      }
      
    } catch (error: any) {
      console.error('[MessageFetchingService] Exception fetching individual messages:', error);
      return { messages: [], hasMore: false, error: error.message };
    }
  }

  /**
   * Fetch user profiles for message mapping
   */
  private static async fetchUserProfiles(userIds: string[]): Promise<Map<string, UserProfileInfo>> {
    if (userIds.length === 0) {
      return new Map();
    }

    try {
      const { data: profilesData, error: profilesError } = await supabase
        .from('music_lover_profiles')
        .select('user_id, first_name, last_name, profile_picture')
        .in('user_id', userIds);

      if (profilesError) {
        console.error('[MessageFetchingService] Error fetching user profiles:', profilesError);
        return new Map();
      }

      const profilesMap = new Map<string, UserProfileInfo>();
      if (profilesData) {
        profilesData.forEach((profile: UserProfileInfo) => {
          profilesMap.set(profile.user_id, profile);
        });
      }

      return profilesMap;
    } catch (error) {
      console.error('[MessageFetchingService] Exception fetching user profiles:', error);
      return new Map();
    }
  }

  /**
   * Fetch a single message by ID
   */
  static async fetchMessageById(messageId: string): Promise<ChatMessage | null> {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*, message_status(is_delivered, delivered_at, is_seen, seen_at)')
        .eq('id', messageId)
        .single();

      if (error || !data) {
        console.error('[MessageFetchingService] Error fetching message by ID:', error);
        return null;
      }

      return MessageMappingUtils.mapDbMessageToChatMessage(data as DbMessage, data.sender_id, 'User');
    } catch (error) {
      console.error('[MessageFetchingService] Exception fetching message by ID:', error);
      return null;
    }
  }

  /**
   * Fetch group message by ID
   */
  static async fetchGroupMessageById(messageId: string): Promise<ChatMessage | null> {
    try {
      const { data, error } = await supabase
        .from('group_chat_messages')
        .select(`
          id, created_at, sender_id, group_id, content, image_url, is_system_message, metadata, 
          original_content, is_edited, edited_at, is_deleted, deleted_at, reply_to_message_id,
          group_message_status(*)
        `)
        .eq('id', messageId)
        .single();

      if (error || !data) {
        console.error('[MessageFetchingService] Error fetching group message by ID:', error);
        return null;
      }

      const profilesMap = await this.fetchUserProfiles([data.sender_id]);
      return MessageMappingUtils.mapGroupDbMessageToChatMessage(data as DbGroupMessage, profilesMap);
    } catch (error) {
      console.error('[MessageFetchingService] Exception fetching group message by ID:', error);
      return null;
    }
  }
} 