import type { ChatMessage, SharedEvent } from '@/types/message';

export class MessageUtils {
  /**
   * Format time for message display
   */
  static formatTime(date: Date | string | number): string {
    try {
      const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
      if (!dateObj || isNaN(dateObj.getTime())) return '--:--';
      return dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      console.warn("Format time error:", date, e);
      return '--:--';
    }
  }

  /**
   * Format timestamp for chat list preview
   */
  static formatTimestamp(timestamp: string | null): string {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMinutes < 1) return 'now';
      if (diffMinutes < 60) return `${diffMinutes}m`;
      if (diffHours < 24) return `${diffHours}h`;
      if (diffDays < 7) return `${diffDays}d`;
      
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  }

  /**
   * Format last message for chat list preview
   */
  static formatLastMessageForPreview(
    messageContent: string | null, 
    senderId: string | undefined, 
    currentUserId: string | undefined, 
    senderName: string | undefined,
    isGroupChat: boolean = false
  ): string {
    if (!messageContent) return '';
    
    if (messageContent.startsWith('SHARED_EVENT:')) {
      if (senderId === currentUserId) {
        return 'You shared an event';
      } else {
        if (senderName) {
          return `${senderName} shared an event`;
        } else {
          return 'Someone shared an event';
        }
      }
    }
    
    return messageContent;
  }

  /**
   * Check if event is over based on date string
   */
  static isEventOver(eventDateString: string): boolean {
    try {
      console.log('[DEBUG] Checking if event is over, date string:', eventDateString);
      
      // First, try direct parsing
      let eventDate = new Date(eventDateString);
      const now = new Date();
      
      // If direct parsing failed, try other formats
      if (isNaN(eventDate.getTime())) {
        // Try to parse common date formats manually
        const dateFormats = [
          eventDateString, // Original format
          eventDateString.replace(/(\d+)(st|nd|rd|th)/, '$1'), // Remove ordinal suffixes
          // Handle formats like "Dec 15, 2024" or "December 15, 2024"
          eventDateString.replace(/(\w+)\s+(\d+),?\s+(\d{4})/, '$1 $2, $3'),
          // Handle formats like "Dec 15" (assume current year)
          eventDateString.includes(',') ? eventDateString : `${eventDateString}, ${new Date().getFullYear()}`,
        ];
        
        for (const format of dateFormats) {
          const parsed = new Date(format);
          console.log('[DEBUG] Trying format:', format, 'Result:', parsed.toISOString(), 'Valid:', !isNaN(parsed.getTime()));
          if (!isNaN(parsed.getTime())) {
            eventDate = parsed;
            break;
          }
        }
        
        // If still couldn't parse, assume event is not over
        if (isNaN(eventDate.getTime())) {
          console.log('[DEBUG] Could not parse event date, assuming not over:', eventDateString);
          return false;
        }
      }
      
      const isOver = eventDate < now;
      console.log('[DEBUG] Event date:', eventDate.toISOString(), 'Now:', now.toISOString(), 'Is over:', isOver);
      return isOver;
    } catch (e) {
      console.warn('Error checking if event is over:', e);
      return false;
    }
  }

  /**
   * Check if shared event is over
   */
  static isSharedEventOver(sharedEvent: SharedEvent): boolean {
    if (!sharedEvent) return false;
    
    // Use eventDateTime if available (more accurate) - this should be the primary method
    if (sharedEvent.eventDateTime) {
      try {
        const eventDate = new Date(sharedEvent.eventDateTime);
        const now = new Date();
        
        // Validate the parsed date
        if (isNaN(eventDate.getTime())) {
          console.warn('Invalid eventDateTime:', sharedEvent.eventDateTime);
        } else {
          const isOver = eventDate < now;
          console.log('[DEBUG] Using eventDateTime:', sharedEvent.eventDateTime, 'Is over:', isOver);
          return isOver;
        }
      } catch (e) {
        console.warn('Error parsing eventDateTime:', sharedEvent.eventDateTime, e);
      }
    }
    
    // Fallback to eventDate string parsing (less reliable due to formatting issues)
    if (sharedEvent.eventDate) {
      console.log('[DEBUG] Falling back to eventDate string parsing for:', sharedEvent.eventDate);
      return this.isEventOver(sharedEvent.eventDate);
    }
    
    return false;
  }

  /**
   * Format event date and time for modal display
   */
  static formatEventDateTimeForModal(isoString: string | null): { date: string; time: string } {
    if (!isoString) return { date: "N/A", time: "N/A" };
    try {
      const d = new Date(isoString);
      const datePart = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'long' });
      const timePart = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
      return { date: datePart, time: timePart };
    } catch (e) { 
      return { date: "Invalid Date", time: "" }; 
    }
  }

  /**
   * Generate a temporary message ID
   */
  static generateTempId(type: 'text' | 'image' | 'event' = 'text'): string {
    return `temp_${type}_${Date.now()}`;
  }

  /**
   * Check if a message ID is temporary
   */
  static isTempId(messageId: string): boolean {
    return messageId.startsWith('temp_');
  }

  /**
   * Get message type from content
   */
  static getMessageType(message: ChatMessage): 'text' | 'image' | 'event' | 'system' | 'deleted' {
    if (message.isSystemMessage) return 'system';
    if (message.isDeleted) return 'deleted';
    if (message.sharedEvent) return 'event';
    if (message.image) return 'image';
    return 'text';
  }

  /**
   * Get display text for message
   */
  static getDisplayText(message: ChatMessage, currentUserId?: string): string {
    if (message.isSystemMessage) return message.text;
    if (message.isDeleted) return 'This message was deleted';
    if (message.sharedEvent) {
      const displayName = message.user._id === currentUserId ? 'You' : message.user.name || 'User';
      return `${displayName} shared an event`;
    }
    if (message.image) return message.text || '[Image]';
    return message.text;
  }

  /**
   * Check if message is from current user
   */
  static isFromCurrentUser(message: ChatMessage, currentUserId?: string): boolean {
    return message.user._id === currentUserId;
  }

  /**
   * Check if message is seen by current user
   */
  static isSeenByCurrentUser(message: ChatMessage, currentUserId?: string): boolean {
    if (!currentUserId) return false;
    
    if (this.isFromCurrentUser(message, currentUserId)) {
      // For sender's messages, check if others have seen it
      return (message.seenBy || []).some(seen => seen.userId !== currentUserId);
    } else {
      // For received messages, check if current user has seen it
      return message.isSeen || false;
    }
  }

  /**
   * Get seen count for message (excluding sender)
   */
  static getSeenCount(message: ChatMessage, currentUserId?: string): number {
    if (!message.seenBy) return 0;
    return message.seenBy.filter(seen => seen.userId !== message.user._id).length;
  }

  /**
   * Get seen text for message
   */
  static getSeenText(message: ChatMessage, currentUserId?: string): string | null {
    const seenCount = this.getSeenCount(message, currentUserId);
    if (seenCount === 0) return null;
    return `Seen by ${seenCount}`;
  }
} 