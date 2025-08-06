import { useState, useEffect, useCallback } from 'react';
import { MessageFetchingService } from '@/services/message/MessageFetchingService';
import { MessageMappingUtils } from '@/utils/message/MessageMappingUtils';
import type { ChatMessage, FetchMessagesResult } from '@/types/message';

interface UseMessageFetchingOptions {
  chatType: 'individual' | 'group';
  chatId: string;
  userId: string;
  partnerName?: string;
  limit?: number;
  autoFetch?: boolean;
}

interface UseMessageFetchingReturn {
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  fetchMessages: (offset?: number) => Promise<void>;
  refreshMessages: () => Promise<void>;
  clearMessages: () => void;
}

export const useMessageFetching = (options: UseMessageFetchingOptions): UseMessageFetchingReturn => {
  const { chatType, chatId, userId, partnerName = 'User', limit = 50, autoFetch = true } = options;
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // Set current user ID for message mapping
  useEffect(() => {
    MessageMappingUtils.setCurrentUserId(userId);
  }, [userId]);

  const fetchMessages = useCallback(async (offset: number = 0) => {
    if (!chatId || !userId) {
      setError('Missing required parameters');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let result: FetchMessagesResult;

      if (chatType === 'individual') {
        result = await MessageFetchingService.fetchIndividualMessages(
          userId,
          chatId,
          limit,
          offset
        );
      } else {
        result = await MessageFetchingService.fetchGroupMessages(
          chatId,
          userId,
          limit,
          offset
        );
      }

      if (result.error) {
        setError(result.error);
        return;
      }

      // Map messages to include partner name for individual chats
      const mappedMessages = result.messages.map(msg => {
        if (chatType === 'individual' && msg.user._id !== userId) {
          return {
            ...msg,
            user: {
              ...msg.user,
              name: partnerName
            }
          };
        }
        return msg;
      });

      if (offset === 0) {
        // Initial load or refresh
        setMessages(mappedMessages);
      } else {
        // Load more (prepend older messages)
        setMessages(prev => [...mappedMessages, ...prev]);
      }

      setHasMore(result.hasMore);
      
    } catch (err: any) {
      console.error('[useMessageFetching] Error fetching messages:', err);
      setError(err.message || 'Failed to fetch messages');
    } finally {
      setLoading(false);
      setIsInitialized(true);
    }
  }, [chatType, chatId, userId, partnerName, limit]);

  const refreshMessages = useCallback(async () => {
    await fetchMessages(0);
  }, [fetchMessages]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
    setHasMore(true);
    setIsInitialized(false);
  }, []);

  // Auto-fetch on mount and when dependencies change
  useEffect(() => {
    if (autoFetch && !isInitialized) {
      fetchMessages(0);
    }
  }, [autoFetch, isInitialized, fetchMessages]);

  // Clear messages when chat changes
  useEffect(() => {
    clearMessages();
  }, [chatId, chatType]);

  return {
    messages,
    loading,
    error,
    hasMore,
    fetchMessages,
    refreshMessages,
    clearMessages,
  };
}; 