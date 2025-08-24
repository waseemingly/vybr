import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";

interface ConversationStartersProps {
  starters: string[];
  musicStarters?: string[];
  onSelect?: (starter: string) => void;
}

const ConversationStarters: React.FC<ConversationStartersProps> = ({
  starters,
  musicStarters,
  onSelect,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <View style={styles.headerContainer}>
          <Feather name="star" size={14} color="#EAB308" style={styles.icon} />
          <Text style={styles.sectionHeader}>AI Conversation Starters</Text>
        </View>

        {starters.map((starter, index) => (
          <TouchableOpacity
            key={index}
            style={styles.starterCard}
            onPress={() => onSelect && onSelect(starter)}
            activeOpacity={0.7}
          >
            <Text style={styles.starterText}>{starter}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {musicStarters && musicStarters.length > 0 && (
        <View style={styles.section}>
          <View style={styles.headerContainer}>
            <Feather
              name="music"
              size={14}
              color="#3B82F6"
              style={styles.icon}
            />
            <Text style={styles.sectionHeader}>
              Music Conversation Starters
            </Text>
          </View>

          {musicStarters.map((starter, index) => (
            <TouchableOpacity
              key={`music-${index}`}
              style={styles.musicStarterCard}
              onPress={() => onSelect && onSelect(starter)}
              activeOpacity={0.7}
            >
              <Text style={styles.musicStarterText}>{starter}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

import { conversationStartersStyles as styles } from '@/styles/chatstyles';

export default ConversationStarters;
