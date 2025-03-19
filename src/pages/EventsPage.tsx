
import React, { useState } from 'react';
import TabBar from '@/components/TabBar';
import { Calendar, MapPin, Music, Tag, Clock, Ticket, ArrowLeft, User, Heart, Send } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { 
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext
} from '@/components/ui/carousel';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from '@/components/ui/scroll-area';

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
    organizer: {
      name: 'Indie Sounds SG',
      image: 'https://images.unsplash.com/photo-1485579149621-3123dd979885?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
      contact: 'contact@indiesoundssg.com'
    },
    description: 'Join us for an unforgettable night of indie rock and alternative music. Experience the atmospheric sounds of The Neighbourhood and Cigarettes After Sex live at The Projector.',
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
    organizer: {
      name: 'Electronic Vibes',
      image: 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
      contact: 'info@electronicvibes.sg'
    },
    description: 'Electronic Dreams Festival brings you the best electronic music experience with world-class DJs and producers. Immerse yourself in cutting-edge sound and visual technology at Zouk.',
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
    organizer: {
      name: 'Jazz Connection',
      image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
      contact: 'hello@jazzconnection.sg'
    },
    description: 'Experience the smooth sounds of jazz against the stunning backdrop of Gardens by the Bay. This open-air concert features celebrated artists Kamasi Washington and Robert Glasper.',
  }
];

const EventBookingDialog = ({ event, onClose }) => {
  return (
    <div className="relative">
      <Button 
        className="absolute top-4 left-4 z-10 rounded-full bg-white/70 backdrop-blur-sm p-2 h-auto"
        variant="ghost"
        size="sm"
        onClick={onClose}
      >
        <ArrowLeft className="h-5 w-5" />
      </Button>
      
      <div className="mb-4">
        <AspectRatio ratio={16 / 9}>
          <img 
            src={event.images[0]} 
            alt={event.title} 
            className="h-full w-full object-cover rounded-t-md"
          />
        </AspectRatio>
      </div>
      
      <div className="px-4 pb-4">
        <h2 className="text-xl font-bold mb-2">{event.title}</h2>
        
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <img 
              src={event.organizer.image} 
              alt={event.organizer.name}
              className="h-8 w-8 rounded-full object-cover mr-2"
            />
            <div>
              <p className="text-sm font-medium">{event.organizer.name}</p>
              <p className="text-xs text-gray-500">Organizer</p>
            </div>
          </div>
          
          <Button 
            size="sm" 
            variant="outline"
            className="rounded-full bg-vybr-midBlue/10 text-vybr-blue border-none hover:bg-vybr-midBlue hover:text-white"
          >
            <Heart className="h-4 w-4 mr-1" />
            Follow
          </Button>
        </div>
        
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
        
        <p className="text-gray-600 text-sm mb-6">{event.description}</p>
        
        <Button 
          className="w-full bg-vybr-midBlue hover:bg-vybr-blue text-white rounded-full py-2.5"
          size="lg"
        >
          <Ticket className="mr-2 h-5 w-5" />
          Reserve for {event.price}
        </Button>
        
        <div className="mt-6 border-t border-gray-100 pt-4">
          <h3 className="font-medium mb-2">Contact Organizer</h3>
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">{event.organizer.contact}</div>
            <Button 
              size="sm" 
              variant="ghost"
              className="rounded-full bg-vybr-midBlue/10 text-vybr-blue hover:bg-vybr-midBlue hover:text-white"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

const EventCard = ({ event }) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="overflow-hidden mb-4 border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300">
        <div className="relative w-full">
          <AspectRatio ratio={1 / 1}>
            <Carousel className="w-full h-full">
              <CarouselContent className="h-full">
                {event.images.map((image, index) => (
                  <CarouselItem key={index} className="p-0 h-full">
                    <div className="w-full h-full relative">
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
            <Clock className="h-4 w-4 text-gray-400 mt-0.5" />
            <span>{event.date}</span>
          </div>
          
          <div className="flex items-start space-x-2 text-sm text-gray-500 mb-4">
            <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
            <span>{event.venue}</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="font-bold text-vybr-blue">{event.price}</span>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  size="sm" 
                  className="rounded-full bg-vybr-midBlue hover:bg-vybr-blue text-white shadow-sm"
                >
                  <Ticket className="mr-1 h-4 w-4" />
                  Book Now
                </Button>
              </DialogTrigger>
              <DialogContent className="p-0 max-w-md">
                <ScrollArea className="max-h-[85vh]">
                  <EventBookingDialog event={event} onClose={() => setIsDialogOpen(false)} />
                </ScrollArea>
              </DialogContent>
            </Dialog>
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
