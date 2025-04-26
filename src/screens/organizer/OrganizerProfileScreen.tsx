// src/screens/organizer/OrganizerProfileScreen.tsx (Example Path)
import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Dimensions,
  ActivityIndicator, Linking, Platform, Alert, RefreshControl
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList, MainStackParamList, OrganizerTabParamList } from '@/navigation/AppNavigator'; // Import all needed param lists

// --- !!! ADJUST PATHS !!! ---
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth"; // Use the AuthProvider context
import { useOrganizerMode } from "../../hooks/useOrganizerMode"; // Use the specific mode hook
import { APP_CONSTANTS } from "../../config/constants"; // Assuming constants live here
// ----------------------------

// Combine param lists for navigation prop type
type OrganizerProfileNavigationProp = NativeStackNavigationProp<RootStackParamList & MainStackParamList & OrganizerTabParamList>;

const DEFAULT_ORGANIZER_LOGO = 'https://via.placeholder.com/150/BFDBFE/1E40AF?text=Logo';

// Section Component (Keep as before)
interface SectionProps { title: string; icon: React.ComponentProps<typeof Feather>['name']; children: React.ReactNode; }
const Section: React.FC<SectionProps> = ({ title, icon, children }) => ( <View style={styles.section}><View style={styles.sectionHeader}><View style={styles.sectionTitleContainer}><Feather name={icon} size={18} color={APP_CONSTANTS.COLORS.PRIMARY} style={styles.sectionIcon} /><Text style={styles.sectionTitle}>{title}</Text></View></View>{children}</View>);
const formatBusinessType = (type?: string | null): string | null => { if(!type)return null;return type.replace(/_/g,' ').replace(/-/g,' ').split(' ').map(w=>w.charAt(0).toUpperCase()+w.slice(1).toLowerCase()).join(' ');};

interface OrganizerStats {
     totalEvents: number | null;
     upcomingEvents: number | null;
     pastEvents: number | null;
     followerCount: number | null; // <-- ADD FOLLOWER COUNT
}

