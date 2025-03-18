
import React, { useState } from 'react';
import TabBar from '@/components/TabBar';
import { Search, MapPin, Music, User, Filter, Mic, ArrowRight, Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';

// Sample search results
const SEARCH_RESULTS = [
  {
    id: '1',
    type: 'artist',
    name: 'Kendrick Lamar',
    image: 'https://images.unsplash.com/photo-1468164016595-6108e4c60c8b?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
    genre: 'Hip Hop',
  },
  {
    id: '2',
    type: 'genre',
    name: 'Jazz',
    count: '245 events',
  },
  {
    id: '3',
    type: 'event',
    name: 'Jazz Weekend Festival',
    date: 'July 15-17, 2023',
    venue: 'Esplanade',
  },
  {
    id: '4',
    type: 'user',
    name: 'Alex Rivera',
    image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-1.2.1&auto=format&fit=crop&w=687&q=80',
    genres: ['Rock', 'Alternative'],
  }
];

const SearchPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showResults, setShowResults] = useState(false);
  
  const handleSearch = (e) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      setShowResults(true);
    }
  };
  
  const renderSearchResult = (result) => {
    switch (result.type) {
      case 'artist':
        return (
          <Card key={result.id} className="mb-3 hover:shadow-md transition-all duration-200">
            <CardContent className="flex items-center p-3">
              <div className="h-12 w-12 rounded-full overflow-hidden mr-3 flex-shrink-0">
                <img src={result.image} alt={result.name} className="h-full w-full object-cover" />
              </div>
              <div className="flex-grow">
                <h3 className="font-medium">{result.name}</h3>
                <p className="text-xs text-gray-500">Artist • {result.genre}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-400" />
            </CardContent>
          </Card>
        );
      
      case 'genre':
        return (
          <Card key={result.id} className="mb-3 hover:shadow-md transition-all duration-200">
            <CardContent className="flex items-center p-3">
              <div className="h-12 w-12 rounded-full bg-vybr-skyBlue/30 flex items-center justify-center mr-3 flex-shrink-0">
                <Music className="h-6 w-6 text-vybr-blue" />
              </div>
              <div className="flex-grow">
                <h3 className="font-medium">{result.name}</h3>
                <p className="text-xs text-gray-500">Genre • {result.count}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-400" />
            </CardContent>
          </Card>
        );
      
      case 'event':
        return (
          <Card key={result.id} className="mb-3 hover:shadow-md transition-all duration-200">
            <CardContent className="flex items-center p-3">
              <div className="h-12 w-12 rounded-full bg-vybr-midBlue/20 flex items-center justify-center mr-3 flex-shrink-0">
                <Calendar className="h-6 w-6 text-vybr-blue" />
              </div>
              <div className="flex-grow">
                <h3 className="font-medium">{result.name}</h3>
                <p className="text-xs text-gray-500">{result.date} • {result.venue}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-400" />
            </CardContent>
          </Card>
        );
      
      case 'user':
        return (
          <Card key={result.id} className="mb-3 hover:shadow-md transition-all duration-200">
            <CardContent className="flex items-center p-3">
              <div className="h-12 w-12 rounded-full overflow-hidden mr-3 flex-shrink-0">
                <img src={result.image} alt={result.name} className="h-full w-full object-cover" />
              </div>
              <div className="flex-grow">
                <h3 className="font-medium">{result.name}</h3>
                <div className="flex gap-1 mt-1">
                  {result.genres.map((genre, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs py-0 px-1.5">
                      {genre}
                    </Badge>
                  ))}
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-400" />
            </CardContent>
          </Card>
        );
      
      default:
        return null;
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-vybr-blue/5 to-white pb-24">
      <header className="pt-6 pb-4 px-4 safe-area-top">
        <div className="mx-auto">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold flex items-center text-vybr-blue">
              <Search className="text-vybr-midBlue mr-2 h-6 w-6" />
              Search
            </h1>
            <img 
              src="/lovable-uploads/6f793496-9715-4c6c-8b88-fcac27b1a4c2.png" 
              alt="Vybr Logo" 
              className="h-8 w-auto"
            />
          </div>
          <p className="text-gray-500 text-sm mt-1">Find music lovers near you</p>
        </div>
      </header>
      
      <main className="px-4 pb-6">
        <div className="mx-auto">
          <Card className="mb-5 overflow-visible">
            <CardContent className="p-4">
              <form onSubmit={handleSearch} className="relative mb-6">
                <div className="relative flex items-center">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input 
                    placeholder="Search by artist, genre, or location" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-16 py-3 h-14 rounded-xl border-gray-200 focus:border-vybr-midBlue focus:ring-vybr-midBlue/20 text-base"
                  />
                  <div className="absolute right-3 flex space-x-2">
                    <Button 
                      type="button" 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8 rounded-full bg-gray-100 text-gray-500"
                    >
                      <Mic className="h-4 w-4" />
                    </Button>
                    <Button 
                      type="button" 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8 rounded-full bg-gray-100 text-gray-500"
                    >
                      <Filter className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Button type="submit" className="hidden">Search</Button>
              </form>
              
              <div className="space-y-4">
                <h3 className="font-semibold text-lg text-gray-800">Popular searches</h3>
                <div className="flex flex-wrap gap-3">
                  <Button variant="outline" size="sm" className="rounded-full border-vybr-midBlue/30 text-vybr-blue py-2 px-4">
                    <Music className="mr-1 h-4 w-4" />
                    Jazz
                  </Button>
                  <Button variant="outline" size="sm" className="rounded-full border-vybr-midBlue/30 text-vybr-blue py-2 px-4">
                    <Music className="mr-1 h-4 w-4" />
                    Hip Hop
                  </Button>
                  <Button variant="outline" size="sm" className="rounded-full border-vybr-midBlue/30 text-vybr-blue py-2 px-4">
                    <User className="mr-1 h-4 w-4" />
                    DJs
                  </Button>
                  <Button variant="outline" size="sm" className="rounded-full border-vybr-midBlue/30 text-vybr-blue py-2 px-4">
                    <MapPin className="mr-1 h-4 w-4" />
                    Near me
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {showResults && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="font-semibold text-lg mb-3">Search Results</h2>
              {SEARCH_RESULTS.map(result => renderSearchResult(result))}
            </motion.div>
          )}
        </div>
      </main>
      
      <TabBar />
    </div>
  );
};

export default SearchPage;
