
import React from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { motion } from 'framer-motion';
import { Sheet, SheetTrigger } from '@/components/ui/sheet';
import { Pin, Archive, Trash2, X, Users, Bell } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ChatCardProps {
  chat: any;
  onChatOpen: (chat: any) => void;
  onProfileOpen: (chat: any) => void;
  type: 'individual' | 'group';
}

const ChatCard: React.FC<ChatCardProps> = ({ 
  chat, 
  onChatOpen, 
  onProfileOpen,
  type
}) => {
  const handleLeftSwipe = (action: 'pin' | 'unread') => {
    console.log(`Left swipe ${action} for chat:`, chat.id);
  };
  
  const handleRightSwipe = (action: 'archive' | 'delete' | 'leave') => {
    console.log(`Right swipe ${action} for chat:`, chat.id);
  };
  
  return (
    <motion.div
      className={cn(
        "relative bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden",
        chat.isPinned && "border-l-4 border-l-vybr-midBlue",
        chat.unread > 0 && "bg-vybr-skyBlue/10"
      )}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center p-3" onClick={() => onChatOpen(chat)}>
        <Sheet>
          <SheetTrigger asChild>
            <Avatar className="h-14 w-14 mr-3 cursor-pointer" onClick={(e) => {
              e.stopPropagation();
              onProfileOpen(chat);
            }}>
              <AvatarImage src={chat.image} alt={chat.name} />
              <AvatarFallback className="bg-vybr-midBlue/10 text-vybr-blue">
                {type === 'group' ? <Users className="h-6 w-6" /> : chat.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
          </SheetTrigger>
        </Sheet>
        
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start">
            <h3 className="font-semibold truncate">{chat.name}</h3>
            <span className="text-xs text-gray-500 whitespace-nowrap ml-2">{chat.time}</span>
          </div>
          
          <p className="text-sm text-gray-600 mt-1 truncate">
            {chat.lastMessage}
          </p>
          
          {type === 'group' && (
            <div className="flex items-center mt-1">
              <p className="text-xs text-gray-500 truncate">
                {chat.members.join(', ')}
              </p>
            </div>
          )}
        </div>
        
        {chat.unread > 0 && (
          <Badge className="ml-2 bg-vybr-midBlue text-white font-medium">
            {chat.unread}
          </Badge>
        )}
      </div>
      
      {/* Swipe Actions - These would be implemented with a gesture library in a real app */}
      <div className="absolute right-0 top-0 bottom-0 hidden">
        <div className="h-full flex flex-col justify-center gap-2 px-2">
          <button 
            className="p-2 bg-amber-500 rounded-full text-white"
            onClick={() => handleRightSwipe('archive')}
          >
            <Archive className="h-5 w-5" />
          </button>
          <button 
            className="p-2 bg-red-500 rounded-full text-white"
            onClick={() => handleRightSwipe(type === 'group' ? 'leave' : 'delete')}
          >
            {type === 'group' ? <X className="h-5 w-5" /> : <Trash2 className="h-5 w-5" />}
          </button>
        </div>
      </div>
      
      <div className="absolute left-0 top-0 bottom-0 hidden">
        <div className="h-full flex flex-col justify-center gap-2 px-2">
          <button 
            className="p-2 bg-vybr-blue rounded-full text-white"
            onClick={() => handleLeftSwipe('pin')}
          >
            <Pin className="h-5 w-5" />
          </button>
          <button 
            className="p-2 bg-vybr-midBlue rounded-full text-white"
            onClick={() => handleLeftSwipe('unread')}
          >
            <Bell className="h-5 w-5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default ChatCard;
