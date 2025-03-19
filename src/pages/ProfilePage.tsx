
import React from 'react';
import TabBar from '@/components/TabBar';
import { User, Music, Heart, Disc, Album, Users, HeadphonesIcon, LayoutDashboard, Crown, Star } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { useOrganizerMode } from '@/hooks/useOrganizerMode';
import { motion } from 'framer-motion';

// Sample user data
const USER_DATA = {
  name: "Alex Chen",
  age: 28,
  profilePic: "https://images.unsplash.com/photo-1536104968055-4d61aa56f46a?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
  bio: "Music lover and concert enthusiast. Always looking for new artists and genres to explore. Let's connect and share playlists!",
  friends: 124,
  following: 56,
  isPremium: true,
  genres: [
    "Alternative Rock", 
    "Indie Pop", 
    "Electronic", 
    "Hip Hop", 
    "Jazz"
  ],
  artists: [
    "Tame Impala", 
    "Mac DeMarco", 
    "Kendrick Lamar", 
    "Frank Ocean", 
    "FKA Twigs"
  ],
  songs: [
    { 
      title: "The Less I Know The Better", 
      artist: "Tame Impala"
    },
    { 
      title: "Self Control", 
      artist: "Frank Ocean"
    },
    { 
      title: "DNA", 
      artist: "Kendrick Lamar"
    },
    { 
      title: "Chamber of Reflection", 
      artist: "Mac DeMarco"
    },
    { 
      title: "Cellophane", 
      artist: "FKA Twigs"
    }
  ],
  albums: [
    { 
      title: "Currents", 
      artist: "Tame Impala", 
      year: 2015
    },
    { 
      title: "Blonde", 
      artist: "Frank Ocean", 
      year: 2016
    },
    { 
      title: "DAMN.", 
      artist: "Kendrick Lamar", 
      year: 2017
    },
    { 
      title: "Salad Days", 
      artist: "Mac DeMarco", 
      year: 2014
    }
  ]
};

const ProfileSection = ({ title, icon, children }) => {
  const Icon = icon;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-6"
    >
      <div className="flex items-center mb-3">
        <Icon className="h-5 w-5 mr-2 text-vybr-midBlue" />
        <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
      </div>
      {children}
    </motion.div>
  );
};

const ProfilePage = () => {
  const { isOrganizerMode, toggleOrganizerMode } = useOrganizerMode();
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-vybr-blue/5 to-white pb-24">
      <header className="pt-6 px-4 safe-area-top">
        <div className="mx-auto">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold flex items-center text-vybr-blue">
              <User className="text-vybr-midBlue mr-2 h-6 w-6" />
              Profile
            </h1>
            <img 
              src="/lovable-uploads/0cc2a209-13f6-490c-bfd1-e35d209b6a89.png" 
              alt="Vybr Logo" 
              className="h-12 w-auto" 
            />
          </div>
        </div>
      </header>
      
      <main className="px-4 pb-6">
        <div className="mx-auto">
          <Card className="overflow-hidden shadow-md mb-5">
            <CardContent className="p-0">
              <div className="bg-gradient-to-r from-vybr-blue to-vybr-midBlue h-32 relative">
                <div className="absolute -bottom-16 left-1/2 transform -translate-x-1/2">
                  <Avatar className="h-32 w-32 border-4 border-white shadow-md">
                    <AvatarImage src={USER_DATA.profilePic} alt={USER_DATA.name} />
                    <AvatarFallback>{USER_DATA.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                </div>
              </div>
              
              <div className="pt-20 pb-5 px-4 text-center">
                <div className="flex items-center justify-center gap-2">
                  <h2 className="text-2xl font-bold text-gray-900">{USER_DATA.name}</h2>
                  {USER_DATA.isPremium && (
                    <div className="bg-gradient-to-r from-[#9b87f5] to-[#6E59A5] text-white px-3 py-1 rounded-full text-xs flex items-center">
                      <Crown className="w-3 h-3 mr-1 text-yellow-300" />
                      Premium
                    </div>
                  )}
                </div>
                <p className="text-gray-500 mt-1">{USER_DATA.age} years old</p>
                
                <div className="flex justify-center space-x-8 mt-4">
                  <div>
                    <p className="font-semibold text-vybr-blue">{USER_DATA.friends}</p>
                    <p className="text-sm text-gray-500">Friends</p>
                  </div>
                  <Separator orientation="vertical" className="h-10" />
                  <div>
                    <p className="font-semibold text-vybr-blue">{USER_DATA.following}</p>
                    <p className="text-sm text-gray-500">Following</p>
                  </div>
                </div>
                
                <p className="text-gray-600 mt-4 text-sm">{USER_DATA.bio}</p>
              </div>
            </CardContent>
          </Card>
          
          <ScrollArea className="h-[calc(100vh-460px)]">
            <ProfileSection title="Favourite Genres" icon={Music}>
              <div className="flex flex-wrap gap-2">
                {USER_DATA.genres.map((genre, index) => (
                  <Badge 
                    key={index} 
                    className="bg-vybr-skyBlue/30 text-vybr-darkBlue hover:bg-vybr-midBlue hover:text-white"
                  >
                    {genre}
                  </Badge>
                ))}
              </div>
            </ProfileSection>
            
            <ProfileSection title="Favourite Artists" icon={HeadphonesIcon}>
              <div className="flex flex-wrap gap-2">
                {USER_DATA.artists.map((artist, index) => (
                  <Badge 
                    key={index} 
                    variant="outline"
                    className="bg-vybr-midBlue/10 text-vybr-blue border-vybr-midBlue/30"
                  >
                    <Music className="w-3 h-3 mr-1" />
                    {artist}
                  </Badge>
                ))}
              </div>
            </ProfileSection>
            
            <ProfileSection title="Favourite Songs" icon={Disc}>
              <div className="grid grid-cols-1 gap-3">
                {USER_DATA.songs.map((song, index) => (
                  <motion.div
                    key={index}
                    whileHover={{ scale: 1.02 }}
                    className="bg-white rounded-lg shadow-sm overflow-hidden"
                  >
                    <div className="flex items-center p-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-800">{song.title}</h3>
                        <p className="text-xs text-gray-500">{song.artist}</p>
                      </div>
                      <Disc className="h-5 w-5 text-vybr-midBlue ml-2" />
                    </div>
                  </motion.div>
                ))}
              </div>
            </ProfileSection>
            
            <ProfileSection title="Favourite Albums" icon={Album}>
              <div className="grid grid-cols-1 gap-3">
                {USER_DATA.albums.map((album, index) => (
                  <motion.div
                    key={index}
                    whileHover={{ scale: 1.02 }}
                    className="bg-white rounded-lg shadow-sm overflow-hidden"
                  >
                    <div className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-gray-800">{album.title}</h3>
                          <p className="text-xs text-gray-500">{album.artist} • {album.year}</p>
                        </div>
                        <Album className="h-5 w-5 text-vybr-midBlue" />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </ProfileSection>
            
            {/* Organizer Mode Toggle */}
            <div className="mt-8 mb-10">
              <Card className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <LayoutDashboard className="h-5 w-5 mr-2 text-vybr-midBlue" />
                      <span className="font-medium">Organiser Mode</span>
                    </div>
                    <Switch 
                      checked={isOrganizerMode} 
                      onCheckedChange={toggleOrganizerMode} 
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Toggle to switch between user and organiser views
                  </p>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </div>
      </main>
      
      <TabBar />
    </div>
  );
};

export default ProfilePage;
