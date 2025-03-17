
import React from 'react';
import TabBar from '@/components/TabBar';
import { Calendar } from 'lucide-react';

const EventsPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-matchmaker-gray to-white pb-24">
      <header className="pt-6 pb-4 px-6">
        <div className="max-w-md mx-auto">
          <h1 className="text-3xl font-bold flex items-center text-matchmaker-darkGray">
            <Calendar className="text-matchmaker-teal mr-2 h-7 w-7" />
            Events
          </h1>
          <p className="text-gray-500 text-sm mt-1">Discover concerts and music events</p>
        </div>
      </header>
      
      <main className="px-4 pb-6">
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-md p-6 text-center">
          <p className="text-gray-600">Events will be displayed here</p>
        </div>
      </main>
      
      <TabBar />
    </div>
  );
};

export default EventsPage;
