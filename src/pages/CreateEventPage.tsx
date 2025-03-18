
import React, { useState } from 'react';
import { Calendar, MapPin, Music, Users, Clock, Plus, Image, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import TabBar from '@/components/TabBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

const CreateEventPage = () => {
  const { toast } = useToast();
  const [formState, setFormState] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    location: '',
    genre: '',
    capacity: '',
    images: []
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // In a real app, this would send the data to a backend
    console.log('Form submitted:', formState);
    toast({
      title: "Event Created!",
      description: "Your event has been successfully created and published.",
      variant: "default",
    });
  };

  const handleImageUpload = () => {
    // Simulate image selection - in a real app this would connect to device camera/gallery
    const mockImages = [
      'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1170&q=80',
      'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1170&q=80'
    ];
    setFormState(prev => ({...prev, images: [...mockImages]}));
  };

  const MotionHeading = motion.h1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-vybr-blue/5 to-white pb-24">
      {/* Header */}
      <header className="pt-6 pb-4 px-4 safe-area-top">
        <div className="flex items-center justify-between mb-2">
          <MotionHeading 
            className="text-2xl font-bold flex items-center text-vybr-blue"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Calendar className="text-vybr-midBlue mr-2 h-6 w-6" />
            Create Event
          </MotionHeading>
          
          <img 
            src="/lovable-uploads/d9d63781-f853-48bc-b06e-8074bad2f8cb.png" 
            alt="Vybr Logo" 
            className="h-10 w-auto"
          />
        </div>
        
        <motion.p
          className="text-gray-500 text-sm mb-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.3 }}
        >
          Host your own music event
        </motion.p>
      </header>
      
      {/* Main Content */}
      <main className="px-4 pb-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Event Images */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Event Images</Label>
            <div className="flex overflow-x-auto gap-3 py-2 no-scrollbar">
              {formState.images.length > 0 ? (
                formState.images.map((img, index) => (
                  <div key={index} className="relative min-w-32 h-32 rounded-lg overflow-hidden">
                    <img src={img} alt="Event" className="w-full h-full object-cover" />
                  </div>
                ))
              ) : null}
              <Button 
                type="button" 
                variant="outline" 
                className="min-w-32 h-32 border-dashed flex-col gap-2" 
                onClick={handleImageUpload}
              >
                <Image className="h-6 w-6 text-gray-400" />
                <span className="text-sm text-gray-500">Add Image</span>
              </Button>
            </div>
          </div>
          
          {/* Event Title */}
          <div>
            <Label htmlFor="title" className="text-sm font-medium">Event Title</Label>
            <Input 
              id="title" 
              name="title" 
              value={formState.title} 
              onChange={handleChange} 
              placeholder="Give your event a name"
              className="mt-1" 
            />
          </div>
          
          {/* Event Description */}
          <div>
            <Label htmlFor="description" className="text-sm font-medium">Description</Label>
            <Textarea 
              id="description" 
              name="description" 
              value={formState.description} 
              onChange={handleChange} 
              placeholder="What's this event about?"
              className="mt-1 min-h-24" 
            />
          </div>
          
          {/* Event Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="date" className="text-sm font-medium">Date</Label>
              <div className="relative mt-1">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input 
                  id="date" 
                  name="date" 
                  type="date" 
                  value={formState.date} 
                  onChange={handleChange}
                  className="pl-9" 
                />
              </div>
            </div>
            <div>
              <Label htmlFor="time" className="text-sm font-medium">Time</Label>
              <div className="relative mt-1">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input 
                  id="time" 
                  name="time" 
                  type="time" 
                  value={formState.time} 
                  onChange={handleChange}
                  className="pl-9" 
                />
              </div>
            </div>
          </div>
          
          {/* Event Location */}
          <div>
            <Label htmlFor="location" className="text-sm font-medium">Location</Label>
            <div className="relative mt-1">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input 
                id="location" 
                name="location" 
                value={formState.location} 
                onChange={handleChange} 
                placeholder="Where's the event?"
                className="pl-9" 
              />
            </div>
          </div>
          
          {/* Event Genre & Capacity */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="genre" className="text-sm font-medium">Music Genre</Label>
              <div className="relative mt-1">
                <Music className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input 
                  id="genre" 
                  name="genre" 
                  value={formState.genre} 
                  onChange={handleChange} 
                  placeholder="Genre"
                  className="pl-9" 
                />
              </div>
            </div>
            <div>
              <Label htmlFor="capacity" className="text-sm font-medium">Capacity</Label>
              <div className="relative mt-1">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input 
                  id="capacity" 
                  name="capacity" 
                  type="number" 
                  value={formState.capacity} 
                  onChange={handleChange} 
                  placeholder="# of people"
                  className="pl-9" 
                />
              </div>
            </div>
          </div>
          
          {/* Submit Button */}
          <Button 
            type="submit" 
            className="w-full bg-vybr-midBlue hover:bg-vybr-blue text-white py-3 rounded-lg flex items-center justify-center gap-2 mt-6"
            size="lg"
          >
            <Check className="h-5 w-5" />
            Create Event
          </Button>
        </form>
      </main>
      
      {/* Tab Bar */}
      <TabBar />
    </div>
  );
};

export default CreateEventPage;
