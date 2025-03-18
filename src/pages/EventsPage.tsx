
import React from 'react';
import TabBar from '@/components/TabBar';
import { Calendar, MapPin, Music, Tag, Clock, Ticket } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { 
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext
} from '@/components/ui/carousel';

// Sample event data
const EVENTS = [
  {
    id: '1',
    title: 'Indie Night Live',
    images: [
      'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80'
    ],
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
    images: [
      'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1506157786151-b8491531f063?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80'
    ],
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
    images: [
      'https://images.unsplash.com/photo-1511192336575-5a79af67a629?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80'
    ],
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
          <Carousel className="w-full">
            <CarouselContent>
              {event.images.map((image, index) => (
                <CarouselItem key={index} className="p-0">
                  <div className="h-48 w-full relative">
                    <img 
                      src={image} 
                      alt={`${event.title} - Image ${index + 1}`} 
                      className="h-full w-full object-cover"
                    />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 bg-white/70 backdrop-blur-sm border-0" />
            <CarouselNext className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 bg-white/70 backdrop-blur-sm border-0" />
          </Carousel>
          
          {event.matchesUserTaste && (
            <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm text-vybr-blue px-3 py-1 rounded-full flex items-center space-x-1 z-10">
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
              Book Now
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
      <header className="pt-6 pb-4 px-4 safe-area-top">
        <div className="mx-auto">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold flex items-center text-vybr-blue">
              <Calendar className="text-vybr-midBlue mr-2 h-6 w-6" />
              Events
            </h1>
            <img 
              src="/lovable-uploads/0cc2a209-13f6-490c-bfd1-e35d209b6a89.png" 
              alt="Vybr Logo" 
              className="h-12 w-auto"
            />
          </div>
          <p className="text-gray-500 text-sm mt-1">Discover concerts and music events in Singapore</p>
        </div>
      </header>
      
      <main className="px-4 pb-6">
        <motion.div 
          className="mx-auto"
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
