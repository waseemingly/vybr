
import React from 'react';
import { Star, Radio, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

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
        "w-full max-w-md mx-auto bg-white rounded-2xl shadow-md overflow-hidden transition-all duration-300 animate-scale-in",
        "border border-gray-100 hover:shadow-lg hover:-translate-y-1"
      )}
    >
      {/* User Image */}
      <div className="relative w-full h-72 overflow-hidden">
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
          <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm text-matchmaker-teal px-3 py-1 rounded-full flex items-center space-x-1 animate-fade-in">
            <Star className="w-4 h-4 text-yellow-500 animate-floating" />
            <span className="font-medium text-sm">{compatibilityScore}% Match</span>
          </div>
        )}
      </div>
      
      {/* Content */}
      <div className="p-5">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{name}</h2>
            <div className="flex flex-wrap gap-2 mt-2">
              {genres.map((genre, index) => (
                <Badge 
                  key={index} 
                  variant="outline" 
                  className="bg-matchmaker-lightTeal/50 text-matchmaker-darkTeal border-none hover:bg-matchmaker-teal hover:text-white transition-colors duration-200 text-xs"
                >
                  {genre}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        
        {/* Matched Artists */}
        <div className="mb-4">
          <p className="text-sm text-gray-500 mb-2">Common Artists</p>
          <div className="flex flex-wrap gap-2">
            {matchedArtists.map((artist, index) => (
              <Badge 
                key={index} 
                className="bg-matchmaker-teal/10 text-matchmaker-teal hover:bg-matchmaker-teal hover:text-white transition-colors duration-200"
              >
                {artist}
              </Badge>
            ))}
          </div>
        </div>
        
        {/* Bio */}
        <p className="text-gray-600 mb-6 text-sm leading-relaxed">{bio}</p>
        
        {/* Actions */}
        <div className="flex items-center justify-between mt-4">
          <div className="flex space-x-3">
            <Button 
              size="lg"
              variant="outline" 
              className="rounded-full bg-red-50 text-red-500 border-red-100 hover:bg-red-100 hover:text-red-600 transition-all duration-200"
              onClick={() => console.log('Rejected match')}
            >
              <X className="mr-1 h-4 w-4" />
              Skip
            </Button>
            
            <Button 
              size="lg" 
              className="rounded-full bg-green-500 text-white hover:bg-green-600 transition-all duration-200"
              onClick={() => console.log('Accepted match')}
            >
              <Check className="mr-1 h-4 w-4" />
              Connect
            </Button>
          </div>
          
          {isPremium && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="rounded-full h-12 w-12 bg-matchmaker-teal/10 text-matchmaker-teal hover:bg-matchmaker-teal hover:text-white transition-all duration-300"
              onClick={() => console.log('Open AI Radio')}
            >
              <Radio className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MatchCard;
