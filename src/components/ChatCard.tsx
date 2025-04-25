// // import React from "react";
// // import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
// // import { Feather } from "@expo/vector-icons";
// // import { Chat, GroupChat, IndividualChat } from "@/types/chat";

// // interface ChatCardProps {
// //   chat: Chat;
// //   onChatOpen: (chat: IndividualChat | GroupChat) => void;
// //   onProfileOpen: (chat: IndividualChat | GroupChat) => void;
// //   type: "individual" | "group";
// // }

// // const ChatCard: React.FC<ChatCardProps> = ({
// //   chat,
// //   onChatOpen,
// //   onProfileOpen,
// //   type,
// // }) => {
// //   return (
// //     <TouchableOpacity
// //       style={[
// //         styles.container,
// //         chat.isPinned && styles.pinned,
// //         chat.unread > 0 && styles.unread,
// //       ]}
// //       activeOpacity={0.7}
// //       onPress={() => onChatOpen(chat)}
// //     >
// //       <View style={styles.content}>
// //         <TouchableOpacity
// //           style={styles.avatarContainer}
// //           onPress={(e) => {
// //             // Prevent triggering parent's onPress
// //             e.stopPropagation();
// //             onProfileOpen(chat);
// //           }}
// //         >
// //           {chat.image ? (
// //             <Image source={{ uri: chat.image }} style={styles.avatar} />
// //           ) : (
// //             <View style={styles.avatarFallback}>
// //               {type === "group" ? (
// //                 <Feather name="users" size={20} color="#3B82F6" />
// //               ) : (
// //                 <Text style={styles.avatarText}>{chat.name.charAt(0)}</Text>
// //               )}
// //             </View>
// //           )}
// //         </TouchableOpacity>

// //         <View style={styles.chatInfo}>
// //           <View style={styles.nameTimeRow}>
// //             <Text style={styles.name} numberOfLines={1}>
// //               {chat.name}
// //             </Text>
// //             <Text style={styles.time}>{chat.time}</Text>
// //           </View>

// //           <Text style={styles.message} numberOfLines={1}>
// //             {chat.lastMessage}
// //           </Text>

// //           {type === "group" && (
// //             <View style={styles.membersRow}>
// //               <Text style={styles.members} numberOfLines={1}>
// //                 {(chat as GroupChat).members.join(", ")}
// //               </Text>
// //             </View>
// //           )}
// //         </View>

// //         {chat.unread > 0 && (
// //           <View style={styles.badge}>
// //             <Text style={styles.badgeText}>{chat.unread}</Text>
// //           </View>
// //         )}
// //       </View>
// //     </TouchableOpacity>
// //   );
// // };

// // const styles = StyleSheet.create({
// //   container: {
// //     backgroundColor: "white",
// //     borderRadius: 12,
// //     overflow: "hidden",
// //     marginBottom: 8,
// //     shadowColor: "#000",
// //     shadowOffset: { width: 0, height: 1 },
// //     shadowOpacity: 0.1,
// //     shadowRadius: 2,
// //     elevation: 2,
// //     borderWidth: 1,
// //     borderColor: "#F3F4F6",
// //   },
// //   pinned: {
// //     borderLeftWidth: 4,
// //     borderLeftColor: "#60A5FA",
// //   },
// //   unread: {
// //     backgroundColor: "rgba(59, 130, 246, 0.05)",
// //   },
// //   content: {
// //     flexDirection: "row",
// //     padding: 12,
// //     alignItems: "center",
// //   },
// //   avatarContainer: {
// //     marginRight: 12,
// //   },
// //   avatar: {
// //     width: 48,
// //     height: 48,
// //     borderRadius: 24,
// //   },
// //   avatarFallback: {
// //     width: 48,
// //     height: 48,
// //     borderRadius: 24,
// //     backgroundColor: "rgba(59, 130, 246, 0.1)",
// //     alignItems: "center",
// //     justifyContent: "center",
// //   },
// //   avatarText: {
// //     fontSize: 18,
// //     fontWeight: "600",
// //     color: "#3B82F6",
// //   },
// //   chatInfo: {
// //     flex: 1,
// //   },
// //   nameTimeRow: {
// //     flexDirection: "row",
// //     justifyContent: "space-between",
// //     marginBottom: 4,
// //   },
// //   name: {
// //     fontWeight: "600",
// //     fontSize: 16,
// //     color: "#1F2937",
// //     flex: 1,
// //   },
// //   time: {
// //     fontSize: 12,
// //     color: "#6B7280",
// //     marginLeft: 8,
// //   },
// //   message: {
// //     fontSize: 14,
// //     color: "#4B5563",
// //     marginTop: 2,
// //   },
// //   membersRow: {
// //     marginTop: 4,
// //   },
// //   members: {
// //     fontSize: 12,
// //     color: "#6B7280",
// //   },
// //   badge: {
// //     backgroundColor: "#60A5FA",
// //     borderRadius: 12,
// //     minWidth: 24,
// //     height: 24,
// //     alignItems: "center",
// //     justifyContent: "center",
// //     paddingHorizontal: 6,
// //     marginLeft: 8,
// //   },
// //   badgeText: {
// //     color: "white",
// //     fontSize: 12,
// //     fontWeight: "600",
// //   },
// // });

