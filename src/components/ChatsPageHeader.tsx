
import React from 'react';
import { MessageCircle, UserPlus } from 'lucide-react';
import { motion } from 'framer-motion';
import { Sheet, SheetTrigger, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { IndividualChat } from '@/types/chat';

interface ChatsPageHeaderProps {
  MotionHeading: typeof motion.h1;
}

const ChatsPageHeader: React.FC<ChatsPageHeaderProps> = ({ MotionHeading }) => {
  return (
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
          src="/lovable-uploads/0cc2a209-13f6-490c-bfd1-e35d209b6a89.png" 
          alt="Vybr Logo" 
          className="h-12 w-auto"
        />
      </div>
      
      <div className="flex justify-between items-center mt-2 mb-4">
        <p className="text-gray-500 text-sm">
          Connect with your matches
        </p>
        
        <CreateGroupButton />
      </div>
    </header>
  );
};

// Sub-component for the Create Group button and sheet
const CreateGroupButton = () => {
  // This would be the list of individual chats to choose from
  // In a real implementation we would get this from props or context
  const individualChats = [] as IndividualChat[];
  
  return (
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
          
          <div className="space-y-2">
            {individualChats.map(chat => (
              <div key={chat.id} className="flex items-center p-2 rounded-lg hover:bg-gray-100">
                <Avatar className="h-10 w-10 mr-3">
                  <AvatarImage src={chat.image || undefined} alt={chat.name} />
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
  );
};

export default ChatsPageHeader;
