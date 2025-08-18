import { usePowerSync } from '@/context/PowerSyncContext';
import { usePowerSyncDataWatcher } from '@/hooks/usePowerSyncData';
import { MessageUtils } from '@/utils/message/MessageUtils';
import type { IndividualChatListItem, GroupChatListItem, ChatItem } from '@/types/message';
import { useEffect, useMemo, useState } from 'react';

export class PowerSyncChatFunctions {
  /**
   * Debug function to check available tables
   */
  static async debugTables(db: any) {
    try {
      console.log('🔍 PowerSync Debug - Checking available tables...');
      
      // Check if tables exist
      const tables = ['messages', 'messageStatus', 'musicLoverProfiles', 'groupChats', 'groupChatParticipants', 'groupChatMessages', 'groupMessageStatus'];
      
      for (const table of tables) {
        try {
          const result = await db.getAll(`SELECT COUNT(*) as count FROM ${table}`);
          console.log(`✅ Table ${table} exists with ${result[0]?.count || 0} rows`);
        } catch (error) {
          console.log(`❌ Table ${table} does not exist or error:`, error);
        }
      }
    } catch (error) {
      console.error('🔍 PowerSync Debug - Error checking tables:', error);
    }
  }

  /**
   * Get individual chat list (equivalent to get_chat_list)
   */
  static getIndividualChatListQuery(userId: string): string {
    return `
      WITH messages_with_partner AS (
        SELECT
          *,
          CASE
            WHEN sender_id = ? THEN receiver_id
            ELSE sender_id
          END AS partner_id
        FROM messages
        WHERE sender_id = ? OR receiver_id = ?
      ),
      ranked_messages AS (
        SELECT *,
               ROW_NUMBER() OVER (
                 PARTITION BY partner_id
                 ORDER BY created_at DESC
               ) AS rn
        FROM messages_with_partner
      ),
      interaction_status AS (
        SELECT 
          partner_id,
          EXISTS(
            SELECT 1 FROM messages_with_partner 
            WHERE partner_id = mwp.partner_id AND sender_id = ?
          ) as current_user_sent_any_message,
          EXISTS(
            SELECT 1 FROM messages_with_partner 
            WHERE partner_id = mwp.partner_id AND sender_id = mwp.partner_id
          ) as partner_sent_any_message
        FROM messages_with_partner mwp
        GROUP BY partner_id
      )
      SELECT
        m.partner_id AS partner_user_id,
        m.content AS last_message_content,
        m.created_at AS last_message_created_at,
        m.sender_id AS last_message_sender_id,
        COALESCE(sender_prof.first_name || ' ' || sender_prof.last_name, sender_prof.username, 'User') AS last_message_sender_name,
        p.first_name AS partner_first_name,
        p.last_name AS partner_last_name,
        p.profile_picture AS partner_profile_picture,
        i.current_user_sent_any_message,
        i.partner_sent_any_message
      FROM ranked_messages m
      LEFT JOIN music_lover_profiles p ON m.partner_id = p.user_id
      LEFT JOIN music_lover_profiles sender_prof ON m.sender_id = sender_prof.user_id
      JOIN interaction_status i ON m.partner_id = i.partner_id
      WHERE m.rn = 1
      ORDER BY m.created_at DESC
    `;
  }

