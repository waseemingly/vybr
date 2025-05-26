import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
  ActivityIndicator, Alert, SafeAreaView, TextInput
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { APP_CONSTANTS } from '@/config/constants';
import type { RootStackParamList, MainStackParamList } from '@/navigation/AppNavigator';

// Define route parameters
type ShareEventScreenParams = {
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventVenue: string;
  eventImage?: string;
};

type ShareEventScreenRouteProp = RouteProp<
  { ShareEventScreen: ShareEventScreenParams },
  'ShareEventScreen'
>;

type ShareEventNavigationProp = NativeStackNavigationProp<RootStackParamList & MainStackParamList>;

// Define types for chat data
interface ChatUser {
  partner_user_id: string;
  partner_first_name: string;
  partner_last_name: string;
  partner_profile_picture: string | null;
  last_message_content: string | null;
  last_message_created_at: string | null;
}

interface GroupChat {
  group_id: string;
  group_name: string;
  group_image: string | null;
  is_admin: boolean;
  last_message_content: string | null;
  last_message_created_at: string | null;
  member_count: number;
}

// Combined type for the list
type ChatItem = { 
  id: string; 
  name: string;
  image: string | null;
  type: 'individual' | 'group';
  lastMessage?: string | null;
  lastActive?: string | null;
};

const DEFAULT_IMAGE = 'https://via.placeholder.com/100x100/E5E7EB/9CA3AF?text=User';
const DEFAULT_GROUP_IMAGE = 'https://via.placeholder.com/100x100/DBEAFE/3B82F6?text=Group';
const DEFAULT_EVENT_IMAGE = 'https://via.placeholder.com/300x200/F3F4F6/4B5563?text=Event';

