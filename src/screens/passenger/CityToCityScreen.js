// src/screens/passenger/CityToCityScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  SafeAreaView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

// Nigerian states (common for intercity travel)
const STATES = [
  'Lagos', 'Abuja', 'Port Harcourt', 'Kano', 'Enugu', 'Ibadan',
  'Benin City', 'Kaduna', 'Owerri', 'Jos', 'Calabar', 'Onitsha',
  'Aba', 'Ilorin', 'Warri', 'Uyo',
];

// Dummy transport companies & trips
const DUMMY_TRIPS = [
  {
    id: '1',
    company: 'GUO Transport',
    from: 'Lagos',
    to: 'Abuja',
    time: '7:00 AM',
    duration: '10h 30m',
    price: '₦18,500',
    seatsAvailable: 12,
    logo: '🚍',
  },
  {
    id: '2',
    company: 'GIG Mobility',
    from: 'Lagos',
    to: 'Abuja',
    time: '8:30 AM',
    duration: '10h',
    price: '₦19,200',
    seatsAvailable: 8,
    logo: '🚌',
  },
  {
    id: '3',
    company: 'ABC Transport',
    from: 'Lagos',
    to: 'Abuja',
    time: '10:00 AM',
    duration: '11h',
    price: '₦17,800',
    seatsAvailable: 15,
    logo: '🚐',
  },
  {
    id: '4',
    company: 'Peace Mass Transit',
    from: 'Lagos',
    to: 'Enugu',
    time: '6:45 AM',
    duration: '9h 15m',
    price: '₦14,200',
    seatsAvailable: 20,
    logo: '🚍',
  },
  {
    id: '5',
    company: 'Young Shall Grow',
    from: 'Lagos',
    to: 'Port Harcourt',
    time: '7:30 AM',
    duration: '12h',
    price: '₦16,500',
    seatsAvailable: 6,
    logo: '🚌',
  },
];

export default function CityToCityScreen() {
  const navigation = useNavigation();

  const [fromState, setFromState] = useState('Lagos');
  const [toState, setToState] = useState('Abuja');
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  // Filter trips based on selected route
  const filteredTrips = DUMMY_TRIPS.filter(
    trip => trip.from === fromState && trip.to === toState
  );

  const openDrawer = () => navigation.openDrawer();

  const reserveSeat = (trip) => {
    Alert.alert(
      'Seat Reserved! 🎉',
      `You have successfully reserved a seat with ${trip.company}\n\n` +
      `Route: ${trip.from} → ${trip.to}\n` +
      `Time: ${trip.time} | Duration: ${trip.duration}\n` +
      `Price: ${trip.price}\n\n` +
      `A confirmation will be sent to your phone.`,
      [{ text: 'OK' }]
    );
  };

  const renderTrip = ({ item }) => (
    <TouchableOpacity style={styles.tripCard} onPress={() => reserveSeat(item)}>
      <View style={styles.tripHeader}>
        <Text style={styles.companyLogo}>{item.logo}</Text>
        <View>
          <Text style={styles.companyName}>{item.company}</Text>
          <Text style={styles.seatsText}>{item.seatsAvailable} seats left</Text>
        </View>
        <Text style={styles.price}>{item.price}</Text>
      </View>

      <View style={styles.tripDetails}>
        <Text style={styles.time}>{item.time}</Text>
        <View style={styles.routeLine}>
          <Text style={styles.routeText}>{item.from}</Text>
          <View style={styles.dashedLine} />
          <Text style={styles.routeText}>{item.to}</Text>
        </View>
        <Text style={styles.duration}>{item.duration}</Text>
      </View>

      <View style={styles.reserveBtn}>
        <Text style={styles.reserveText}>Reserve Seat</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={openDrawer}>
          <Ionicons name="menu" size={28} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>City to City</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* Route Picker */}
      <View style={styles.pickerContainer}>
        <TouchableOpacity style={styles.picker} onPress={() => setShowFromPicker(true)}>
          <Text style={styles.pickerLabel}>From</Text>
          <Text style={styles.pickerValue}>{fromState}</Text>
          <Ionicons name="chevron-down" size={20} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.picker} onPress={() => setShowToPicker(true)}>
          <Text style={styles.pickerLabel}>To</Text>
          <Text style={styles.pickerValue}>{toState}</Text>
          <Ionicons name="chevron-down" size={20} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Trip List */}
      <FlatList
        data={filteredTrips}
        keyExtractor={(item) => item.id}
        renderItem={renderTrip}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="bus-outline" size={60} color="#CCC" />
            <Text style={styles.emptyText}>No trips available</Text>
            <Text style={styles.emptySub}>Try a different route</Text>
          </View>
        }
      />

      {/* State Picker Modal */}
      <Modal visible={showFromPicker || showToPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {showFromPicker ? 'Departure State' : 'Arrival State'}
              </Text>
              <TouchableOpacity onPress={() => {
                setShowFromPicker(false);
                setShowToPicker(false);
              }}>
                <Ionicons name="close" size={28} color="#000" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={STATES}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.stateItem}
                  onPress={() => {
                    if (showFromPicker) {
                      setFromState(item);
                      setShowFromPicker(false);
                    } else {
                      setToState(item);
                      setShowToPicker(false);
                    }
                  }}
                >
                  <Text style={styles.stateText}>{item}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#0A2540' },
  pickerContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#FFF',
    gap: 12,
  },
  picker: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerLabel: { fontSize: 14, color: '#64748B' },
  pickerValue: { fontSize: 18, fontWeight: '600', color: '#0A2540' },
  list: { padding: 16 },
  tripCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  tripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  companyLogo: { fontSize: 32 },
  companyName: { fontSize: 16, fontWeight: '700', color: '#0A2540' },
  seatsText: { fontSize: 13, color: '#10B981', fontWeight: '600' },
  price: { fontSize: 20, fontWeight: '800', color: '#00B0F3' },
  tripDetails: {
    marginVertical: 8,
  },
  time: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  routeLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  routeText: { fontSize: 15, color: '#64748B' },
  dashedLine: {
    height: 1,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    flex: 1,
    marginHorizontal: 12,
  },
  duration: { fontSize: 14, color: '#64748B' },
  reserveBtn: {
    backgroundColor: '#00B0F3',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  reserveText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#94A3B8', marginTop: 16 },
  emptySub: { fontSize: 14, color: '#94A3B8' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  stateItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  stateText: { fontSize: 16 },
});