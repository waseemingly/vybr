
import React, { useState } from 'react';
import { MessageCircle, Users, Pin, Archive, Trash2, Bell, UserPlus, ChevronRight, Info, Flag } from 'lucide-react';
import { motion } from 'framer-motion';
import TabBar from '@/components/TabBar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ChatCard from '@/components/ChatCard';

// Sample data for chats
const INDIVIDUAL_CHATS = [
  {
    id: '1',
    name: 'Sarah Chen',
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=687&q=80',
    lastMessage: 'Are you going to the Kendrick concert?',
    time: '2m ago',
    unread: 2,
    isPinned: true,
    commonArtists: ['Kendrick Lamar', 'SZA'],
    commonGenres: ['Hip Hop', 'R&B'],
  },
  {
    id: '2',
    name: 'Alex Rivera',
    image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=687&q=80',
    lastMessage: 'Did you check out that new Tame Impala album?',
    time: '1h ago',
    unread: 0,
    isPinned: false,
    commonArtists: ['Tame Impala', 'Arctic Monkeys'],
    commonGenres: ['Indie Rock'],
  },
  {
    id: '3',
    name: 'Maya Johnson',
    image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=687&q=80',
    lastMessage: 'The event was amazing! Thanks for the recommendation',
    time: '3h ago',
    unread: 0,
    isPinned: false,
    commonArtists: ['Daft Punk', 'Justice'],
    commonGenres: ['Electronic', 'House'],
  }
];

const GROUP_CHATS = [
  {
    id: 'g1',
    name: 'Jazz Lovers',
    image: null,
    lastMessage: 'Mike: Anyone going to the Blue Note this weekend?',
    time: '35m ago',
    unread: 5,
    isPinned: true,
    members: ['You', 'Mike', 'Sarah', 'Alex', '+3'],
  },
  {
    id: 'g2',
    name: 'Festival Squad',
    image: null,
    lastMessage: 'Alex: Tickets are on sale now!',
    time: '2h ago',
    unread: 0,
    isPinned: false,
    members: ['You', 'Alex', 'Ellie', 'Maya', '+2'],
  }
];

const ChatsPage = () => {
  const [activeTab, setActiveTab] = useState('individual');
  const [selectedChat, setSelectedChat] = useState(null);
  
  const MotionHeading = motion.h1;
  
  const handleChatOpen = (chat) => {
    setSelectedChat(chat);
  };
  
  const handleProfileOpen = (chat) => {
    // In a real app, this would open a profile view
    console.log('Open profile for:', chat.name);
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-vybr-blue/5 to-white pb-24">
      {/* Header */}
      <header className="pt-6 pb-4 px-4 safe-area-top">
        <div className="flex items-center justify-between mb-2">
          <MotionHeading 
            className="text-2xl font-bold flex items-center text-vybr-blue"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <MessageCircle className="text-vybr-midBlue mr-2 h-6 w-6" />
            Chats
          </MotionHeading>
          
          <img 
            src="/lovable-uploads/d9d63781-f853-48bc-b06e-8074bad2f8cb.png" 
            alt="Vybr Logo" 
            className="h-10 w-auto"
          />
        </div>
        
        {/* Create Group Chat Button */}
        <div className="flex justify-between items-center mt-2 mb-4">
          <p className="text-gray-500 text-sm">
            Connect with your matches
          </p>
          
          <Sheet>
            <SheetTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="rounded-full h-10 w-10 bg-vybr-midBlue/10 text-vybr-blue hover:bg-vybr-midBlue hover:text-white"
              >
                <UserPlus className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent className="rounded-l-2xl">
              <div className="px-1 py-3">
                <h3 className="text-lg font-bold mb-4">Create a Group</h3>
                <p className="text-sm text-gray-500 mb-4">Select friends to add to your new group</p>
                
                {/* Group creation UI would go here */}
                <div className="space-y-2">
                  {INDIVIDUAL_CHATS.map(chat => (
                    <div key={chat.id} className="flex items-center p-2 rounded-lg hover:bg-gray-100">
                      <Avatar className="h-10 w-10 mr-3">
                        <AvatarImage src={chat.image} alt={chat.name} />
                        <AvatarFallback>{chat.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium">{chat.name}</p>
                      </div>
                      <Button variant="ghost" size="sm" className="rounded-full">
                        <UserPlus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                
                <div className="flex justify-end gap-2 mt-6">
                  <Button variant="outline">Cancel</Button>
                  <Button>Next</Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
        
        {/* Tabs */}
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

          {/* Individual Chats Content */}
          <TabsContent value="individual" className="mt-2">
            <ScrollArea className="h-[calc(100vh-230px)]">
              <div className="space-y-3 pr-3 pt-3">
                {INDIVIDUAL_CHATS.map(chat => (
                  <ChatCard
                    key={chat.id}
                    chat={chat}
                    onChatOpen={handleChatOpen}
                    onProfileOpen={handleProfileOpen}
                    type="individual"
                  />
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
          
          {/* Group Chats Content */}
          <TabsContent value="groups" className="mt-2">
            <ScrollArea className="h-[calc(100vh-230px)]">
              <div className="space-y-3 pr-3 pt-3">
                {GROUP_CHATS.map(chat => (
                  <ChatCard
                    key={chat.id}
                    chat={chat}
                    onChatOpen={handleChatOpen}
                    onProfileOpen={handleProfileOpen}
                    type="group"
                  />
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </header>
      
      {/* Main Content - Empty since tabs are in header */}
      <main className="px-4 pb-6">
        {/* Profile Sheet */}
        {selectedChat && (
          <Sheet>
            <SheetContent side="right" className="w-full sm:max-w-md">
              <div className="flex flex-col items-center p-4">
                <Avatar className="h-20 w-20 mb-4">
                  <AvatarImage src={selectedChat.image} alt={selectedChat.name} />
                  <AvatarFallback className="text-xl">{selectedChat.name.charAt(0)}</AvatarFallback>
                </Avatar>
                
                <h2 className="text-xl font-bold">{selectedChat.name}</h2>
                
                {selectedChat.commonArtists && (
                  <div className="mt-4 w-full">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Common Artists</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedChat.commonArtists.map((artist, i) => (
                        <Badge key={i} variant="outline" className="bg-vybr-skyBlue/30 text-vybr-darkBlue">
                          {artist}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                {selectedChat.commonGenres && (
                  <div className="mt-4 w-full">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Common Genres</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedChat.commonGenres.map((genre, i) => (
                        <Badge key={i} variant="outline" className="bg-vybr-midBlue/10 text-vybr-blue">
                          {genre}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                <Button className="mt-6 w-full" size="lg">
                  Message
                </Button>
                
                <Button variant="outline" className="mt-3 w-full text-red-500 hover:text-red-600 hover:bg-red-50" size="lg">
                  <Flag className="mr-2 h-4 w-4" />
                  Report User
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        )}
      </main>
      
      {/* Tab Bar */}
      <TabBar />
    </div>
  );
};

export default ChatsPage;
