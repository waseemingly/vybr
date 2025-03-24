import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { IndividualChat, GroupChat } from "@/types/chat";
import { generateMusicConversationStarters } from "@/utils/conversationUtils";
import ChatsTabs from "@/components/ChatsTabs";
import ChatProfileSheet from "@/components/ChatProfileSheet";
import ConversationStarters from "@/components/ConversationStarters";

const ChatsScreen = () => {
  const [selectedChat, setSelectedChat] = useState<
    IndividualChat | GroupChat | null
  >(null);
  const [musicStarters, setMusicStarters] = useState<string[]>([]);
  const [showProfileSheet, setShowProfileSheet] = useState<boolean>(false);

  const handleChatOpen = (chat: IndividualChat | GroupChat) => {
    setSelectedChat(chat);
    setShowProfileSheet(false);

    // TypeScript guard to check if chat has commonArtists or commonGenres
    if ("commonArtists" in chat || "commonGenres" in chat) {
      const commonArtists =
        "commonArtists" in chat ? chat.commonArtists : undefined;
      const commonGenres =
        "commonGenres" in chat ? chat.commonGenres : undefined;

      const generatedStarters = generateMusicConversationStarters(
        commonArtists,
        commonGenres
      );
      setMusicStarters(generatedStarters);
    } else {
      setMusicStarters([]);
    }
  };

  const handleProfileOpen = (chat: IndividualChat | GroupChat) => {
    setSelectedChat(chat);
    setShowProfileSheet(true);
  };

  useEffect(() => {
    if (!selectedChat) {
      setMusicStarters([]);
    }
  }, [selectedChat]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View style={styles.titleContainer}>
            <Feather
              name="message-square"
              size={22}
              color="#60A5FA"
              style={styles.headerIcon}
            />
            <Text style={styles.title}>Chats</Text>
          </View>

          <Image
            source={{ uri: "https://yourappurl.com/logo.png" }}
            style={styles.logo}
          />
        </View>

        <View style={styles.headerSubRow}>
          <Text style={styles.subtitle}>Connect with your matches</Text>

          <TouchableOpacity
            style={styles.createGroupButton}
            activeOpacity={0.7}
          >
            <Feather name="user-plus" size={18} color="#3B82F6" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        <ChatsTabs
          onChatOpen={handleChatOpen}
          onProfileOpen={handleProfileOpen}
        />

        {selectedChat && !showProfileSheet && (
          <View style={styles.chatPreview}>
            <Text style={styles.chatPreviewTitle}>
              Chat with {selectedChat.name}
            </Text>
            <Text style={styles.chatPreviewMessage}>
              {selectedChat.lastMessage}
            </Text>

            {"conversationStarters" in selectedChat && (
              <ConversationStarters
                starters={selectedChat.conversationStarters || []}
                musicStarters={musicStarters}
                onSelect={(starter) => {
                  console.log("Selected starter:", starter);
                  // Here you would implement functionality to use this starter
                }}
              />
            )}
          </View>
        )}
      </View>

      {/* Profile Sheet */}
      {selectedChat && (
        <ChatProfileSheet
          chat={selectedChat}
          musicStarters={musicStarters}
          visible={showProfileSheet}
          onClose={() => setShowProfileSheet(false)}
          onSendMessage={() => {
            setShowProfileSheet(false);
            // Additional logic to navigate to chat or perform other actions
          }}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  header: {
    paddingTop: 16,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  headerTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerIcon: {
    marginRight: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#3B82F6",
  },
  logo: {
    height: 36,
    width: 36,
    resizeMode: "contain",
  },
  headerSubRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
  },
  createGroupButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  chatPreview: {
    marginTop: 16,
    padding: 16,
    backgroundColor: "white",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  chatPreviewTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
    color: "#1F2937",
  },
  chatPreviewMessage: {
    fontSize: 14,
    color: "#4B5563",
    marginBottom: 16,
  },
});

export default ChatsScreen;
