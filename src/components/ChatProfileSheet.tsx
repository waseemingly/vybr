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

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  sheetContainer: {
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: "85%",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E7EB",
    alignSelf: "center",
    marginBottom: 12,
  },
  closeButton: {
    position: "absolute",
    right: 20,
    top: 12,
    zIndex: 1,
  },
  content: {
    paddingBottom: 40,
    paddingTop: 20,
  },
  profileContainer: {
    alignItems: "center",
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 16,
  },
  avatarFallback: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: "600",
    color: "#3B82F6",
  },
  name: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 16,
    color: "#1F2937",
  },
  section: {
    width: "100%",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
    marginBottom: 8,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
  },
  tag: {
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    margin: 4,
  },
  tagText: {
    color: "#1E3A8A",
    fontSize: 14,
  },
  genreTag: {
    backgroundColor: "rgba(96, 165, 250, 0.1)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    margin: 4,
  },
  genreTagText: {
    color: "#3B82F6",
    fontSize: 14,
  },
  messageButton: {
    backgroundColor: "#3B82F6",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    width: "100%",
    alignItems: "center",
    marginTop: 24,
  },
  messageButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 16,
  },
});

export default ChatProfileSheet;
