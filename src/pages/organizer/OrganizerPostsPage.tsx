
import React from 'react';
import { ArrowRight, Calendar, Edit, MapPin, Tag, Trash, Users, Activity, Star } from 'lucide-react';
import TabBar from '@/components/TabBar';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AspectRatio } from '@/components/ui/aspect-ratio';

// Sample event data for organiser
const ORGANISER_EVENTS = [
  {
    id: '1',
    title: 'Indie Night Live',
    image: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
    date: 'Sat, 25 June 2023 • 8:00 PM',
    venue: 'The Projector, Golden Mile Tower',
    genres: ['Indie Rock', 'Alternative'],
    artists: ['The Neighbourhood', 'Cigarettes After Sex'],
    impressions: 1250,
    reservations: 87,
    clickThroughRate: '5.2%',
    revenue: '$3,045',
  },
  {
    id: '2',
    title: 'Electronic Dreams Festival',
    image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
    date: 'Fri, 1 July 2023 • 10:00 PM',
    venue: 'Zouk Singapore, Clarke Quay',
    genres: ['Electronic', 'House', 'Techno'],
    artists: ['Disclosure', 'Flume'],
    impressions: 3450,
    reservations: 215,
    clickThroughRate: '6.8%',
    revenue: '$7,525',
  },
  {
    id: '3',
    title: 'Jazz in the Gardens',
    image: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
    date: 'Sun, 10 July 2023 • 5:00 PM',
    venue: 'Gardens by the Bay, Marina Bay',
    genres: ['Jazz', 'Soul'],
    artists: ['Kamasi Washington', 'Robert Glasper'],
    impressions: 980,
    reservations: 53,
    clickThroughRate: '4.1%',
    revenue: '$1,590',
  }
];

const OrganizerPostsPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-vybr-blue/5 to-white pb-24">
      <header className="pt-6 pb-4 px-4 safe-area-top">
        <div className="mx-auto">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold flex items-center text-vybr-blue">
              <Star className="text-vybr-midBlue mr-2 h-6 w-6" />
              Your Posts
            </h1>
            <img 
              src="/lovable-uploads/0cc2a209-13f6-490c-bfd1-e35d209b6a89.png" 
              alt="Vybr Logo" 
              className="h-16 w-auto" 
            />
          </div>
          <p className="text-gray-500 text-sm">Manage your hosted events and check performance</p>
        </div>
      </header>
      
      <main className="px-4 pb-6">
        <motion.div 
          className="mx-auto space-y-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ staggerChildren: 0.1 }}
        >
          {ORGANISER_EVENTS.map((event) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="w-full"
            >
              <Card className="overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300">
                <div className="w-full">
                  <AspectRatio ratio={1 / 1}>
                    <img 
                      src={event.image} 
                      alt={event.title} 
                      className="h-full w-full object-cover"
                    />
                  </AspectRatio>
                </div>
                
                <CardContent className="p-4">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{event.title}</h3>
                  
                  <div className="flex flex-wrap gap-2 mb-3">
                    {event.genres.map((genre, index) => (
                      <Badge 
                        key={index} 
                        className="bg-vybr-skyBlue/30 text-vybr-darkBlue"
                      >
                        {genre}
                      </Badge>
                    ))}
                  </div>
                  
                  <div className="flex items-start space-x-2 text-sm text-gray-500 mb-2">
                    <Calendar className="h-4 w-4 text-gray-400 mt-0.5" />
                    <span>{event.date}</span>
                  </div>
                  
                  <div className="flex items-start space-x-2 text-sm text-gray-500 mb-4">
                    <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                    <span>{event.venue}</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                    <div className="flex items-center">
                      <Activity className="h-4 w-4 text-vybr-midBlue mr-1.5" />
                      <span className="font-semibold">{event.impressions}</span>
                      <span className="text-gray-500 ml-1">impressions</span>
                    </div>
                    <div className="flex items-center">
                      <Users className="h-4 w-4 text-vybr-midBlue mr-1.5" />
                      <span className="font-semibold">{event.reservations}</span>
                      <span className="text-gray-500 ml-1">bookings</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex space-x-2">
                      <Button 
                        size="sm"
                        variant="outline" 
                        className="rounded-full border-vybr-midBlue text-vybr-blue"
                        onClick={() => console.log('Edit event')}
                      >
                        <Edit className="mr-1 h-4 w-4" />
                        Edit
                      </Button>
                      
                      <Button 
                        size="sm"
                        variant="outline" 
                        className="rounded-full border-red-300 text-red-500"
                        onClick={() => console.log('Delete event')}
                      >
                        <Trash className="mr-1 h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                    
                    <Button 
                      size="sm"
                      variant="ghost" 
                      className="text-vybr-midBlue hover:text-vybr-darkBlue hover:bg-vybr-midBlue/10"
                      onClick={() => navigate(`/organizer/event/${event.id}`)}
                    >
                      Details
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </main>
      
      <TabBar />
    </div>
  );
};

export default OrganizerPostsPage;
