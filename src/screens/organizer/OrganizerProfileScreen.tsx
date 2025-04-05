import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Dimensions,
  ActivityIndicator, // Import ActivityIndicator
  Linking, // Import Linking to open websites/emails
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useOrganizerMode } from "@/hooks/useOrganizerMode";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/hooks/useAuth"; // Import useAuth
import { APP_CONSTANTS } from "@/config/constants"; // For colors/defaults
import { useNavigation } from "@react-navigation/native"; // For navigation

// Default Logo Placeholder
const DEFAULT_ORGANIZER_LOGO = 'https://via.placeholder.com/150/BFDBFE/1E40AF?text=Logo'; // Adjusted placeholder

// Remove hardcoded data
// const ORGANIZER_DATA = { ... };

// Section Component (Keep as before)
interface SectionProps { title: string; icon: React.ComponentProps<typeof Feather>['name']; children: React.ReactNode; }
const Section: React.FC<SectionProps> = ({ title, icon, children }) => {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleContainer}>
          <Feather name={icon} size={18} color={APP_CONSTANTS.COLORS.PRIMARY} style={styles.sectionIcon} />
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
      </View>
      {children}
    </View>
  );
};

// Function to format business_type
const formatBusinessType = (type?: string | null): string | null => {
  if (!type) return null;
  // Replace underscores/hyphens with spaces and capitalize words
  return type
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};


