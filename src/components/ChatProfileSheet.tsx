
import React from 'react';
import { Flag } from 'lucide-react';
import { SheetContent } from '@/components/ui/sheet';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import ConversationStarters from './ConversationStarters';

interface ChatProfileSheetProps {
  chat: any;
  musicStarters: string[];
}

const ChatProfileSheet: React.FC<ChatProfileSheetProps> = ({ 
  chat, 
  musicStarters 
}) => {
  return (
    <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
      <div className="flex flex-col items-center p-4">
        <Avatar className="h-20 w-20 mb-4">
          <AvatarImage src={chat.image} alt={chat.name} />
          <AvatarFallback className="text-xl">{chat.name.charAt(0)}</AvatarFallback>
        </Avatar>
        
        <h2 className="text-xl font-bold">{chat.name}</h2>
        
        {chat.commonArtists && (
          <div className="mt-4 w-full">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Common Artists</h3>
            <div className="flex flex-wrap gap-2">
              {chat.commonArtists.map((artist: string, i: number) => (
                <Badge key={i} variant="outline" className="bg-vybr-skyBlue/30 text-vybr-darkBlue">
                  {artist}
                </Badge>
              ))}
            </div>
          </div>
        )}
        
        {chat.commonGenres && (
          <div className="mt-4 w-full">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Common Genres</h3>
            <div className="flex flex-wrap gap-2">
              {chat.commonGenres.map((genre: string, i: number) => (
                <Badge key={i} variant="outline" className="bg-vybr-midBlue/10 text-vybr-blue">
                  {genre}
                </Badge>
              ))}
            </div>
          </div>
        )}
        
        {chat.conversationStarters && (
          <ConversationStarters 
            starters={chat.conversationStarters} 
            musicStarters={musicStarters}
          />
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
  );
};

export default ChatProfileSheet;
