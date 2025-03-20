
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import TabBar from '@/components/TabBar';
import { Sheet } from '@/components/ui/sheet';
import ChatProfileSheet from '@/components/ChatProfileSheet';
import ChatsPageHeader from '@/components/ChatsPageHeader';
import ChatsTabs from '@/components/ChatsTabs';
import { IndividualChat, GroupChat } from '@/types/chat';
import { generateMusicConversationStarters } from '@/utils/conversationUtils';

const ChatsPage = () => {
  const [selectedChat, setSelectedChat] = useState<IndividualChat | GroupChat | null>(null);
  const [musicStarters, setMusicStarters] = useState<string[]>([]);
  
  const MotionHeading = motion.h1;
  
  const handleChatOpen = (chat: IndividualChat | GroupChat) => {
    setSelectedChat(chat);
    
    // TypeScript guard to check if chat has commonArtists or commonGenres
    if ('commonArtists' in chat || 'commonGenres' in chat) {
      const commonArtists = 'commonArtists' in chat ? chat.commonArtists : undefined;
      const commonGenres = 'commonGenres' in chat ? chat.commonGenres : undefined;
      
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
    console.log('Open profile for:', chat.name);
  };
  
  useEffect(() => {
    if (!selectedChat) {
      setMusicStarters([]);
    }
  }, [selectedChat]);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-vybr-blue/5 to-white pb-24">
      <ChatsPageHeader MotionHeading={MotionHeading} />
      
      <main className="px-4 pb-6">
        <ChatsTabs 
          onChatOpen={handleChatOpen}
          onProfileOpen={handleProfileOpen}
        />
        
        {selectedChat && (
          <Sheet>
            <ChatProfileSheet chat={selectedChat} musicStarters={musicStarters} />
          </Sheet>
        )}
      </main>
      
      <TabBar />
    </div>
  );
};

export default ChatsPage;
