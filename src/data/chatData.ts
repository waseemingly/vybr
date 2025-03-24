import { IndividualChat, GroupChat } from "../types/chat";

export const INDIVIDUAL_CHATS: IndividualChat[] = [
  {
    id: "1",
    name: "Sarah Chen",
    image:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=687&q=80",
    lastMessage: "Are you going to the Kendrick concert?",
    time: "2m ago",
    unread: 2,
    isPinned: true,
    commonArtists: ["Kendrick Lamar", "SZA"],
    commonGenres: ["Hip Hop", "R&B"],
    conversationStarters: [
      "What did you think of Kendrick's latest album?",
      "Have you seen SZA perform live before?",
      "What's your favorite track from DAMN.?",
    ],
  },
  {
    id: "2",
    name: "Alex Rivera",
    image:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=687&q=80",
    lastMessage: "Did you check out that new Tame Impala album?",
    time: "1h ago",
    unread: 0,
    isPinned: false,
    commonArtists: ["Tame Impala", "Arctic Monkeys"],
    commonGenres: ["Indie Rock"],
    conversationStarters: [
      "What's your favorite track from Currents?",
      "Have you seen Arctic Monkeys live?",
      "Which Tame Impala era do you prefer?",
    ],
  },
  {
    id: "3",
    name: "Maya Johnson",
    image:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=687&q=80",
    lastMessage: "The event was amazing! Thanks for the recommendation",
    time: "3h ago",
    unread: 0,
    isPinned: false,
    commonArtists: ["Daft Punk", "Justice"],
    commonGenres: ["Electronic", "House"],
    conversationStarters: [
      "What are your thoughts on Daft Punk's split?",
      "Which electronic artists are you currently into?",
      "What's your favorite house track right now?",
    ],
  },
];

export const GROUP_CHATS: GroupChat[] = [
  {
    id: "g1",
    name: "Jazz Lovers",
    image: null,
    lastMessage: "Mike: Anyone going to the Blue Note this weekend?",
    time: "35m ago",
    unread: 5,
    isPinned: true,
    members: ["You", "Mike", "Sarah", "Alex", "+3"],
  },
  {
    id: "g2",
    name: "Festival Squad",
    image: null,
    lastMessage: "Alex: Tickets are on sale now!",
    time: "2h ago",
    unread: 0,
    isPinned: false,
    members: ["You", "Alex", "Ellie", "Maya", "+2"],
  },
];