  /**
   * Get individual chat list with unread counts (equivalent to get_chat_list_with_unread)
   */
  static getIndividualChatListWithUnreadQuery(userId: string): string {
    return `
      WITH messages_with_partner AS (
        SELECT
          *,
          CASE
            WHEN sender_id = ? THEN receiver_id
            ELSE sender_id
          END AS partner_id
        FROM messages
        WHERE sender_id = ? OR receiver_id = ?
      ),
      ranked_messages AS (
        SELECT *,
               ROW_NUMBER() OVER (
                 PARTITION BY partner_id
                 ORDER BY created_at DESC
               ) AS rn
        FROM messages_with_partner
      ),
      interaction_status AS (
        SELECT 
          partner_id,
          EXISTS(
            SELECT 1 FROM messages_with_partner 
            WHERE partner_id = mwp.partner_id AND sender_id = ?
          ) as current_user_sent_any_message,
          EXISTS(
            SELECT 1 FROM messages_with_partner 
            WHERE partner_id = mwp.partner_id AND sender_id = mwp.partner_id
          ) as partner_sent_any_message
        FROM messages_with_partner mwp
        GROUP BY partner_id
      ),
      unread_counts AS (
        SELECT 
          sender_id as partner_id,
          COUNT(*) as unread_count
        FROM messages m
        LEFT JOIN message_status ms ON m.id = ms.message_id
        WHERE m.receiver_id = ? 
          AND (ms.is_seen IS NULL OR ms.is_seen = 0)
          AND m.sender_id != ?
        GROUP BY sender_id
      )
      SELECT
        m.partner_id AS partner_user_id,
        m.content AS last_message_content,
        m.created_at AS last_message_created_at,
        m.sender_id AS last_message_sender_id,
        COALESCE(sender_prof.first_name || ' ' || sender_prof.last_name, sender_prof.username, 'User') AS last_message_sender_name,
        p.first_name AS partner_first_name,
        p.last_name AS partner_last_name,
        p.profile_picture AS partner_profile_picture,
        i.current_user_sent_any_message,
        i.partner_sent_any_message,
        COALESCE(u.unread_count, 0) as unread_count
      FROM ranked_messages m
      LEFT JOIN music_lover_profiles p ON m.partner_id = p.user_id
      LEFT JOIN music_lover_profiles sender_prof ON m.sender_id = sender_prof.user_id
      JOIN interaction_status i ON m.partner_id = i.partner_id
      LEFT JOIN unread_counts u ON m.partner_id = u.partner_id
      WHERE m.rn = 1
      ORDER BY m.created_at DESC
    `;
  }

  /**
   * Get group chat list (equivalent to get_group_chat_list)
   */
  static getGroupChatListQuery(userId: string): string {
    return `
      SELECT
        gc.id as group_id,
        gc.group_name as group_name,
        gc.group_image as group_image,
        p_filter.is_admin,
        lm.last_message_content,
        lm.last_message_created_at,
        (SELECT count(*) FROM group_chat_participants p_count WHERE p_count.group_id = gc.id) as member_count
      FROM group_chats gc
      JOIN group_chat_participants p_filter
        ON gc.id = p_filter.group_id AND p_filter.user_id = ?
      LEFT JOIN (
        SELECT
          gcm.group_id,
          gcm.content as last_message_content,
          gcm.created_at as last_message_created_at
        FROM group_chat_messages gcm
        WHERE gcm.group_id IN (SELECT gcp.group_id FROM group_chat_participants gcp WHERE gcp.user_id = ?)
        AND gcm.id = (
          SELECT gcm2.id FROM group_chat_messages gcm2 
          WHERE gcm2.group_id = gcm.group_id 
          ORDER BY gcm2.created_at DESC 
          LIMIT 1
        )
      ) lm ON gc.id = lm.group_id
      ORDER BY lm.last_message_created_at DESC NULLS LAST
    `;
  }

