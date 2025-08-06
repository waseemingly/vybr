import { supabase } from '@/lib/supabase';
import type { 
  ChatMessage, 
  DbMessage, 
  DbGroupMessage, 
  UserProfileInfo, 
  SharedEvent 
} from '@/types/message';

// User profile cache to avoid repeated database calls
const userProfileCache: Record<string, { name?: string; avatar?: string }> = {};
let currentUserId: string | undefined;

export class MessageMappingUtils {
  /**
   * Map database message to UI message format for individual chats
   */
  static mapDbMessageToChatMessage(
    dbMessage: DbMessage, 
    currentUserId: string,
    partnerName: string = 'User'
  ): ChatMessage {
    let sharedEventInfo: ChatMessage['sharedEvent'] = null;
    const rawContent = dbMessage.content ?? '';
    let displayText = rawContent;

    // Parse shared event content
    if (rawContent.startsWith('SHARED_EVENT:')) {
      try {
        const parts = rawContent.split(':');
        if (parts.length >= 3) {
          const eventId = parts[1];
          const detailsString = parts.slice(2).join(':');
          let eventName = detailsString;
          let eventDate = 'N/A';
          let eventVenue = 'N/A';

          const onSeparator = ' on ';
          const atSeparator = ' at ';

          const atIndex = detailsString.lastIndexOf(atSeparator);
          if (atIndex !== -1) {
            eventVenue = detailsString.substring(atIndex + atSeparator.length);
            eventName = detailsString.substring(0, atIndex);
          }

          const onIndex = eventName.lastIndexOf(onSeparator);
          if (onIndex !== -1) {
            eventDate = eventName.substring(onIndex + onSeparator.length);
            eventName = eventName.substring(0, onIndex);
          }

          // Check metadata for stored event image and datetime
          let eventImage = 'https://picsum.photos/800/450?random=1'; // Default event image
          let eventDateTime: string | null = null;
          if (dbMessage.metadata && typeof dbMessage.metadata === 'object' && dbMessage.metadata.shared_event) {
            const metadataEvent = dbMessage.metadata.shared_event as any;
            if (metadataEvent.eventImage) {
              eventImage = metadataEvent.eventImage;
            }
            if (metadataEvent.eventDateTime) {
              eventDateTime = metadataEvent.eventDateTime;
            }
          }

          sharedEventInfo = {
            eventId: eventId,
            eventTitle: eventName.trim(),
            eventDate: eventDate.trim(),
            eventVenue: eventVenue.trim(),
            eventImage: eventImage,
            eventDateTime: eventDateTime,
          };

          // Show proper sender name for individual chats
          const displayName = dbMessage.sender_id === currentUserId ? 'You' : partnerName;
          displayText = `${displayName} shared an event`;
        } else {
          console.warn("SHARED_EVENT string has invalid format:", rawContent);
          displayText = "Shared an event";
          sharedEventInfo = {
            eventId: "unknown",
            eventTitle: "Event",
            eventDate: "N/A",
            eventVenue: "N/A",
            eventImage: 'https://picsum.photos/800/450?random=1',
          };
        }
      } catch (e) {
        console.error("Failed to parse shared event content:", rawContent, e);
        displayText = "Shared an event";
        sharedEventInfo = {
          eventId: "unknown",
          eventTitle: "Event",
          eventDate: "N/A",
          eventVenue: "N/A",
          eventImage: 'https://picsum.photos/800/450?random=1',
        };
      }
    }

    return {
      _id: dbMessage.id,
      text: displayText,
      createdAt: new Date(dbMessage.created_at),
      user: { 
        _id: dbMessage.sender_id,
        name: dbMessage.sender_id === currentUserId ? 'You' : partnerName,
        avatar: undefined
      },
      image: dbMessage.image_url || null,
      isSystemMessage: false,
      sharedEvent: sharedEventInfo,
      originalContent: dbMessage.original_content,
      isEdited: dbMessage.is_edited,
      editedAt: dbMessage.edited_at ? new Date(dbMessage.edited_at) : null,
      isDeleted: dbMessage.is_deleted,
      deletedAt: dbMessage.deleted_at ? new Date(dbMessage.deleted_at) : null,
      replyToMessageId: dbMessage.reply_to_message_id,
      isDelivered: dbMessage.is_delivered,
      deliveredAt: dbMessage.delivered_at ? new Date(dbMessage.delivered_at) : null,
      isSeen: dbMessage.is_seen,
      seenAt: dbMessage.seen_at ? new Date(dbMessage.seen_at) : null,
    };
  }