const OrganizerProfileScreen: React.FC = () => {
  const { session, loading: authLoading, logout } = useAuth(); // Get session and loading state
  const { toggleOrganizerMode } = useOrganizerMode();
  const navigation = useNavigation(); // For create event button

  // Extract organizer profile data
  const organizerProfile = session?.organizerProfile;

  // --- Loading State ---
  if (authLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={APP_CONSTANTS.COLORS.PRIMARY} />
        <Text style={styles.loadingText}>Loading Organizer Profile...</Text>
      </SafeAreaView>
    );
  }

  // --- Not Logged In or Profile Missing State ---
  if (!session || !organizerProfile) {
    return (
      <SafeAreaView style={styles.centered}>
        <Feather name="alert-circle" size={40} color="#FFA500" />
        <Text style={styles.errorText}>Could not load Organizer Profile.</Text>
        <Text style={styles.errorSubText}>
            { !session ? "You are not logged in." : "Your organizer profile might be incomplete."}
        </Text>
         <TouchableOpacity
            style={[styles.logoutButton, {marginTop: 20, backgroundColor: !session ? APP_CONSTANTS.COLORS.PRIMARY : '#EF4444'}]}
            onPress={() => !session ? navigation.navigate('AuthFlow' as never) : logout()}
        >
             <Feather name={!session ? "log-in" : "log-out"} size={18} color="#FFF" />
            <Text style={styles.logoutButtonText}>{!session ? "Go to Login" : "Logout"}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // --- Data Extraction and Formatting ---
  const companyName = organizerProfile.companyName ?? "Organizer";
  const logoUrl = organizerProfile.logo ?? DEFAULT_ORGANIZER_LOGO;
  const bio = organizerProfile.bio ?? "No description provided.";
  const contactEmail = organizerProfile.email; // Email should generally exist
  const phoneNumber = organizerProfile.phoneNumber;
  const website = organizerProfile.website;
  const businessTypeFormatted = formatBusinessType(organizerProfile.businessType);

  // --- Placeholders for data not yet in the profile ---
  const followers = 0; // Replace with actual data when available
  const eventsTotal = 0; // Replace with actual data when available
  const rating = 0.0; // Replace with actual data when available
  const reviews = 0; // Replace with actual data when available
  const location = "Location not set"; // Replace with actual data when available
  const upcomingEvents = 0; // Replace with actual data when available
  const pastEvents = 0; // Replace with actual data when available
  const specialties: string[] = []; // Replace with actual data when available
  const recentEvents: any[] = []; // Replace with actual data when available


  // Function to safely open URLs/mailto links
  const openLink = async (url: string | null | undefined, type: 'web' | 'email' | 'tel') => {
    if (!url) return;
    let formattedUrl = url;
    if (type === 'email' && !url.startsWith('mailto:')) {
      formattedUrl = `mailto:${url}`;
    } else if (type === 'tel' && !url.startsWith('tel:')) {
      formattedUrl = `tel:${url.replace(/\s+/g, '')}`; // Remove spaces for tel link
    } else if (type === 'web' && !url.startsWith('http://') && !url.startsWith('https://')) {
      formattedUrl = `https://${url}`; // Assume https
    }

    const supported = await Linking.canOpenURL(formattedUrl);
    if (supported) {
      await Linking.openURL(formattedUrl);
    } else {
      Alert.alert("Cannot Open Link", `Could not open the ${type} link: ${url}`);
    }
  };


  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
            <View style={styles.titleContainer}><Feather name="briefcase" size={22} color={APP_CONSTANTS.COLORS.PRIMARY} style={styles.headerIcon} /><Text style={styles.title}>Organizer Profile</Text></View>
            <TouchableOpacity style={styles.modeButtonSmall} onPress={toggleOrganizerMode}><Feather name="repeat" size={16} color={APP_CONSTANTS.COLORS.PRIMARY} /><Text style={styles.modeButtonTextSmall}>Switch to User</Text></TouchableOpacity>
        </View>
      </View>

      {/* Profile Content */}
      <ScrollView style={styles.scrollViewContainer} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={true} >
        <View style={styles.profileCard}>
            <LinearGradient colors={[APP_CONSTANTS.COLORS.PRIMARY_LIGHT, APP_CONSTANTS.COLORS.PRIMARY]} style={styles.coverPhoto} />
            <View style={styles.avatarContainer}><Image source={{ uri: logoUrl }} style={styles.avatar} /></View>
            <View style={styles.profileInfo}>
                <Text style={styles.name}>{companyName}</Text>
                 {businessTypeFormatted && (
                    <Text style={styles.businessType}>{businessTypeFormatted}</Text>
                 )}
                {/* Add Location display if available in profile */}
                {/* <Text style={styles.location}><Feather name="map-pin" size={14} color="#6B7280" /> {location}</Text> */}

                {/* Placeholder Stats */}
                <View style={styles.statsContainer}>
                    <View style={styles.statItem}><Text style={styles.statValue}>{followers}</Text><Text style={styles.statLabel}>Followers</Text></View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}><Text style={styles.statValue}>{eventsTotal}</Text><Text style={styles.statLabel}>Events</Text></View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}><Text style={styles.statValue}>{rating.toFixed(1)}</Text><Text style={styles.statLabel}>Rating</Text></View>
                </View>

                <Text style={styles.bio}>{bio}</Text>

                <TouchableOpacity
                    style={styles.createEventButton}
                    onPress={() => navigation.navigate('CreateEventScreen' as never)} // Navigate to Create Event screen
                >
                    <Feather name="plus" size={16} color="#FFF" />
                    <Text style={styles.createEventButtonText}>Create New Event</Text>
                </TouchableOpacity>
            </View>
        </View>

        {/* Contact Information Section */}
        {(contactEmail || phoneNumber || website) && ( // Only show section if there's contact info
             <Section title="Contact Information" icon="phone">
                 <View style={styles.infoContainer}>
                     {contactEmail && (
                         <TouchableOpacity style={styles.infoRow} onPress={() => openLink(contactEmail, 'email')}>
                             <Feather name="mail" size={16} color="#6B7280" />
                             <Text style={styles.infoTextLink}>{contactEmail}</Text>
                         </TouchableOpacity>
                     )}
                     {phoneNumber && (
                         <TouchableOpacity style={styles.infoRow} onPress={() => openLink(phoneNumber, 'tel')}>
                             <Feather name="phone" size={16} color="#6B7280" />
                             <Text style={styles.infoTextLink}>{phoneNumber}</Text>
                         </TouchableOpacity>
                     )}
                     {website && (
                         <TouchableOpacity style={styles.infoRow} onPress={() => openLink(website, 'web')}>
                             <Feather name="globe" size={16} color="#6B7280" />
                             <Text style={styles.infoTextLink}>{website}</Text>
                         </TouchableOpacity>
                     )}
                 </View>
             </Section>
        )}

        {/* Specialties Section (Placeholder) */}
        <Section title="Event Specialties" icon="tag">
          {specialties.length > 0 ? (
             <View style={styles.tagsContainer}>
                {specialties.map((specialty, index) => (
                  <View key={index} style={styles.specialtyTag}><Text style={styles.specialtyTagText}>{specialty}</Text></View>
                ))}
              </View>
            ) : (
              <Text style={styles.dataMissingText}>Specialties not listed.</Text>
            )}
        </Section>

        {/* Recent Events Section (Placeholder) */}
        <Section title="Recent Events" icon="calendar">
          {recentEvents.length > 0 ? (
            recentEvents.map((event, index) => (
              <View key={index} style={styles.eventItem}>
                <View><Text style={styles.eventItemTitle}>{event.title}</Text><Text style={styles.eventItemDate}>{event.date}</Text></View>
                <View style={styles.attendeesContainer}><Text style={styles.attendeesCount}>{event.attendees}</Text><Text style={styles.attendeesLabel}>Attendees</Text></View>
              </View>
            ))
           ) : (
             <Text style={styles.dataMissingText}>No recent events to show.</Text>
           )}
        </Section>

        {/* Stats Summary Section (Placeholder) */}
        <Section title="Performance" icon="bar-chart-2">
          <View style={styles.statsGrid}>
            <View style={styles.statBox}><Feather name="calendar" size={24} color="#3B82F6" /><Text style={styles.statBoxValue}>{upcomingEvents}</Text><Text style={styles.statBoxLabel}>Upcoming</Text></View>
            <View style={styles.statBox}><Feather name="check-circle" size={24} color="#10B981" /><Text style={styles.statBoxValue}>{pastEvents}</Text><Text style={styles.statBoxLabel}>Completed</Text></View>
            <View style={styles.statBox}><Feather name="users" size={24} color="#F59E0B" /><Text style={styles.statBoxValue}>{reviews}</Text><Text style={styles.statBoxLabel}>Reviews</Text></View>
          </View>
        </Section>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
            <Feather name="log-out" size={18} color="#FFF" /><Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>

        {/* Switch to User Mode Button */}
        <TouchableOpacity style={styles.modeButton} onPress={toggleOrganizerMode}>
            <Feather name="refresh-cw" size={18} color="#FFF" /><Text style={styles.modeButtonText}>Switch to User Mode</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const { width } = Dimensions.get("window");