  /**
   * Get group chat list with unread counts (equivalent to get_group_chat_list_with_unread)
   */
  static getGroupChatListWithUnreadQuery(userId: string): string {
    return `
      WITH last_messages AS (
        SELECT DISTINCT ON (gcm.group_id)
          gcm.group_id,
          gcm.content AS last_message_content,
          gcm.created_at AS last_message_created_at,
          gcm.sender_id AS last_message_sender_id,
          COALESCE(sender_prof.first_name || ' ' || sender_prof.last_name, sender_prof.username, 'User') as last_message_sender_name
        FROM group_chat_messages gcm
        LEFT JOIN music_lover_profiles sender_prof ON gcm.sender_id = sender_prof.user_id
        WHERE gcm.group_id IN (SELECT gcp.group_id FROM group_chat_participants gcp WHERE gcp.user_id = ?)
        ORDER BY gcm.group_id, gcm.created_at DESC
      ),
      unread_counts AS (
        SELECT
          gcm.group_id,
          COUNT(*) as unread_count
        FROM group_chat_messages gcm
        LEFT JOIN group_message_status gms ON gcm.id = gms.message_id AND gms.user_id = ?
        WHERE gcm.group_id IN (SELECT gcp.group_id FROM group_chat_participants gcp WHERE gcp.user_id = ?)
          AND gcm.sender_id != ?
          AND (gms.id IS NULL OR gms.is_seen = 0)
        GROUP BY gcm.group_id
      ),
      member_counts AS (
        SELECT
          gcp.group_id,
          count(*) as member_count
        FROM group_chat_participants gcp
        GROUP BY gcp.group_id
      )
      SELECT 
        gc.id as group_id,
        gc.group_name as group_name,
        gc.group_image as group_image,
        lm.last_message_content,
        lm.last_message_created_at,
        lm.last_message_sender_id,
        lm.last_message_sender_name,
        mc.member_count,
        COALESCE(uc.unread_count, 0) as unread_count
      FROM group_chats gc
      JOIN group_chat_participants gcp ON gc.id = gcp.group_id
      LEFT JOIN last_messages lm ON gc.id = lm.group_id
      LEFT JOIN unread_counts uc ON gc.id = uc.group_id
      LEFT JOIN member_counts mc ON gc.id = mc.group_id
      WHERE gcp.user_id = ?
      ORDER BY lm.last_message_created_at DESC NULLS LAST
    `;
  }

  /**
   * Get individual messages (equivalent to fetchIndividualMessages)
   */
  static getIndividualMessagesQuery(userId: string, partnerId: string, limit: number = 50, offset: number = 0): string {
    return `
      SELECT
        m.id,
        m.sender_id,
        m.receiver_id,
        m.content,
        m.created_at,
        ms.is_delivered,
        ms.delivered_at,
        ms.is_seen,
        ms.seen_at,
        p.first_name,
        p.last_name,
        p.profile_picture
      FROM messages m
      LEFT JOIN message_status ms ON m.id = ms.message_id AND ms.user_id = ?
      LEFT JOIN music_lover_profiles p ON m.sender_id = p.user_id
      WHERE (m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?)
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?
    `;
  }

  /**
   * Get group messages (equivalent to fetchGroupMessages)
   */
  static getGroupMessagesQuery(groupId: string, userId: string, limit: number = 50, offset: number = 0): string {
    return `
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
    `;
  }

  /**
   * Get seen_by data for group messages
   */
  static getGroupMessageSeenByQuery(messageIds: string[]): string {
    if (messageIds.length === 0) return '';
    
    const placeholders = messageIds.map(() => '?').join(',');
    return `
      SELECT 
        gms.message_id,
        gms.user_id,
        gms.seen_at,
        COALESCE(p.first_name || ' ' || p.last_name, p.username, 'User') as user_name
      FROM group_message_status gms
      LEFT JOIN music_lover_profiles p ON gms.user_id = p.user_id
      WHERE gms.message_id IN (${placeholders})
        AND gms.is_seen = 1
      ORDER BY gms.message_id, gms.seen_at
    `;
  }

  /**
   * Mark individual messages as read
   */
  static markIndividualMessagesAsReadQuery(userId: string, partnerId: string): string {
    return `
      UPDATE messageStatus 
      SET status = 'read', created_at = datetime('now')
      WHERE user_id = ? 
        AND message_id IN (
          SELECT id FROM messages 
          WHERE sender_id = ? AND receiver_id = ?
        )
    `;
  }

  /**
   * Mark group messages as read
   */
  static markGroupMessagesAsReadQuery(groupId: string, userId: string): string {
    return `
      INSERT OR REPLACE INTO groupMessageStatus (group_id, message_id, user_id, status, created_at)
      SELECT ?, gcm.id, ?, 'read', datetime('now')
      FROM groupChatMessages gcm
      WHERE gcm.group_id = ? 
        AND gcm.sender_id != ?
        AND NOT EXISTS (
          SELECT 1 FROM groupMessageStatus gms 
          WHERE gms.message_id = gcm.id AND gms.user_id = ?
        )
    `;
  }