  /**
   * Map database group message to UI message format
   */
  static mapGroupDbMessageToChatMessage(
    dbMessage: DbGroupMessage, 
    profilesMap: Map<string, UserProfileInfo>
  ): ChatMessage {
    let senderName = 'User';
    let senderAvatar: string | undefined = undefined;

    // Get sender info from cache or profiles map
    if (dbMessage.sender_id) {
      const cachedProfile = userProfileCache[dbMessage.sender_id];
      if (cachedProfile) {
        senderName = cachedProfile.name || 'User';
        senderAvatar = cachedProfile.avatar;
      } else {
        const profile = profilesMap.get(dbMessage.sender_id);
        if (profile) {
          senderName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'User';
          senderAvatar = profile.profile_picture || undefined;
          if (!dbMessage.is_system_message) {
            userProfileCache[dbMessage.sender_id] = { name: senderName, avatar: senderAvatar };
          }
        }
      }
    }

    let sharedEventInfo: ChatMessage['sharedEvent'] = null;
    const rawContent = dbMessage.content ?? '';
    let displayText = rawContent;

    // Parse shared event content for group messages
    if (rawContent.startsWith('SHARED_EVENT:')) {
      try {
        const parts = rawContent.split(':');
        if (parts.length >= 3) {
          const eventId = parts[1];
          const detailsString = parts.slice(2).join(':');

          let eventName = detailsString;
          let eventDate = 'N/A';
          let eventVenue = 'N/A';

          const onSeparator = ' on ';
          const atSeparator = ' at ';

          const atIndex = detailsString.lastIndexOf(atSeparator);
          if (atIndex !== -1) {
            eventVenue = detailsString.substring(atIndex + atSeparator.length);
            eventName = detailsString.substring(0, atIndex);
          }

          const onIndex = eventName.lastIndexOf(onSeparator);
          if (onIndex !== -1) {
            eventDate = eventName.substring(onIndex + onSeparator.length);
            eventName = eventName.substring(0, onIndex);
          }

          // Check metadata for stored event image first
          let eventImage = 'https://picsum.photos/800/450?random=1';
          let eventDateTime: string | null = null;
          if (dbMessage.metadata && typeof dbMessage.metadata === 'object' && (dbMessage.metadata as any).shared_event) {
            const metadataEvent = (dbMessage.metadata as any).shared_event;
            if (metadataEvent.eventImage) {
              eventImage = metadataEvent.eventImage;
            }
            if (metadataEvent.eventDateTime) {
              eventDateTime = metadataEvent.eventDateTime;
            }
          }

          sharedEventInfo = {
            eventId: eventId,
            eventTitle: eventName.trim(),
            eventDate: eventDate.trim(),
            eventVenue: eventVenue.trim(),
            eventImage: eventImage,
            eventDateTime: eventDateTime,
          };

          // Show proper user name in the display text
          const displayName = dbMessage.sender_id === currentUserId ? 'You' : senderName;
          displayText = `${displayName} shared an event`;
        } else {
          console.warn("SHARED_EVENT string has too few parts:", rawContent);
        }
      } catch (e) {
        console.error("Failed to parse shared event content:", rawContent, e);
      }
    }

    return {
      _id: dbMessage.id,
      text: displayText,
      createdAt: new Date(dbMessage.created_at),
      user: { 
        _id: dbMessage.sender_id || 'system', 
        name: dbMessage.sender_id === currentUserId ? 'You' : senderName, 
        avatar: dbMessage.sender_id === currentUserId ? undefined : senderAvatar 
      },
      image: dbMessage.image_url,
      isSystemMessage: dbMessage.is_system_message,
      sharedEvent: sharedEventInfo,
      originalContent: dbMessage.original_content,
      isEdited: dbMessage.is_edited,
      editedAt: dbMessage.edited_at ? new Date(dbMessage.edited_at) : null,
      isDeleted: dbMessage.is_deleted,
      deletedAt: dbMessage.deleted_at ? new Date(dbMessage.deleted_at) : null,
      replyToMessageId: dbMessage.reply_to_message_id,
      isDelivered: false,
      deliveredAt: null,
      isSeen: false,
      seenAt: null,
      seenBy: [],
    };
  }

