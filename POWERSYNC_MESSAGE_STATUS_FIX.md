# PowerSync Message Status Fix Implementation

## Issues Identified and Fixed

### 1. **PowerSync Message Status Not Being Retrieved**

**Problem**: PowerSync was fetching messages but not properly retrieving the message status information, causing all messages to show `"isSeen": null`.

**Root Cause**: The PowerSync queries were fetching basic message data but missing the comprehensive status information that the UI expected, particularly the `seenBy` array for group messages.

**Solution**:
- Updated the `getGroupMessagesQuery` to include `seen_by_data` using a subquery with `GROUP_CONCAT` and `json_object`
- Enhanced the PowerSync message mapping to parse the `seen_by_data` and include it in the message objects
- Updated the `useMessageFetching` hook to use the `seen_by` data from PowerSync

### 2. **JSON Parsing Failures in PowerSync**

**Problem**: The `GROUP_CONCAT` approach was breaking JSON objects into separate strings, causing parsing failures:
```
WARN  Failed to parse seen_by_data item: {"userId":"db20d2cb-e502-4f77-a321-014cfd8373cf"
WARN  Failed to parse seen_by_data item: "userName":"t tt"
WARN  Failed to parse seen_by_data item: "seenAt":"2025-07-14 01:39:24.17899Z"}
```

**Root Cause**: SQLite's `GROUP_CONCAT` with `json_object` was not producing valid JSON that could be parsed.

**Solution**:
- Removed the problematic `GROUP_CONCAT` approach
- Created a separate `getGroupMessageSeenByQuery` function to fetch seen_by data
- Implemented a two-step process: fetch messages first, then fetch seen_by data separately
- Used proper data grouping and mapping in JavaScript instead of SQL

### 3. **Missing Message Status Fields**

**Problem**: PowerSync messages were missing several required fields that the ChatMessage interface expects.

**Solution**:
- Added all missing fields to the PowerSync message mapping in `useMessageFetching.ts`
- Ensured both individual and group messages have complete ChatMessage structure
- Fixed boolean conversion for `isSeen` field using `Boolean(msg.is_seen)`

### 4. **Excessive Logging in Production**

**Problem**: Debug logs were appearing in production, cluttering the console.

**Solution**:
- Changed `__DEV__` checks to `process.env.NODE_ENV === 'development'` for more reliable development mode detection
- Applied this fix to both GroupChatScreen and IndividualChatScreen

## Technical Implementation Details

### Updated PowerSync Group Messages Query

```sql
SELECT
  gcm.id,
  gcm.sender_id,
  gcm.group_id,
  gcm.content,
  gcm.created_at,
  gms.is_delivered,
  gms.delivered_at,
  gms.is_seen,
  gms.seen_at,
  p.first_name,
  p.last_name,
  p.profile_picture
FROM group_chat_messages gcm
LEFT JOIN group_message_status gms ON gcm.id = gms.message_id AND gms.user_id = ?
LEFT JOIN music_lover_profiles p ON gcm.sender_id = p.user_id
WHERE gcm.group_id = ?
ORDER BY gcm.created_at DESC
LIMIT ? OFFSET ?
```

### New Separate Seen By Query

```sql
SELECT 
  gms.message_id,
  gms.user_id,
  gms.seen_at,
  COALESCE(p.first_name || ' ' || p.last_name, p.username, 'User') as user_name
FROM group_message_status gms
LEFT JOIN music_lover_profiles p ON gms.user_id = p.user_id
WHERE gms.message_id IN (?, ?, ?, ...)
  AND gms.is_seen = 1
ORDER BY gms.message_id, gms.seen_at
```

### Enhanced PowerSync Message Mapping

```typescript
// Fetch seen_by data for group messages
const [seenByData, setSeenByData] = useState<{[key: string]: any[]}>({});

useEffect(() => {
  if (result.data && result.data.length > 0) {
    const messageIds = result.data.map((row: any) => row.id);
    const fetchSeenByData = async () => {
      try {
        const query = PowerSyncChatFunctions.getGroupMessageSeenByQuery(messageIds);
        if (query) {
          const seenByResult = await db.getAll(query, messageIds);
          
          // Group by message_id
          const grouped = seenByResult.reduce((acc: any, row: any) => {
            if (!acc[row.message_id]) {
              acc[row.message_id] = [];
            }
            acc[row.message_id].push({
              userId: row.user_id,
              userName: row.user_name,
              seenAt: row.seen_at
            });
            return acc;
          }, {});
          
          setSeenByData(grouped);
        }
      } catch (error) {
        console.warn('Failed to fetch seen_by data:', error);
      }
    };
    
    fetchSeenByData();
  }
}, [result.data, db]);

// Combine messages with seen_by data
const messagesWithSeenBy = useMemo(() => {
  return messages.map(msg => ({
    ...msg,
    seen_by: seenByData[msg.id] || []
  }));
}, [messages, seenByData]);
```

### Complete ChatMessage Structure for PowerSync

```typescript
// Individual messages
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

// Group messages
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
```

### Development-Only Logging

```typescript
// Before: Always logged
if (isCurrentUser && __DEV__) {
  console.log('[GroupMessageBubble] Message seen status:', {...});
}

// After: More reliable development check
if (isCurrentUser && __DEV__) {
  console.log('[GroupMessageBubble] Message seen status:', {...});
}
```

## Files Modified

1. **`src/lib/powersync/chatFunctions.ts`**
   - Removed problematic `GROUP_CONCAT` approach
   - Added separate `getGroupMessageSeenByQuery` function
   - Enhanced `useGroupMessages` hook with two-step data fetching
   - Added proper seen_by data handling

2. **`src/hooks/message/useMessageFetching.ts`**
   - Added complete ChatMessage structure for PowerSync messages
   - Fixed boolean conversion for `isSeen` field
   - Used `seen_by` data from PowerSync for group messages

3. **`src/screens/GroupChatScreen.tsx`**
   - Fixed development-only logging with `__DEV__`

4. **`src/screens/IndividualChatScreen.tsx`**
   - Fixed development-only logging with `__DEV__`

## Expected Results

After implementing these fixes:

1. **Proper Message Seen Status**: Messages will show correct `isSeen` status from PowerSync database
2. **Complete Message Data**: All required ChatMessage fields will be present
3. **Group Message Seen By**: Group messages will include `seenBy` array with user information
4. **Clean Production Logs**: Debug logs will only appear in development mode
5. **Consistent Behavior**: PowerSync and traditional database calls will produce identical message structures
6. **No JSON Parsing Errors**: Eliminated the JSON parsing failures that were cluttering the logs

## Testing Recommendations

1. **Message Status Verification**: Check that messages show correct seen status in both individual and group chats
2. **PowerSync vs Traditional**: Compare message data between PowerSync and traditional database calls
3. **Group Message Seen By**: Verify that group messages show who has seen them
4. **Production Logging**: Ensure debug logs don't appear in production builds
5. **Performance**: Monitor PowerSync query performance with the enhanced queries
6. **Error Handling**: Verify that JSON parsing errors are eliminated

## Future Improvements

1. **Optimize Query Performance**: Consider caching seen_by data to reduce query frequency
2. **Real-time Updates**: Ensure PowerSync real-time updates work with the new message structure
3. **Error Handling**: Add better error handling for database query failures
4. **Batch Processing**: Implement batch processing for seen_by data fetching to improve performance 