  /**
   * Get user profile by ID
   */
  static getUserProfileQuery(userId: string): string {
    return `
      SELECT user_id, first_name, last_name, profile_picture, username
      FROM musicLoverProfiles
      WHERE user_id = ?
    `;
  }

  /**
   * Get multiple user profiles
   */
  static getMultipleUserProfilesQuery(userIds: string[]): string {
    const placeholders = userIds.map(() => '?').join(',');
    return `
      SELECT user_id, first_name, last_name, profile_picture, username
      FROM musicLoverProfiles
      WHERE user_id IN (${placeholders})
    `;
  }

  /**
   * Get individual message status (equivalent to get_individual_message_status)
   */
  static getIndividualMessageStatusQuery(messageId: string, userId: string): string {
    return `
      SELECT
        m.id,
        m.sender_id,
        m.receiver_id,
        m.content,
        m.created_at,
        ms.is_delivered,
        ms.delivered_at,
        ms.is_seen,
        ms.seen_at
      FROM messages m
      LEFT JOIN message_status ms ON m.id = ms.message_id AND ms.user_id = ?
      WHERE m.id = ? AND (m.sender_id = ? OR m.receiver_id = ?)
    `;
  }

  /**
   * Get group message status (equivalent to get_group_message_status)
   */
  static getGroupMessageStatusQuery(messageId: string, userId: string): string {
    return `
      SELECT
        gcm.id,
        gcm.sender_id,
        gcm.group_id,
        gcm.content,
        gcm.created_at,
        gms.is_delivered,
        gms.delivered_at,
        gms.is_seen,
        gms.seen_at
      FROM group_chat_messages gcm
      LEFT JOIN group_message_status gms ON gcm.id = gms.message_id AND gms.user_id = ?
      WHERE gcm.id = ?
    `;
  }

  /**
   * Debug function to check message-related tables
   */
  static async debugMessageTables(db: any) {
    console.log('🔍 PowerSync Debug - Checking message tables...');
    
    const tables = [
      'messages',
      'message_status',
      'group_chat_messages',
      'group_message_status'
    ];

    for (const table of tables) {
      try {
        const result = await db.getAll(`SELECT COUNT(*) as count FROM ${table}`);
        const count = result[0]?.count || 0;
        console.log(`✅ Table ${table} exists with ${count} rows`);
      } catch (error) {
        console.log(`❌ Table ${table} does not exist or error:`, error);
      }
    }
  }
}

/**
 * Hook to get individual chat list using PowerSync (equivalent to get_chat_list)
 */
export function useIndividualChatList(userId: string) {
  const { db, isPowerSyncAvailable } = usePowerSync();
  const query = PowerSyncChatFunctions.getIndividualChatListQuery(userId);
  const params = [userId, userId, userId, userId];

  const { data, loading, error } = usePowerSyncDataWatcher<IndividualChatListItem>(query, params);

  const chatItems: ChatItem[] = useMemo(() => {
    return data.map((chat: IndividualChatListItem) => ({
      type: 'individual' as const,
      data: {
        ...chat,
        last_message_content: MessageUtils.formatLastMessageForPreview(
          chat.last_message_content,
          chat.last_message_sender_id,
          userId,
          chat.last_message_sender_name,
          false
        ),
        unread_count: chat.unread_count || 0,
        isPinned: false
      }
    }));
  }, [data, userId]);

  // Return empty array if PowerSync is not available (no fallback to Supabase)
  if (!isPowerSyncAvailable) {
    return { chats: [], loading: false, error: 'PowerSync not available' };
  }

  return { chats: chatItems, loading, error };
}

/**
 * Hook to get individual chat list with unread counts using PowerSync (equivalent to get_chat_list_with_unread)
 */