  /**
   * Enhance shared events with missing eventDateTime (for older messages)
   */
  static async enhanceSharedEventsWithDateTime(messages: ChatMessage[]): Promise<ChatMessage[]> {
    const messagesToEnhance = messages.filter(msg =>
      msg.sharedEvent &&
      !msg.sharedEvent.eventDateTime &&
      msg.sharedEvent.eventId &&
      msg.sharedEvent.eventId !== 'unknown'
    );

    if (messagesToEnhance.length === 0) {
      return messages;
    }

    console.log(`[DEBUG] Enhancing ${messagesToEnhance.length} shared event messages with missing eventDateTime`);

    // Fetch event data for all messages that need enhancement
    const eventIds = messagesToEnhance.map(msg => msg.sharedEvent!.eventId);
    const uniqueEventIds = [...new Set(eventIds)];

    try {
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('id, event_datetime, poster_urls')
        .in('id', uniqueEventIds);

      if (eventsError) {
        console.warn('[DEBUG] Error fetching event data for enhancement:', eventsError.message);
        return messages;
      }

      if (!eventsData || eventsData.length === 0) {
        console.warn('[DEBUG] No event data found for enhancement');
        return messages;
      }

      // Create a map of event data
      const eventDataMap = new Map(eventsData.map(event => [event.id, event]));

      // Enhance messages with fetched event data
      const enhancedMessages = messages.map(msg => {
        if (msg.sharedEvent && !msg.sharedEvent.eventDateTime && msg.sharedEvent.eventId !== 'unknown') {
          const eventData = eventDataMap.get(msg.sharedEvent.eventId);
          if (eventData) {
            console.log(`[DEBUG] Enhanced message ${msg._id} with eventDateTime: ${eventData.event_datetime}`);
            return {
              ...msg,
              sharedEvent: {
                ...msg.sharedEvent,
                eventDateTime: eventData.event_datetime,
                // Also update image if needed
                eventImage: (eventData.poster_urls && eventData.poster_urls.length > 0)
                  ? eventData.poster_urls[0]
                  : msg.sharedEvent.eventImage
              }
            };
          }
        }
        return msg;
      });

      return enhancedMessages;
    } catch (error) {
      console.warn('[DEBUG] Exception during event enhancement:', error);
      return messages;
    }
  }

  /**
   * Create reply message preview
   */
  static createReplyPreview(
    repliedMessage: ChatMessage,
    currentUserId?: string
  ): ChatMessage['replyToMessagePreview'] {
    if (!repliedMessage) return null;

    return {
      text: repliedMessage.image ? '[Image]' : repliedMessage.text,
      senderName: repliedMessage.user._id === currentUserId ? 'You' : repliedMessage.user.name || 'User',
      image: repliedMessage.image
    };
  }

  /**
   * Clear user profile cache
   */
  static clearUserProfileCache(): void {
    Object.keys(userProfileCache).forEach(key => {
      delete userProfileCache[key];
    });
  }

  /**
   * Set current user ID for cache management
   */
  static setCurrentUserId(userId: string): void {
    currentUserId = userId;
  }
} 