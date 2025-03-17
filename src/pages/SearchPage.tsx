
import React from 'react';
import TabBar from '@/components/TabBar';
import { Search, MapPin, Music, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const SearchPage = () => {
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
              <Search className="text-vybr-midBlue mr-2 h-6 w-6" />
              Search
            </h1>
          </div>
          <p className="text-gray-500 text-sm mt-1">Find music lovers near you</p>
        </div>
      </header>
      
      <main className="px-4 pb-6">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-2xl shadow-md p-6">
            <div className="relative mb-6">
              <Input 
                placeholder="Search by artist, genre, or location" 
                className="pl-10 pr-4 py-3 rounded-xl border-gray-200 focus:border-vybr-midBlue focus:ring-vybr-midBlue/20"
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            </div>
            
            <div className="space-y-4 mb-6">
              <h3 className="font-semibold text-lg text-gray-800">Popular searches</h3>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="rounded-full border-vybr-midBlue/30 text-vybr-blue">
                  <Music className="mr-1 h-4 w-4" />
                  Jazz
                </Button>
                <Button variant="outline" size="sm" className="rounded-full border-vybr-midBlue/30 text-vybr-blue">
                  <Music className="mr-1 h-4 w-4" />
                  Hip Hop
                </Button>
                <Button variant="outline" size="sm" className="rounded-full border-vybr-midBlue/30 text-vybr-blue">
                  <User className="mr-1 h-4 w-4" />
                  DJs
                </Button>
                <Button variant="outline" size="sm" className="rounded-full border-vybr-midBlue/30 text-vybr-blue">
                  <MapPin className="mr-1 h-4 w-4" />
                  Near me
                </Button>
              </div>
            </div>
            
            <p className="text-gray-500 text-center text-sm">
              Search features coming soon with more filtering options
            </p>
          </div>
        </div>
      </main>
      
      <TabBar />
    </div>
  );
};

export default SearchPage;
