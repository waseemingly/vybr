
import React from 'react';
import { MessageCircle, Users } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import ChatCard from '@/components/ChatCard';
import { IndividualChat, GroupChat } from '@/types/chat';
import { INDIVIDUAL_CHATS, GROUP_CHATS } from '@/data/chatData';

interface ChatsTabsProps {
  onChatOpen: (chat: IndividualChat | GroupChat) => void;
  onProfileOpen: (chat: IndividualChat | GroupChat) => void;
}

const ChatsTabs: React.FC<ChatsTabsProps> = ({ 
  onChatOpen, 
  onProfileOpen 
}) => {
  return (
    <Tabs defaultValue="individual" className="w-full">
      <TabsList className="grid grid-cols-2 w-full bg-vybr-skyBlue/30 rounded-lg p-1">
        <TabsTrigger 
          value="individual" 
          className="rounded-md data-[state=active]:bg-white"
        >
          <MessageCircle className="h-4 w-4 mr-2" />
          Individual
        </TabsTrigger>
        <TabsTrigger 
          value="groups" 
          className="rounded-md data-[state=active]:bg-white"
        >
          <Users className="h-4 w-4 mr-2" />
          Groups
        </TabsTrigger>
      </TabsList>

      <TabsContent value="individual" className="mt-2">
        <ScrollArea className="h-[calc(100vh-230px)]">
          <div className="space-y-3 pr-3 pt-3">
            {INDIVIDUAL_CHATS.map(chat => (
              <ChatCard
                key={chat.id}
                chat={chat}
                onChatOpen={onChatOpen}
                onProfileOpen={onProfileOpen}
                type="individual"
              />
            ))}
          </div>
        </ScrollArea>
      </TabsContent>
      
      <TabsContent value="groups" className="mt-2">
        <ScrollArea className="h-[calc(100vh-230px)]">
          <div className="space-y-3 pr-3 pt-3">
            {GROUP_CHATS.map(chat => (
              <ChatCard
                key={chat.id}
                chat={chat}
                onChatOpen={onChatOpen}
                onProfileOpen={onProfileOpen}
                type="group"
              />
            ))}
          </div>
        </ScrollArea>
      </TabsContent>
    </Tabs>
  );
};

export default ChatsTabs;
