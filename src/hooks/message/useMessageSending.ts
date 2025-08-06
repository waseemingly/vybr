import { useState, useCallback } from 'react';
import { MessageSendingService } from '@/services/message/MessageSendingService';
import { MessageUtils } from '@/utils/message/MessageUtils';
import type { SendMessageOptions, MessageResult, ChatMessage } from '@/types/message';

interface UseMessageSendingOptions {
  chatType: 'individual' | 'group';
  chatId: string;
  senderId: string;
  onMessageSent?: (message: ChatMessage) => void;
  onMessageFailed?: (tempId: string, error: string) => void;
}

interface UseMessageSendingReturn {
  sending: boolean;
  sendTextMessage: (content: string, replyToMessageId?: string) => Promise<MessageResult>;
  sendImageMessage: (imageUrl: string, replyToMessageId?: string) => Promise<MessageResult>;
  shareEvent: (eventData: any, replyToMessageId?: string) => Promise<MessageResult>;
}

export const useMessageSending = (options: UseMessageSendingOptions): UseMessageSendingReturn => {
  const { chatType, chatId, senderId, onMessageSent, onMessageFailed } = options;
  
  const [sending, setSending] = useState(false);

  const sendTextMessage = useCallback(async (content: string, replyToMessageId?: string): Promise<MessageResult> => {
    if (!content?.trim()) {
      return { success: false, error: 'Message content is required' };
    }

    setSending(true);

    try {
      const sendOptions: SendMessageOptions = {
        chatType,
        senderId,
        content: content.trim(),
        replyToMessageId,
        ...(chatType === 'individual' ? { receiverId: chatId } : { groupId: chatId })
      };

      const result = await MessageSendingService.sendTextMessage(sendOptions);

      if (result.success && onMessageSent) {
        // Create optimistic message for UI
        const optimisticMessage: ChatMessage = {
          _id: result.tempId || result.messageId || '',
          text: content.trim(),
          createdAt: new Date(),
          user: { _id: senderId, name: 'You', avatar: undefined },
          image: null,
          isSystemMessage: false,
          replyToMessageId: replyToMessageId || null,
          isDelivered: true,
          deliveredAt: new Date(),
          isSeen: false,
          seenAt: null,
          seenBy: [],
        };

        onMessageSent(optimisticMessage);
      } else if (!result.success && onMessageFailed && result.tempId) {
        onMessageFailed(result.tempId, result.error || 'Failed to send message');
      }

      return result;
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to send message';
      console.error('[useMessageSending] Error sending text message:', error);
      return { success: false, error: errorMessage };
    } finally {
      setSending(false);
    }
  }, [chatType, chatId, senderId, onMessageSent, onMessageFailed]);

  const sendImageMessage = useCallback(async (imageUrl: string, replyToMessageId?: string): Promise<MessageResult> => {
    if (!imageUrl) {
      return { success: false, error: 'Image URL is required' };
    }

    setSending(true);

    try {
      const sendOptions: SendMessageOptions = {
        chatType,
        senderId,
        imageUrl,
        replyToMessageId,
        ...(chatType === 'individual' ? { receiverId: chatId } : { groupId: chatId })
      };

      const result = await MessageSendingService.sendImageMessage(sendOptions);

      if (result.success && onMessageSent) {
        // Create optimistic message for UI
        const optimisticMessage: ChatMessage = {
          _id: result.tempId || result.messageId || '',
          text: '',
          createdAt: new Date(),
          user: { _id: senderId, name: 'You', avatar: undefined },
          image: imageUrl,
          isSystemMessage: false,
          replyToMessageId: replyToMessageId || null,
          isDelivered: true,
          deliveredAt: new Date(),
          isSeen: false,
          seenAt: null,
          seenBy: [],
        };

        onMessageSent(optimisticMessage);
      } else if (!result.success && onMessageFailed && result.tempId) {
        onMessageFailed(result.tempId, result.error || 'Failed to send image');
      }

      return result;
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to send image';
      console.error('[useMessageSending] Error sending image message:', error);
      return { success: false, error: errorMessage };
    } finally {
      setSending(false);
    }
  }, [chatType, chatId, senderId, onMessageSent, onMessageFailed]);

  const shareEvent = useCallback(async (eventData: any, replyToMessageId?: string): Promise<MessageResult> => {
    if (!eventData) {
      return { success: false, error: 'Event data is required' };
    }

    setSending(true);

    try {
      const sendOptions: SendMessageOptions = {
        chatType,
        senderId,
        metadata: { shared_event: eventData },
        replyToMessageId,
        ...(chatType === 'individual' ? { receiverId: chatId } : { groupId: chatId })
      };

      const result = await MessageSendingService.shareEvent(sendOptions);

      if (result.success && onMessageSent) {
        // Create optimistic message for UI
        const optimisticMessage: ChatMessage = {
          _id: result.tempId || result.messageId || '',
          text: 'You shared an event',
          createdAt: new Date(),
          user: { _id: senderId, name: 'You', avatar: undefined },
          image: null,
          isSystemMessage: false,
          sharedEvent: eventData,
          replyToMessageId: replyToMessageId || null,
          isDelivered: true,
          deliveredAt: new Date(),
          isSeen: false,
          seenAt: null,
          seenBy: [],
        };

        onMessageSent(optimisticMessage);
      } else if (!result.success && onMessageFailed && result.tempId) {
        onMessageFailed(result.tempId, result.error || 'Failed to share event');
      }

      return result;
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to share event';
      console.error('[useMessageSending] Error sharing event:', error);
      return { success: false, error: errorMessage };
    } finally {
      setSending(false);
    }
  }, [chatType, chatId, senderId, onMessageSent, onMessageFailed]);

  return {
    sending,
    sendTextMessage,
    sendImageMessage,
    shareEvent,
  };
}; 