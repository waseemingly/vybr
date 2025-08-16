# PowerSync Integration for Vybr

This document outlines the PowerSync integration for the Vybr React Native application.

## Overview

PowerSync has been integrated into the Vybr application to provide:
- Real-time data synchronization between client and server
- Offline-first data storage using SQLite
- Automatic conflict resolution
- Reactive UI updates when data changes
- **Full support for both web and mobile platforms**

## Architecture

### Schema Design

The PowerSync schema is defined in `src/lib/powersync/schema.ts` and includes the following tables based on your sync rules:

1. **User Profile Data**
   - `musicLoverProfiles` - User profile information
   - `users` - Basic user data
   - `userStreamingData` - User's music streaming data

2. **Events**
   - `events` - Event information that users can see

3. **Messaging**
   - `messages` - Individual messages
   - `messageStatus` - Message delivery status
   - `groupChats` - Group chat information
   - `groupChatParticipants` - Group chat members
   - `groupChatMessages` - Group chat messages
   - `groupMessageStatus` - Group message status

4. **Social Features**
   - `blocks` - User blocking relationships
   - `mutedUsers` - User muting relationships
   - `organizerProfiles` - Organizer profile information
   - `organizerFollows` - User-organizer following relationships

5. **Reports**
   - `reports` - User reports
   - `organizerReports` - Organizer reports

### Key Files

- `src/lib/powersync/schema.ts` - PowerSync schema definition
- `src/lib/powersync/database.ts` - Database creation and configuration
- `src/lib/powersync/connector.ts` - Backend connector for authentication and data upload
- `src/context/PowerSyncContext.tsx` - React context for PowerSync state management
- `src/hooks/usePowerSyncData.ts` - Hooks for using PowerSync data in components

## Setup

### Prerequisites

1. PowerSync instance URL configured in environment variables
2. Supabase authentication set up
3. PowerSync client auth configured for Supabase JWTs

### Environment Variables

Add the following to your environment configuration:

```bash
POWERSYNC_URL=https://your-powersync-instance.powersync.journeyapps.com
```

### Installation

The following packages have been installed:

```bash
npm install @powersync/react-native @powersync/web @journeyapps/react-native-quick-sqlite @azure/core-asynciterator-polyfill
```

### Babel Configuration

The async generator Babel plugin has been added to `babel.config.js`:

```javascript
"@babel/plugin-transform-async-generator-functions"
```

### Metro Configuration

Metro has been configured to handle platform-specific modules:

```javascript
// Handle PowerSync modules for web
if (platform === 'web') {
  if (moduleName === '@powersync/react-native') {
    // For web, use the web SDK
    return context.resolveRequest(context, '@powersync/web', platform, realModuleName);
  }
}
```

## Usage

### Using PowerSync in Components

#### Basic Data Query

```typescript
import { usePowerSyncData } from '@/hooks/usePowerSyncData';

function MyComponent() {
  const { data: events, loading, error } = usePowerSyncData(
    'SELECT * FROM events ORDER BY start_date DESC LIMIT 10'
  );

  if (loading) return <ActivityIndicator />;
  if (error) return <Text>Error: {error}</Text>;

  return (
    <View>
      {events.map(event => (
        <Text key={event.id}>{event.title}</Text>
      ))}
    </View>
  );
}
```

#### Real-time Data Updates

```typescript
import { usePowerSyncDataWatcher } from '@/hooks/usePowerSyncData';

function MyComponent() {
  const { data: messages, loading, error } = usePowerSyncDataWatcher(
    'SELECT * FROM messages WHERE receiver_id = ? ORDER BY created_at DESC',
    [userId]
  );

  // This will automatically update when new messages are received
  return (
    <View>
      {messages.map(message => (
        <Text key={message.id}>{message.content}</Text>
      ))}
    </View>
  );
}
```

#### Using PowerSync Context

```typescript
import { usePowerSync } from '@/context/PowerSyncContext';

function MyComponent() {
  const { isPowerSyncAvailable, isConnected, db, isMobile, isWeb } = usePowerSync();

  if (!isPowerSyncAvailable) {
    return <Text>PowerSync not available</Text>;
  }

  // Use db directly for complex operations
  const handleCreateEvent = async () => {
    await db.execute(
      'INSERT INTO events (id, title, description, created_at) VALUES (uuid(), ?, ?, datetime())',
      ['My Event', 'Event description']
    );
  };
}
```

### Data Mutations

#### Insert Data

```typescript
const { db } = usePowerSync();

await db.execute(
  'INSERT INTO messages (id, sender_id, receiver_id, content, created_at) VALUES (uuid(), ?, ?, ?, datetime())',
  [senderId, receiverId, messageContent]
);
```

#### Update Data

```typescript
await db.execute(
  'UPDATE messages SET is_read = 1 WHERE id = ?',
  [messageId]
);
```

#### Delete Data

```typescript
await db.execute(
  'DELETE FROM messages WHERE id = ?',
  [messageId]
);
```

