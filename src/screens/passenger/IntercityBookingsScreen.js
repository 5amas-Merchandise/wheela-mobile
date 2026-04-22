// src/screens/passenger/IntercityBookingsScreen.js
import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  ScrollView,
  Platform,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import axios from "axios";
import * as Auth from "../../utils/auth";

import { BASE_URL as API_URL } from '../../config';

const STATUS_CONFIG = {
  confirmed: {
    color: "#10B981",
    bg: "#ECFDF5",
    label: "CONFIRMED",
    icon: "checkmark-circle",
  },
  checked_in: {
    color: "#3B82F6",
    bg: "#EFF6FF",
    label: "CHECKED IN",
    icon: "log-in",
  },
  completed: {
    color: "#888",
    bg: "#F5F5F0",
    label: "COMPLETED",
    icon: "checkmark-done",
  },
  cancelled: {
    color: "#EF4444",
    bg: "#FEF2F2",
    label: "CANCELLED",
    icon: "close-circle",
  },
  no_show: { color: "#F59E0B", bg: "#FFFBEB", label: "NO SHOW", icon: "time" },
  pending: {
    color: "#8B5CF6",
    bg: "#F5F3FF",
    label: "PENDING",
    icon: "time-outline",
  },
};

const FILTERS = [
  { id: "all", label: "All Trips" },
  { id: "upcoming", label: "Upcoming" },
  { id: "past", label: "Past" },
  { id: "cancelled", label: "Cancelled" },
];

