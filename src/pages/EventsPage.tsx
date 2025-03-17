
import React from 'react';
import TabBar from '@/components/TabBar';
import { Calendar, MapPin, Music, Tag, Clock, Ticket } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';

// Sample event data
const EVENTS = [
  {
    id: '1',
    title: 'Indie Night Live',
    image: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
    date: 'Sat, 25 June 2023 • 8:00 PM',
    venue: 'The Projector, Golden Mile Tower',
    genres: ['Indie Rock', 'Alternative'],
    artists: ['The Neighbourhood', 'Cigarettes After Sex'],
    price: '$35',
    matchesUserTaste: true,
  },
  {
    id: '2',
    title: 'Electronic Dreams Festival',
    image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
    date: 'Fri, 1 July 2023 • 10:00 PM',
    venue: 'Zouk Singapore, Clarke Quay',
    genres: ['Electronic', 'House', 'Techno'],
    artists: ['Disclosure', 'Flume'],
    price: '$45',
    matchesUserTaste: false,
  },
  {
    id: '3',
    title: 'Jazz in the Gardens',
    image: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
    date: 'Sun, 10 July 2023 • 5:00 PM',
    venue: 'Gardens by the Bay, Marina Bay',
    genres: ['Jazz', 'Soul'],
    artists: ['Kamasi Washington', 'Robert Glasper'],
    price: '$30',
    matchesUserTaste: true,
  }
];

const EventCard = ({ event }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="overflow-hidden mb-4 border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300">
        <div className="relative h-48 w-full">
          <img 
            src={event.image} 
            alt={event.title} 
            className="h-full w-full object-cover"
          />
          {event.matchesUserTaste && (
            <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm text-vybr-blue px-3 py-1 rounded-full flex items-center space-x-1">
              <Music className="w-4 h-4 text-vybr-midBlue" />
              <span className="font-medium text-xs">Matches your taste</span>
            </div>
          )}
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
            <Clock className="h-4 w-4 text-gray-400 mt-0.5" />
            <span>{event.date}</span>
          </div>
          
          <div className="flex items-start space-x-2 text-sm text-gray-500 mb-4">
            <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
            <span>{event.venue}</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="font-bold text-vybr-blue">{event.price}</span>
            <Button 
              size="sm" 
              className="rounded-full bg-vybr-midBlue hover:bg-vybr-blue text-white shadow-sm"
            >
              <Ticket className="mr-1 h-4 w-4" />
              Reserve
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

const EventsPage = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-vybr-blue/5 to-white pb-24">
      <header className="pt-6 pb-4 px-6 safe-area-top">
        <div className="max-w-md mx-auto">
          <div className="flex items-center mb-2">
            <img 
              src="/lovable-uploads/d9d63781-f853-48bc-b06e-8074bad2f8cb.png" 
              alt="Vybr Logo" 
              className="h-8 mr-3"
            />
            <h1 className="text-2xl font-bold flex items-center text-vybr-blue">
              <Calendar className="text-vybr-midBlue mr-2 h-6 w-6" />
              Events
            </h1>
          </div>
          <p className="text-gray-500 text-sm mt-1">Discover concerts and music events in Singapore</p>
        </div>
      </header>
      
      <main className="px-4 pb-6">
        <motion.div 
          className="max-w-md mx-auto"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {EVENTS.map(event => (
            <EventCard key={event.id} event={event} />
          ))}
        </motion.div>
      </main>
      
      <TabBar />
    </div>
  );
};

export default EventsPage;