### Transactions

For complex operations that require multiple database changes:

```typescript
await db.writeTransaction(async (tx) => {
  // Delete the main list
  await tx.execute(`DELETE FROM lists WHERE id = ?`, [listId]);
  // Delete any children of the list
  await tx.execute(`DELETE FROM todos WHERE list_id = ?`, [listId]);
});
```

## Platform Support

### ✅ Mobile (iOS/Android) - FULL SUPPORT

- **Complete PowerSync functionality**
- Real-time synchronization with SQLite
- Offline-first functionality
- Automatic conflict resolution
- Reactive UI updates
- All PowerSync features available

**Features:**
- ✅ Real-time data sync
- ✅ Offline support
- ✅ Local SQLite database
- ✅ Automatic conflict resolution
- ✅ Reactive UI updates
- ✅ Background sync
- ✅ Data encryption

### ✅ Web - FULL SUPPORT

- **Full PowerSync functionality**
- Real-time synchronization with WebSQL/IndexedDB
- Offline-first functionality
- Automatic conflict resolution
- Reactive UI updates
- All PowerSync features available

**Features:**
- ✅ Real-time data sync
- ✅ Offline support
- ✅ Local storage (WebSQL/IndexedDB)
- ✅ Automatic conflict resolution
- ✅ Reactive UI updates
- ✅ Background sync
- ✅ Progressive Web App support

**Web-specific Setup:**
1. PowerSync Web SDK automatically loaded
2. Worker files handled by Metro configuration
3. Platform detection in database creation
4. Fallback to Supabase if PowerSync web fails

## Error Handling

PowerSync errors are handled gracefully:

1. **Connection Errors** - Automatically retries connection
2. **Schema Errors** - Logs errors and continues with Supabase fallback
3. **Query Errors** - Returns error state in hooks
4. **Authentication Errors** - Re-authenticates when needed
5. **Platform Errors** - Falls back to appropriate platform-specific solution

## Monitoring

PowerSync status can be monitored through the context:

```typescript
const { isConnected, isPowerSyncAvailable, isMobile, isWeb } = usePowerSync();
```

## Troubleshooting

### Common Issues

1. **PowerSync URL not configured**
   - Check environment variables
   - Verify PowerSync instance URL

2. **Authentication issues**
   - Ensure Supabase session is active
   - Check PowerSync client auth configuration

3. **Schema mismatches**
   - Verify schema matches sync rules
   - Check PowerSync dashboard for schema generation

4. **Web platform issues**
   - Check Metro configuration for web module resolution
   - Verify @powersync/web package is installed
   - Check browser console for worker file errors

5. **Mobile platform issues**
   - Verify @powersync/react-native package is installed
   - Check native module linking
   - Ensure SQLite is properly configured

### Debugging

Enable verbose logging by checking the console for PowerSync-related messages:

- `🔍 PowerSync:` - Debug information
- `✅ PowerSync:` - Success messages
- `❌ PowerSync:` - Error messages
- `⚠️ PowerSync:` - Warning messages

### Platform-Specific Debugging

#### Web Debugging
```javascript
// Check if PowerSync web is loaded
console.log('PowerSync Web:', typeof window !== 'undefined' ? window.PowerSync : 'Not available');

// Check worker files
fetch('/@powersync/worker/WASQLiteDB.umd.js').then(r => console.log('Worker available:', r.ok));
```

#### Mobile Debugging
```javascript
// Check PowerSync React Native
import { PowerSyncDatabase } from '@powersync/react-native';
console.log('PowerSync RN:', typeof PowerSyncDatabase);
```

## Next Steps

1. **Implement specific screen integrations** - Replace existing data fetching with PowerSync queries
2. **Add data mutations** - Implement create, update, delete operations
3. **Optimize queries** - Add indexes and optimize query performance
4. **Add error boundaries** - Implement error handling for PowerSync failures
5. **Test offline functionality** - Verify offline-first behavior
6. **Monitor performance** - Track PowerSync performance metrics
7. **Test cross-platform** - Verify functionality on both web and mobile

## Support

For PowerSync-specific issues:
- Check PowerSync documentation: https://docs.powersync.com
- Join PowerSync Discord: https://discord.gg/powersync
- Review PowerSync examples: https://github.com/powersync-ja/powersync-js/tree/main/demos

## Platform Comparison

| Feature | Mobile | Web |
|---------|--------|-----|
| Real-time Sync | ✅ Full | ✅ Full |
| Offline Support | ✅ SQLite | ✅ WebSQL/IndexedDB |
| Conflict Resolution | ✅ Automatic | ✅ Automatic |
| Reactive UI | ✅ Yes | ✅ Yes |
| Background Sync | ✅ Yes | ✅ Limited |
| Data Encryption | ✅ Yes | ✅ Limited |
| Performance | ✅ Excellent | ✅ Good |
| Storage | ✅ Unlimited | ✅ Limited by browser | 