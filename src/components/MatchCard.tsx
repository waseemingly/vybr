
import React from 'react';
import { Star, Radio, Check, X, Music } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface MatchProps {
  id: string;
  name: string;
  image: string;
  bio: string;
  matchedArtists: string[];
  genres: string[];
  compatibilityScore?: number;
  isPremium?: boolean;
  isThrowback?: boolean;
}

const MatchCard: React.FC<MatchProps> = ({
  id,
  name,
  image,
  bio,
  matchedArtists,
  genres,
  compatibilityScore,
  isPremium = false,
  isThrowback = false,
}) => {
  return (
    <div 
      className={cn(
        "w-full mx-auto bg-white rounded-xl shadow-md overflow-hidden transition-all duration-300 animate-scale-in",
        "border border-gray-100 hover:shadow-lg",
        "max-w-sm", // Limit max width for better mobile display
        "max-h-[75vh]" // Limit max height - REDUCED HEIGHT
      )}
    >
      {/* User Image */}
      <div className="relative w-full aspect-square overflow-hidden">
        <img 
          src={image} 
          alt={name} 
          className="w-full h-full object-cover transition-transform duration-700 hover:scale-105" 
        />
        
        {isThrowback && (
          <div className="absolute top-4 left-4 bg-yellow-500 text-white px-3 py-1 rounded-full text-xs font-medium animate-pulse-soft">
            Throwback Match
          </div>
        )}
        
        {isPremium && compatibilityScore && (
          <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm text-vybr-blue px-3 py-1 rounded-full flex items-center space-x-1 animate-fade-in">
            <Star className="w-4 h-4 text-yellow-500 animate-floating" />
            <span className="font-medium text-sm">{compatibilityScore}% Match</span>
          </div>
        )}
      </div>
      
      {/* Content */}
      <div className="p-5">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{name}</h2>
            <div className="flex flex-wrap gap-2 mt-1">
              {genres.map((genre, index) => (
                <Badge 
                  key={index} 
                  variant="outline" 
                  className="bg-vybr-skyBlue/30 text-vybr-darkBlue border-none hover:bg-vybr-midBlue hover:text-white transition-colors duration-200 text-xs"
                >
                  {genre}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        
        {/* Matched Artists */}
        <div className="mb-3">
          <p className="text-sm text-gray-500 mb-1">Common Artists</p>
          <div className="flex flex-wrap gap-2">
            {matchedArtists.map((artist, index) => (
              <Badge 
                key={index} 
                className="bg-vybr-midBlue/10 text-vybr-blue hover:bg-vybr-midBlue hover:text-white transition-colors duration-200"
              >
                <Music className="w-3 h-3 mr-1" />
                {artist}
              </Badge>
            ))}
          </div>
        </div>
        
        {/* Bio - shortened */}
        <p className="text-gray-600 mb-3 text-sm leading-relaxed line-clamp-2">{bio}</p>
        
        {/* Actions with gradient buttons */}
        <div className="flex items-center justify-between mt-4">
          <button 
            className="flex items-center justify-center rounded-full bg-gradient-to-r from-[#ff719a] to-[#ffa99f] text-white px-8 py-2.5 min-w-[110px] font-medium text-sm hover:shadow-md transition-all"
            onClick={() => console.log('Rejected match')}
          >
            <X className="mr-1.5 h-4 w-4" />
            Skip
          </button>
          
          <button 
            className="flex items-center justify-center rounded-full bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white px-8 py-2.5 min-w-[110px] font-medium text-sm hover:shadow-md transition-all"
            onClick={() => console.log('Accepted match')}
          >
            <Check className="mr-1.5 h-4 w-4" />
            Connect
          </button>
          
          {isPremium && (
            <button 
              className="rounded-full h-10 w-10 ml-2 bg-vybr-midBlue/10 text-vybr-blue flex items-center justify-center hover:bg-vybr-midBlue/20 transition-colors"
              onClick={() => console.log('Open AI Radio')}
            >
              <Radio className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MatchCard;