const ShareEventScreen = () => {
  const { session } = useAuth();
  const navigation = useNavigation<ShareEventNavigationProp>();
  const route = useRoute<ShareEventScreenRouteProp>();
  const { eventId, eventTitle, eventDate, eventVenue, eventImage } = route.params;

  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [individualChats, setIndividualChats] = useState<ChatUser[]>([]);
  const [groupChats, setGroupChats] = useState<GroupChat[]>([]);
  const [sharingTo, setSharingTo] = useState<string | null>(null);

  useEffect(() => {
    fetchChats();
    
    // Set navigation title
    navigation.setOptions({
      title: 'Share Event',
      headerRight: () => (
        <TouchableOpacity
          style={{ marginRight: 8 }}
          onPress={() => navigation.goBack()}
        >
          <Text style={{ color: APP_CONSTANTS.COLORS.PRIMARY, fontSize: 16 }}>Done</Text>
        </TouchableOpacity>
      ),
    });
  }, []);

  const fetchChats = async () => {
    setIsLoading(true);
    try {
      // Fetch individual chats
      const { data: individualChatsData, error: individualChatsError } = await supabase
        .rpc('get_chat_list');

      if (individualChatsError) throw individualChatsError;

      // Fetch group chats
      const { data: groupChatsData, error: groupChatsError } = await supabase
        .rpc('get_group_chat_list');

      if (groupChatsError) throw groupChatsError;

      setIndividualChats(individualChatsData || []);
      setGroupChats(groupChatsData || []);
    } catch (error: any) {
      console.error('Error fetching chats:', error.message);
      Alert.alert('Error', 'Failed to load chats. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleShareToIndividualChat = async (recipientId: string, recipientName: string) => {
    if (!session?.user) {
      Alert.alert('Error', 'You must be logged in to share');
      return;
    }
    
    console.log(`Navigating to chat with ${recipientName} to share event ${eventId}`);
    
    // Navigate to the individual chat screen with event sharing data
    navigation.navigate('IndividualChatScreen', {
      matchUserId: recipientId,
      matchName: recipientName,
      matchProfilePicture: null,
      // Pass the event data for pre-composed message
      sharedEventData: {
        eventId,
        eventTitle,
        eventDate,
        eventVenue,
        eventImage: eventImage || DEFAULT_EVENT_IMAGE,
        isSharing: true
      }
    });
  };

  const handleShareToGroupChat = async (groupId: string, groupName: string) => {
    if (!session?.user) {
      Alert.alert('Error', 'You must be logged in to share');
      return;
    }
    
    console.log(`Navigating to group chat ${groupName} to share event ${eventId}`);
    
    // Navigate to the group chat screen with event sharing data
    navigation.navigate('GroupChatScreen', {
      groupId: groupId,
      groupName: groupName,
      groupImage: null,
      // Pass the event data for pre-composed message
      sharedEventData: {
        eventId,
        eventTitle,
        eventDate,
        eventVenue,
        eventImage: eventImage || DEFAULT_EVENT_IMAGE,
        isSharing: true
      }
    });
  };

  // Combine and format chats for display
  const allChats: ChatItem[] = [
    ...individualChats.map(chat => ({
      id: chat.partner_user_id,
      name: `${chat.partner_first_name || ''} ${chat.partner_last_name || ''}`.trim() || 'User',
      image: chat.partner_profile_picture,
      type: 'individual' as const,
      lastMessage: chat.last_message_content,
      lastActive: chat.last_message_created_at
    })),
    ...groupChats.map(chat => ({
      id: chat.group_id,
      name: chat.group_name,
      image: chat.group_image,
      type: 'group' as const,
      lastMessage: chat.last_message_content,
      lastActive: chat.last_message_created_at
    }))
  ].sort((a, b) => {
    // Sort by last activity
    const dateA = a.lastActive ? new Date(a.lastActive).getTime() : 0;
    const dateB = b.lastActive ? new Date(b.lastActive).getTime() : 0;
    return dateB - dateA;
  });

  // Filter chats based on search query
  const filteredChats = searchQuery
    ? allChats.filter(chat => 
        chat.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : allChats;

  const renderChatItem = ({ item }: { item: ChatItem }) => {
    const isSharing = sharingTo === item.id;
    
    return (
      <TouchableOpacity
        style={styles.chatItem}
        onPress={() => {
          if (item.type === 'individual') {
            handleShareToIndividualChat(item.id, item.name);
          } else {
            handleShareToGroupChat(item.id, item.name);
          }
        }}
        disabled={isSharing}
      >
        <Image
          source={{ uri: item.image || (item.type === 'group' ? DEFAULT_GROUP_IMAGE : DEFAULT_IMAGE) }}
          style={styles.chatAvatar}
        />
        <View style={styles.chatInfo}>
          <Text style={styles.chatName}>{item.name}</Text>
          <Text style={styles.chatType}>
            {item.type === 'group' ? 'Group Chat' : 'Individual Chat'}
          </Text>
        </View>
        <View style={styles.shareIndicator}>
          {isSharing ? (
            <ActivityIndicator size="small" color={APP_CONSTANTS.COLORS.PRIMARY} />
          ) : (
            <Feather name="share" size={20} color={APP_CONSTANTS.COLORS.PRIMARY} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.eventPreview}>
        <Image 
          source={{ uri: eventImage || DEFAULT_EVENT_IMAGE }}
          style={styles.eventImage}
        />
        <View style={styles.eventInfo}>
          <Text style={styles.eventTitle} numberOfLines={2}>{eventTitle}</Text>
          <View style={styles.eventDetailRow}>
            <Feather name="calendar" size={14} color="#6B7280" />
            <Text style={styles.eventDetailText}>{eventDate}</Text>
          </View>
          <View style={styles.eventDetailRow}>
            <Feather name="map-pin" size={14} color="#6B7280" />
            <Text style={styles.eventDetailText} numberOfLines={1}>{eventVenue}</Text>
          </View>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <Feather name="search" size={18} color="#9CA3AF" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search chats..."
          placeholderTextColor="#9CA3AF"
        />
      </View>

      <Text style={styles.sectionTitle}>Select Chat</Text>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} />
        </View>
      ) : (
        <FlatList
          data={filteredChats}
          renderItem={renderChatItem}
          keyExtractor={item => `${item.type}-${item.id}`}
          contentContainerStyle={styles.list}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Feather name="message-circle" size={48} color="#CBD5E1" />
              <Text style={styles.emptyText}>No chats found</Text>
              <Text style={styles.emptySubText}>
                {searchQuery ? 'Try a different search term' : 'Start a chat to share this event'}
              </Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  eventPreview: {
    flexDirection: 'row',
    backgroundColor: 'white',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  eventImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  eventInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  eventDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  eventDetailText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
  },
  searchContainer: {
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
    color: '#1F2937',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4B5563',
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  list: {
    padding: 8,
  },
  chatItem: {
    flexDirection: 'row',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  chatAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E5E7EB',
  },
  chatInfo: {
    flex: 1,
    marginLeft: 12,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
  },
  chatType: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  shareIndicator: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4B5563',
    marginTop: 16,
  },
  emptySubText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});

export default ShareEventScreen; 