
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import ChatsPage from "./pages/ChatsPage";
import SearchPage from "./pages/SearchPage";
import EventsPage from "./pages/EventsPage";
import ProfilePage from "./pages/ProfilePage";
import CreateEventPage from "./pages/CreateEventPage";
import NotFound from "./pages/NotFound";
import { OrganizerModeProvider } from "./hooks/useOrganizerMode";
import OrganizerPostsPage from "./pages/organizer/OrganizerPostsPage";
import OrganizerProfilePage from "./pages/organizer/OrganizerProfilePage";
import EventDetailPage from "./pages/organizer/EventDetailPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <OrganizerModeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* User Routes */}
            <Route path="/" element={<Index />} />
            <Route path="/chats" element={<ChatsPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/create-event" element={<CreateEventPage />} />
            
            {/* Organizer Routes */}
            <Route path="/organizer/posts" element={<OrganizerPostsPage />} />
            <Route path="/organizer/profile" element={<OrganizerProfilePage />} />
            <Route path="/organizer/event/:id" element={<EventDetailPage />} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </OrganizerModeProvider>
  </QueryClientProvider>
);

export default App;
