# PowerSync Chat Implementation

## Overview

This implementation provides chat list retrieval using PowerSync for mobile devices and Supabase for web platforms. The system automatically detects the platform and uses the appropriate data source.

## Key Features

1. **Platform Detection**: Automatically uses PowerSync for mobile (iOS/Android) and Supabase for web
2. **Real-time Updates**: Both platforms support real-time chat updates
3. **Unread Count Tracking**: Tracks unread messages for both individual and group chats
4. **Search Functionality**: Supports searching through chat lists
5. **Message Status**: Tracks sent, delivered, and read status

## Implementation Details

### 1. PowerSync Chat Functions (`src/lib/powersync/chatFunctions.ts`)

The PowerSync implementation includes four main query functions that replicate the Supabase RPC functions:

#### Individual Chat Functions:
- `getIndividualChatListQuery()` - Equivalent to `get_chat_list`
- `getIndividualChatListWithUnreadQuery()` - Equivalent to `get_chat_list_with_unread`

#### Group Chat Functions:
- `getGroupChatListQuery()` - Equivalent to `get_group_chat_list`
- `getGroupChatListWithUnreadQuery()` - Equivalent to `get_group_chat_list_with_unread`

### 2. PowerSync Hooks

Four React hooks provide easy access to chat data:

```typescript
// Individual chats without unread counts
const { chats, loading, error } = useIndividualChatList(userId);

// Individual chats with unread counts
const { chats, loading, error } = useIndividualChatListWithUnread(userId);

// Group chats without unread counts
const { chats, loading, error } = useGroupChatList(userId);

// Group chats with unread counts
const { chats, loading, error } = useGroupChatListWithUnread(userId);
```

### 3. Updated ChatsTabs Component (`src/components/ChatsTabs.tsx`)

The ChatsTabs component now:

- Detects platform using `usePowerSync()` hook
- Uses PowerSync data for mobile devices
- Falls back to Supabase for web platforms
- Maintains the same UI and functionality across platforms

#### Key Changes:
```typescript
// Platform detection
const { isMobile, isPowerSyncAvailable } = usePowerSync();

// PowerSync hooks for mobile
const individualChatResult = useIndividualChatList(session?.user?.id || '');
const groupChatResult = useGroupChatList(session?.user?.id || '');

// Platform-specific data selection
const getIndividualList = useMemo(() => {
    if (isMobile && isPowerSyncAvailable) {
        return individualChatResult.chats.map(chat => chat.data as IndividualChatListItem);
    }
    return individualList; // Supabase data for web
}, [isMobile, isPowerSyncAvailable, individualChatResult.chats, individualList]);
```

### 4. PowerSync Schema (`src/lib/powersync/schema.ts`)

Updated schema to match the actual database structure and sync rules:

#### Individual Chat Tables:
- `messages` - Individual chat messages (simplified schema)
- `messageStatus` - Message delivery and read status

#### Group Chat Tables:
- `groupChats` - Group chat information
- `groupChatParticipants` - Group membership
- `groupChatMessages` - Group chat messages (simplified schema)
- `groupMessageStatus` - Group message status

#### User Profile Tables:
- `musicLoverProfiles` - User profile information

#### Block/Mute Tables:
- `blocks` - User blocking relationships
- `mutedUsers` - User muting relationships

### 5. Sync Rules (`src/lib/powersync/sync-rules.yaml`)

The sync rules follow PowerSync's bucket-based approach and address all PowerSync requirements:

#### Key Requirements Addressed:
- **ID Column**: All data queries return an `id` column
- **Valid Columns**: Only includes columns that exist in the actual database
- **Proper Parameter Usage**: Uses `request.user_id()` only in parameter queries, not data queries

#### Bucket Definitions:

