
import React from 'react';
import TabBar from '@/components/TabBar';
import { Search } from 'lucide-react';

const SearchPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-matchmaker-gray to-white pb-24">
      <header className="pt-6 pb-4 px-6">
        <div className="max-w-md mx-auto">
          <h1 className="text-3xl font-bold flex items-center text-matchmaker-darkGray">
            <Search className="text-matchmaker-teal mr-2 h-7 w-7" />
            Search
          </h1>
          <p className="text-gray-500 text-sm mt-1">Find music lovers near you</p>
        </div>
      </header>
      
      <main className="px-4 pb-6">
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-md p-6 text-center">
          <p className="text-gray-600">Search functionality coming soon</p>
        </div>
      </main>
      
      <TabBar />
    </div>
  );
};

export default SearchPage;
