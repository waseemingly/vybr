
import React from 'react';
import { Sparkles, Music } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from "@/hooks/use-toast";

interface ConversationStartersProps {
  starters: string[];
  musicStarters?: string[];
}

const ConversationStarters: React.FC<ConversationStartersProps> = ({ 
  starters, 
  musicStarters 
}) => {
  return (
    <div className="mt-4 w-full">
      <h3 className="text-sm font-medium text-gray-500 mb-2 flex items-center">
        <Sparkles className="h-4 w-4 mr-1 text-yellow-500" />
        AI Conversation Starters
      </h3>
      <div className="space-y-2">
        {starters.map((starter, index) => (
          <Card key={index} className="bg-vybr-skyBlue/10 border-vybr-skyBlue/30">
            <CardContent className="p-3 text-sm">
              <p className="text-vybr-darkBlue">{starter}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {musicStarters && musicStarters.length > 0 && (
        <>
          <h3 className="text-sm font-medium text-gray-500 mt-4 mb-2 flex items-center">
            <Music className="h-4 w-4 mr-1 text-vybr-midBlue" />
            Music Conversation Starters
          </h3>
          <div className="space-y-2">
            {musicStarters.map((starter, index) => (
              <Card 
                key={`music-${index}`} 
                className="bg-vybr-midBlue/10 border-vybr-midBlue/30 cursor-pointer hover:bg-vybr-midBlue/20 transition-colors"
                onClick={() => {
                  toast({
                    title: "Message Ready",
                    description: "Tap to send: " + starter,
                  });
                }}
              >
                <CardContent className="p-3 text-sm">
                  <p className="text-vybr-blue">{starter}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default ConversationStarters;