const OrganizerProfileScreen: React.FC = () => {
  const { session, loading: authLoading, logout } = useAuth(); // Get session from context
  const { isOrganizerMode, toggleOrganizerMode } = useOrganizerMode(); // Use the specific hook
  const navigation = useNavigation<OrganizerProfileNavigationProp>();
  const [stats, setStats] = useState<OrganizerStats>({ totalEvents: null, upcomingEvents: null, pastEvents: null, followerCount: null });
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const organizerProfile = session?.organizerProfile;
  const userId = session?.user?.id;

  // Fetch organizer stats (Add follower count query)
  const fetchOrganizerStats = useCallback(async () => {
      if (!userId) return;
      if (!refreshing) setStatsLoading(true);
      setStatsError(null);
      try {
          const now = new Date().toISOString();
          // Use Promise.all but replace follower count with RPC call
          const [totalR, upcomingR, pastR, followerRpcRes] = await Promise.all([
              supabase.from('events').select('*.*', { count: 'exact', head: true }).eq('organizer_id', userId),
              supabase.from('events').select('*.*', { count: 'exact', head: true }).eq('organizer_id', userId).gt('event_datetime', now),
              supabase.from('events').select('*.*', { count: 'exact', head: true }).eq('organizer_id', userId).lte('event_datetime', now),
              supabase.rpc('get_organizer_follower_count', { p_organizer_id: userId }) // <-- Use RPC function
          ]);

          // Check RPC error first
          if (followerRpcRes.error) {
              console.error("[OrganizerProfileScreen] RPC Error fetching follower count:", followerRpcRes.error);
              throw new Error(`Follower Count RPC Error: ${followerRpcRes.error.message}`);
          }
          // Check other errors
          if (totalR.error || upcomingR.error || pastR.error) {
              console.warn("Stats DB Error:", totalR.error || upcomingR.error || pastR.error);
              // Decide if partial data is okay or throw
              // For now, we proceed but the counts might be inaccurate if there was an error
          }
          
          // Extract follower count from RPC result
          const followerCount = typeof followerRpcRes.data === 'number' ? followerRpcRes.data : 0;
          
          setStats({
              totalEvents: totalR.count ?? 0,
              upcomingEvents: upcomingR.count ?? 0,
              pastEvents: pastR.count ?? 0,
              followerCount: followerCount // <-- Set follower count from RPC
          });

          console.log(`[OrganizerProfileScreen] Stats fetched: Followers=${followerCount}, Events=${totalR.count}`);

      } catch (e: any) {
          console.error("Stats Err:", e);
          setStatsError(`Stats Error: ${e.message}`);
          // Reset all stats on error
          setStats({ totalEvents: null, upcomingEvents: null, pastEvents: null, followerCount: null });
      } finally {
          setStatsLoading(false);
          setRefreshing(false);
      }
  }, [userId, refreshing]);
  useFocusEffect(useCallback(() => { fetchOrganizerStats(); }, [fetchOrganizerStats]));
  const onRefresh = useCallback(() => { setRefreshing(true); }, []);

  // Loading/Error/Profile Check (Keep as before)
  if (authLoading) return ( <SafeAreaView style={styles.centered}><ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} /><Text style={styles.loadingText}>Loading Profile...</Text></SafeAreaView> );
  if (!session || !organizerProfile) return ( <SafeAreaView style={styles.centered}><Feather name="alert-circle" size={40} color="#FFA500" /><Text style={styles.errorText}>Profile Error</Text><Text style={styles.errorSubText}>{ !session?"Not logged in.":"Profile incomplete."}</Text><TouchableOpacity style={[styles.logoutButton,{marginTop:20,backgroundColor:!session?APP_CONSTANTS.COLORS.PRIMARY:'#EF4444'}]} onPress={()=>!session?navigation.navigate('Auth'):logout()}><Feather name={!session?"log-in":"log-out"} size={18} color="#FFF" /><Text style={styles.logoutButtonText}>{!session?"Go to Login":"Logout"}</Text></TouchableOpacity></SafeAreaView>);

  // Data Extraction (Keep as before)
  const { companyName, logo, bio, email: contactEmail, phoneNumber, website, businessType /* Removed average_rating */ } = organizerProfile || {};
  const businessTypeFormatted = formatBusinessType(businessType);
  const logoUrl = logo ?? DEFAULT_ORGANIZER_LOGO;
  // Set displayRating based on stats if needed, or remove if not used
  const displayRating = "N/A"; // Placeholder or derive from another source
  const reviews="N/A"; const location="N/A"; const specialties: string[]=[]; const recentEvents: any[]=[]; // Placeholders

  // openLink function (Keep as before)
   const openLink = async (url: string | null | undefined, type: 'web' | 'email' | 'tel') => { if(!url)return; let fUrl=url; if(type==='email'&&!url.startsWith('mailto:'))fUrl=`mailto:${url}`; else if(type==='tel'&&!url.startsWith('tel:'))fUrl=`tel:${url.replace(/\s+/g,'')}`; else if(type==='web'&&!url.startsWith('http'))fUrl=`https://${url}`; try{const s=await Linking.canOpenURL(fUrl); if(s)await Linking.openURL(fUrl); else Alert.alert("Error",`Cannot open: ${url}`);}catch(e){Alert.alert("Error","Failed to open.");}};

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      {/* Add settings icon in header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View style={styles.titleContainer}>
            <Feather name="briefcase" size={22} color={APP_CONSTANTS.COLORS.PRIMARY} style={styles.headerIcon} />
            <Text style={styles.title}>Organizer Profile</Text>
          </View>
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={() => navigation.navigate('OrganizerSettingsScreen')}
          >
            <Feather name="settings" size={22} color={APP_CONSTANTS.COLORS.PRIMARY} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scrollViewContainer} contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[APP_CONSTANTS.COLORS.PRIMARY]} />}>
        <View style={styles.profileCard}>
            <LinearGradient colors={[APP_CONSTANTS.COLORS.PRIMARY_LIGHT, APP_CONSTANTS.COLORS.PRIMARY]} style={styles.coverPhoto} />
            <View style={styles.avatarContainer}><Image source={{ uri: logoUrl }} style={styles.avatar} /></View>
            <View style={styles.profileInfo}>
                <Text style={styles.name}>{companyName ?? "Organizer"}</Text>
                 {businessTypeFormatted && (<Text style={styles.businessType}>{businessTypeFormatted}</Text>)}
                <View style={styles.statsContainer}>
                     {/* Make Followers stat pressable */}
                     <TouchableOpacity style={styles.statItemTouchable} onPress={() => navigation.navigate('UserListScreen')} disabled={stats.followerCount === 0 && !statsLoading}>
                        {statsLoading?<ActivityIndicator size="small"/>:<Text style={styles.statValue}>{stats.followerCount??'N/A'}</Text>}
                        <Text style={styles.statLabel}>Followers</Text>
                    </TouchableOpacity>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>{statsLoading?<ActivityIndicator size="small"/>:<Text style={styles.statValue}>{stats.totalEvents??'N/A'}</Text>}<Text style={styles.statLabel}>Events</Text></View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                             <Feather name="star" size={14} color={APP_CONSTANTS.COLORS.DISABLED} style={{ marginRight: 4, marginTop: -2 }} />
                             <Text style={styles.statValue}>{displayRating}</Text>
                        </View>
                        <Text style={styles.statLabel}>Rating</Text>
                    </View>
                </View>
                <Text style={styles.bio}>{bio ?? "No description."}</Text>
                <TouchableOpacity style={styles.createEventButton} onPress={() => navigation.navigate('MainApp', { screen: 'OrganizerTabs', params: { screen: 'Create'} })} ><Feather name="plus" size={16} color="#FFF" /><Text style={styles.createEventButtonText}>Create New Event</Text></TouchableOpacity>
            </View>
        </View>
        {(contactEmail || phoneNumber || website) && (<Section title="Contact Information" icon="phone"><View style={styles.infoContainer}>{contactEmail && (<TouchableOpacity style={styles.infoRow} onPress={() => openLink(contactEmail, 'email')}><Feather name="mail" size={16} color="#6B7280" /><Text style={styles.infoTextLink}>{contactEmail}</Text></TouchableOpacity>)}{phoneNumber && (<TouchableOpacity style={styles.infoRow} onPress={() => openLink(phoneNumber, 'tel')}><Feather name="phone" size={16} color="#6B7280" /><Text style={styles.infoTextLink}>{phoneNumber}</Text></TouchableOpacity>)}{website && (<TouchableOpacity style={styles.infoRow} onPress={() => openLink(website, 'web')}><Feather name="globe" size={16} color="#6B7280" /><Text style={styles.infoTextLink}>{website}</Text></TouchableOpacity>)}</View></Section>)}
        <Section title="Event Specialties" icon="tag"><Text style={styles.dataMissingText}>Specialties not listed.</Text></Section>
        <Section title="My Events" icon="calendar">
             <TouchableOpacity style={styles.linkButton} onPress={() => { if(userId) navigation.navigate('UpcomingEventsListScreen', { organizerUserId: userId, organizerName: companyName }) }} disabled={!userId}>
                 <Feather name="fast-forward" size={16} color={APP_CONSTANTS.COLORS.PRIMARY} />
                 <Text style={styles.linkButtonText}>View Upcoming Events</Text>
                 <Feather name="chevron-right" size={16} color={APP_CONSTANTS.COLORS.DISABLED} />
             </TouchableOpacity>
             <TouchableOpacity style={styles.linkButton} onPress={() => { if(userId) navigation.navigate('PastEventsListScreen', { organizerUserId: userId, organizerName: companyName }) }} disabled={!userId}>
                 <Feather name="rewind" size={16} color={APP_CONSTANTS.COLORS.PRIMARY} />
                 <Text style={styles.linkButtonText}>View Past Events</Text>
                  <Feather name="chevron-right" size={16} color={APP_CONSTANTS.COLORS.DISABLED} />
             </TouchableOpacity>
        </Section>
        <Section title="Performance" icon="bar-chart-2">
          {statsLoading?<View style={styles.centered}><ActivityIndicator color={APP_CONSTANTS.COLORS.PRIMARY}/></View> : statsError?<Text style={[styles.errorText,{marginTop:0,marginBottom:10}]}>{statsError}</Text> : (<View style={styles.statsGrid}><View style={styles.statBox}><Feather name="calendar" size={24} color="#3B82F6" /><Text style={styles.statBoxValue}>{stats.upcomingEvents ?? 'N/A'}</Text><Text style={styles.statBoxLabel}>Upcoming</Text></View><View style={styles.statBox}><Feather name="check-circle" size={24} color="#10B981" /><Text style={styles.statBoxValue}>{stats.pastEvents ?? 'N/A'}</Text><Text style={styles.statBoxLabel}>Completed</Text></View><View style={styles.statBox}><Feather name="star" size={24} color="#F59E0B" /><Text style={styles.statBoxValue}>{displayRating}</Text><Text style={styles.statBoxLabel}>Avg Rating</Text></View></View>)}
        </Section>
        <TouchableOpacity style={styles.logoutButton} onPress={logout}><Feather name="log-out" size={18} color="#FFF" /><Text style={styles.logoutButtonText}>Logout</Text></TouchableOpacity>
         {/* Removed large mode switch button as it's in the header now */}
      </ScrollView>
    </SafeAreaView>
  );
};

