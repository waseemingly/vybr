
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MessageSquare, User, Search, Calendar, Plus, Heart, LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOrganizerMode } from '@/hooks/useOrganizerMode';

// Define the type for tab items
interface TabItem {
  icon: React.ElementType;
  label: string;
  path: string;
  isPrimary?: boolean;
}

const TabBar = () => {
  const location = useLocation();
  const { isOrganizerMode } = useOrganizerMode();
  
  // User mode tabs (original design)
  const userTabs: TabItem[] = [
    { icon: Heart, label: 'Matches', path: '/' },
    { icon: MessageSquare, label: 'Chats', path: '/chats' },
    { icon: Search, label: 'Search', path: '/search' },
    { icon: Calendar, label: 'Events', path: '/events' },
    { icon: User, label: 'Profile', path: '/profile' },
  ];

  // Organiser mode tabs
  const organiserTabs: TabItem[] = [
    { icon: LayoutDashboard, label: 'Posts', path: '/organiser/posts' },
    { icon: Plus, label: 'Create', path: '/create-event', isPrimary: true },
    { icon: User, label: 'Profile', path: '/organiser/profile' },
  ];

  // Choose which tabs to display based on mode
  const tabs = isOrganizerMode ? organiserTabs : userTabs;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg py-2 px-1 z-50 animate-fade-in safe-area-bottom">
      <div className="flex justify-around items-center">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          const isPrimary = tab.isPrimary;
          
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={cn(
                "flex flex-col items-center p-1 text-xs transition-all duration-200",
                isActive 
                  ? "text-vybr-blue font-medium" 
                  : "text-gray-500 hover:text-vybr-midBlue"
              )}
            >
              <div className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center mb-1 transition-all duration-300",
                isPrimary 
                  ? "bg-vybr-midBlue text-white" 
                  : isActive 
                    ? "bg-vybr-midBlue/10 text-vybr-blue" 
                    : "text-gray-400 hover:bg-vybr-midBlue/5"
              )}>
                <tab.icon className={cn(
                  "w-6 h-6 transition-transform duration-300",
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
