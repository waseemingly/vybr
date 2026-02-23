// Function to create the PowerSync schema dynamically
export const createAppSchema = async () => {
  // Import PowerSync classes dynamically
  const powersyncModule = await import('@powersync/react-native');
  const { Schema, Table, column } = powersyncModule;

  // User profile and related data - matches sync rules SELECT statements
  const musicLoverProfiles = new Table({
    id: column.text, // user_id as id from sync rules
    user_id: column.text,
    first_name: column.text,
    last_name: column.text,
    username: column.text,
    email: column.text,
    age: column.integer,
    profile_picture: column.text,
    bio: column.text,
    country: column.text,
    city: column.text,
    is_premium: column.integer,
    music_data: column.text, // JSON string
    favorite_artists: column.text,
    favorite_songs: column.text,
    favorite_albums: column.text,
    created_at: column.text
  });

  const users = new Table({
    id: column.text,
    email: column.text,
    created_at: column.text,
    updated_at: column.text
  });

  const userStreamingData = new Table({
    user_id: column.text,
    data: column.text, // JSON string
    created_at: column.text,
    updated_at: column.text
  });

  // Events that the user can see
  const events = new Table({
    id: column.text,
    title: column.text,
    description: column.text,
    organizer_id: column.text,
    venue: column.text,
    address: column.text,
    city: column.text,
    state: column.text,
    country: column.text,
    postal_code: column.text,
    latitude: column.real,
    longitude: column.real,
    start_date: column.text,
    end_date: column.text,
    price: column.real,
    capacity: column.integer,
    current_attendees: column.integer,
    event_type: column.text,
    genre: column.text,
    age_restriction: column.text,
    dress_code: column.text,
    additional_info: column.text,
    image_url: column.text,
    is_public: column.integer,
    status: column.text,
    created_at: column.text,
    updated_at: column.text
  });

  // Messages for the user - matches sync rules SELECT statements
  const messages = new Table({
    id: column.text,
    sender_id: column.text,
    receiver_id: column.text,
    content: column.text,
    content_format: column.text,
    created_at: column.text
  });

  // Message status - matches sync rules SELECT statements
  const messageStatus = new Table({
    id: column.text, // message_id as id from sync rules
    message_id: column.text,
    user_id: column.text,
    is_delivered: column.integer,
    delivered_at: column.text,
    is_seen: column.integer,
    seen_at: column.text,
    created_at: column.text
  });

  // Group chats - matches sync rules SELECT statements
  const groupChats = new Table({
    id: column.text,
    group_name: column.text,
    group_image: column.text,
    created_by: column.text,
    can_members_add_others: column.integer,
    can_members_edit_info: column.integer,
    created_at: column.text
  });

  const groupChatParticipants = new Table({
    id: column.text, // group_id || '_' || user_id as id from sync rules
    group_id: column.text,
    user_id: column.text,
    is_admin: column.integer,
    joined_at: column.text
  });

  const groupChatMessages = new Table({
    id: column.text,
    group_id: column.text,
    sender_id: column.text,
    content: column.text,
    content_format: column.text,
    created_at: column.text
  });

  const groupMessageStatus = new Table({
    id: column.text, // group_id || '_' || message_id || '_' || user_id as id from sync rules
    group_id: column.text,
    message_id: column.text,
    user_id: column.text,
    is_delivered: column.integer,
    delivered_at: column.text,
    is_seen: column.integer,
    seen_at: column.text,
    created_at: column.text
  });

  // Blocks for the user - matches sync rules SELECT statements
  const blocks = new Table({
    id: column.text, // blocker_id || '_' || blocked_id as id from sync rules
    blocker_id: column.text,
    blocked_id: column.text,
    created_at: column.text
  });

  // Mutes for the user - matches sync rules SELECT statements
  const mutedUsers = new Table({
    id: column.text, // muter_id || '_' || muted_id as id from sync rules
    muter_id: column.text,
    muted_id: column.text,
    created_at: column.text
  });

  // Organizer profiles the user follows
  const organizerProfiles = new Table({
    user_id: column.text,
    company_name: column.text,
    email: column.text,
    phone_number: column.text,
    logo: column.text,
    business_type: column.text,
    bio: column.text,
    website: column.text,
    stripe_connect_account_id: column.text,
    created_at: column.text,
    updated_at: column.text
  });

  const organizerFollows = new Table({
    user_id: column.text,
    organizer_id: column.text,
    created_at: column.text
  });

  // Reports made by the user
  const reports = new Table({
    id: column.text,
    reporter_id: column.text,
    reported_user_id: column.text,
    reason: column.text,
    description: column.text,
    status: column.text,
    created_at: column.text,
    updated_at: column.text
  });

  const organizerReports = new Table({
    id: column.text,
    reporter_id: column.text,
    reported_organizer_id: column.text,
    reason: column.text,
    description: column.text,
    status: column.text,
    created_at: column.text,
    updated_at: column.text
  });

  // Create and return the schema
  return new Schema({
    music_lover_profiles: musicLoverProfiles,
    users,
    userStreamingData,
    events,
    messages,
    message_status: messageStatus,
    group_chats: groupChats,
    group_chat_participants: groupChatParticipants,
    group_chat_messages: groupChatMessages,
    group_message_status: groupMessageStatus,
    blocks,
    muted_users: mutedUsers,
    organizerProfiles,
    organizerFollows,
    reports,
    organizerReports
  });
};

// Export types - these will be used when the schema is created
export type Database = any; // Will be properly typed when schema is created
export type MusicLoverProfileRecord = any;
export type UserRecord = any;
export type UserStreamingDataRecord = any;
export type EventRecord = any;
export type MessageRecord = any;
export type MessageStatusRecord = any;
export type GroupChatRecord = any;
export type GroupChatParticipantRecord = any;
export type GroupChatMessageRecord = any;
export type GroupMessageStatusRecord = any;
export type BlockRecord = any;
export type MutedUserRecord = any;
export type OrganizerProfileRecord = any;
export type OrganizerFollowRecord = any;
export type ReportRecord = any;
export type OrganizerReportRecord = any; 