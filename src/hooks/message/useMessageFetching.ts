import { useState, useEffect, useCallback, useMemo } from 'react';
import { MessageFetchingService } from '@/services/message/MessageFetchingService';
import { MessageMappingUtils } from '@/utils/message/MessageMappingUtils';
import { usePowerSync } from '@/context/PowerSyncContext';
import { useIndividualMessages, useGroupMessages } from '@/lib/powersync/chatFunctions';
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
  const { isMobile, isPowerSyncAvailable } = usePowerSync();
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // PowerSync hooks for mobile
  const individualMessagesResult = useIndividualMessages(userId, chatId, limit, 0);
  const groupMessagesResult = useGroupMessages(chatId, userId, limit, 0);

  // Set current user ID for message mapping
  useEffect(() => {
    MessageMappingUtils.setCurrentUserId(userId);
  }, [userId]);

  const fetchMessages = useCallback(async (offset: number = 0) => {
    if (!chatId || !userId) {
      setError('Missing required parameters');
      return;
    }

    // For mobile, PowerSync handles the data automatically
    if (isMobile && isPowerSyncAvailable) {
      console.log("useMessageFetching: Using PowerSync for mobile");
      setLoading(false);
      return;
    }

    // For web, use Supabase
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
  }, [chatType, chatId, userId, partnerName, limit, isMobile, isPowerSyncAvailable]);

  const refreshMessages = useCallback(async () => {
    await fetchMessages(0);
  }, [fetchMessages]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
    setHasMore(true);
    setIsInitialized(false);
  }, []);

  // Get messages based on platform
  const getMessages = useMemo(() => {
    if (isMobile && isPowerSyncAvailable) {
      if (chatType === 'individual') {
        return individualMessagesResult.messages.map((msg: any) => ({
          _id: msg.id,
          text: msg.content,
          createdAt: new Date(msg.created_at),
          user: {
            _id: msg.sender_id,
            name: msg.sender_name,
            avatar: msg.sender_profile_picture
          },
          image: null,
          isSystemMessage: false,
          sharedEvent: null,
          originalContent: null,
          isEdited: false,
          editedAt: null,
          isDeleted: false,
          deletedAt: null,
          replyToMessageId: null,
          replyToMessagePreview: null,
          isDelivered: msg.is_delivered,
          deliveredAt: msg.delivered_at ? new Date(msg.delivered_at) : null,
          isSeen: Boolean(msg.is_seen), // Convert to boolean
          seenAt: msg.seen_at ? new Date(msg.seen_at) : null,
          seenBy: [] // Individual chats don't use seenBy array
        }));
      } else {
        return groupMessagesResult.messages.map((msg: any) => ({
          _id: msg.id,
          text: msg.content,
          createdAt: new Date(msg.created_at),
          user: {
            _id: msg.sender_id,
            name: msg.sender_name,
            avatar: msg.sender_profile_picture
          },
          image: null,
          isSystemMessage: false,
          sharedEvent: null,
          originalContent: null,
          isEdited: false,
          editedAt: null,
          isDeleted: false,
          deletedAt: null,
          replyToMessageId: null,
          replyToMessagePreview: null,
          isDelivered: msg.is_delivered,
          deliveredAt: msg.delivered_at ? new Date(msg.delivered_at) : null,
          isSeen: Boolean(msg.is_seen), // Convert to boolean
          seenAt: msg.seen_at ? new Date(msg.seen_at) : null,
          seenBy: msg.seen_by || [] // Use the seen_by data from PowerSync
        }));
      }
    }
    return messages;
  }, [isMobile, isPowerSyncAvailable, chatType, individualMessagesResult.messages, groupMessagesResult.messages, messages]);

  const getIsLoading = useMemo(() => {
    if (isMobile && isPowerSyncAvailable) {
      // For mobile with PowerSync, we don't show loading since data is instantly available
      return false;
    }
    return loading;
  }, [isMobile, isPowerSyncAvailable, loading]);

  const getError = useMemo(() => {
    if (isMobile && isPowerSyncAvailable) {
      if (chatType === 'individual') {
        return individualMessagesResult.error;
      } else {
        return groupMessagesResult.error;
      }
    }
    return error;
  }, [isMobile, isPowerSyncAvailable, chatType, individualMessagesResult.error, groupMessagesResult.error, error]);

  // Auto-fetch on mount and when dependencies change (web only)
  useEffect(() => {
    if (autoFetch && !isInitialized && !isMobile) {
      fetchMessages(0);
    }
  }, [autoFetch, isInitialized, fetchMessages, isMobile]);

  // Clear messages when chat changes
  useEffect(() => {
    clearMessages();
  }, [chatId, chatType]);

  return {
    messages: getMessages,
    loading: getIsLoading,
    error: getError,
    hasMore,
    fetchMessages,
    refreshMessages,
    clearMessages
  };
}; 