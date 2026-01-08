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
  TextInput,
  ScrollView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

const STATES = [
  'Lagos', 'Abuja', 'Port Harcourt', 'Kano', 'Enugu', 'Ibadan',
  'Benin City', 'Kaduna', 'Owerri', 'Jos', 'Calabar', 'Onitsha',
  'Aba', 'Ilorin', 'Warri', 'Uyo',
];

const DUMMY_TRIPS = [
  { id: '1', company: 'GUO Transport', from: 'Lagos', to: 'Abuja', time: '7:00 AM', duration: '10h 30m', price: 18500, seatsAvailable: 12, logo: '🚍' },
  { id: '2', company: 'GIG Mobility', from: 'Lagos', to: 'Abuja', time: '8:30 AM', duration: '10h', price: 19200, seatsAvailable: 8, logo: '🚌' },
  { id: '3', company: 'ABC Transport', from: 'Lagos', to: 'Abuja', time: '10:00 AM', duration: '11h', price: 17800, seatsAvailable: 15, logo: '🚐' },
  { id: '4', company: 'Peace Mass Transit', from: 'Lagos', to: 'Enugu', time: '6:45 AM', duration: '9h 15m', price: 14200, seatsAvailable: 20, logo: '🚍' },
  { id: '5', company: 'Young Shall Grow', from: 'Lagos', to: 'Port Harcourt', time: '7:30 AM', duration: '12h', price: 16500, seatsAvailable: 6, logo: '🚌' },
  { id: '6', company: 'GUO Transport', from: 'Abuja', to: 'Lagos', time: '9:00 AM', duration: '10h 30m', price: 18500, seatsAvailable: 10, logo: '🚍' },
  { id: '7', company: 'GIG Mobility', from: 'Enugu', to: 'Lagos', time: '8:00 AM', duration: '9h', price: 15000, seatsAvailable: 14, logo: '🚌' },
];