// --- Styles ---
// Includes minor additions/changes for businessType, infoTextLink, dataMissingText
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc", },
  scrollViewContainer: { flex: 1, },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 80, paddingTop: 16, }, // Added paddingTop
  header: { paddingTop: Platform.OS === 'android' ? 20 : 16, paddingBottom: 12, paddingHorizontal: 16, backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: '#E5E7EB', }, // Changed bg, added border
  headerTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", }, // Removed marginBottom
  titleContainer: { flexDirection: "row", alignItems: "center", },
  headerIcon: { marginRight: 8, },
  title: { fontSize: 22, fontWeight: "bold", color: APP_CONSTANTS.COLORS.PRIMARY, }, // Use constant
  modeButtonSmall: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(59, 130, 246, 0.1)", paddingVertical: 6, paddingHorizontal: 10, borderRadius: 20, },
  modeButtonTextSmall: { color: APP_CONSTANTS.COLORS.PRIMARY, fontSize: 12, fontWeight: "500", marginLeft: 4, },
  profileCard: { backgroundColor: "white", borderRadius: 16, marginBottom: 24, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2, },
  coverPhoto: { height: 120, width: "100%", }, // Increased height
  avatarContainer: { position: "absolute", top: 60, // Adjusted position
    alignSelf: 'center', backgroundColor: "white", borderRadius: 55, padding: 5, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 4, }, // Added shadow
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 2, borderColor: 'white', }, // Added border
  profileInfo: { paddingTop: 65, paddingBottom: 20, paddingHorizontal: 16, alignItems: "center", },
  name: { fontSize: 22, fontWeight: "bold", color: "#1F2937", marginBottom: 4, textAlign: 'center' }, // Increased size, added center align
   businessType: { // New style for business type
     fontSize: 14,
     color: "#6B7280",
     fontWeight: '500',
     marginBottom: 12,
   },
  location: { fontSize: 14, color: "#6B7280", marginBottom: 16, },
  statsContainer: { flexDirection: "row", justifyContent: "space-around", width: "90%", marginVertical: 16, paddingVertical: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#F3F4F6', alignItems: 'center' }, // Wider, added borders, align items
  statItem: { alignItems: "center", paddingHorizontal: 10 }, // Added padding
  statValue: { fontSize: 18, fontWeight: "600", color: APP_CONSTANTS.COLORS.PRIMARY, }, // Larger value
  statLabel: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  statDivider: { width: 1, height: 35, backgroundColor: "#E5E7EB", }, // Increased height
  bio: { fontSize: 14, color: "#4B5563", textAlign: "center", lineHeight: 20, marginBottom: 20, },
  createEventButton: { flexDirection: "row", alignItems: "center", backgroundColor: APP_CONSTANTS.COLORS.PRIMARY, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 3, elevation: 2, }, // Added padding, shadow
  createEventButtonText: { color: "white", fontWeight: "600", marginLeft: 8, fontSize: 15 }, // Increased size
  section: { marginBottom: 20, backgroundColor: "white", borderRadius: 12, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1, },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }, // Added bottom border
  sectionTitleContainer: { flexDirection: "row", alignItems: "center", },
  sectionIcon: { marginRight: 10, }, // Increased spacing
  sectionTitle: { fontSize: 17, fontWeight: "600", color: "#1F2937", }, // Increased size
  infoContainer: { marginTop: 4, },
  infoRow: { flexDirection: "row", alignItems: "center", marginBottom: 14, }, // Increased spacing
  infoText: { marginLeft: 12, fontSize: 14, color: "#4B5563", },
  infoTextLink: { // Style for clickable links
    marginLeft: 12,
    fontSize: 14,
    color: APP_CONSTANTS.COLORS.PRIMARY, // Make links blue
    textDecorationLine: 'underline', // Underline links
   },
  tagsContainer: { flexDirection: "row", flexWrap: "wrap", marginTop: 4, },
  specialtyTag: { backgroundColor: "rgba(59, 130, 246, 0.1)", paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, marginRight: 8, marginBottom: 8, }, // Added margin right/bottom
  specialtyTagText: { color: APP_CONSTANTS.COLORS.PRIMARY, fontSize: 13, fontWeight: '500' }, // Smaller font size
  eventItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F3F4F6", }, // Increased padding
  eventItemTitle: { fontSize: 15, fontWeight: "500", color: "#1F2937", marginBottom: 4, },
  eventItemDate: { fontSize: 13, color: "#6B7280", },
  attendeesContainer: { alignItems: "flex-end", }, // Align right
  attendeesCount: { fontSize: 16, fontWeight: "600", color: APP_CONSTANTS.COLORS.PRIMARY, },
  attendeesLabel: { fontSize: 12, color: "#6B7280", },
  statsGrid: { flexDirection: "row", justifyContent: "space-between", marginTop: 4, },
  statBox: { flex: 1, alignItems: "center", paddingVertical: 16, paddingHorizontal: 8, marginHorizontal: 4, backgroundColor: "#F9FAFB", borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' }, // Added padding, border
  statBoxValue: { fontSize: 20, fontWeight: "bold", color: "#1F2937", marginTop: 8, }, // Larger, bolder value
  statBoxLabel: { fontSize: 12, color: "#6B7280", marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 }, // Uppercase label
  logoutButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#EF4444", paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, marginTop: 16, marginBottom: 8, }, // Adjusted margins
  logoutButtonText: { color: "white", fontWeight: "600", fontSize: 16, marginLeft: 8, },
  modeButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: APP_CONSTANTS.COLORS.SECONDARY, // Use secondary color
    paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, marginTop: 8, marginBottom: 16, },
  modeButtonText: { color: "white", fontWeight: "600", fontSize: 16, marginLeft: 8, },
  // Centered styles for loading/error
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#f8fafc', },
  loadingText: { marginTop: 10, fontSize: 16, color: '#6B7280', },
  errorText: { marginTop: 15, fontSize: 18, fontWeight: '600', color: '#DC2626', textAlign: 'center', },
  errorSubText: { marginTop: 8, fontSize: 14, color: '#4B5563', textAlign: 'center', },
  dataMissingText: { // Added style for placeholders in sections
    fontSize: 14,
    color: '#9CA3AF', // Lighter grey
    textAlign: 'center',
    paddingVertical: 16,
    fontStyle: 'italic',
   },
});

export default OrganizerProfileScreen;