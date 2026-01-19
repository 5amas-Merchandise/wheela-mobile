import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
  StatusBar,
  TextInput,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import * as Auth from '../../utils/auth';

// REPLACE WITH YOUR ACTUAL API URL
const API_URL = 'https://wheels-backend.vercel.app';

const NIGERIA_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa',
  'Benue', 'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo',
  'Ekiti', 'Enugu', 'FCT', 'Gombe', 'Imo', 'Jigawa',
  'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara',
  'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun',
  'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara'
];

export default function CityToCityScreen() {
  const navigation = useNavigation();
  
  // Search Parameters
  const [departureState, setDepartureState] = useState('');
  const [arrivalState, setArrivalState] = useState('');
  const [travelDate, setTravelDate] = useState(new Date().toISOString().split('T')[0]);
  
  // UI State
  const [showDepartureModal, setShowDepartureModal] = useState(false);
  const [showArrivalModal, setShowArrivalModal] = useState(false);
  const [searching, setSearching] = useState(false);
  const [trips, setTrips] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!departureState || !arrivalState) {
      Alert.alert('Missing Information', 'Please select both departure and arrival states.');
      return;
    }

    if (departureState === arrivalState) {
      Alert.alert('Invalid Route', 'Departure and arrival states cannot be the same.');
      return;
    }

    try {
      setSearching(true);
      setHasSearched(true);

      const response = await axios.get(`${API_URL}/intercity/search`, {
        params: {
          departureState,
          arrivalState,
          date: travelDate
        }
      });

      console.log('✅ Search results:', response.data);

      if (response.data.success) {
        setTrips(response.data.trips || []);
        if (response.data.trips.length === 0) {
          Alert.alert('No Trips Found', 'No available trips for the selected route and date.');
        }
      }
    } catch (error) {
      console.error('❌ Search error:', error);
      Alert.alert('Search Failed', 'Unable to search for trips. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  const handleBookTrip = (trip) => {
    navigation.navigate('IntercityBookingForm', { trip });
  };

  const swapLocations = () => {
    const temp = departureState;
    setDepartureState(arrivalState);
    setArrivalState(temp);
  };

  const formatTime = (time) => {
    if (!time) return 'N/A';
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayHour = h % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getDuration = (duration) => {
    if (!duration) return 'N/A';
    const hours = Math.floor(duration / 60);
    const minutes = duration % 60;
    return `${hours}h ${minutes}m`;
  };

  const renderTripCard = ({ item }) => (
    <View style={styles.tripCard}>
      {/* Company Header */}
      <View style={styles.tripHeader}>
        <View style={styles.companyLogo}>
          <MaterialIcons name="directions-bus" size={24} color="#00B0F3" />
        </View>
        <View style={styles.companyInfo}>
          <Text style={styles.companyName}>{item.company.name}</Text>
          {item.company.rating > 0 && (
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={14} color="#F59E0B" />
              <Text style={styles.ratingText}>
                {item.company.rating.toFixed(1)} ({item.company.totalReviews})
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Route Information */}
      <View style={styles.routeContainer}>
        <View style={styles.routeColumn}>
          <Text style={styles.timeText}>{formatTime(item.departure.time)}</Text>
          <Text style={styles.locationText} numberOfLines={1}>
            {item.route.from.split(',')[0]}
          </Text>
        </View>

        <View style={styles.routeCenter}>
          <View style={styles.routeLine}>
            <View style={styles.routeDot} />
            <View style={styles.routeDash} />
            <View style={styles.routeDot} />
          </View>
          <Text style={styles.durationText}>{getDuration(item.route.duration)}</Text>
        </View>

        <View style={[styles.routeColumn, { alignItems: 'flex-end' }]}>
          <Text style={styles.timeText}>{formatTime(item.arrival.time)}</Text>
          <Text style={styles.locationText} numberOfLines={1}>
            {item.route.to.split(',')[0]}
          </Text>
        </View>
      </View>

      {/* Trip Details */}
      <View style={styles.tripDetails}>
        <View style={styles.detailItem}>
          <Ionicons name="car-outline" size={16} color="#64748B" />
          <Text style={styles.detailText}>
            {item.vehicle.type.replace('_', ' ').toUpperCase()}
          </Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name="people-outline" size={16} color="#64748B" />
          <Text style={styles.detailText}>
            {item.availability.availableSeats} seats left
          </Text>
        </View>
      </View>

      {/* Amenities */}
      {item.vehicle.amenities?.length > 0 && (
        <View style={styles.amenitiesRow}>
          {item.vehicle.amenities.slice(0, 4).map((amenity, index) => (
            <View key={index} style={styles.amenityTag}>
              <Text style={styles.amenityText}>{amenity}</Text>
            </View>
          ))}
          {item.vehicle.amenities.length > 4 && (
            <Text style={styles.moreAmenities}>+{item.vehicle.amenities.length - 4}</Text>
          )}
        </View>
      )}

      {/* Price & Book Button */}
      <View style={styles.tripFooter}>
        <View>
          <Text style={styles.priceLabel}>From</Text>
          <Text style={styles.priceText}>₦{parseFloat(item.pricing.priceInNaira).toLocaleString()}</Text>
          <Text style={styles.perSeatText}>per seat</Text>
        </View>
        <TouchableOpacity
          style={styles.bookButton}
          onPress={() => handleBookTrip(item)}
        >
          <Text style={styles.bookButtonText}>Book Now</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#0A2540" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Intercity Travel</Text>
        
        <TouchableOpacity 
          style={styles.bookingsBtn}
          onPress={() => navigation.navigate('IntercityBookings')}
        >
          <Ionicons name="receipt-outline" size={22} color="#00B0F3" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Search Card */}
        <View style={styles.searchCard}>
          <Text style={styles.searchTitle}>Where are you going?</Text>

          {/* From Location */}
          <TouchableOpacity
            style={styles.inputContainer}
            onPress={() => setShowDepartureModal(true)}
          >
            <Ionicons name="location" size={20} color="#00B0F3" />
            <Text style={[styles.inputText, !departureState && styles.placeholder]}>
              {departureState || 'From (State)'}
            </Text>
          </TouchableOpacity>

          {/* Swap Button */}
          <TouchableOpacity style={styles.swapButton} onPress={swapLocations}>
            <Ionicons name="swap-vertical" size={20} color="#00B0F3" />
          </TouchableOpacity>

          {/* To Location */}
          <TouchableOpacity
            style={styles.inputContainer}
            onPress={() => setShowArrivalModal(true)}
          >
            <Ionicons name="location-outline" size={20} color="#EF4444" />
            <Text style={[styles.inputText, !arrivalState && styles.placeholder]}>
              {arrivalState || 'To (State)'}
            </Text>
          </TouchableOpacity>

          {/* Date Picker */}
          <View style={styles.inputContainer}>
            <Ionicons name="calendar-outline" size={20} color="#64748B" />
            <TextInput
              style={styles.inputText}
              value={travelDate}
              onChangeText={setTravelDate}
              placeholder="Travel Date (YYYY-MM-DD)"
              placeholderTextColor="#94A3B8"
            />
          </View>

          {/* Search Button */}
          <TouchableOpacity
            style={styles.searchButton}
            onPress={handleSearch}
            disabled={searching}
          >
            {searching ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="search" size={20} color="#FFFFFF" />
                <Text style={styles.searchButtonText}>Search Trips</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Results */}
        {hasSearched && (
          <View style={styles.resultsContainer}>
            <Text style={styles.resultsTitle}>
              {trips.length} {trips.length === 1 ? 'Trip' : 'Trips'} Found
            </Text>
            
            {trips.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="search-outline" size={64} color="#CBD5E1" />
                <Text style={styles.emptyTitle}>No Trips Available</Text>
                <Text style={styles.emptySubtitle}>
                  Try searching for a different date or route
                </Text>
              </View>
            ) : (
              <FlatList
                data={trips}
                keyExtractor={(item, index) => `${item.scheduleId}-${index}`}
                renderItem={renderTripCard}
                scrollEnabled={false}
                contentContainerStyle={styles.tripsList}
              />
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* State Selection Modals */}
      <Modal
        visible={showDepartureModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDepartureModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Departure State</Text>
              <TouchableOpacity onPress={() => setShowDepartureModal(false)}>
                <Ionicons name="close" size={24} color="#0A2540" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {NIGERIA_STATES.map((state) => (
                <TouchableOpacity
                  key={state}
                  style={styles.stateItem}
                  onPress={() => {
                    setDepartureState(state);
                    setShowDepartureModal(false);
                  }}
                >
                  <Text style={styles.stateText}>{state}</Text>
                  {departureState === state && (
                    <Ionicons name="checkmark-circle" size={24} color="#00B0F3" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showArrivalModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowArrivalModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Arrival State</Text>
              <TouchableOpacity onPress={() => setShowArrivalModal(false)}>
                <Ionicons name="close" size={24} color="#0A2540" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {NIGERIA_STATES.map((state) => (
                <TouchableOpacity
                  key={state}
                  style={styles.stateItem}
                  onPress={() => {
                    setArrivalState(state);
                    setShowArrivalModal(false);
                  }}
                >
                  <Text style={styles.stateText}>{state}</Text>
                  {arrivalState === state && (
                    <Ionicons name="checkmark-circle" size={24} color="#00B0F3" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0A2540',
  },
  bookingsBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Search Card
  searchCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 20,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  searchTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0A2540',
    marginBottom: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  inputText: {
    flex: 1,
    fontSize: 16,
    color: '#0A2540',
    marginLeft: 12,
  },
  placeholder: {
    color: '#94A3B8',
  },
  swapButton: {
    alignSelf: 'center',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: -6,
    zIndex: 10,
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00B0F3',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
  },
  searchButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Results
  resultsContainer: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0A2540',
    marginBottom: 16,
  },
  tripsList: {
    gap: 16,
  },

  // Trip Card
  tripCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  tripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  companyLogo: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  companyInfo: {
    flex: 1,
  },
  companyName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0A2540',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  ratingText: {
    fontSize: 12,
    color: '#64748B',
  },
  routeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
  },
  routeColumn: {
    flex: 1,
  },
  timeText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0A2540',
    marginBottom: 4,
  },
  locationText: {
    fontSize: 13,
    color: '#64748B',
  },
  routeCenter: {
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  routeLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  routeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00B0F3',
  },
  routeDash: {
    width: 40,
    height: 2,
    backgroundColor: '#CBD5E1',
    marginHorizontal: 4,
  },
  durationText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  tripDetails: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 12,
    color: '#64748B',
  },
  amenitiesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  amenityTag: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  amenityText: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '500',
  },
  moreAmenities: {
    fontSize: 11,
    color: '#64748B',
    alignSelf: 'center',
  },
  tripFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  priceText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0A2540',
  },
  perSeatText: {
    fontSize: 12,
    color: '#64748B',
  },
  bookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00B0F3',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  bookButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#475569',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0A2540',
  },
  stateItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  stateText: {
    fontSize: 16,
    color: '#0A2540',
  },
});