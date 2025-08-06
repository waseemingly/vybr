import { useState, useEffect, useCallback } from 'react';
import { ChatListService } from '@/services/chat/ChatListService';
import type { ChatItem } from '@/types/message';

interface UseChatListOptions {
  userId: string;
  chatType?: 'individual' | 'group' | 'combined';
  autoFetch?: boolean;
  refreshInterval?: number;
}

interface UseChatListReturn {
  chats: ChatItem[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  fetchChats: () => Promise<void>;
  refreshChats: () => Promise<void>;
  markChatAsRead: (chatType: 'individual' | 'group', chatId: string) => Promise<boolean>;
  deleteChat: (chatType: 'individual' | 'group', chatId: string) => Promise<boolean>;
  clearChats: () => void;
}

export const useChatList = (options: UseChatListOptions): UseChatListReturn => {
  const { 
    userId, 
    chatType = 'combined', 
    autoFetch = true, 
    refreshInterval 
  } = options;
  
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const fetchChats = useCallback(async () => {
    if (!userId) {
      setError('User ID is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let result;

      switch (chatType) {
        case 'individual':
          result = await ChatListService.fetchIndividualChatList(userId);
          break;
        case 'group':
          result = await ChatListService.fetchGroupChatList(userId);
          break;
        case 'combined':
        default:
          result = await ChatListService.fetchCombinedChatList(userId);
          break;
      }

      if (result.error) {
        setError(result.error);
        return;
      }

      setChats(result.chats);
      setHasMore(result.hasMore);
      
    } catch (err: any) {
      console.error('[useChatList] Error fetching chats:', err);
      setError(err.message || 'Failed to fetch chats');
    } finally {
      setLoading(false);
      setIsInitialized(true);
    }
  }, [userId, chatType]);

  const refreshChats = useCallback(async () => {
    await fetchChats();
  }, [fetchChats]);

  const markChatAsRead = useCallback(async (
    chatType: 'individual' | 'group', 
    chatId: string
  ): Promise<boolean> => {
    try {
      const success = await ChatListService.markChatAsRead(chatType, chatId, userId);
      
      if (success) {
        // Update the chat in the list to reflect read status
        setChats(prevChats => 
          prevChats.map(chat => {
            if (chat.type === chatType) {
              if (chatType === 'individual' && chat.type === 'individual' && chat.data.partner_user_id === chatId) {
                return {
                  ...chat,
                  data: {
                    ...chat.data,
                    unread_count: 0
                  }
                };
              } else if (chatType === 'group' && chat.type === 'group' && chat.data.group_id === chatId) {
                return {
                  ...chat,
                  data: {
                    ...chat.data,
                    unread_count: 0
                  }
                };
              }
            }
            return chat;
          })
        );
      }
      
      return success;
    } catch (error) {
      console.error('[useChatList] Error marking chat as read:', error);
      return false;
    }
  }, [userId]);

  const deleteChat = useCallback(async (
    chatType: 'individual' | 'group', 
    chatId: string
  ): Promise<boolean> => {
    try {
      const success = await ChatListService.deleteChat(chatType, chatId, userId);
      
      if (success) {
        // Remove the chat from the list
        setChats(prevChats => 
          prevChats.filter(chat => {
            if (chat.type === chatType) {
              if (chatType === 'individual' && chat.type === 'individual') {
                return chat.data.partner_user_id !== chatId;
              } else if (chatType === 'group' && chat.type === 'group') {
                return chat.data.group_id !== chatId;
              }
            }
            return true;
          })
        );
      }
      
      return success;
    } catch (error) {
      console.error('[useChatList] Error deleting chat:', error);
      return false;
    }
  }, [userId]);

  const clearChats = useCallback(() => {
    setChats([]);
    setError(null);
    setHasMore(false);
    setIsInitialized(false);
  }, []);

  // Auto-fetch on mount and when dependencies change
  useEffect(() => {
    if (autoFetch && !isInitialized) {
      fetchChats();
    }
  }, [autoFetch, isInitialized, fetchChats]);

  // Set up refresh interval if provided
  useEffect(() => {
    if (refreshInterval && isInitialized) {
      const interval = setInterval(() => {
        fetchChats();
      }, refreshInterval);

      return () => clearInterval(interval);
    }
  }, [refreshInterval, isInitialized, fetchChats]);

  // Clear chats when user or chat type changes
  useEffect(() => {
    clearChats();
  }, [userId, chatType]);

  return {
    chats,
    loading,
    error,
    hasMore,
    fetchChats,
    refreshChats,
    markChatAsRead,
    deleteChat,
    clearChats,
  };
}; 