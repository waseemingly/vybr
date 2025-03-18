
import React from 'react';
import TabBar from '@/components/TabBar';
import { User, Mail, Phone, Star, Users, ArrowRight, Calendar } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useOrganizerMode } from '@/hooks/useOrganizerMode';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

// Sample organizer data
const ORGANIZER_DATA = {
  name: "Alex Chen Productions",
  profilePic: "https://images.unsplash.com/photo-1536104968055-4d61aa56f46a?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
  bio: "Independent music event organizer specializing in indie and electronic music events. Bringing the best underground artists to venues across Singapore.",
  followers: 1245,
  email: "alex@chenproductions.com",
  phone: "+65 9123 4567",
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
  const { toggleOrganizerMode } = useOrganizerMode();
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-vybr-blue/5 to-white pb-24">
      <header className="pt-6 px-4 safe-area-top">
        <div className="mx-auto">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold flex items-center text-vybr-blue">
              <User className="text-vybr-midBlue mr-2 h-6 w-6" />
              Organizer Profile
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
                    <AvatarImage src={ORGANIZER_DATA.profilePic} alt={ORGANIZER_DATA.name} />
                    <AvatarFallback>{ORGANIZER_DATA.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                </div>
              </div>
              
              <div className="pt-20 pb-5 px-4 text-center">
                <h2 className="text-2xl font-bold text-gray-900">{ORGANIZER_DATA.name}</h2>
                <Badge className="mt-2 bg-vybr-midBlue text-white">Event Organizer</Badge>
                
                <div className="flex justify-center mt-4">
                  <div className="flex items-center">
                    <Users className="h-5 w-5 text-vybr-midBlue mr-1" />
                    <p className="font-semibold text-vybr-blue">{ORGANIZER_DATA.followers}</p>
                    <p className="text-sm text-gray-500 ml-1.5">Followers</p>
                  </div>
                </div>
                
                <p className="text-gray-600 mt-4 text-sm px-4">{ORGANIZER_DATA.bio}</p>
                
                <div className="mt-6 flex justify-center space-x-4">
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="rounded-full border-vybr-midBlue text-vybr-blue"
                  >
                    <Mail className="mr-1.5 h-4 w-4" />
                    Contact
                  </Button>
                  
                  <Button 
                    size="sm"
                    className="rounded-full bg-vybr-midBlue text-white"
                    onClick={() => toggleOrganizerMode()}
                  >
                    <User className="mr-1.5 h-4 w-4" />
                    Switch to User
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Contact Information */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <h3 className="font-semibold mb-3">Contact Information</h3>
              
              <div className="flex items-center mb-3">
                <Mail className="h-5 w-5 text-vybr-midBlue mr-3" />
                <span className="text-sm">{ORGANIZER_DATA.email}</span>
              </div>
              
              <div className="flex items-center">
                <Phone className="h-5 w-5 text-vybr-midBlue mr-3" />
                <span className="text-sm">{ORGANIZER_DATA.phone}</span>
              </div>
            </CardContent>
          </Card>
          
          {/* Recent Events */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg flex items-center">
                <Star className="h-5 w-5 text-vybr-midBlue mr-2" />
                Recent Events
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
            
            {ORGANIZER_DATA.recentEvents.map((event, index) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                <Card className="mb-3 overflow-hidden border border-gray-100 hover:shadow-md transition-all duration-300">
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
        </div>
      </main>
      
      <TabBar />
    </div>
  );
};

export default OrganizerProfilePage;
