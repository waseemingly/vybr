import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { IndividualChat, GroupChat } from "@/types/chat";
import { INDIVIDUAL_CHATS, GROUP_CHATS } from "@/data/chatData";
import ChatCard from "./ChatCard";

interface ChatsTabsProps {
  onChatOpen: (chat: IndividualChat | GroupChat) => void;
  onProfileOpen: (chat: IndividualChat | GroupChat) => void;
}

const { height } = Dimensions.get("window");

const ChatsTabs: React.FC<ChatsTabsProps> = ({ onChatOpen, onProfileOpen }) => {
  const [activeTab, setActiveTab] = useState<"individual" | "groups">(
    "individual"
  );

  return (
    <View style={styles.container}>
      {/* Tab Navigation */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === "individual" && styles.activeTabButton,
          ]}
          onPress={() => setActiveTab("individual")}
          activeOpacity={0.7}
        >
          <Feather
            name="message-circle"
            size={16}
            color={activeTab === "individual" ? "#3B82F6" : "#6B7280"}
            style={styles.tabIcon}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === "individual" && styles.activeTabText,
            ]}
          >
            Individual
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === "groups" && styles.activeTabButton,
          ]}
          onPress={() => setActiveTab("groups")}
          activeOpacity={0.7}
        >
          <Feather
            name="users"
            size={16}
            color={activeTab === "groups" ? "#3B82F6" : "#6B7280"}
            style={styles.tabIcon}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === "groups" && styles.activeTabText,
            ]}
          >
            Groups
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      <View style={styles.tabContent}>
        {activeTab === "individual" ? (
          <FlatList
            data={INDIVIDUAL_CHATS}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ChatCard
                chat={item}
                onChatOpen={onChatOpen}
                onProfileOpen={onProfileOpen}
                type="individual"
              />
            )}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          />
        ) : (
          <FlatList
            data={GROUP_CHATS}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ChatCard
                chat={item}
                onChatOpen={onChatOpen}
                onProfileOpen={onProfileOpen}
                type="group"
              />
            )}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabsContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    borderRadius: 8,
    padding: 4,
    marginBottom: 12,
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 6,
  },
  activeTabButton: {
    backgroundColor: "white",
  },
  tabIcon: {
    marginRight: 6,
  },
  tabText: {
    fontSize: 14,
    color: "#6B7280",
  },
  activeTabText: {
    color: "#3B82F6",
    fontWeight: "500",
  },
  tabContent: {
    flex: 1,
  },
  listContent: {
    paddingTop: 4,
    paddingBottom: 16,
  },
});

export default ChatsTabs;
