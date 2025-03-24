import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Chat, GroupChat, IndividualChat } from "@/types/chat";

interface ChatCardProps {
  chat: Chat;
  onChatOpen: (chat: IndividualChat | GroupChat) => void;
  onProfileOpen: (chat: IndividualChat | GroupChat) => void;
  type: "individual" | "group";
}

const ChatCard: React.FC<ChatCardProps> = ({
  chat,
  onChatOpen,
  onProfileOpen,
  type,
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.container,
        chat.isPinned && styles.pinned,
        chat.unread > 0 && styles.unread,
      ]}
      activeOpacity={0.7}
      onPress={() => onChatOpen(chat)}
    >
      <View style={styles.content}>
        <TouchableOpacity
          style={styles.avatarContainer}
          onPress={(e) => {
            // Prevent triggering parent's onPress
            e.stopPropagation();
            onProfileOpen(chat);
          }}
        >
          {chat.image ? (
            <Image source={{ uri: chat.image }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              {type === "group" ? (
                <Feather name="users" size={20} color="#3B82F6" />
              ) : (
                <Text style={styles.avatarText}>{chat.name.charAt(0)}</Text>
              )}
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.chatInfo}>
          <View style={styles.nameTimeRow}>
            <Text style={styles.name} numberOfLines={1}>
              {chat.name}
            </Text>
            <Text style={styles.time}>{chat.time}</Text>
          </View>

          <Text style={styles.message} numberOfLines={1}>
            {chat.lastMessage}
          </Text>

          {type === "group" && (
            <View style={styles.membersRow}>
              <Text style={styles.members} numberOfLines={1}>
                {(chat as GroupChat).members.join(", ")}
              </Text>
            </View>
          )}
        </View>

        {chat.unread > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{chat.unread}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "white",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  pinned: {
    borderLeftWidth: 4,
    borderLeftColor: "#60A5FA",
  },
  unread: {
    backgroundColor: "rgba(59, 130, 246, 0.05)",
  },
  content: {
    flexDirection: "row",
    padding: 12,
    alignItems: "center",
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#3B82F6",
  },
  chatInfo: {
    flex: 1,
  },
  nameTimeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  name: {
    fontWeight: "600",
    fontSize: 16,
    color: "#1F2937",
    flex: 1,
  },
  time: {
    fontSize: 12,
    color: "#6B7280",
    marginLeft: 8,
  },
  message: {
    fontSize: 14,
    color: "#4B5563",
    marginTop: 2,
  },
  membersRow: {
    marginTop: 4,
  },
  members: {
    fontSize: 12,
    color: "#6B7280",
  },
  badge: {
    backgroundColor: "#60A5FA",
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  badgeText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
});

export default ChatCard;
