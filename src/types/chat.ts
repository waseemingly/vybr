
export interface IndividualChat {
  id: string;
  name: string;
  image: string | null;
  lastMessage: string;
  time: string;
  unread: number;
  isPinned: boolean;
  commonArtists?: string[];
  commonGenres?: string[];
  conversationStarters?: string[];
}

export interface GroupChat {
  id: string;
  name: string;
  image: string | null;
  lastMessage: string;
  time: string;
  unread: number;
  isPinned: boolean;
  members: string[];
}

export type Chat = IndividualChat | GroupChat;
