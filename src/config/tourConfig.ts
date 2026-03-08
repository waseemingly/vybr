import type { UserTabParamList, OrganizerTabParamList, MainStackParamList } from '@/navigation/AppNavigator';

export type TourUserType = 'music_lover' | 'organizer';

export type TourTarget =
  | { kind: 'none' }
  | { kind: 'userTab'; tab: keyof UserTabParamList }
  | { kind: 'organizerTab'; tab: keyof OrganizerTabParamList }
  | { kind: 'mainScreen'; screen: keyof MainStackParamList };

export type TourStep = {
  id: string;
  title: string;
  description: string;
  target: TourTarget;
};

export const MUSIC_LOVER_TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Vybr',
    description: 'Here’s a quick tour of the core features so you can start vibing right away.',
    target: { kind: 'none' },
  },
  {
    id: 'matches',
    title: 'Discover Vybs',
    description: 'Find new people based on your music taste and connect with matches.',
    target: { kind: 'userTab', tab: 'Matches' },
  },
  {
    id: 'events',
    title: 'Events',
    description: 'Explore events and see what’s happening near you.',
    target: { kind: 'userTab', tab: 'Events' },
  },
  {
    id: 'chats',
    title: 'Chats',
    description: 'Message your matches and keep the conversation going. Open the Chats tab, then under Individual you’ll see two sub-tabs: Chats and Pending.',
    target: { kind: 'userTab', tab: 'Chats' },
  },
  {
    id: 'chats-pending',
    title: 'Pending Chats',
    description:
      'When you tap “Chat” with a match, that conversation appears in Pending first. New chats stay in Pending until both of you have sent at least one message.',
    target: { kind: 'userTab', tab: 'Chats' },
  },
  {
    id: 'chats-active',
    title: 'Active Chats (Individual)',
    description:
      'Once both you and your match have sent a message, the chat moves from Pending to the main Chats list under Individual. That’s where your ongoing conversations live.',
    target: { kind: 'userTab', tab: 'Chats' },
  },
  {
    id: 'chats-add-friend',
    title: 'Adding Someone as a Friend',
    description:
      'To add a chat partner as a friend, open the chat, tap their name or avatar to go to their profile, then send a friend request from there. They’ll see it in their Friends List under Requests.',
    target: { kind: 'userTab', tab: 'Chats' },
  },
  {
    id: 'friends-requests',
    title: 'Accepting Friends',
    description:
      'When someone sends you a friend request, open your Friends List and switch to the Requests tab to Accept or Decline.',
    target: { kind: 'mainScreen', screen: 'FriendsListScreen' },
  },
  {
    id: 'search',
    title: 'Search',
    description: 'Search for people, organizers, and more.',
    target: { kind: 'userTab', tab: 'Search' },
  },
  {
    id: 'profile',
    title: 'Your Profile',
    description: 'Update your profile and manage your account settings.',
    target: { kind: 'userTab', tab: 'Profile' },
  },
  {
    id: 'my-bookings',
    title: 'My Bookings',
    description: 'Find your upcoming bookings and booking codes anytime in one place.',
    target: { kind: 'mainScreen', screen: 'MyBookingsScreen' },
  },
  {
    id: 'update-favorites',
    title: 'Update Favorites',
    description: 'Manually add your favorite artists, songs, and albums — great if you haven’t linked a service yet.',
    target: { kind: 'mainScreen', screen: 'UpdateMusicFavoritesScreen' },
  },
];

export const ORGANIZER_TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Vybr (Organizer)',
    description: 'Let’s do a quick tour so you can start creating and managing events.',
    target: { kind: 'none' },
  },
  {
    id: 'posts',
    title: 'Your Events',
    description: 'View and manage your event listings here.',
    target: { kind: 'organizerTab', tab: 'Posts' },
  },
  {
    id: 'create',
    title: 'Create',
    description: 'Create a new event and publish it to Vybr.',
    target: { kind: 'organizerTab', tab: 'Create' },
  },
  {
    id: 'profile',
    title: 'Organizer Profile',
    description: 'Manage your organizer profile and settings.',
    target: { kind: 'organizerTab', tab: 'OrganizerProfile' },
  },
  {
    id: 'reservations',
    title: 'Reservations',
    description: 'Track reservations and manage attendee information across your events.',
    target: { kind: 'mainScreen', screen: 'OrganizerReservationsScreen' },
  },
  {
    id: 'overall-analytics',
    title: 'Overall Analytics',
    description: 'See performance across all your events — views, bookings, revenue, and trends.',
    target: { kind: 'mainScreen', screen: 'OverallAnalyticsScreen' },
  },
  {
    id: 'manage-plan',
    title: 'Manage Plan & Billing',
    description: 'Manage your payment method and billing so platform fees can be charged correctly.',
    target: { kind: 'mainScreen', screen: 'ManagePlanScreen' },
  },
  {
    id: 'organizer-settings',
    title: 'Organizer Settings',
    description: 'Update organizer account settings, notifications, and business details.',
    target: { kind: 'mainScreen', screen: 'OrganizerSettingsScreen' },
  },
];

export function getTourSteps(userType: TourUserType): TourStep[] {
  return userType === 'organizer' ? ORGANIZER_TOUR_STEPS : MUSIC_LOVER_TOUR_STEPS;
}