// // export default ChatCard;

// // src/components/ChatCard.tsx

// import React from "react";
// import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
// import { Feather } from "@expo/vector-icons";

// // Import the ChatListItem type (ensure path is correct or define it here)
// import type { ChatListItem } from "@/screens/ChatsScreen"; // Adjust path if needed

// // --- Simple Timestamp Formatter (Copy from ChatsScreen or move to utils) ---
// const formatTimestamp = (timestamp: string | null): string => {
//     if (!timestamp) return '';
//     try {
//         const date = new Date(timestamp);
//         const now = new Date();
//         // Simple comparison for today/yesterday - consider library for robustness
//         const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
//         const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);

//         if (date >= startOfToday) {
//             // Today: Show time
//             return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
//         } else if (date >= startOfYesterday) {
//              // Yesterday
//              return 'Yesterday';
//         } else {
//             // Older: Show date M/D/YY
//             return date.toLocaleDateString([], { year: '2-digit', month: 'numeric', day: 'numeric' });
//         }
//     } catch (e) {
//         console.error("Error formatting timestamp:", e);
//         return '';
//     }
// };
// // -------------------------------------

// // Define Props for the dynamic data
// interface ChatCardProps {
//   chatItem: ChatListItem; // Use the fetched data structure
//   onChatOpen: (chatItem: ChatListItem) => void;
//   onProfileOpen: (chatItem: ChatListItem) => void;
//   // 'type' prop is removed as we are only showing individual chats for now
//   // Add props for unread count or pinned status later if needed
// }

// const DEFAULT_PROFILE_PIC = 'https://via.placeholder.com/150/CCCCCC/808080?text=No+User';

// const ChatCard: React.FC<ChatCardProps> = ({
//   chatItem,
//   onChatOpen,
//   onProfileOpen,
// }) => {
//   // Combine names safely, provide fallback
//   const partnerName = `${chatItem.partner_first_name || ''} ${chatItem.partner_last_name || ''}`.trim() || 'Chat User';
//   // Format the timestamp
//   const displayTime = formatTimestamp(chatItem.last_message_created_at);
//   // Provide fallback for last message
//   const lastMessageDisplay = chatItem.last_message_content || 'No messages yet';
//   // Provide fallback for profile picture
//   const profilePictureUri = chatItem.partner_profile_picture ?? DEFAULT_PROFILE_PIC;

//   return (
//     // Pass the specific chatItem to the handler
//     <TouchableOpacity
//       style={[ styles.container /* Add .pinned/.unread later */ ]}
//       activeOpacity={0.7}
//       onPress={() => onChatOpen(chatItem)}
//     >
//       <View style={styles.content}>
//         {/* Use TouchableOpacity for avatar press */}
//         <TouchableOpacity
//           style={styles.avatarContainer}
//           onPress={(e) => {
//             e.stopPropagation(); // Prevent triggering card press
//             onProfileOpen(chatItem); // Pass the specific chatItem
//           }}
//         >
//           {/* Use dynamic image source */}
//           <Image source={{ uri: profilePictureUri }} style={styles.avatar} />
//           {/* Fallback view removed for simplicity, Image handles default */}
//         </TouchableOpacity>

//         {/* Display dynamic info */}
//         <View style={styles.chatInfo}>
//           <View style={styles.nameTimeRow}>
//             <Text style={styles.name} numberOfLines={1}>
//               {partnerName}
//             </Text>
//             <Text style={styles.time}>{displayTime}</Text>
//           </View>
//           <Text style={styles.message} numberOfLines={1}>
//             {lastMessageDisplay}
//           </Text>
//           {/* Group members row removed */}
//         </View>