export function useIndividualChatListWithUnread(userId: string) {
  const { db, isPowerSyncAvailable } = usePowerSync();
  const query = PowerSyncChatFunctions.getIndividualChatListWithUnreadQuery(userId);
  const params = [userId, userId, userId, userId, userId, userId];

  const { data, loading, error } = usePowerSyncDataWatcher<IndividualChatListItem>(query, params);

  const chatItems: ChatItem[] = useMemo(() => {
    return data.map((chat: IndividualChatListItem) => ({
      type: 'individual' as const,
      data: {
        ...chat,
        last_message_content: MessageUtils.formatLastMessageForPreview(
          chat.last_message_content,
          chat.last_message_sender_id,
          userId,
          chat.last_message_sender_name,
          false
        ),
        unread_count: chat.unread_count || 0,
        isPinned: false
      }
    }));
  }, [data, userId]);

  // Return empty array if PowerSync is not available (no fallback to Supabase)
  if (!isPowerSyncAvailable) {
    return { chats: [], loading: false, error: 'PowerSync not available' };
  }

  return { chats: chatItems, loading, error };
}

/**
 * Hook to get group chat list using PowerSync (equivalent to get_group_chat_list)
 */
export function useGroupChatList(userId: string) {
  const { db, isPowerSyncAvailable } = usePowerSync();
  const query = PowerSyncChatFunctions.getGroupChatListQuery(userId);
  const params = [userId, userId];

  const { data, loading, error } = usePowerSyncDataWatcher<GroupChatListItem>(query, params);

  const chatItems: ChatItem[] = useMemo(() => {
    return data.map((chat: GroupChatListItem) => ({
      type: 'group' as const,
      data: {
        ...chat,
        last_message_content: MessageUtils.formatLastMessageForPreview(
          chat.last_message_content,
          chat.last_message_sender_id,
          userId,
          chat.last_message_sender_name,
          true
        ),
        unread_count: chat.unread_count || 0,
        isPinned: false
      }
    }));
  }, [data, userId]);

  // Return empty array if PowerSync is not available (no fallback to Supabase)
  if (!isPowerSyncAvailable) {
    return { chats: [], loading: false, error: 'PowerSync not available' };
  }

  return { chats: chatItems, loading, error };
}

/**
 * Hook to get group chat list with unread counts using PowerSync (equivalent to get_group_chat_list_with_unread)
 */
export function useGroupChatListWithUnread(userId: string) {
  const { db, isPowerSyncAvailable } = usePowerSync();
  const query = PowerSyncChatFunctions.getGroupChatListWithUnreadQuery(userId);
  const params = [userId, userId, userId, userId, userId];

  const { data, loading, error } = usePowerSyncDataWatcher<GroupChatListItem>(query, params);

  const chatItems: ChatItem[] = useMemo(() => {
    return data.map((chat: GroupChatListItem) => ({
      type: 'group' as const,
      data: {
        ...chat,
        last_message_content: MessageUtils.formatLastMessageForPreview(
          chat.last_message_content,
          chat.last_message_sender_id,
          userId,
          chat.last_message_sender_name,
          true
        ),
        unread_count: chat.unread_count || 0,
        isPinned: false
      }
    }));
  }, [data, userId]);

  // Return empty array if PowerSync is not available (no fallback to Supabase)
  if (!isPowerSyncAvailable) {
    return { chats: [], loading: false, error: 'PowerSync not available' };
  }

  return { chats: chatItems, loading, error };
} 

/**
 * Hook to fetch individual messages using PowerSync
 */
