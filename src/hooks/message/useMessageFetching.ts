import { useState, useEffect, useCallback, useMemo } from 'react';
import { MessageFetchingService } from '@/services/message/MessageFetchingService';
import { MessageMappingUtils } from '@/utils/message/MessageMappingUtils';
import { usePowerSync } from '@/context/PowerSyncContext';
import { useIndividualMessages, useGroupMessages } from '@/lib/powersync/chatFunctions';
import type { ChatMessage, FetchMessagesResult } from '@/types/message';
import { decryptMessageContent, E2E_UNDECRYPTABLE } from '@/lib/e2e/e2eService';

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
  const { isMobile, isPowerSyncAvailable, isOffline } = usePowerSync();
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [powerSyncMessages, setPowerSyncMessages] = useState<ChatMessage[] | null>(null);

  // PowerSync hooks for mobile
  const individualMessagesResult = useIndividualMessages(userId, chatId, limit, 0);
  const groupMessagesResult = useGroupMessages(chatId, userId, limit, 0);

  // Heuristic: looks like our E2E ciphertext
  const looksLikeE2eCiphertext = useCallback((content: string | null | undefined): boolean => {
    return !!content && content.length >= 20 && /^[A-Za-z0-9+/]+=*$/.test(content) && !content.startsWith('SHARED_EVENT:');
  }, []);

  // Set current user ID for message mapping
  useEffect(() => {
    MessageMappingUtils.setCurrentUserId(userId);
  }, [userId]);

  // Build decrypted messages from PowerSync whenever its data changes (mobile only)
  useEffect(() => {
    if (!isMobile || !isPowerSyncAvailable) {
      setPowerSyncMessages(null);
      return;
    }

    const source =
      chatType === 'individual'
        ? (individualMessagesResult.messages as any[])
        : (groupMessagesResult.messages as any[]);

    if (!source || source.length === 0) {
      setPowerSyncMessages(null);
      return;
    }

    let cancelled = false;

    const run = async () => {
      const ctx =
        chatType === 'individual'
          ? { type: 'individual' as const, userId, peerId: chatId }
          : { type: 'group' as const, userId, groupId: chatId };

      const mapped: ChatMessage[] = [];

      for (const msg of source) {
        let text: string = msg.content ?? '';

        if (looksLikeE2eCiphertext(text)) {
          try {
            const decrypted = await decryptMessageContent(text, 'e2e', ctx);
            text = decrypted === E2E_UNDECRYPTABLE ? 'Encrypted message' : decrypted;
          } catch {
            text = 'Encrypted message';
          }
        }

        mapped.push({
          _id: msg.id,
          text,
          createdAt: new Date(msg.created_at),
          user: {
            _id: msg.sender_id,
            name: msg.sender_name,
            avatar: msg.sender_profile_picture,
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
          isSeen: Boolean(msg.is_seen),
          seenAt: msg.seen_at ? new Date(msg.seen_at) : null,
          seenBy: chatType === 'group' ? msg.seen_by || [] : [],
        });
      }

      if (!cancelled) {
        setPowerSyncMessages(mapped);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [
    isMobile,
    isPowerSyncAvailable,
    chatType,
    chatId,
    userId,
    individualMessagesResult.messages,
    groupMessagesResult.messages,
    looksLikeE2eCiphertext,
  ]);

  const fetchMessages = useCallback(async (offset: number = 0) => {
    if (!chatId || !userId) {
      setError('Missing required parameters');
      return;
    }

    console.log(`useMessageFetching: Fetching ${chatType} messages for user ${userId}, chat ${chatId}`);
    setLoading(true);
    setError(null);

    try {
      let result: FetchMessagesResult;

      // Check if we're offline - if so, skip Supabase fetch and rely on PowerSync data
      if (isMobile && isPowerSyncAvailable && isOffline) {
        console.log("useMessageFetching: Offline mode with PowerSync - skipping Supabase fetch, using PowerSync data");
        setLoading(false);
        return;
      }

      // Use Supabase for fetching (PowerSync data is handled by getMessages)
      if (isMobile && !isPowerSyncAvailable) {
        console.log("useMessageFetching: PowerSync disabled - using Supabase only");
      } else if (isMobile && isPowerSyncAvailable) {
        console.log("useMessageFetching: PowerSync available - using Supabase as fallback for message fetching");
      }

      // Use Supabase for fetching
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

  // Get messages based on platform
  const getMessages = useMemo(() => {
    if (isMobile && isPowerSyncAvailable) {
      // Prefer decrypted PowerSync data when available
      if (powerSyncMessages && powerSyncMessages.length > 0) {
        return powerSyncMessages;
      }
      // Fallback to Supabase-mapped messages
      console.log('🔍 PowerSync: No decrypted PowerSync data available, using Supabase fallback');
    }
    return messages;
  }, [isMobile, isPowerSyncAvailable, powerSyncMessages, messages]);

  const getIsLoading = useMemo(() => {
    if (isMobile && isPowerSyncAvailable) {
      // Use PowerSync loading state if available, otherwise Supabase
      if (chatType === 'individual') {
        return individualMessagesResult.loading || loading;
      } else {
        return groupMessagesResult.loading || loading;
      }
    }
    return loading;
  }, [isMobile, isPowerSyncAvailable, chatType, individualMessagesResult.loading, groupMessagesResult.loading, loading]);

  const getError = useMemo(() => {
    if (isMobile && isPowerSyncAvailable) {
      // Use PowerSync error state if available, otherwise Supabase
      if (chatType === 'individual') {
        return individualMessagesResult.error || error;
      } else {
        return groupMessagesResult.error || error;
      }
    }
    return error;
  }, [isMobile, isPowerSyncAvailable, chatType, individualMessagesResult.error, groupMessagesResult.error, error]);

  // Auto-fetch on mount and when dependencies change
  useEffect(() => {
    if (autoFetch && !isInitialized && !loading) {
      console.log(`useMessageFetching: Auto-fetching messages for ${chatType} chat ${chatId}`);
      fetchMessages(0);
    }
  }, [autoFetch, isInitialized, chatId, chatType, userId]);

  // Handle PowerSync data changes
  useEffect(() => {
    if (isMobile && isPowerSyncAvailable && !loading) {
      const powerSyncMessages = chatType === 'individual' 
        ? individualMessagesResult.messages 
        : groupMessagesResult.messages;
      
      if (powerSyncMessages && powerSyncMessages.length > 0) {
        console.log(`useMessageFetching: PowerSync data available (${powerSyncMessages.length} messages), skipping Supabase fetch`);
        setLoading(false);
        setIsInitialized(true);
      }
    }
  }, [isMobile, isPowerSyncAvailable, chatType, individualMessagesResult.messages, groupMessagesResult.messages, loading]); // Removed fetchMessages from dependencies

  // Clear messages when chat changes (but not on initial mount)
  // Note: We don't need to clear messages here since the hook is recreated for each chat
  // The hook state is naturally reset when navigating to a different chat

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