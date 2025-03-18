
import React, { useState } from 'react';
import { Heart, ArrowRight, Music } from 'lucide-react';
import TabBar from '@/components/TabBar';
import MatchCard from '@/components/MatchCard';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { useIsMobile } from '@/hooks/use-mobile';

// Sample data for matches
const MATCHES = [
  {
    id: '1',
    name: 'Sarah Chen',
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=687&q=80',
    bio: "Music is my escape. I'm a big fan of indie rock and alternative music. Always looking for new artists to discover and concerts to attend!",
    matchedArtists: ['Kendrick Lamar', 'Anderson .Paak', 'SZA'],
    genres: ['Hip Hop', 'R&B', 'Jazz Rap'],
    compatibilityScore: 87,
    isPremium: true,
    isThrowback: false,
  },
  {
    id: '2',
    name: 'Alex Rivera',
    image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=687&q=80',
    bio: "Vinyl collector and music enthusiast. I play guitar in a local band and love discovering underground artists. Let's talk music!",
    matchedArtists: ['Tame Impala', 'Arctic Monkeys', 'The Strokes'],
    genres: ['Indie Rock', 'Psychedelic Rock', 'Alternative'],
    compatibilityScore: 92,
    isPremium: true,
    isThrowback: true,
  }
];

const MatchesPage = () => {
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const currentMatch = MATCHES[currentMatchIndex];
  const isMobile = useIsMobile();
  
  const goToNextMatch = () => {
    if (currentMatchIndex < MATCHES.length - 1) {
      setCurrentMatchIndex(currentMatchIndex + 1);
    } else {
      setCurrentMatchIndex(0);
    }
  };
  
  const MotionHeading = motion.h1;
  const MotionDiv = motion.div;

  return (
    <div className="min-h-screen bg-gradient-to-br from-vybr-blue/5 to-white pb-24">
      {/* Header */}
      <header className="pt-6 pb-4 px-4 safe-area-top">
        <div className="mx-auto">
          <div className="flex items-center justify-between mb-2">
            <MotionHeading 
              className="text-2xl font-bold flex items-center text-vybr-blue"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Heart className="text-vybr-midBlue mr-2 h-6 w-6" />
              Today's Matches
            </MotionHeading>
            
            <img 
              src="/lovable-uploads/6f793496-9715-4c6c-8b88-fcac27b1a4c2.png" 
              alt="Vybr Logo" 
              className="h-6 w-auto"
            />
          </div>
          
          <MotionDiv
            className="flex justify-between items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.3 }}
          >
            <p className="text-gray-500 text-sm">
              Find your musical connection
            </p>
            
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-vybr-midBlue hover:text-vybr-darkBlue hover:bg-vybr-midBlue/10"
              onClick={goToNextMatch}
            >
              Next match
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </MotionDiv>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="px-4 pb-6">
        <div className="mx-auto max-w-md">
          <MotionDiv
            key={currentMatch.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="w-full"
          >
            <MatchCard
              id={currentMatch.id}
              name={currentMatch.name}
              image={currentMatch.image}
              bio={currentMatch.bio}
              matchedArtists={currentMatch.matchedArtists}
              genres={currentMatch.genres}
              compatibilityScore={currentMatch.compatibilityScore}
              isPremium={currentMatch.isPremium}
              isThrowback={currentMatch.isThrowback}
            />
          </MotionDiv>
        </div>
      </main>
      
      {/* Tab Bar */}
      <TabBar />
    </div>
  );
};

export default MatchesPage;