1. **`user_messages`** - Individual chat messages and status for the current user
2. **`user_profile`** - Current user's profile information
3. **`chat_partner_profiles_received`** - Profile information for users who sent messages to the current user
4. **`chat_partner_profiles_sent`** - Profile information for users who received messages from the current user
5. **`user_group_chats`** - Group chats the current user is a member of
6. **`user_blocks_mutes`** - Block and mute relationships for the current user

#### Example Bucket Definition:
```yaml
user_messages:
  parameters: SELECT request.user_id() as base_user_id
  data:
    - SELECT id, sender_id, receiver_id, content, created_at
      FROM public.messages
      WHERE sender_id = bucket.base_user_id
         OR receiver_id = bucket.base_user_id
    - SELECT message_id as id, message_id, user_id, is_delivered, delivered_at, is_seen, seen_at, created_at
      FROM public.message_status
      WHERE user_id = bucket.base_user_id
```

#### ID Column Strategies:
- **Messages**: Uses existing `id` column
- **Message Status**: Uses `message_id as id` 
- **Group Participants**: Uses `group_id || '_' || user_id as id`
- **Group Message Status**: Uses `group_id || '_' || message_id || '_' || user_id as id`
- **Blocks/Mutes**: Uses concatenated IDs as unique identifiers

## Database Tables Used

### Individual Chat Tables:
1. **`public.messages`** - Core message data (simplified schema)
2. **`public.message_status`** - Message delivery/read status
3. **`public.music_lover_profiles`** - User profile information

### Group Chat Tables:
1. **`public.group_chats`** - Group information
2. **`public.group_chat_participants`** - Group membership
3. **`public.group_chat_messages`** - Group messages (simplified schema)
4. **`public.group_message_status`** - Group message status

### Supporting Tables:
1. **`public.blocks`** - User blocking
2. **`public.muted_users`** - User muting

## Query Functions Replicated

### Individual Chat Functions:
1. **`get_chat_list`** - Basic individual chat list
2. **`get_chat_list_with_unread`** - Individual chat list with unread counts

### Group Chat Functions:
1. **`get_group_chat_list`** - Basic group chat list
2. **`get_group_chat_list_with_unread`** - Group chat list with unread counts

## Usage Instructions

### For Mobile Development:
1. Ensure PowerSync is properly configured
2. The system automatically uses PowerSync for chat data
3. Real-time updates work through PowerSync's sync mechanism

### For Web Development:
1. The system automatically falls back to Supabase
2. Real-time updates work through Supabase's real-time subscriptions
3. No additional configuration required

### For Both Platforms:
1. Import and use the ChatsTabs component as before
2. All existing functionality remains the same
3. Platform detection is automatic

## Benefits

1. **Offline Support**: Mobile users can view chat lists offline
2. **Performance**: Faster data access on mobile devices
3. **Consistency**: Same API and functionality across platforms
4. **Scalability**: PowerSync handles data synchronization efficiently
5. **User Experience**: Seamless transition between online/offline states

## Future Enhancements

1. **Message Sending**: Implement PowerSync-based message sending for mobile
2. **File Uploads**: Add support for media file synchronization
3. **Push Notifications**: Integrate with PowerSync's notification system
4. **Advanced Filtering**: Add more sophisticated chat filtering options
5. **Message Search**: Implement full-text search across messages

## Troubleshooting

### Common Issues:

1. **PowerSync Not Available**: Check PowerSync configuration and authentication
2. **Data Not Syncing**: Verify sync rules are properly configured
3. **Performance Issues**: Check query optimization and indexing
4. **Real-time Updates**: Ensure PowerSync connection is stable

### Debug Tools:

The implementation includes debug functions for troubleshooting:
```typescript
// Exposed globally in development mode
(global as any).debugUnreadCounts = debugUnreadCounts;
```

## Conclusion

This implementation provides a robust, platform-aware chat system that leverages PowerSync for mobile performance while maintaining web compatibility through Supabase. The system is designed to be transparent to the end user while providing optimal performance for each platform. 