//         {/* Unread badge logic needs to be added later */}
//         {/* {chatItem.unread > 0 && ( ... ) */}
//       </View>
//     </TouchableOpacity>
//   );
// };

// // Styles (Keep original styles, minor cleanup)
// const styles = StyleSheet.create({
//   container: {
//     backgroundColor: "white",
//     borderRadius: 12,
//     overflow: "hidden",
//     marginBottom: 8,
//     shadowColor: "#000",
//     shadowOffset: { width: 0, height: 1 },
//     shadowOpacity: 0.05, // Slightly reduced shadow
//     shadowRadius: 2,
//     elevation: 2,
//     borderWidth: 1,
//     borderColor: "#F3F4F6",
//   },
//   // Styles for pinned/unread can be added back later
//   // pinned: { borderLeftWidth: 4, borderLeftColor: "#60A5FA", },
//   // unread: { backgroundColor: "rgba(59, 130, 246, 0.05)", },
//   content: {
//     flexDirection: "row",
//     padding: 12,
//     alignItems: "center",
//   },
//   avatarContainer: {
//     marginRight: 12,
//   },
//   avatar: {
//     width: 48,
//     height: 48,
//     borderRadius: 24,
//     backgroundColor: '#E5E7EB', // Background color while loading/if no image
//   },
//   chatInfo: {
//     flex: 1,
//   },
//   nameTimeRow: {
//     flexDirection: "row",
//     justifyContent: "space-between",
//     marginBottom: 4,
//   },
//   name: {
//     fontWeight: "600",
//     fontSize: 16,
//     color: "#1F2937",
//     flexShrink: 1, // Allow name to shrink if time is long
//     marginRight: 5,
//   },
//   time: {
//     fontSize: 12,
//     color: "#6B7280",
//     marginLeft: 8,
//     flexShrink: 0, // Don't allow time to shrink
//   },
//   message: {
//     fontSize: 14,
//     color: "#4B5563",
//     marginTop: 2,
//   },
//   // Badge styles can be added back later
//   // badge: { ... }
//   // badgeText: { ... }
// });

// export default ChatCard;

// src/components/ChatCard.tsx

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';

interface ChatCardProps {
    id: string; // Can be user_id or group_id
    name: string;
    image: string | null;
    lastMessage: string;
    time: string;
    unread: number;
    isPinned: boolean;
    type: 'individual' | 'group'; // To determine avatar fallback etc.
    membersPreview?: string; // Optional: For group chats, e.g., "You, John, +3 others"
    onChatOpen: () => void; // Called when the card body is pressed
    onProfileOpen?: () => void; // Called ONLY when avatar is pressed (for individual)
}

// Define default images - consider adding actual assets to your project
const DEFAULT_GROUP_PIC_URL = 'https://via.placeholder.com/150/CCCCCC/808080?text=Group'; // Placeholder
const DEFAULT_PROFILE_PIC_URL = 'https://via.placeholder.com/150/CCCCCC/808080?text=User'; // Placeholder

