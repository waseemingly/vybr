// Message Types
export interface DbMessage {
  id: string;
  created_at: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  image_url?: string | null;
  metadata?: {
    shared_event?: {
      eventId: string;
      eventTitle: string;
      eventDate: string;
      eventVenue: string;
      eventImage: string;
      eventDateTime?: string;
    };
  } | null;
  original_content?: string | null;
  is_edited?: boolean;
  edited_at?: string | null;
  is_deleted?: boolean;
  deleted_at?: string | null;
  reply_to_message_id?: string | null;
  is_delivered?: boolean;
  delivered_at?: string | null;
  is_seen?: boolean;
  seen_at?: string | null;
}

export interface DbGroupMessage {
  id: string;
  created_at: string;
  sender_id: string;
  group_id: string;
  content: string | null;
  image_url: string | null;
  is_system_message: boolean;
  metadata?: any;
  original_content?: string | null;
  is_edited?: boolean;
  edited_at?: string | null;
  is_deleted?: boolean;
  deleted_at?: string | null;
  reply_to_message_id?: string | null;
}

export interface ChatMessage {
  _id: string;
  text: string;
  createdAt: Date;
  user: { 
    _id: string; 
    name?: string; 
    avatar?: string; 
  };
  image?: string | null;
  isSystemMessage: boolean;
  sharedEvent?: {
    eventId: string;
    eventTitle: string;
    eventDate: string;
    eventVenue: string;
    eventImage: string;
    eventDateTime?: string | null;
  } | null;
  originalContent?: string | null;
  isEdited?: boolean;
  editedAt?: Date | null;
  isDeleted?: boolean;
  deletedAt?: Date | null;
  replyToMessageId?: string | null;
  replyToMessagePreview?: {
    text?: string | null;
    senderName?: string | null;
    image?: string | null;
  } | null;
  isDelivered?: boolean;
  deliveredAt?: Date | null;
  isSeen?: boolean;
  seenAt?: Date | null;
  seenBy?: {
    userId: string;
    userName: string;
    seenAt: Date;
  }[];
}

export interface UserProfileInfo {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  profile_picture: string | null;
}

export interface SharedEvent {
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventVenue: string;
  eventImage: string;
  eventDateTime?: string | null;
}

// Message Service Types
export interface SendMessageOptions {
  chatType: 'individual' | 'group';
  receiverId?: string;
  groupId?: string;
  senderId: string;
  content?: string;
  imageUrl?: string;
  replyToMessageId?: string;
  metadata?: any;
}

export interface MessageResult {
  success: boolean;
  messageId?: string;
  tempId?: string;
  error?: string;
}

export interface FetchMessagesResult {
  messages: ChatMessage[];
  hasMore: boolean;
  error?: string;
}

export interface MessageQueryParams {
  chatType: 'individual' | 'group';
  chatId: string;
  userId: string;
  limit?: number;
  offset?: number;
}

// Chat List Types
export interface IndividualChatListItem {
  partner_user_id: string;
  last_message_content: string | null;
  last_message_created_at: string;
  last_message_sender_id?: string;
  last_message_sender_name?: string;
  partner_first_name: string | null;
  partner_last_name: string | null;
  partner_profile_picture: string | null;
  current_user_sent_any_message: boolean;
  partner_sent_any_message: boolean;
  partner_profile_id?: string;
  unread_count?: number;
  isPinned?: boolean;
}

export interface GroupChatListItem {
  group_id: string;
  group_name: string | null;
  group_image: string | null;
  last_message_content: string | null;
  last_message_created_at: string | null;
  last_message_sender_id?: string;
  last_message_sender_name?: string;
  current_user_sent_any_message?: boolean;
  member_count?: number;
  other_members_preview?: { user_id: string; name: string }[];
  unread_count?: number;
  isPinned?: boolean;
}

export type ChatItem = 
  | { type: 'individual'; data: IndividualChatListItem }
  | { type: 'group'; data: GroupChatListItem };

// Interaction Types
export interface InteractionStatus {
  isMuted: boolean;
  isBlocked: boolean;
  isChatMutuallyInitiated: boolean;
}

// Event Sharing Types
export interface EventData {
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventVenue: string;
  eventImage: string;
  eventDateTime?: string;
}

export interface ShareEventOptions {
  eventData: EventData;
  senderId: string;
  receiverId?: string;
  groupId?: string;
  chatType: 'individual' | 'group';
}

// Image Types
export interface ImagePickerResult {
  uri: string;
  base64?: string;
  cancelled: boolean;
}

export interface SendImageOptions {
  imageUri: string;
  chatType: 'individual' | 'group';
  chatId: string;
  senderId: string;
  replyToMessageId?: string;
} 