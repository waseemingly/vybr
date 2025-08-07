import { supabase } from '@/lib/supabase';
import { MessageUtils } from '@/utils/message/MessageUtils';
import type { IndividualChatListItem, GroupChatListItem, ChatItem } from '@/types/message';

export interface ChatListOptions {
  userId: string;
  limit?: number;
  offset?: number;
}

export interface ChatListResult {
  chats: ChatItem[];
  hasMore: boolean;
  error?: string;
}

export class ChatListService {
  /**
   * Fetch individual chat list
   */
  static async fetchIndividualChatList(userId: string): Promise<ChatListResult> {
    try {
      console.log(`[ChatListService] Fetching individual chat list for user ${userId}`);
      
      const { data, error } = await supabase.rpc('get_individual_chat_list', {
        current_user_id: userId
      });

      if (error) {
        console.error('[ChatListService] Error fetching individual chat list:', error);
        return { chats: [], hasMore: false, error: error.message };
      }

      if (!data || data.length === 0) {
        return { chats: [], hasMore: false };
      }

      const chatItems: ChatItem[] = data.map((chat: IndividualChatListItem) => ({
        type: 'individual' as const,
        data: {
          ...chat,
          last_message_content: MessageUtils.formatLastMessageForPreview(
            chat.last_message_content,
            chat.last_message_sender_id,
            userId,
            chat.last_message_sender_name,
            false
          ),
          unread_count: chat.unread_count || 0,
          isPinned: false // TODO: Implement pinning functionality
        }
      }));

      console.log(`[ChatListService] Successfully fetched ${chatItems.length} individual chats`);
      
      return { chats: chatItems, hasMore: false };
      
    } catch (error: any) {
      console.error('[ChatListService] Exception fetching individual chat list:', error);
      return { chats: [], hasMore: false, error: error.message };
    }
  }

  /**
   * Fetch group chat list
   */
  static async fetchGroupChatList(userId: string): Promise<ChatListResult> {
    try {
      console.log(`[ChatListService] Fetching group chat list for user ${userId}`);
      
      const { data, error } = await supabase.rpc('get_group_chat_list', {
        current_user_id: userId
      });

      if (error) {
        console.error('[ChatListService] Error fetching group chat list:', error);
        return { chats: [], hasMore: false, error: error.message };
      }

      if (!data || data.length === 0) {
        return { chats: [], hasMore: false };
      }

      const chatItems: ChatItem[] = data.map((chat: GroupChatListItem) => ({
        type: 'group' as const,
        data: {
          ...chat,
          last_message_content: MessageUtils.formatLastMessageForPreview(
            chat.last_message_content,
            chat.last_message_sender_id,
            userId,
            chat.last_message_sender_name,
            true
          ),
          unread_count: chat.unread_count || 0,
          isPinned: false // TODO: Implement pinning functionality
        }
      }));

      console.log(`[ChatListService] Successfully fetched ${chatItems.length} group chats`);
      
      return { chats: chatItems, hasMore: false };
      
    } catch (error: any) {
      console.error('[ChatListService] Exception fetching group chat list:', error);
      return { chats: [], hasMore: false, error: error.message };
    }
  }

  /**
   * Fetch combined chat list (individual + group)
   */
  static async fetchCombinedChatList(userId: string): Promise<ChatListResult> {
    try {
      console.log(`[ChatListService] Fetching combined chat list for user ${userId}`);
      
      const [individualResult, groupResult] = await Promise.all([
        this.fetchIndividualChatList(userId),
        this.fetchGroupChatList(userId)
      ]);

      if (individualResult.error || groupResult.error) {
        const error = individualResult.error || groupResult.error;
        console.error('[ChatListService] Error fetching combined chat list:', error);
        return { chats: [], hasMore: false, error };
      }

      // Combine and sort by last message time
      const allChats = [...individualResult.chats, ...groupResult.chats];
      
      allChats.sort((a, b) => {
        const aTime = a.type === 'individual' 
          ? a.data.last_message_created_at 
          : a.data.last_message_created_at;
        const bTime = b.type === 'individual' 
          ? b.data.last_message_created_at 
          : b.data.last_message_created_at;
        
        if (!aTime && !bTime) return 0;
        if (!aTime) return 1;
        if (!bTime) return -1;
        
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });

      console.log(`[ChatListService] Successfully fetched combined chat list with ${allChats.length} chats`);
      
      return { chats: allChats, hasMore: false };
      
    } catch (error: any) {
      console.error('[ChatListService] Exception fetching combined chat list:', error);
      return { chats: [], hasMore: false, error: error.message };
    }
  }