const ChatCard: React.FC<ChatCardProps> = ({
    id, name, image, lastMessage, time, unread, isPinned, type, membersPreview,
    onChatOpen, onProfileOpen
}) => {
    // Determine the image source or fallback
    const imageSourceUri = image ?? (type === 'group' ? DEFAULT_GROUP_PIC_URL : DEFAULT_PROFILE_PIC_URL);

    return (
        <TouchableOpacity
            style={[styles.container, isPinned && styles.pinned, unread > 0 && styles.unread]}
            activeOpacity={0.8} // Slightly more feedback on press
            onPress={onChatOpen} // Navigate to chat on main card press
        >
            <View style={styles.content}>
                {/* Avatar Area - Tappable only for individual profiles */}
                <TouchableOpacity
                    style={styles.avatarContainer}
                    // Only allow profile open for individual chats and if handler exists
                    onPress={ (type === 'individual' && onProfileOpen) ? (e) => { e.stopPropagation(); onProfileOpen(); } : undefined }
                    disabled={type === 'group' || !onProfileOpen}
                    activeOpacity={0.8}
                >
                    {/* Use Image component - consider adding placeholder/error handling later */}
                    <Image source={{ uri: imageSourceUri }} style={styles.avatar} />
                    {/* You could add an online indicator dot here later */}
                </TouchableOpacity>

                {/* Chat Info Area */}
                <View style={styles.chatInfo}>
                    <View style={styles.nameTimeRow}>
                        <Text style={[styles.name, unread > 0 && styles.nameUnread]} numberOfLines={1}>{name}</Text>
                        <Text style={styles.time}>{time}</Text>
                    </View>
                    <Text style={[styles.message, unread > 0 && styles.messageUnread]} numberOfLines={1}>
                        {lastMessage}
                    </Text>
                    {/* Show members preview only for groups */}
                    {type === 'group' && membersPreview && (
                        <View style={styles.membersRow}>
                            <Text style={styles.members} numberOfLines={1}>{membersPreview}</Text>
                        </View>
                    )}
                </View>

                {/* Unread Badge */}
                {unread > 0 && (
                    <View style={styles.badgeContainer}>
                        <View style={styles.badge}>
                           <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
                        </View>
                    </View>
                )}
                 {/* Pinned Icon (Optional) */}
                 {isPinned && !unread && ( // Show pin only if not unread (badge takes precedence)
                     <View style={styles.badgeContainer}>
                         <Feather name="map-pin" size={16} color="#A0AEC0" style={styles.pinIcon} />
                    </View>
                 )}
            </View>
        </TouchableOpacity>
    );
};

// --- Styles ---
const styles = StyleSheet.create({
    container: {
        backgroundColor: "white",
        borderRadius: 12,
        overflow: "hidden", // Changed from hidden to visible if badge needs overflow
        marginBottom: 8,
        // Removed shadows for a flatter look, add back if desired
        borderWidth: StyleSheet.hairlineWidth, // Use hairline for subtle border
        borderColor: "#E5E7EB", // Lighter border
    },
    pinned: {
        borderLeftWidth: 3, // Slightly thinner pinned border
        borderLeftColor: "#60A5FA",
        // backgroundColor: '#F0F9FF' // Optional subtle background for pinned
    },
    unread: {
        // Keep subtle background or remove if badge is enough
         backgroundColor: "rgba(59, 130, 246, 0.03)",
    },
    content: {
        flexDirection: "row",
        paddingVertical: 12,
        paddingHorizontal: 12,
        alignItems: "center",
    },
    avatarContainer: {
        marginRight: 12,
        position: 'relative', // For potential online indicator
    },
    avatar: {
        width: 52, // Slightly larger avatar
        height: 52,
        borderRadius: 26,
        backgroundColor: '#E5E7EB', // Background color while loading
    },
    // Removed avatarFallback styles - handled by Image component's default source or background
    chatInfo: {
        flex: 1,
        justifyContent: 'center', // Vertically center text lines
    },
    nameTimeRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: 'center', // Align name and time vertically
        marginBottom: 3, // Reduced space
    },
    name: {
        fontWeight: "600",
        fontSize: 15, // Slightly smaller name
        color: "#1F2937",
        flexShrink: 1, // Allow name to shrink if time is long
        marginRight: 5,
    },
    nameUnread: {
         fontWeight: "bold", // Make name bold if unread
         color: "#111827",
    },
    time: {
        fontSize: 12,
        color: "#6B7280",
        marginLeft: 'auto', // Push time to the right
    },
    message: {
        fontSize: 14,
        color: "#4B5563",
    },
     messageUnread: {
         color: "#1F2937", // Darker message text if unread
         fontWeight: "500",
    },
    membersRow: {
        marginTop: 3, // Reduced space
    },
    members: {
        fontSize: 12,
        color: "#9CA3AF", // Lighter grey for members
        fontStyle: 'italic',
    },
     badgeContainer: {
         marginLeft: 8, // Space before badge/pin
         width: 24, // Fixed width container for alignment
         alignItems: 'center',
         justifyContent: 'center',
    },
    badge: {
        backgroundColor: "#3B82F6", // Use primary color
        borderRadius: 10,
        minWidth: 20, // Min width for badge
        height: 20,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 5, // Dynamic padding based on text
    },
    badgeText: {
        color: "white",
        fontSize: 11, // Smaller badge text
        fontWeight: "bold",
    },
     pinIcon: {
        // Style for pin icon if needed
    }
});

export default ChatCard;