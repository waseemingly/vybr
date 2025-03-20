
import React, { useState } from 'react';
import TabBar from '@/components/TabBar';
import { User, Music, Heart, Disc, Album, Users, HeadphonesIcon, LayoutDashboard, Crown, Star, ChevronRight, BarChart, Radio } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useOrganizerMode } from '@/hooks/useOrganizerMode';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

// Sample user data - expanded with more items
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
    "Jazz",
    "R&B",
    "Folk",
    "Lo-fi",
    "Dream Pop",
    "Post Rock"
  ],
  genreData: [
    { name: 'Alternative Rock', value: 35 },
    { name: 'Indie Pop', value: 25 },
    { name: 'Electronic', value: 15 },
    { name: 'Hip Hop', value: 12 },
    { name: 'Jazz', value: 8 },
    { name: 'Others', value: 5 },
  ],
  artists: [
    "Tame Impala", 
    "Mac DeMarco", 
    "Kendrick Lamar", 
    "Frank Ocean", 
    "FKA Twigs",
    "The Strokes",
    "Beach House",
    "Radiohead",
    "Arctic Monkeys",
    "Childish Gambino",
    "Bon Iver",
    "Flume",
    "SZA",
    "Tyler, The Creator",
    "James Blake"
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
    },
    { 
      title: "Reptilia", 
      artist: "The Strokes"
    },
    { 
      title: "Space Song", 
      artist: "Beach House"
    },
    { 
      title: "Weird Fishes/Arpeggi", 
      artist: "Radiohead"
    },
    { 
      title: "505", 
      artist: "Arctic Monkeys"
    },
    { 
      title: "Redbone", 
      artist: "Childish Gambino"
    },
    { 
      title: "Holocene", 
      artist: "Bon Iver"
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
    },
    { 
      title: "LP1", 
      artist: "FKA Twigs", 
      year: 2014
    },
    { 
      title: "Is This It", 
      artist: "The Strokes", 
      year: 2001
    }
  ],
  listeningPatterns: [
    { day: "Monday", hours: 2.5 },
    { day: "Tuesday", hours: 3.2 },
    { day: "Wednesday", hours: 1.8 },
    { day: "Thursday", hours: 4.1 },
    { day: "Friday", hours: 5.5 },
    { day: "Saturday", hours: 4.7 },
    { day: "Sunday", hours: 3.9 }
  ]
};

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#10b981', '#6b7280'];

const ProfileSection = ({ title, icon, children, isPremiumFeature = false, expanded = true, onToggle = () => {} }) => {
  const Icon = icon;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-6"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          <Icon className="h-5 w-5 mr-2 text-vybr-midBlue" />
          <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
          {isPremiumFeature && (
            <div className="ml-2 bg-gradient-to-r from-[#9b87f5] to-[#6E59A5] text-white px-2 py-0.5 rounded-full text-xs flex items-center">
              <Crown className="w-3 h-3 mr-1 text-yellow-300" />
              Premium
            </div>
          )}
        </div>
        {isPremiumFeature && (
          <Button variant="ghost" size="sm" onClick={onToggle}>
            {expanded ? "See Less" : "See More"}
            <ChevronRight className={`ml-1 h-4 w-4 transition-transform ${expanded ? 'rotate-90' : ''}`} />
          </Button>
        )}
      </div>
      {children}
    </motion.div>
  );
};