// --- Styles --- (Add statItemTouchable if missing)
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc", },
  scrollViewContainer: { flex: 1, },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 80, paddingTop: 16, },
  header: { paddingTop: Platform.OS === 'android' ? 20 : 16, paddingBottom: 12, paddingHorizontal: 16, backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: '#E5E7EB', },
  headerTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", },
  titleContainer: { flexDirection: "row", alignItems: "center", },
  headerIcon: { marginRight: 8, },
  title: { fontSize: 22, fontWeight: "bold", color: APP_CONSTANTS.COLORS.PRIMARY, },
  settingsButton: { padding: 8, borderRadius: 20, backgroundColor: 'rgba(59, 130, 246, 0.1)' },
  modeButtonSmall: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(59, 130, 246, 0.1)", paddingVertical: 6, paddingHorizontal: 10, borderRadius: 20, },
  modeButtonTextSmall: { color: APP_CONSTANTS.COLORS.PRIMARY, fontSize: 12, fontWeight: "500", marginLeft: 4, },
  profileCard: { backgroundColor: "white", borderRadius: 16, marginBottom: 24, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2, },
  coverPhoto: { height: 120, width: "100%", },
  avatarContainer: { position: "absolute", top: 60, alignSelf: 'center', backgroundColor: "white", borderRadius: 55, padding: 5, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 4, },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 2, borderColor: 'white', backgroundColor: '#E5E7EB' },
  profileInfo: { paddingTop: 65, paddingBottom: 20, paddingHorizontal: 16, alignItems: "center", },
  name: { fontSize: 22, fontWeight: "bold", color: "#1F2937", marginBottom: 4, textAlign: 'center' },
   businessType: { fontSize: 14, color: "#6B7280", fontWeight: '500', marginBottom: 12, },
  location: { fontSize: 14, color: "#6B7280", marginBottom: 16, },
  statsContainer: { flexDirection: "row", justifyContent: "space-around", width: "90%", marginVertical: 16, paddingVertical: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#F3F4F6', alignItems: 'center' },
  statItem: { alignItems: "center", paddingHorizontal: 10, minWidth: 60 },
  statItemTouchable: { alignItems: "center", paddingHorizontal: 10, minWidth: 60, paddingVertical: 5, borderRadius: 8 },
  statValue: { fontSize: 18, fontWeight: "600", color: APP_CONSTANTS.COLORS.PRIMARY, minHeight: 21 },
  statLabel: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  statDivider: { width: 1, height: 35, backgroundColor: "#E5E7EB", },
  bio: { fontSize: 14, color: "#4B5563", textAlign: "center", lineHeight: 20, marginBottom: 20, },
  createEventButton: { flexDirection: "row", alignItems: "center", backgroundColor: APP_CONSTANTS.COLORS.PRIMARY, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 3, elevation: 2, },
  createEventButtonText: { color: "white", fontWeight: "600", marginLeft: 8, fontSize: 15 },
  section: { marginBottom: 20, backgroundColor: "white", borderRadius: 12, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1, },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  sectionTitleContainer: { flexDirection: "row", alignItems: "center", },
  sectionIcon: { marginRight: 10, },
  sectionTitle: { fontSize: 17, fontWeight: "600", color: "#1F2937", },
  infoContainer: { marginTop: 4, },
  infoRow: { flexDirection: "row", alignItems: "center", marginBottom: 14, },
  infoText: { marginLeft: 12, fontSize: 14, color: "#4B5563", },
  infoTextLink: { marginLeft: 12, fontSize: 14, color: APP_CONSTANTS.COLORS.PRIMARY, textDecorationLine: 'underline', },
  tagsContainer: { flexDirection: "row", flexWrap: "wrap", marginTop: 4, },
  specialtyTag: { backgroundColor: "rgba(59, 130, 246, 0.1)", paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, marginRight: 8, marginBottom: 8, },
  specialtyTagText: { color: APP_CONSTANTS.COLORS.PRIMARY, fontSize: 13, fontWeight: '500' },
  eventItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F3F4F6", },
  eventItemTitle: { fontSize: 15, fontWeight: "500", color: "#1F2937", marginBottom: 4, },
  eventItemDate: { fontSize: 13, color: "#6B7280", },
  attendeesContainer: { alignItems: "flex-end", },
  attendeesCount: { fontSize: 16, fontWeight: "600", color: APP_CONSTANTS.COLORS.PRIMARY, },
  attendeesLabel: { fontSize: 12, color: "#6B7280", },
  statsGrid: { flexDirection: "row", justifyContent: "space-between", marginTop: 4, },
  statBox: { flex: 1, alignItems: "center", paddingVertical: 16, paddingHorizontal: 8, marginHorizontal: 4, backgroundColor: "#F9FAFB", borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  statBoxValue: { fontSize: 20, fontWeight: "bold", color: "#1F2937", marginTop: 8, },
  statBoxLabel: { fontSize: 12, color: "#6B7280", marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  logoutButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#EF4444", paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, marginTop: 16, marginBottom: 8, },
  logoutButtonText: { color: "white", fontWeight: "600", fontSize: 16, marginLeft: 8, },
  // modeButton removed as it's not needed with useOrganizerMode hook in header
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#f8fafc', },
  loadingText: { marginTop: 10, fontSize: 16, color: '#6B7280', },
  errorText: { marginTop: 15, fontSize: 18, fontWeight: '600', color: '#DC2626', textAlign: 'center', },
  errorSubText: { marginTop: 8, fontSize: 14, color: '#4B5563', textAlign: 'center', },
   dataMissingText: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', paddingVertical: 16, fontStyle: 'italic', },
  linkButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  linkButtonText: { flex: 1, marginLeft: 12, fontSize: 15, fontWeight: '500', color: '#374151' },
});

export default OrganizerProfileScreen;