// src/screens/passenger/CityToCityScreen.js
import { useState } from 'react';
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
  Platform,
  Animated,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import axios from "axios";

import { BASE_URL as API_URL } from '../../config';

const NIGERIA_STATES = [
  "Abia",
  "Adamawa",
  "Akwa Ibom",
  "Anambra",
  "Bauchi",
  "Bayelsa",
  "Benue",
  "Borno",
  "Cross River",
  "Delta",
  "Ebonyi",
  "Edo",
  "Ekiti",
  "Enugu",
  "FCT",
  "Gombe",
  "Imo",
  "Jigawa",
  "Kaduna",
  "Kano",
  "Katsina",
  "Kebbi",
  "Kogi",
  "Kwara",
  "Lagos",
  "Nasarawa",
  "Niger",
  "Ogun",
  "Ondo",
  "Osun",
  "Oyo",
  "Plateau",
  "Rivers",
  "Sokoto",
  "Taraba",
  "Yobe",
  "Zamfara",
];

export default function CityToCityScreen() {
  const navigation = useNavigation();

  const [departureState, setDepartureState] = useState("");
  const [arrivalState, setArrivalState] = useState("");
  const [travelDate, setTravelDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [showDepartureModal, setShowDepartureModal] = useState(false);
  const [showArrivalModal, setShowArrivalModal] = useState(false);
  const [searching, setSearching] = useState(false);
  const [trips, setTrips] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!departureState || !arrivalState) {
      Alert.alert(
        "Missing Info",
        "Please select both departure and arrival states.",
      );
      return;
    }
    if (departureState === arrivalState) {
      Alert.alert(
        "Invalid Route",
        "Departure and arrival cannot be the same state.",
      );
      return;
    }
    try {
      setSearching(true);
      setHasSearched(true);
      const response = await axios.get(`${API_URL}/intercity/search`, {
        params: { departureState, arrivalState, date: travelDate },
      });
      if (response.data.success) {
        setTrips(response.data.trips || []);
        if (!response.data.trips.length) {
          Alert.alert(
            "No Trips Found",
            "No trips available for this route and date.",
          );
        }
      }
    } catch {
      Alert.alert(
        "Search Failed",
        "Unable to search for trips. Please try again.",
      );
    } finally {
      setSearching(false);
    }
  };

  const swapLocations = () => {
    const temp = departureState;
    setDepartureState(arrivalState);
    setArrivalState(temp);
  };

  const formatTime = (time) => {
    if (!time) return "N/A";
    const [hours, minutes] = time.split(":");
    const h = parseInt(hours);
    return `${h % 12 || 12}:${minutes} ${h >= 12 ? "PM" : "AM"}`;
  };

  const getDuration = (duration) => {
    if (!duration) return "N/A";
    const h = Math.floor(duration / 60);
    const m = duration % 60;
    return `${h}h ${m}m`;
  };

  const renderTripCard = ({ item }) => (
    <View style={s.tripCard}>
      {/* Company row */}
      <View style={s.tripCompanyRow}>
        <View style={s.tripCompanyIconWrap}>
          <MaterialIcons name="directions-bus" size={22} color="#1A1A1A" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.tripCompanyName}>{item.company.name}</Text>
          {item.company.rating > 0 && (
            <View style={s.tripRatingRow}>
              <Ionicons name="star" size={12} color="#F59E0B" />
              <Text style={s.tripRatingText}>
                {item.company.rating.toFixed(1)} · {item.company.totalReviews}{" "}
                reviews
              </Text>
            </View>
          )}
        </View>
        <View style={s.seatsChip}>
          <Ionicons name="people-outline" size={12} color="#1A1A1A" />
          <Text style={s.seatsChipText}>
            {item.availability.availableSeats} seats
          </Text>
        </View>
      </View>

      {/* Route */}
      <View style={s.routeRow}>
        <View style={s.routeTimeBlock}>
          <Text style={s.routeTime}>{formatTime(item.departure.time)}</Text>
          <Text style={s.routeCity} numberOfLines={1}>
            {item.route.from.split(",")[0]}
          </Text>
        </View>

        <View style={s.routeCenter}>
          <View style={s.routeDot} />
          <View style={s.routeDash} />
          <Text style={s.routeDuration}>
            {getDuration(item.route.duration)}
          </Text>
          <View style={s.routeDash} />
          <View style={[s.routeDot, { backgroundColor: "#EF4444" }]} />
        </View>

        <View style={[s.routeTimeBlock, { alignItems: "flex-end" }]}>
          <Text style={s.routeTime}>{formatTime(item.arrival.time)}</Text>
          <Text style={s.routeCity} numberOfLines={1}>
            {item.route.to.split(",")[0]}
          </Text>
        </View>
      </View>

      {/* Chips row */}
      <View style={s.tripChipsRow}>
        <View style={s.tripChip}>
          <Ionicons name="car-outline" size={13} color="#666" />
          <Text style={s.tripChipText}>
            {item.vehicle.type.replace("_", " ")}
          </Text>
        </View>
        {item.vehicle.amenities?.slice(0, 3).map((a, i) => (
          <View key={i} style={[s.tripChip, { backgroundColor: "#ECFDF5" }]}>
            <Text style={[s.tripChipText, { color: "#059669" }]}>{a}</Text>
          </View>
        ))}
        {item.vehicle.amenities?.length > 3 && (
          <Text style={s.moreText}>+{item.vehicle.amenities.length - 3}</Text>
        )}
      </View>

      {/* Footer */}
      <View style={s.tripFooter}>
        <View>
          <Text style={s.priceLabel}>From</Text>
          <Text style={s.priceText}>
            ₦{parseFloat(item.pricing.priceInNaira).toLocaleString()}
          </Text>
          <Text style={s.perSeatText}>per seat</Text>
        </View>
        <TouchableOpacity
          style={s.bookBtn}
          onPress={() =>
            navigation.navigate("IntercityBookingForm", { trip: item })
          }
          activeOpacity={0.88}
        >
          <Text style={s.bookBtnText}>Book Now</Text>
          <Ionicons name="arrow-forward" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const StateModal = ({ visible, title, selected, onSelect, onClose }) => (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={s.modalBackdrop}
        activeOpacity={1}
        onPress={onClose}
      />
      <View style={s.modalSheet}>
        <View style={s.sheetHandle} />
        <View style={s.modalHeaderRow}>
          <Text style={s.modalTitle}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={s.modalCloseBtn}>
            <Ionicons name="close" size={20} color="#1A1A1A" />
          </TouchableOpacity>
        </View>
        <ScrollView showsVerticalScrollIndicator={false}>
          {NIGERIA_STATES.map((state) => (
            <TouchableOpacity
              key={state}
              style={s.stateItem}
              onPress={() => {
                onSelect(state);
                onClose();
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[s.stateText, selected === state && s.stateTextSelected]}
              >
                {state}
              </Text>
              {selected === state && (
                <View style={s.stateCheck}>
                  <Ionicons name="checkmark" size={14} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          ))}
          <View style={{ height: Platform.OS === "ios" ? 28 : 12 }} />
        </ScrollView>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={s.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent
      />

      {/* ── TOP BAR ── */}
      <View style={s.topBar}>
        <TouchableOpacity
          style={s.topBarBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={20} color="#1A1A1A" />
        </TouchableOpacity>

        <Text style={s.topBarTitle}>City to City</Text>

        <TouchableOpacity
          style={s.topBarBtn}
          onPress={() => navigation.navigate("IntercityBookings")}
          activeOpacity={0.8}
        >
          <Ionicons name="receipt-outline" size={20} color="#1A1A1A" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* ── SEARCH CARD ── */}
        <View style={s.searchCard}>
          <Text style={s.searchCardTitle}>Where are you going?</Text>

          {/* From */}
          <TouchableOpacity
            style={s.locationInputRow}
            onPress={() => setShowDepartureModal(true)}
            activeOpacity={0.8}
          >
            <View style={s.dotGreen} />
            <View style={s.locationInputContent}>
              <Text style={s.locationInputLabel}>DEPARTURE</Text>
              <Text
                style={[
                  s.locationInputText,
                  !departureState && s.locationInputPlaceholder,
                ]}
              >
                {departureState || "Select state"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#ccc" />
          </TouchableOpacity>

          {/* Swap + divider */}
          <View style={s.swapRow}>
            <View style={s.swapDivider} />
            <TouchableOpacity
              style={s.swapBtn}
              onPress={swapLocations}
              activeOpacity={0.8}
            >
              <Ionicons name="swap-vertical" size={18} color="#1A1A1A" />
            </TouchableOpacity>
            <View style={s.swapDivider} />
          </View>

          {/* To */}
          <TouchableOpacity
            style={s.locationInputRow}
            onPress={() => setShowArrivalModal(true)}
            activeOpacity={0.8}
          >
            <View style={s.dotBlack} />
            <View style={s.locationInputContent}>
              <Text style={s.locationInputLabel}>ARRIVAL</Text>
              <Text
                style={[
                  s.locationInputText,
                  !arrivalState && s.locationInputPlaceholder,
                ]}
              >
                {arrivalState || "Select state"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#ccc" />
          </TouchableOpacity>

          {/* Date */}
          <View style={[s.locationInputRow, { marginTop: 12 }]}>
            <View style={s.calendarIconWrap}>
              <Ionicons name="calendar-outline" size={16} color="#1A1A1A" />
            </View>
            <View style={s.locationInputContent}>
              <Text style={s.locationInputLabel}>TRAVEL DATE</Text>
              <TextInput
                style={s.dateInput}
                value={travelDate}
                onChangeText={setTravelDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#bbb"
              />
            </View>
          </View>

          {/* Search CTA */}
          <TouchableOpacity
            style={s.searchBtn}
            onPress={handleSearch}
            disabled={searching}
            activeOpacity={0.88}
          >
            {searching ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={s.searchBtnText}>Search Trips</Text>
                <Ionicons
                  name="arrow-forward"
                  size={20}
                  color="#fff"
                  style={{ marginLeft: 8 }}
                />
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* ── RESULTS ── */}
        {hasSearched && (
          <View style={s.resultsSection}>
            <Text style={s.resultsTitle}>
              {trips.length} {trips.length === 1 ? "Trip" : "Trips"} Found
            </Text>

            {trips.length === 0 ? (
              <View style={s.emptyState}>
                <View style={s.emptyIconWrap}>
                  <Ionicons name="bus-outline" size={36} color="#1A1A1A" />
                </View>
                <Text style={s.emptyTitle}>No Trips Available</Text>
                <Text style={s.emptySub}>Try a different date or route</Text>
              </View>
            ) : (
              <FlatList
                data={trips}
                keyExtractor={(item, index) => `${item.scheduleId}-${index}`}
                renderItem={renderTripCard}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
              />
            )}
          </View>
        )}
      </ScrollView>

      {/* ── STATE MODALS ── */}
      <StateModal
        visible={showDepartureModal}
        title="Select Departure"
        selected={departureState}
        onSelect={setDepartureState}
        onClose={() => setShowDepartureModal(false)}
      />
      <StateModal
        visible={showArrivalModal}
        title="Select Arrival"
        selected={arrivalState}
        onSelect={setArrivalState}
        onClose={() => setShowArrivalModal(false)}
      />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES — mirrors PassengerHomeScreen design language
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F0" },

  // ── Top bar ──
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 12 : 44,
    paddingBottom: 14,
    backgroundColor: "#F5F5F0",
  },
  topBarBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1A1A1A",
    letterSpacing: -0.3,
  },

  // ── Search card ──
  searchCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.09,
    shadowRadius: 16,
    elevation: 8,
  },
  searchCardTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1A1A1A",
    letterSpacing: -0.5,
    marginBottom: 20,
  },

  // Location input rows (same pattern as HomeScreen)
  locationInputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
  },
  dotGreen: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#10B981",
    marginRight: 14,
  },
  dotBlack: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#1A1A1A",
    marginRight: 14,
  },
  locationInputContent: { flex: 1 },
  locationInputLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#aaa",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  locationInputText: { fontSize: 15, fontWeight: "600", color: "#1A1A1A" },
  locationInputPlaceholder: { color: "#bbb", fontWeight: "400" },

  // Swap row
  swapRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 8,
  },
  swapDivider: { flex: 1, height: 1, backgroundColor: "#EFEFEF" },
  swapBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F5F5F0",
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 12,
    borderWidth: 1,
    borderColor: "#EBEBEB",
  },

  // Date input
  calendarIconWrap: {
    width: 12,
    height: 12,
    marginRight: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  dateInput: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1A1A1A",
    padding: 0,
  },

  // Search button (matches requestBtn in HomeScreen)
  searchBtn: {
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    paddingVertical: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  searchBtnText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.3,
  },

  // ── Results ──
  resultsSection: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  resultsTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1A1A1A",
    letterSpacing: -0.3,
    marginBottom: 14,
  },

  // ── Trip card ──
  tripCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 5,
  },
  tripCompanyRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  tripCompanyIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#F5F5F0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  tripCompanyName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 2,
  },
  tripRatingRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  tripRatingText: { fontSize: 12, color: "#888" },
  seatsChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F5F5F0",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  seatsChipText: { fontSize: 11, fontWeight: "700", color: "#1A1A1A" },

  // Route
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F0",
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  routeTimeBlock: { flex: 1 },
  routeTime: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1A1A1A",
    letterSpacing: -0.5,
    marginBottom: 3,
  },
  routeCity: { fontSize: 12, color: "#888" },
  routeCenter: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
  },
  routeDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#10B981",
  },
  routeDash: {
    flex: 1,
    height: 2,
    backgroundColor: "#DCDCDC",
    marginHorizontal: 4,
  },
  routeDuration: {
    fontSize: 10,
    fontWeight: "700",
    color: "#888",
    letterSpacing: 0.3,
    paddingHorizontal: 6,
  },

  // Chips
  tripChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 16,
  },
  tripChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F5F5F0",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  tripChipText: { fontSize: 11, fontWeight: "600", color: "#555" },
  moreText: { fontSize: 12, color: "#aaa", alignSelf: "center" },

  // Trip footer
  tripFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#F5F5F0",
  },
  priceLabel: { fontSize: 11, color: "#aaa", fontWeight: "600" },
  priceText: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1A1A1A",
    letterSpacing: -0.5,
  },
  perSeatText: { fontSize: 11, color: "#aaa" },
  bookBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1A1A",
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 20,
    gap: 6,
  },
  bookBtnText: { fontSize: 14, fontWeight: "800", color: "#fff" },

  // Empty state
  emptyState: {
    alignItems: "center",
    paddingVertical: 52,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 5,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1A1A1A",
    marginBottom: 6,
  },
  emptySub: { fontSize: 14, color: "#aaa" },

  // ── Modal / bottom sheet ──
  modalBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  modalSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "78%",
    paddingTop: 12,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E0E0E0",
    alignSelf: "center",
    marginBottom: 16,
  },
  modalHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F0",
  },
  modalTitle: { fontSize: 17, fontWeight: "800", color: "#1A1A1A" },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F5F5F0",
    justifyContent: "center",
    alignItems: "center",
  },
  stateItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F0",
  },
  stateText: { fontSize: 15, fontWeight: "500", color: "#1A1A1A" },
  stateTextSelected: { fontWeight: "800" },
  stateCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#10B981",
    justifyContent: "center",
    alignItems: "center",
  },
});
