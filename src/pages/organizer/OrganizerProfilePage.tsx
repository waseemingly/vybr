
import React from 'react';
import TabBar from '@/components/TabBar';
import { User, Mail, Phone, Star, Users, ArrowRight, Calendar, LayoutDashboard } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useOrganizerMode } from '@/hooks/useOrganizerMode';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

// Sample organiser data - Using Sundown Jammers info
const ORGANISER_DATA = {
  name: "Sundown Jammers",
  profilePic: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
  bio: "Sundown Jammers will be wreaking havoc in Singapore with live music entertainment, food gastronomy and pop up events. It is a safe heaven for a unique cutting-edge atmosphere for everyone to relax and party the night away. Watch this space for all our exciting future ventures unfolding in the next few months! We're going to keep you plugged in and on the edge of your seat!",
  followers: 2815,
  email: "events@sundownjammers.com",
  phone: "+65 9876 5432",
  recentEvents: [
    {
      id: '1',
      title: 'Indie Night Live',
      image: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
      date: 'Sat, 25 June 2023',
      venue: 'The Projector, Golden Mile Tower',
    },
    {
      id: '2',
      title: 'Electronic Dreams Festival',
      image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
      date: 'Fri, 1 July 2023',
      venue: 'Zouk Singapore, Clarke Quay',
    },
    {
      id: '3',
      title: 'Jazz in the Gardens',
      image: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
      date: 'Sun, 10 July 2023',
      venue: 'Gardens by the Bay',
    }
  ]
};

const OrganizerProfilePage = () => {
  const navigate = useNavigate();
  const { isOrganizerMode, toggleOrganizerMode } = useOrganizerMode();
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-vybr-blue/5 to-white pb-24">
      <header className="pt-6 px-4 safe-area-top">
        <div className="mx-auto">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold flex items-center text-vybr-blue">
              <User className="text-vybr-midBlue mr-2 h-6 w-6" />
              Organiser Profile
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
                    <AvatarImage src={ORGANISER_DATA.profilePic} alt={ORGANISER_DATA.name} />
                    <AvatarFallback>{ORGANISER_DATA.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                </div>
              </div>
              
              <div className="pt-20 pb-5 px-4 text-center">
                <h2 className="text-2xl font-bold text-gray-900">{ORGANISER_DATA.name}</h2>
                <Badge className="mt-2 bg-vybr-midBlue text-white">Event Organiser</Badge>
                
                <div className="flex justify-center mt-4">
                  <div className="flex items-center">
                    <Users className="h-5 w-5 text-vybr-midBlue mr-1" />
                    <p className="font-semibold text-vybr-blue">{ORGANISER_DATA.followers}</p>
                    <p className="text-sm text-gray-500 ml-1.5">Followers</p>
                  </div>
                </div>
                
                <p className="text-gray-600 mt-4 text-sm px-4">{ORGANISER_DATA.bio}</p>
              </div>
            </CardContent>
          </Card>
          
          {/* Contact Information */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <h3 className="font-semibold mb-3">Contact Information</h3>
              
              <div className="flex items-center mb-3">
                <Mail className="h-5 w-5 text-vybr-midBlue mr-3" />
                <span className="text-sm">{ORGANISER_DATA.email}</span>
              </div>
              
              <div className="flex items-center">
                <Phone className="h-5 w-5 text-vybr-midBlue mr-3" />
                <span className="text-sm">{ORGANISER_DATA.phone}</span>
              </div>
            </CardContent>
          </Card>
          
          {/* Recent Events */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg flex items-center">
                <Star className="h-5 w-5 text-vybr-midBlue mr-2" />
                Recent Posts
              </h3>
              
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-vybr-midBlue hover:text-vybr-darkBlue hover:bg-vybr-midBlue/10"
                onClick={() => navigate('/organizer/posts')}
              >
                View All
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
            
            {ORGANISER_DATA.recentEvents.map((event, index) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                <Card 
                  className="mb-3 overflow-hidden border border-gray-100 hover:shadow-md transition-all duration-300 cursor-pointer"
                  onClick={() => navigate(`/organizer/event/${event.id}`)}
                >
                  <div className="flex">
                    <div className="w-24 h-24">
                      <img 
                        src={event.image} 
                        alt={event.title} 
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <CardContent className="p-3 flex-1">
                      <h4 className="font-semibold text-gray-900">{event.title}</h4>
                      <div className="flex items-center text-xs text-gray-500 mt-1">
                        <Calendar className="h-3 w-3 mr-1" />
                        <span>{event.date}</span>
                      </div>
                      <div className="flex items-center text-xs text-gray-500 mt-1">
                        <div className="h-3 w-3 mr-1 flex items-center">
                          <div className="w-[10px] h-[10px] rounded-full bg-vybr-midBlue/70"></div>
                        </div>
                        <span className="truncate">{event.venue}</span>
                      </div>
                    </CardContent>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
          
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
                  Toggle to switch between organiser and user views
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      
      <TabBar />
    </div>
  );
};

export default OrganizerProfilePage;
