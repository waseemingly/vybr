
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MessageSquare, User, Search, Calendar, Radio, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';

const TabBar = () => {
  const location = useLocation();
  
  const tabs = [
    { icon: Heart, label: 'Matches', path: '/' },
    { icon: MessageSquare, label: 'Chats', path: '/chats' },
    { icon: Search, label: 'Search', path: '/search' },
    { icon: Calendar, label: 'Events', path: '/events' },
    { icon: User, label: 'Profile', path: '/profile' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg py-2 px-4 z-50 animate-fade-in">
      <div className="flex justify-between items-center max-w-screen-lg mx-auto">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={cn(
                "flex flex-col items-center p-2 text-xs transition-all duration-200",
                isActive 
                  ? "text-matchmaker-teal font-medium" 
                  : "text-gray-500 hover:text-matchmaker-teal"
              )}
            >
              <div className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center mb-1 transition-all duration-300",
                isActive 
                  ? "bg-matchmaker-teal/10 text-matchmaker-teal" 
                  : "text-gray-400 hover:bg-matchmaker-teal/5"
              )}>
                <tab.icon className={cn(
                  "w-5 h-5 transition-transform duration-300",
                  isActive ? "scale-110" : ""
                )} />
              </div>
              <span className={cn(
                "transition-all duration-200",
                isActive ? "opacity-100" : "opacity-70"
              )}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default TabBar;