const ProfilePage = () => {
  const { isOrganizerMode, toggleOrganizerMode } = useOrganizerMode();
  const [expandedSections, setExpandedSections] = useState({
    artists: false,
    songs: false,
    analytics: true
  });
  
  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };
  
  const renderTooltip = (props) => {
    const { payload } = props;
    if (payload && payload.length) {
      return (
        <div className="bg-white p-2 rounded shadow-md text-xs">
          <p>{`${payload[0].name}: ${payload[0].value}%`}</p>
        </div>
      );
    }
    return null;
  };
  
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
            {/* Genre Analytics for Premium Users */}
            {USER_DATA.isPremium && (
              <ProfileSection 
                title="Music Taste Analytics" 
                icon={BarChart} 
                isPremiumFeature={true}
                expanded={expandedSections.analytics}
                onToggle={() => toggleSection('analytics')}
              >
                {expandedSections.analytics && (
                  <div className="mt-2">
                    <Card className="p-4">
                      <div className="text-center mb-2">
                        <h3 className="text-sm font-medium text-gray-500">Genre Distribution</h3>
                      </div>
                      <div className="w-full h-[200px] mx-auto">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={USER_DATA.genreData}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                                const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                                const x = cx + radius * Math.cos(-midAngle * Math.PI / 180);
                                const y = cy + radius * Math.sin(-midAngle * Math.PI / 180);
                                return (
                                  <text 
                                    x={x} 
                                    y={y} 
                                    fill="white" 
                                    textAnchor="middle" 
                                    dominantBaseline="central"
                                    fontSize={12}
                                    fontWeight="bold"
                                  >
                                    {`${(percent * 100).toFixed(0)}%`}
                                  </text>
                                );
                              }}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {USER_DATA.genreData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip content={renderTooltip} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex flex-wrap justify-center mt-2 gap-2">
                        {USER_DATA.genreData.map((genre, index) => (
                          <div key={index} className="flex items-center text-xs">
                            <div 
                              className="w-3 h-3 rounded-full mr-1" 
                              style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            ></div>
                            <span>{genre.name}</span>
                          </div>
                        ))}
                      </div>
                    </Card>
                    
                    <div className="mt-4">
                      <h3 className="text-sm font-medium text-gray-500 mb-2">Listening Patterns</h3>
                      <div className="grid grid-cols-7 gap-1">
                        {USER_DATA.listeningPatterns.map((pattern, index) => (
                          <div key={index} className="flex flex-col items-center">
                            <div 
                              className="bg-vybr-midBlue/20 w-full rounded-t-md" 
                              style={{ 
                                height: `${pattern.hours * 12}px`,
                                backgroundColor: `rgba(99, 102, 241, ${pattern.hours/6})`
                              }}
                            ></div>
                            <span className="text-xs mt-1">{pattern.day.substr(0, 3)}</span>
                            <span className="text-[10px] text-gray-500">{pattern.hours}h</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </ProfileSection>
            )}
            
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
            
            <ProfileSection 
              title="Favourite Artists" 
              icon={HeadphonesIcon} 
              isPremiumFeature={USER_DATA.isPremium && USER_DATA.artists.length > 10}
              expanded={expandedSections.artists}
              onToggle={() => toggleSection('artists')}
            >
              <div className="flex flex-wrap gap-2">
                {USER_DATA.artists
                  .slice(0, expandedSections.artists || !USER_DATA.isPremium ? USER_DATA.artists.length : 10)
                  .map((artist, index) => (
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
            
            <ProfileSection 
              title="Favourite Songs" 
              icon={Disc}
              isPremiumFeature={USER_DATA.isPremium && USER_DATA.songs.length > 10}
              expanded={expandedSections.songs}
              onToggle={() => toggleSection('songs')}
            >
              <div className="grid grid-cols-1 gap-3">
                {USER_DATA.songs
                  .slice(0, expandedSections.songs || !USER_DATA.isPremium ? USER_DATA.songs.length : 10)
                  .map((song, index) => (
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
              
              {USER_DATA.isPremium && USER_DATA.songs.length > 10 && !expandedSections.songs && (
                <div className="mt-3 text-center text-sm text-gray-500">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => toggleSection('songs')}
                    className="text-vybr-midBlue"
                  >
                    See all {USER_DATA.songs.length} songs
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              )}
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
            
            {/* Match Radio Feature for Premium Users */}
            {USER_DATA.isPremium && (
              <ProfileSection title="Match Radio" icon={Radio} isPremiumFeature={true}>
                <Card className="bg-gradient-to-r from-vybr-blue/10 to-vybr-midBlue/10 border-0 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-vybr-blue mb-1">AI-Generated Playlists</h3>
                      <p className="text-xs text-gray-600">Create custom playlists that blend your music taste with your matches</p>
                    </div>
                    <Radio className="h-12 w-12 text-vybr-midBlue p-2 bg-white rounded-full shadow-sm" />
                  </div>
                  <Button className="w-full mt-4 bg-vybr-midBlue hover:bg-vybr-blue">
                    Create a Match Radio
                  </Button>
                </Card>
              </ProfileSection>
            )}
            
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