export default function IntercityBookingsScreen() {
  const navigation = useNavigation();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");

  useFocusEffect(
    useCallback(() => {
      fetchBookings();
    }, []),
  );

  const fetchBookings = async () => {
    try {
      const token = await Auth.getAuthToken();
      if (!token) {
        navigation.goBack();
        return;
      }
      const response = await axios.get(`${API_URL}/intercity/bookings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) setBookings(response.data.bookings || []);
    } catch (error) {
      if (error.response?.status === 401) {
        await Auth.logout();
        navigation.goBack();
      } else
        Alert.alert("Error", "Unable to load bookings. Check your connection.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchBookings();
  };

  const handleCancelBooking = (bookingId, bookingRef) => {
    Alert.alert(
      "Cancel Booking",
      `Cancel ${bookingRef}? Refund processed in 5-7 business days.`,
      [
        { text: "Keep Booking", style: "cancel" },
        {
          text: "Cancel",
          style: "destructive",
          onPress: () => cancelBooking(bookingId),
        },
      ],
    );
  };

  const cancelBooking = async (bookingId) => {
    try {
      const token = await Auth.getAuthToken();
      const response = await axios.post(
        `${API_URL}/intercity/bookings/${bookingId}/cancel`,
        { reason: "Cancelled by passenger" },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (response.data.success) {
        Alert.alert(
          "Cancelled",
          "Refund will be processed in 5-7 business days.",
          [{ text: "OK", onPress: fetchBookings }],
        );
      }
    } catch (error) {
      Alert.alert(
        "Failed",
        error.response?.data?.error?.message || "Unable to cancel booking.",
      );
    }
  };

  const formatDate = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatTime = (time) => {
    if (!time) return "N/A";
    const [h, m] = time.split(":");
    const hr = parseInt(h);
    return `${hr % 12 || 12}:${m} ${hr >= 12 ? "PM" : "AM"}`;
  };

  const getDuration = (d) => {
    if (!d) return "N/A";
    return `${Math.floor(d / 60)}h ${d % 60}m`;
  };

  const isUpcoming = (date) => date && new Date(date) > new Date();

  const getFilteredBookings = () => {
    switch (activeFilter) {
      case "upcoming":
        return bookings.filter(
          (b) =>
            isUpcoming(b.departure?.date) &&
            ["confirmed", "checked_in", "pending"].includes(b.status),
        );
      case "past":
        return bookings.filter(
          (b) =>
            !isUpcoming(b.departure?.date) ||
            ["completed", "no_show"].includes(b.status),
        );
      case "cancelled":
        return bookings.filter((b) => b.status === "cancelled");
      default:
        return bookings;
    }
  };

  const renderBooking = ({ item }) => {
    const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
    const upcoming = isUpcoming(item.departure?.date);
    const canCancel =
      upcoming && ["confirmed", "pending"].includes(item.status);

    return (
      <View style={s.bookingCard}>
        {/* Header */}
        <View style={s.bookingCardHeader}>
          <View style={s.companyRow}>
            <View style={[s.companyIconWrap, { backgroundColor: cfg.bg }]}>
              <MaterialIcons
                name="directions-bus"
                size={22}
                color={cfg.color}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.companyName} numberOfLines={1}>
                {item.company?.name || "Transport Company"}
              </Text>
              <Text style={s.bookingRef}>{item.bookingReference}</Text>
            </View>
          </View>
          <View style={[s.statusBadge, { backgroundColor: cfg.bg }]}>
            <Ionicons name={cfg.icon} size={12} color={cfg.color} />
            <Text style={[s.statusBadgeText, { color: cfg.color }]}>
              {cfg.label}
            </Text>
          </View>
        </View>

        {/* Route */}
        <View style={s.routeBlock}>
          <View style={s.routeTimeBlock}>
            <Text style={s.routeTime}>{formatTime(item.departure?.time)}</Text>
            <Text style={s.routeCity} numberOfLines={1}>
              {item.route?.from?.split(",")[0] || "Departure"}
            </Text>
            <Text style={s.routeTerminal}>
              {item.departure?.terminal || "Main Terminal"}
            </Text>
          </View>
          <View style={s.routeCenter}>
            <View style={s.routeDot} />
            <View style={s.routeDash} />
            <Text style={s.routeDuration}>
              {getDuration(item.route?.duration)}
            </Text>
            <View style={s.routeDash} />
            <View style={[s.routeDot, { backgroundColor: "#EF4444" }]} />
          </View>
          <View style={[s.routeTimeBlock, { alignItems: "flex-end" }]}>
            <Text style={s.routeTime}>{formatTime(item.arrival?.time)}</Text>
            <Text style={s.routeCity} numberOfLines={1}>
              {item.route?.to?.split(",")[0] || "Arrival"}
            </Text>
            <Text style={s.routeTerminal}>
              {item.arrival?.terminal || "Main Terminal"}
            </Text>
          </View>
        </View>

        {/* Chips */}
        <View style={s.tripChipsRow}>
          <View style={s.tripChip}>
            <Ionicons name="calendar-outline" size={12} color="#666" />
            <Text style={s.tripChipText}>
              {formatDate(item.departure?.date)}
            </Text>
          </View>
          <View style={s.tripChipDivider} />
          <View style={s.tripChip}>
            <Ionicons name="people-outline" size={12} color="#666" />
            <Text style={s.tripChipText}>
              {item.numberOfSeats} seat{item.numberOfSeats > 1 ? "s" : ""}
            </Text>
          </View>
          <View style={s.tripChipDivider} />
          <View style={s.tripChip}>
            <Ionicons name="cash-outline" size={12} color="#666" />
            <Text style={s.tripChipText}>
              ₦{parseFloat(item.totalAmountInNaira).toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={s.actionsRow}>
          <TouchableOpacity
            style={s.viewBtn}
            onPress={() =>
              navigation.navigate("IntercityBookingDetails", {
                bookingId: item.id,
                bookingReference: item.bookingReference,
              })
            }
            activeOpacity={0.8}
          >
            <Ionicons name="eye-outline" size={14} color="#1A1A1A" />
            <Text style={s.viewBtnText}>Details</Text>
          </TouchableOpacity>

          {item.status === "confirmed" && upcoming && (
            <TouchableOpacity
              style={s.checkInBtn}
              onPress={() => Alert.alert("Check-In", "Coming soon!")}
              activeOpacity={0.8}
            >
              <Ionicons name="qr-code-outline" size={14} color="#10B981" />
              <Text style={s.checkInBtnText}>Check In</Text>
            </TouchableOpacity>
          )}

          {canCancel && (
            <TouchableOpacity
              style={s.cancelBtn}
              onPress={() =>
                handleCancelBooking(item.id, item.bookingReference)
              }
              activeOpacity={0.8}
            >
              <Ionicons name="close-circle-outline" size={14} color="#EF4444" />
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const filteredBookings = getFilteredBookings();

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
        <Text style={s.topBarTitle}>My Bookings</Text>
        <TouchableOpacity
          style={s.topBarBtn}
          onPress={onRefresh}
          disabled={refreshing}
          activeOpacity={0.8}
        >
          <Ionicons
            name={refreshing ? "hourglass-outline" : "refresh"}
            size={20}
            color="#1A1A1A"
          />
        </TouchableOpacity>
      </View>

      {/* ── FILTER TABS ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.filterBar}
        contentContainerStyle={s.filterBarContent}
      >
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.id}
            style={[s.filterTab, activeFilter === f.id && s.filterTabActive]}
            onPress={() => setActiveFilter(f.id)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                s.filterTabText,
                activeFilter === f.id && s.filterTabTextActive,
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── LIST ── */}
      {loading ? (
        <View style={s.centeredState}>
          <ActivityIndicator size="large" color="#1A1A1A" />
          <Text style={s.centeredStateText}>Loading bookings…</Text>
        </View>
      ) : (
        <FlatList
          data={filteredBookings}
          keyExtractor={(item) => item.id}
          renderItem={renderBooking}
          contentContainerStyle={s.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#1A1A1A"
              colors={["#1A1A1A"]}
            />
          }
          ListHeaderComponent={
            filteredBookings.length > 0 ? (
              <Text style={s.listHeader}>
                {filteredBookings.length} booking
                {filteredBookings.length !== 1 ? "s" : ""}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <View style={s.emptyState}>
              <View style={s.emptyIconWrap}>
                <Ionicons
                  name={
                    activeFilter === "upcoming"
                      ? "calendar-outline"
                      : activeFilter === "cancelled"
                        ? "close-circle-outline"
                        : "bus-outline"
                  }
                  size={36}
                  color="#1A1A1A"
                />
              </View>
              <Text style={s.emptyTitle}>
                {activeFilter === "upcoming"
                  ? "No Upcoming Trips"
                  : activeFilter === "past"
                    ? "No Past Bookings"
                    : activeFilter === "cancelled"
                      ? "No Cancelled Bookings"
                      : "No Bookings Yet"}
              </Text>
              <Text style={s.emptySubtitle}>
                {activeFilter === "all"
                  ? "Book your first intercity trip to get started"
                  : "Your booking history will appear here"}
              </Text>
              {activeFilter === "all" && (
                <TouchableOpacity
                  style={s.emptyActionBtn}
                  onPress={() => navigation.navigate("CityToCity")}
                  activeOpacity={0.88}
                >
                  <Text style={s.emptyActionBtnText}>Search Trips</Text>
                  <Ionicons name="arrow-forward" size={16} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}

      {/* ── FAB ── */}
      {!loading && filteredBookings.length > 0 && (
        <TouchableOpacity
          style={s.fab}
          onPress={() => navigation.navigate("CityToCity")}
          activeOpacity={0.88}
        >
          <Ionicons name="add" size={26} color="#fff" />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

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

  // ── Filter bar ──
  filterBar: { backgroundColor: "#F5F5F0", maxHeight: 60 },
  filterBarContent: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  filterTab: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  filterTabActive: { backgroundColor: "#1A1A1A" },
  filterTabText: { fontSize: 13, fontWeight: "700", color: "#888" },
  filterTabTextActive: { color: "#fff" },

  // ── List ──
  listContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 100 },
  listHeader: {
    fontSize: 12,
    fontWeight: "700",
    color: "#aaa",
    letterSpacing: 0.5,
    marginBottom: 12,
  },

  // ── Booking card ──
  bookingCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 5,
  },
  bookingCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  companyRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
  },
  companyIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  companyName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1A1A1A",
    marginBottom: 2,
  },
  bookingRef: {
    fontSize: 11,
    color: "#aaa",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
    letterSpacing: 0.5,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  statusBadgeText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },

  // ── Route block ──
  routeBlock: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F0",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  routeTimeBlock: { flex: 1 },
  routeTime: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1A1A1A",
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  routeCity: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1A1A1A",
    marginBottom: 2,
  },
  routeTerminal: { fontSize: 10, color: "#aaa" },
  routeCenter: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  routeDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#10B981",
  },
  routeDash: {
    width: 12,
    height: 2,
    backgroundColor: "#DCDCDC",
    marginHorizontal: 3,
  },
  routeDuration: {
    fontSize: 9,
    fontWeight: "700",
    color: "#aaa",
    paddingHorizontal: 4,
  },

  // ── Chips ──
  tripChipsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  tripChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
  },
  tripChipText: { fontSize: 11, fontWeight: "600", color: "#666" },
  tripChipDivider: { width: 1, height: 12, backgroundColor: "#E0E0E0" },

  // ── Action buttons ──
  actionsRow: { flexDirection: "row", gap: 8 },
  viewBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#F5F5F0",
    borderRadius: 12,
    paddingVertical: 11,
  },
  viewBtnText: { fontSize: 12, fontWeight: "700", color: "#1A1A1A" },
  checkInBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#ECFDF5",
    borderRadius: 12,
    paddingVertical: 11,
  },
  checkInBtnText: { fontSize: 12, fontWeight: "700", color: "#10B981" },
  cancelBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    paddingVertical: 11,
  },
  cancelBtnText: { fontSize: 12, fontWeight: "700", color: "#EF4444" },

  // ── Empty state ──
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 40,
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
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#aaa",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 28,
  },
  emptyActionBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },

  // ── Centered states ──
  centeredState: { flex: 1, justifyContent: "center", alignItems: "center" },
  centeredStateText: {
    fontSize: 14,
    color: "#aaa",
    fontWeight: "600",
    marginTop: 12,
  },

  // ── FAB ──
  fab: {
    position: "absolute",
    bottom: 30,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#1A1A1A",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
});
