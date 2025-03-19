
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, MapPin, Edit, Trash, Activity, Users, Bell, DollarSign, Tag, Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  BarChart, 
  LineChart, 
  PieChart, 
  Pie, 
  Line, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Cell 
} from 'recharts';
import TabBar from '@/components/TabBar';
import { Switch } from '@/components/ui/switch';
import { useOrganizerMode } from '@/hooks/useOrganizerMode';

// Sample event details with analytics data
const EVENT_DETAILS = {
  id: '1',
  title: 'Indie Night Live',
  image: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
  date: 'Sat, 25 June 2023 • 8:00 PM',
  venue: 'The Projector, Golden Mile Tower',
  genres: ['Indie Rock', 'Alternative'],
  artists: ['The Neighbourhood', 'Cigarettes After Sex'],
  description: 'Join us for an unforgettable night of indie rock and alternative music. Experience the atmospheric sounds of The Neighbourhood and Cigarettes After Sex live at The Projector.',
  analytics: {
    impressions: 1250,
    reservations: 87,
    adSpend: 350,
    revenue: 3045,
    notificationsSent: 450,
    reservationBreakdown: [
      { name: 'Single', value: 42, color: '#3B82F6' },
      { name: 'Couple', value: 18, color: '#60A5FA' },
      { name: 'Group (3-5)', value: 21, color: '#93C5FD' },
      { name: 'Group (6+)', value: 6, color: '#1E3A8A' },
    ],
    monthlyPerformance: [
      { name: 'Jan', impressions: 0, clicks: 0, bookings: 0 },
      { name: 'Feb', impressions: 0, clicks: 0, bookings: 0 },
      { name: 'Mar', impressions: 0, clicks: 0, bookings: 0 },
      { name: 'Apr', impressions: 250, clicks: 28, bookings: 12 },
      { name: 'May', impressions: 780, clicks: 95, bookings: 45 },
      { name: 'Jun', impressions: 1250, clicks: 145, bookings: 87 },
    ],
  }
};

// Custom colors for charts
const CHART_COLORS = {
  impressions: '#3B82F6', // vybr-midBlue
  clicks: '#60A5FA', // vybr-lightBlue
  bookings: '#1E3A8A', // vybr-blue
};

const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  const radius = outerRadius * 0.6;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text 
      x={x} 
      y={y} 
      fill="#ffffff"
      textAnchor="middle" 
      dominantBaseline="central"
      fontSize={12}
      fontWeight="500"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

const EventDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const event = EVENT_DETAILS; // In a real app, fetch based on id
  const { isOrganizerMode, toggleOrganizerMode } = useOrganizerMode();
  
  // Calculate total reservations for percentages
  const totalReservations = event.analytics.reservationBreakdown.reduce(
    (total, item) => total + item.value, 0
  );
  
  // Add percent to each item for the pie chart
  const reservationBreakdownWithPercent = event.analytics.reservationBreakdown.map(item => ({
    ...item,
    percent: item.value / totalReservations
  }));
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-vybr-blue/5 to-white pb-24">
      <header className="pt-6 px-4 safe-area-top">
        <div className="mx-auto">
          <div className="flex items-center justify-between mb-4">
            <Button 
              variant="ghost" 
              size="sm"
              className="flex items-center text-vybr-blue hover:text-vybr-darkBlue"
              onClick={() => navigate("/organizer/posts")}
            >
              <ArrowLeft className="mr-1 h-5 w-5" />
              Back
            </Button>
            <img 
              src="/lovable-uploads/0cc2a209-13f6-490c-bfd1-e35d209b6a89.png" 
              alt="Vybr Logo" 
              className="h-12 w-auto" 
            />
          </div>
          
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-vybr-blue">{event.title}</h1>
            <div className="flex space-x-2">
              <Button 
                size="sm"
                variant="outline" 
                className="rounded-full border-vybr-midBlue text-vybr-blue"
              >
                <Edit className="mr-1 h-4 w-4" />
                Edit
              </Button>
              
              <Button 
                size="sm"
                variant="outline" 
                className="rounded-full border-red-300 text-red-500"
              >
                <Trash className="mr-1 h-4 w-4" />
                Delete
              </Button>
            </div>
          </div>
        </div>
      </header>
      
      <main className="px-4 pb-6">
        <ScrollArea className="h-[calc(100vh-180px)]">
          <div className="mx-auto">
            {/* Event Image */}
            <div className="relative w-full aspect-square rounded-lg overflow-hidden mb-4">
              <img 
                src={event.image} 
                alt={event.title} 
                className="h-full w-full object-cover"
              />
            </div>
            
            {/* Event Details */}
            <Card className="mb-6">
              <CardContent className="p-4">
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
                  <Calendar className="h-4 w-4 text-gray-400 mt-0.5" />
                  <span>{event.date}</span>
                </div>
                
                <div className="flex items-start space-x-2 text-sm text-gray-500 mb-4">
                  <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                  <span>{event.venue}</span>
                </div>
                
                <Separator className="my-4" />
                
                <h3 className="font-semibold mb-2">Featured Artists</h3>
                <div className="flex flex-wrap gap-2 mb-4">
                  {event.artists.map((artist, index) => (
                    <Badge 
                      key={index} 
                      variant="outline"
                      className="bg-vybr-midBlue/10 text-vybr-blue border-vybr-midBlue/30"
                    >
                      <Music className="w-3 h-3 mr-1" />
                      {artist}
                    </Badge>
                  ))}
                </div>
                
                <p className="text-gray-600 text-sm">{event.description}</p>
              </CardContent>
            </Card>
            
            {/* Analytics Overview */}
            <h2 className="text-xl font-bold text-vybr-blue mb-4 flex items-center">
              <Activity className="mr-2 h-5 w-5 text-vybr-midBlue" />
              Analytics Overview
            </h2>
            
            <div className="grid grid-cols-2 gap-3 mb-6">
              <Card className="bg-gradient-to-br from-vybr-blue/10 to-white">
                <CardContent className="p-4 flex flex-col items-center justify-center">
                  <Activity className="h-6 w-6 text-vybr-midBlue mb-1" />
                  <span className="text-2xl font-bold text-vybr-blue">{event.analytics.impressions}</span>
                  <span className="text-xs text-gray-500">Total Impressions</span>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-vybr-blue/10 to-white">
                <CardContent className="p-4 flex flex-col items-center justify-center">
                  <Users className="h-6 w-6 text-vybr-midBlue mb-1" />
                  <span className="text-2xl font-bold text-vybr-blue">{event.analytics.reservations}</span>
                  <span className="text-xs text-gray-500">Total Reservations</span>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-vybr-blue/10 to-white">
                <CardContent className="p-4 flex flex-col items-center justify-center">
                  <Bell className="h-6 w-6 text-vybr-midBlue mb-1" />
                  <span className="text-2xl font-bold text-vybr-blue">{event.analytics.notificationsSent}</span>
                  <span className="text-xs text-gray-500">Notifications Sent</span>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-vybr-blue/10 to-white">
                <CardContent className="p-4 flex flex-col items-center justify-center">
                  <DollarSign className="h-6 w-6 text-vybr-midBlue mb-1" />
                  <span className="text-2xl font-bold text-vybr-blue">${event.analytics.revenue}</span>
                  <span className="text-xs text-gray-500">Total Revenue</span>
                </CardContent>
              </Card>
            </div>
            
            {/* Reservation Breakdown (Pie Chart) - Improved */}
            <Card className="mb-6">
              <CardContent className="p-4">
                <h3 className="font-semibold mb-4">Reservation Breakdown</h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={reservationBreakdownWithPercent}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={renderCustomizedLabel}
                      >
                        {reservationBreakdownWithPercent.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value) => [`${value} bookings (${Math.round((value as number / totalReservations) * 100)}%)`, 'Bookings']} 
                        contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)' }}
                      />
                      <Legend 
                        layout="horizontal" 
                        verticalAlign="bottom" 
                        align="center"
                        iconType="circle"
                        wrapperStyle={{ paddingTop: '20px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            
            {/* Monthly Performance (Line Chart) */}
            <Card className="mb-6">
              <CardContent className="p-4">
                <h3 className="font-semibold mb-4">Ad Performance (Monthly)</h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={event.analytics.monthlyPerformance}
                      margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'rgba(255, 255, 255, 0.9)', 
                          borderRadius: '8px', 
                          border: 'none', 
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
                        }}
                      />
                      <Legend 
                        iconType="circle" 
                        wrapperStyle={{ paddingTop: '10px' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="impressions" 
                        stroke={CHART_COLORS.impressions} 
                        name="Impressions"
                        strokeWidth={2}
                        activeDot={{ r: 8 }} 
                      />
                      <Line 
                        type="monotone" 
                        dataKey="clicks" 
                        stroke={CHART_COLORS.clicks} 
                        name="Clicks"
                        strokeWidth={2}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="bookings" 
                        stroke={CHART_COLORS.bookings} 
                        name="Bookings"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            
            {/* Organizer Mode Toggle */}
            <Card className="mb-6">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Switch to User Mode</span>
                  <Switch 
                    checked={!isOrganizerMode}
                    onCheckedChange={toggleOrganizerMode}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </main>
      
      <TabBar />
    </div>
  );
};

export default EventDetailPage;
