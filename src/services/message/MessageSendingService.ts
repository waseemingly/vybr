import { supabase } from '@/lib/supabase';
import { MessageUtils } from '@/utils/message/MessageUtils';
import { MessageMappingUtils } from '@/utils/message/MessageMappingUtils';
import type { SendMessageOptions, MessageResult, ChatMessage } from '@/types/message';
import { v4 as uuidv4 } from 'uuid';
import { ensureUserKeyPair, encryptMessageContent, CONTENT_FORMAT_PLAIN } from '@/lib/e2e/e2eService';

export class MessageSendingService {
  /**
   * Send text message with optimistic updates
   */
  static async sendTextMessage(options: SendMessageOptions): Promise<MessageResult> {
    const { chatType, receiverId, groupId, senderId, content, replyToMessageId, metadata } = options;
    
    if (!content?.trim()) {
      return { success: false, error: 'Message content is required' };
    }
    
    const tempId = MessageUtils.generateTempId('text');
    const trimmedContent = content.trim();
    
    try {
      console.warn(`[E2E SEND] Starting send — chatType=${chatType} senderId=${senderId?.slice(0, 8)}... receiverId=${receiverId?.slice(0, 8)}...`);

      // E2E only for individual chat; group chat stays plain
      let contentToStore = trimmedContent;
      let contentFormat = CONTENT_FORMAT_PLAIN;
      if (chatType === 'individual') {
        const keyOk = await ensureUserKeyPair(senderId);
        console.warn('[E2E SEND] ensureUserKeyPair:', keyOk ? 'OK' : 'FAILED');
        const context = { type: 'individual' as const, userId: senderId, peerId: receiverId! };
        const e2eResult = await encryptMessageContent(trimmedContent, context);
        if (e2eResult) {
          contentToStore = e2eResult.ciphertext;
          contentFormat = e2eResult.contentFormat;
        }
      }

      // Create optimistic message (show plaintext to sender)
      const optimisticMessage: ChatMessage = {
        _id: tempId,
        text: trimmedContent,
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

      // Send to database (ciphertext if E2E)
      let insertData: any = {
        sender_id: senderId,
        content: contentToStore,
        content_format: contentFormat,
        reply_to_message_id: replyToMessageId || null,
        metadata: metadata || null,
      };

      if (chatType === 'individual') {
        insertData.receiver_id = receiverId;
      } else {
        insertData.group_id = groupId;
      }

      const { data: insertedData, error: insertError } = await supabase
        .from(chatType === 'individual' ? 'messages' : 'group_chat_messages')
        .insert(insertData)
        .select('*')
        .single();

      if (insertError) {
        console.error('[MessageSendingService] Database insert error:', insertError);
        return { success: false, error: insertError.message, tempId };
      }

      if (!insertedData) {
        return { success: false, error: 'No confirmation from database', tempId };
      }

      // Create message status entries for group messages
      if (chatType === 'group' && groupId) {
        await this.createGroupMessageStatusEntries(insertedData.id, groupId, senderId);
      }

      // Create message status entry for individual messages
      if (chatType === 'individual' && receiverId) {
        await this.createIndividualMessageStatusEntry(insertedData.id, receiverId);
      }

      console.log(`[MessageSendingService] Successfully sent message with ID: ${insertedData.id}`);
      
      return { 
        success: true, 
        messageId: insertedData.id, 
        tempId 
      };
      
    } catch (error: any) {
      console.error('[MessageSendingService] Exception sending text message:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to send message', 
        tempId 
      };
    }
  }

  /**
   * Send image message with optimistic updates
   */
  static async sendImageMessage(options: SendMessageOptions): Promise<MessageResult> {
    const { chatType, receiverId, groupId, senderId, imageUrl, replyToMessageId } = options;
    
    if (!imageUrl) {
      return { success: false, error: 'Image URL is required' };
    }
    
    const tempId = MessageUtils.generateTempId('image');
    
    try {
      console.log(`[MessageSendingService] Sending ${chatType} image message with tempId: ${tempId}`);
      
      // Create optimistic message
      const optimisticMessage: ChatMessage = {
        _id: tempId,
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

      // Send to database
      let insertData: any = {
        sender_id: senderId,
        content: '[Image]',
        image_url: imageUrl,
        reply_to_message_id: replyToMessageId || null,
      };

      if (chatType === 'individual') {
        insertData.receiver_id = receiverId;
      } else {
        insertData.group_id = groupId;
      }

      const { data: insertedData, error: insertError } = await supabase
        .from(chatType === 'individual' ? 'messages' : 'group_chat_messages')
        .insert(insertData)
        .select('id, created_at, image_url')
        .single();

      if (insertError) {
        console.error('[MessageSendingService] Database insert error for image:', insertError);
        return { success: false, error: insertError.message, tempId };
      }

      if (!insertedData) {
        return { success: false, error: 'No confirmation from database', tempId };
      }

      // Create message status entries for group messages
      if (chatType === 'group' && groupId) {
        await this.createGroupMessageStatusEntries(insertedData.id, groupId, senderId);
      }

      // Create message status entry for individual messages
      if (chatType === 'individual' && receiverId) {
        await this.createIndividualMessageStatusEntry(insertedData.id, receiverId);
      }

      console.log(`[MessageSendingService] Successfully sent image message with ID: ${insertedData.id}`);
      
      return { 
        success: true, 
        messageId: insertedData.id, 
        tempId 
      };
      
    } catch (error: any) {
      console.error('[MessageSendingService] Exception sending image message:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to send image', 
        tempId 
      };
    }
  }

  /**
   * Share event message
   */
  static async shareEvent(options: SendMessageOptions): Promise<MessageResult> {
    const { chatType, receiverId, groupId, senderId, metadata, replyToMessageId } = options;
    
    if (!metadata?.shared_event) {
      return { success: false, error: 'Event data is required' };
    }
    
    const tempId = MessageUtils.generateTempId('event');
    const eventData = metadata.shared_event;
    
    try {
      console.log(`[MessageSendingService] Sharing event to ${chatType} with tempId: ${tempId}`);
      
      // Create formatted content for the message
      const formattedContent = `SHARED_EVENT:${eventData.eventId}:${eventData.eventTitle} on ${eventData.eventDate} at ${eventData.eventVenue}`;
      
      // Create optimistic message
      const optimisticMessage: ChatMessage = {
        _id: tempId,
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

      // Send to database
      let insertData: any = {
        sender_id: senderId,
        content: formattedContent,
        reply_to_message_id: replyToMessageId || null,
        metadata: { shared_event: eventData },
      };

      if (chatType === 'individual') {
        insertData.receiver_id = receiverId;
      } else {
        insertData.group_id = groupId;
      }

      const { data: insertedData, error: insertError } = await supabase
        .from(chatType === 'individual' ? 'messages' : 'group_chat_messages')
        .insert(insertData)
        .select('id, created_at')
        .single();

      if (insertError) {
        console.error('[MessageSendingService] Database insert error for event share:', insertError);
        return { success: false, error: insertError.message, tempId };
      }

      if (!insertedData) {
        return { success: false, error: 'No confirmation from database', tempId };
      }

      // Create message status entries for group messages
      if (chatType === 'group' && groupId) {
        await this.createGroupMessageStatusEntries(insertedData.id, groupId, senderId);
      }

      // Create message status entry for individual messages
      if (chatType === 'individual' && receiverId) {
        await this.createIndividualMessageStatusEntry(insertedData.id, receiverId);
      }

      // Log event impression
      await this.logEventImpression(eventData.eventId, senderId, `${chatType}_chat_share`);

      console.log(`[MessageSendingService] Successfully shared event with message ID: ${insertedData.id}`);
      
      return { 
        success: true, 
        messageId: insertedData.id, 
        tempId 
      };
      
    } catch (error: any) {
      console.error('[MessageSendingService] Exception sharing event:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to share event', 
        tempId 
      };
    }
  }

  /**
   * Create group message status entries for all group members except sender
   */
  private static async createGroupMessageStatusEntries(
    messageId: string, 
    groupId: string, 
    senderId: string
  ): Promise<void> {
    try {
      // Get group members
      const { data: groupInfo, error: groupError } = await supabase.rpc('get_group_info', { 
        group_id_input: groupId 
      });

      if (groupError) {
        console.warn('[MessageSendingService] Error getting group info for status entries:', groupError);
        return;
      }

      if (groupInfo?.participants) {
                 const membersToCreateStatusFor = groupInfo.participants
           .filter((p: { user_id: string }) => p.user_id !== senderId)
           .map((p: { user_id: string }) => p.user_id);

                 if (membersToCreateStatusFor.length > 0) {
           const statusEntries = membersToCreateStatusFor.map((userId: string) => ({
             message_id: messageId,
             user_id: userId,
             group_id: groupId,
             is_delivered: false,
             is_seen: false
           }));

          const { error: statusError } = await supabase
            .from('group_message_status')
            .insert(statusEntries);

          if (statusError) {
            console.warn('[MessageSendingService] Failed to create group message status entries:', statusError);
          }
        }
      }
    } catch (error) {
      console.warn('[MessageSendingService] Exception creating group message status entries:', error);
    }
  }

  /**
   * Create individual message status entry for receiver
   */
  private static async createIndividualMessageStatusEntry(
    messageId: string, 
    receiverId: string
  ): Promise<void> {
    try {
      const { error } = await supabase.rpc('create_message_status_entry', {
        message_id_input: messageId,
        receiver_id_input: receiverId
      });

      if (error) {
        console.warn('[MessageSendingService] Failed to create individual message status entry:', error);
      }
    } catch (error) {
      console.warn('[MessageSendingService] Exception creating individual message status entry:', error);
    }
  }

  /**
   * Log event impression
   */
  private static async logEventImpression(
    eventId: string, 
    userId: string, 
    source: string
  ): Promise<void> {
    try {
      await supabase.from('event_impressions').insert({
        event_id: eventId,
        user_id: userId,
        source: source,
        viewed_at: new Date().toISOString()
      });
    } catch (error) {
      console.warn('[MessageSendingService] Failed to log event impression:', error);
      // Don't fail the whole operation for impression logging
    }
  }
} 