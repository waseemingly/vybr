import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import ConversationStarters from "./ConversationStarters";
import { Chat, IndividualChat } from "@/types/chat";

interface ChatProfileSheetProps {
  chat: Chat;
  musicStarters: string[];
  visible: boolean;
  onClose: () => void;
  onSendMessage: () => void;
}

const ChatProfileSheet: React.FC<ChatProfileSheetProps> = ({
  chat,
  musicStarters,
  visible,
  onClose,
  onSendMessage,
}) => {
  // TypeGuard for IndividualChat
  const isIndividualChat = (chat: Chat): chat is IndividualChat => {
    return "commonArtists" in chat || "commonGenres" in chat;
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.sheetContainer}>
          <View style={styles.handle} />

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Feather name="x" size={24} color="#6B7280" />
          </TouchableOpacity>

          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.profileContainer}>
              {chat.image ? (
                <Image source={{ uri: chat.image }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarText}>{chat.name.charAt(0)}</Text>
                </View>
              )}

              <Text style={styles.name}>{chat.name}</Text>

              {isIndividualChat(chat) && chat.commonArtists && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Common Artists</Text>
                  <View style={styles.tagsContainer}>
                    {chat.commonArtists.map((artist, i) => (
                      <View key={i} style={styles.tag}>
                        <Text style={styles.tagText}>{artist}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {isIndividualChat(chat) && chat.commonGenres && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Common Genres</Text>
                  <View style={styles.tagsContainer}>
                    {chat.commonGenres.map((genre, i) => (
                      <View key={i} style={styles.genreTag}>
                        <Text style={styles.genreTagText}>{genre}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {isIndividualChat(chat) && chat.conversationStarters && (
                <ConversationStarters
                  starters={chat.conversationStarters}
                  musicStarters={musicStarters}
                  onSelect={(starter) => {
                    console.log("Selected starter:", starter);
                    // Here you would implement functionality to use this starter
                  }}
                />
              )}

              <TouchableOpacity
                style={styles.messageButton}
                onPress={onSendMessage}
              >
                <Text style={styles.messageButtonText}>Message</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

import { chatProfileSheetStyles as styles } from '@/styles/chatstyles';

export default ChatProfileSheet;