export function useIndividualMessages(userId: string, partnerId: string, limit: number = 50, offset: number = 0) {
  const { db, isPowerSyncAvailable } = usePowerSync();
  const query = PowerSyncChatFunctions.getIndividualMessagesQuery(userId, partnerId, limit, offset);
  const params = [userId, userId, partnerId, partnerId, userId, limit, offset];
  
  const result = usePowerSyncDataWatcher(query, params);

  const messages = useMemo(() => {
    if (!result.data || result.data.length === 0) return [];
    
    // Reverse the order since we query with DESC but want to display oldest to newest
    return result.data.reverse().map((row: any) => ({
      id: row.id,
      sender_id: row.sender_id,
      receiver_id: row.receiver_id,
      content: row.content,
      created_at: row.created_at,
      is_delivered: row.is_delivered,
      delivered_at: row.delivered_at,
      is_seen: row.is_seen,
      seen_at: row.seen_at,
      sender_name: row.first_name && row.last_name ? `${row.first_name} ${row.last_name}`.trim() : row.first_name || 'User',
      sender_profile_picture: row.profile_picture
    }));
  }, [result.data]);

  return {
    messages,
    loading: result.loading,
    error: result.error,
    dataCount: messages.length
  };
}

/**
 * Hook to fetch group messages using PowerSync
 */
export function useGroupMessages(groupId: string, userId: string, limit: number = 50, offset: number = 0) {
  const { db, isPowerSyncAvailable } = usePowerSync();
  const query = PowerSyncChatFunctions.getGroupMessagesQuery(groupId, userId, limit, offset);
  const params = [userId, groupId, limit, offset];
  
  const result = usePowerSyncDataWatcher(query, params);

  const messages = useMemo(() => {
    if (!result.data || result.data.length === 0) return [];
    
    // Reverse the order since we query with DESC but want to display oldest to newest
    return result.data.reverse().map((row: any) => {
      return {
        id: row.id,
        sender_id: row.sender_id,
        group_id: row.group_id,
        content: row.content,
        created_at: row.created_at,
        is_delivered: row.is_delivered,
        delivered_at: row.delivered_at,
        is_seen: row.is_seen,
        seen_at: row.seen_at,
        sender_name: row.first_name && row.last_name ? `${row.first_name} ${row.last_name}`.trim() : row.first_name || 'User',
        sender_profile_picture: row.profile_picture,
        seen_by: [] // We'll handle seen_by separately with a different approach
      };
    });
  }, [result.data]);

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

  return {
    messages: messagesWithSeenBy,
    loading: result.loading,
    error: result.error,
    dataCount: messagesWithSeenBy.length
  };
}

/**
 * Hook to get individual message status using PowerSync
 */
export function useIndividualMessageStatus(messageId: string, userId: string) {
  const { db, isPowerSyncAvailable } = usePowerSync();
  const query = PowerSyncChatFunctions.getIndividualMessageStatusQuery(messageId, userId);
  const params = [userId, messageId, userId, userId];
  
  const result = usePowerSyncDataWatcher(query, params);

  const messageStatus = useMemo(() => {
    if (!result.data || result.data.length === 0) return null;
    
    const row = result.data[0] as any;
    return {
      id: row.id,
      sender_id: row.sender_id,
      receiver_id: row.receiver_id,
      content: row.content,
      created_at: row.created_at,
      is_delivered: row.is_delivered,
      delivered_at: row.delivered_at,
      is_seen: row.is_seen,
      seen_at: row.seen_at
    };
  }, [result.data]);

  return {
    messageStatus,
    loading: result.loading,
    error: result.error
  };
}

/**
 * Hook to get group message status using PowerSync
 */
export function useGroupMessageStatus(messageId: string, userId: string) {
  const { db, isPowerSyncAvailable } = usePowerSync();
  const query = PowerSyncChatFunctions.getGroupMessageStatusQuery(messageId, userId);
  const params = [userId, messageId];
  
  const result = usePowerSyncDataWatcher(query, params);

  const messageStatus = useMemo(() => {
    if (!result.data || result.data.length === 0) return null;
    
    const row = result.data[0] as any;
    return {
      id: row.id,
      sender_id: row.sender_id,
      group_id: row.group_id,
      content: row.content,
      created_at: row.created_at,
      is_delivered: row.is_delivered,
      delivered_at: row.delivered_at,
      is_seen: row.is_seen,
      seen_at: row.seen_at
    };
  }, [result.data]);

  return {
    messageStatus,
    loading: result.loading,
    error: result.error
  };
} 