export default function CityToCityScreen() {
  const navigation = useNavigation();

  // Route selection
  const [fromState, setFromState] = useState('Lagos');
  const [toState, setToState] = useState('Abuja');
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  // Selected trip & booking modal
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [showBookingModal, setShowBookingModal] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [numSeats, setNumSeats] = useState('1');

  // Ticket modal
  const [showTicket, setShowTicket] = useState(false);
  const [bookingDetails, setBookingDetails] = useState(null);

  const filteredTrips = DUMMY_TRIPS.filter(
    trip => trip.from === fromState && trip.to === toState
  );

  const openDrawer = () => navigation.openDrawer();

  const handleBookTrip = (trip) => {
    if (trip.seatsAvailable === 0) {
      Alert.alert('No Seats', 'This trip is fully booked.');
      return;
    }
    setSelectedTrip(trip);
    setShowBookingModal(true);
  };

  const handleSubmitBooking = () => {
    if (!name || !email || !phone || !numSeats) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }
    const seats = parseInt(numSeats);
    if (seats > selectedTrip.seatsAvailable) {
      Alert.alert('Error', `Only ${selectedTrip.seatsAvailable} seats available`);
      return;
    }

    const totalPrice = selectedTrip.price * seats;
    const details = {
      ...selectedTrip,
      passengerName: name,
      passengerEmail: email,
      passengerPhone: phone,
      seatsBooked: seats,
      totalPrice,
      bookingId: 'TKT' + Math.floor(Math.random() * 1000000),
      date: new Date().toLocaleDateString('en-GB'),
    };

    setBookingDetails(details);
    setShowBookingModal(false);
    setShowTicket(true);

    // Reset form
    setName(''); setEmail(''); setPhone(''); setNumSeats('1');
  };

  const renderTrip = ({ item }) => (
    <TouchableOpacity style={styles.tripCard} onPress={() => handleBookTrip(item)}>
      <View style={styles.tripHeader}>
        <Text style={styles.companyLogo}>{item.logo}</Text>
        <View>
          <Text style={styles.companyName}>{item.company}</Text>
          <Text style={styles.seatsText}>{item.seatsAvailable} seats left</Text>
        </View>
        <Text style={styles.price}>₦{item.price.toLocaleString()}</Text>
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
      <View style={[styles.reserveBtn, item.seatsAvailable === 0 && { backgroundColor: '#94A3B8' }]}>
        <Text style={styles.reserveText}>
          {item.seatsAvailable === 0 ? 'Fully Booked' : 'Book Now'}
        </Text>
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
                {showFromPicker ? 'Departure City' : 'Arrival City'}
              </Text>
              <TouchableOpacity onPress={() => { setShowFromPicker(false); setShowToPicker(false); }}>
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

      {/* Booking Form Modal */}
      <Modal visible={showBookingModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.bookingModal}>
            <ScrollView contentContainerStyle={{ padding: 20 }}>
              <Text style={styles.modalTitle}>Complete Your Booking</Text>
              {selectedTrip && (
                <View style={styles.selectedTripSummary}>
                  <Text style={styles.companyName}>{selectedTrip.company} {selectedTrip.logo}</Text>
                  <Text>{selectedTrip.from} → {selectedTrip.to}</Text>
                  <Text>{selectedTrip.time} • {selectedTrip.duration}</Text>
                  <Text style={styles.price}>₦{selectedTrip.price.toLocaleString()} per seat</Text>
                </View>
              )}

              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="John Doe" />

              <Text style={styles.inputLabel}>Email</Text>
              <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="john@example.com" keyboardType="email-address" />

              <Text style={styles.inputLabel}>Phone Number</Text>
              <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="08012345678" keyboardType="phone-pad" />

              <Text style={styles.inputLabel}>Number of Seats (max {selectedTrip?.seatsAvailable})</Text>
              <TextInput
                style={styles.input}
                value={numSeats}
                onChangeText={setNumSeats}
                keyboardType="number-pad"
                placeholder="1"
              />

              <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowBookingModal(false)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.submitBtn} onPress={handleSubmitBooking}>
                  <Text style={styles.submitText}>Confirm Booking</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Ticket Modal */}
      <Modal visible={showTicket} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.ticketContainer}>
            <View style={styles.ticketHeader}>
              <Text style={styles.ticketTitle}>Your Ticket 🎉</Text>
              <TouchableOpacity onPress={() => setShowTicket(false)}>
                <Ionicons name="close" size={28} color="#000" />
              </TouchableOpacity>
            </View>

            <View style={styles.ticketBody}>
              <Text style={styles.bookingId}>{bookingDetails?.bookingId}</Text>
              <Text style={styles.date}>Date: {bookingDetails?.date}</Text>

              <View style={styles.ticketInfo}>
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Passenger</Text>
                  <Text style={styles.value}>{bookingDetails?.passengerName}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Route</Text>
                  <Text style={styles.value}>{bookingDetails?.from} → {bookingDetails?.to}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Departure</Text>
                  <Text style={styles.value}>{bookingDetails?.time}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Company</Text>
                  <Text style={styles.value}>{bookingDetails?.company} {bookingDetails?.logo}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Seats Booked</Text>
                  <Text style={styles.value}>{bookingDetails?.seatsBooked}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Total Amount</Text>
                  <Text style={styles.totalPrice}>₦{bookingDetails?.totalPrice?.toLocaleString()}</Text>
                </View>
              </View>

              <View style={styles.qrPlaceholder}>
                <Text style={{ fontSize: 40 }}>🎫</Text>
                <Text style={{ color: '#666', marginTop: 10 }}>Show this at boarding</Text>
              </View>

              <Text style={styles.screenshotHint}>📸 Screenshot or share this ticket</Text>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#0A2540' },
  pickerContainer: { flexDirection: 'row', padding: 16, backgroundColor: '#FFF', gap: 12 },
  picker: { flex: 1, backgroundColor: '#F1F5F9', padding: 16, borderRadius: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pickerLabel: { fontSize: 14, color: '#64748B' },
  pickerValue: { fontSize: 18, fontWeight: '600', color: '#0A2540' },
  list: { padding: 16 },
  tripCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, elevation: 4 },
  tripHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  companyLogo: { fontSize: 32 },
  companyName: { fontSize: 16, fontWeight: '700', color: '#0A2540' },
  seatsText: { fontSize: 13, color: '#10B981', fontWeight: '600' },
  price: { fontSize: 20, fontWeight: '800', color: '#00B0F3' },
  tripDetails: { marginVertical: 8 },
  time: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  routeLine: { flexDirection: 'row', alignItems: 'center', marginVertical: 8 },
  routeText: { fontSize: 15, color: '#64748B' },
  dashedLine: { height: 1, borderWidth: 1, borderColor: '#E2E8F0', borderStyle: 'dashed', flex: 1, marginHorizontal: 12 },
  duration: { fontSize: 14, color: '#64748B' },
  reserveBtn: { backgroundColor: '#00B0F3', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 12 },
  reserveText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#94A3B8', marginTop: 16 },
  emptySub: { fontSize: 14, color: '#94A3B8' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  stateItem: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  stateText: { fontSize: 16 },
  bookingModal: { backgroundColor: '#FFF', borderRadius: 20, margin: 20, maxHeight: '90%' },
  selectedTripSummary: { backgroundColor: '#F1F5F9', padding: 16, borderRadius: 12, marginVertical: 16 },
  inputLabel: { fontSize: 14, color: '#64748B', marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 14, fontSize: 16 },
  cancelBtn: { flex: 1, padding: 16, backgroundColor: '#F1F5F9', borderRadius: 12, alignItems: 'center' },
  cancelText: { color: '#64748B', fontWeight: '600' },
  submitBtn: { flex: 1, padding: 16, backgroundColor: '#00B0F3', borderRadius: 12, alignItems: 'center' },
  submitText: { color: '#FFF', fontWeight: '700' },
  ticketContainer: { backgroundColor: '#FFF', margin: 20, borderRadius: 20, overflow: 'hidden' },
  ticketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#00B0F3' },
  ticketTitle: { fontSize: 20, fontWeight: '700', color: '#FFF' },
  ticketBody: { padding: 24 },
  bookingId: { fontSize: 24, fontWeight: '800', color: '#0A2540', textAlign: 'center', marginBottom: 8 },
  date: { textAlign: 'center', color: '#64748B', marginBottom: 20 },
  ticketInfo: { backgroundColor: '#F8FAFC', padding: 20, borderRadius: 16 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 8 },
  label: { color: '#64748B', fontSize: 15 },
  value: { fontWeight: '600', color: '#0A2540', fontSize: 15 },
  totalPrice: { fontSize: 22, fontWeight: '800', color: '#00B0F3' },
  qrPlaceholder: { alignItems: 'center', marginVertical: 30 },
  screenshotHint: { textAlign: 'center', color: '#64748B', fontStyle: 'italic', marginTop: 20 },
});