  /**
   * Get chat preview information
   */
  static async getChatPreview(
    chatType: 'individual' | 'group',
    chatId: string,
    userId: string
  ): Promise<ChatItem | null> {
    try {
      if (chatType === 'individual') {
        const { data, error } = await supabase.rpc('get_individual_chat_preview', {
          current_user_id: userId,
          partner_user_id: chatId
        });

        if (error || !data) {
          console.error('[ChatListService] Error getting individual chat preview:', error);
          return null;
        }

        return {
          type: 'individual',
          data: {
            ...data,
            last_message_content: MessageUtils.formatLastMessageForPreview(
              data.last_message_content,
              data.last_message_sender_id,
              userId,
              data.last_message_sender_name,
              false
            ),
            unread_count: data.unread_count || 0,
            isPinned: false
          }
        };
      } else {
        const { data, error } = await supabase.rpc('get_group_chat_preview', {
          current_user_id: userId,
          group_id: chatId
        });

        if (error || !data) {
          console.error('[ChatListService] Error getting group chat preview:', error);
          return null;
        }

        return {
          type: 'group',
          data: {
            ...data,
            last_message_content: MessageUtils.formatLastMessageForPreview(
              data.last_message_content,
              data.last_message_sender_id,
              userId,
              data.last_message_sender_name,
              true
            ),
            unread_count: data.unread_count || 0,
            isPinned: false
          }
        };
      }
    } catch (error) {
      console.error('[ChatListService] Exception getting chat preview:', error);
      return null;
    }
  }

  /**
   * Mark chat as read
   */
  static async markChatAsRead(
    chatType: 'individual' | 'group',
    chatId: string,
    userId: string
  ): Promise<boolean> {
    try {
      if (chatType === 'individual') {
        const { error } = await supabase.rpc('mark_all_messages_seen_from_user', {
          sender_id_input: chatId,
          receiver_id_input: userId
        });

        if (error) {
          console.error('[ChatListService] Error marking individual chat as read:', error);
          return false;
        }
      } else {
        const { error } = await supabase.rpc('mark_all_group_messages_seen', {
          group_id_input: chatId,
          user_id_input: userId
        });

        if (error) {
          console.error('[ChatListService] Error marking group chat as read:', error);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('[ChatListService] Exception marking chat as read:', error);
      return false;
    }
  }

  /**
   * Delete chat conversation
   */
  static async deleteChat(
    chatType: 'individual' | 'group',
    chatId: string,
    userId: string
  ): Promise<boolean> {
    try {
      if (chatType === 'individual') {
        // For individual chats, we hide messages from the user
        const { error } = await supabase
          .from('user_hidden_messages')
          .insert({
            user_id: userId,
            message_id: chatId // This would need to be implemented differently
          });

        if (error) {
          console.error('[ChatListService] Error deleting individual chat:', error);
          return false;
        }
      } else {
        // For group chats, we remove the user from the group
        const { error } = await supabase
          .from('group_participants')
          .delete()
          .eq('group_id', chatId)
          .eq('user_id', userId);

        if (error) {
          console.error('[ChatListService] Error deleting group chat:', error);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('[ChatListService] Exception deleting chat:', error);
      return false;
    }
  }
} 