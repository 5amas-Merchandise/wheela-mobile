// src/screens/passenger/IntercityBookingDetailsScreen.js
import { useState, useEffect } from 'react';
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
  Share,
  Linking,
  Platform,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
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

export default function IntercityBookingDetailsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { bookingId, bookingReference } = route.params;

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBookingDetails();
  }, []);

  const fetchBookingDetails = async () => {
    try {
      setLoading(true);
      const token = await Auth.getAuthToken();
      const response = await axios.get(
        `${API_URL}/intercity/bookings/${bookingId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (response.data.success) setBooking(response.data.booking);
      else {
        Alert.alert("Error", "Failed to load booking details");
        navigation.goBack();
      }
    } catch {
      Alert.alert("Error", "Unable to load booking details.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBooking = () => {
    Alert.alert(
      "Cancel Booking",
      `Cancel ${booking.bookingReference}? Refund in 5-7 business days.`,
      [
        { text: "Keep Booking", style: "cancel" },
        {
          text: "Cancel Booking",
          style: "destructive",
          onPress: cancelBooking,
        },
      ],
    );
  };

  const cancelBooking = async () => {
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
          "Refund will be processed within 5-7 business days.",
          [{ text: "OK", onPress: () => navigation.goBack() }],
        );
      }
    } catch (error) {
      Alert.alert(
        "Failed",
        error.response?.data?.error?.message || "Unable to cancel booking.",
      );
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message:
          `🚌 Booking: ${booking.bookingReference}\n` +
          `${booking.route.from.split(",")[0]} → ${booking.route.to.split(",")[0]}\n` +
          `${formatDate(booking.departure.date)} at ${formatTime(booking.departure.time)}\n` +
          `${booking.numberOfSeats} seat(s) · ₦${parseFloat(booking.totalAmountInNaira).toLocaleString()}`,
      });
    } catch {}
  };

  const formatDate = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      weekday: "long",
      day: "numeric",
      month: "long",
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

  const canCancel = () =>
    booking &&
    new Date(booking.departure?.date) > new Date() &&
    ["confirmed", "pending"].includes(booking.status);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.centeredState}>
          <ActivityIndicator size="large" color="#1A1A1A" />
          <Text style={s.centeredStateText}>Loading booking…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (!booking) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.centeredState}>
          <View style={s.emptyIconWrap}>
            <Ionicons name="alert-circle-outline" size={36} color="#EF4444" />
          </View>
          <Text style={[s.centeredStateText, { color: "#EF4444" }]}>
            Booking not found
          </Text>
          <TouchableOpacity
            style={s.backPill}
            onPress={() => navigation.goBack()}
          >
            <Text style={s.backPillText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const statusCfg = STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending;

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
        <Text style={s.topBarTitle}>Booking Details</Text>
        <TouchableOpacity
          style={s.topBarBtn}
          onPress={handleShare}
          activeOpacity={0.8}
        >
          <Ionicons name="share-outline" size={20} color="#1A1A1A" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* ── STATUS CARD ── */}
        <View style={s.statusCard}>
          <View style={[s.statusBadge, { backgroundColor: statusCfg.bg }]}>
            <Ionicons name={statusCfg.icon} size={18} color={statusCfg.color} />
            <Text style={[s.statusLabel, { color: statusCfg.color }]}>
              {statusCfg.label}
            </Text>
          </View>
          <Text style={s.bookingRef}>{booking.bookingReference}</Text>
          <Text style={s.bookingDateText}>
            Booked {formatDate(booking.bookingDate)}
          </Text>
        </View>

        {/* ── JOURNEY CARD ── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Journey</Text>

          {/* Route visual */}
          <View style={s.routeRow}>
            <View style={s.routeTimeBlock}>
              <Text style={s.routeTime}>
                {formatTime(booking.departure.time)}
              </Text>
              <Text style={s.routeCity}>
                {booking.route.from.split(",")[0]}
              </Text>
              <Text style={s.routeTerminal}>
                {booking.departure.terminal || "Main Terminal"}
              </Text>
            </View>
            <View style={s.routeCenter}>
              <View style={s.routeDot} />
              <View style={s.routeDash} />
              <View style={s.routeDurationWrap}>
                <Ionicons name="time-outline" size={12} color="#888" />
                <Text style={s.routeDuration}>
                  {getDuration(booking.route.duration)}
                </Text>
              </View>
              <View style={s.routeDash} />
              <View style={[s.routeDot, { backgroundColor: "#EF4444" }]} />
            </View>
            <View style={[s.routeTimeBlock, { alignItems: "flex-end" }]}>
              <Text style={s.routeTime}>
                {formatTime(booking.arrival.time)}
              </Text>
              <Text style={s.routeCity}>{booking.route.to.split(",")[0]}</Text>
              <Text style={s.routeTerminal}>
                {booking.arrival.terminal || "Main Terminal"}
              </Text>
            </View>
          </View>

          {/* Date chip */}
          <View style={s.dateChipRow}>
            <View style={s.dateChip}>
              <Ionicons name="calendar-outline" size={13} color="#666" />
              <Text style={s.dateChipText}>
                {formatDate(booking.departure.date)}
              </Text>
            </View>
            {booking.route.distance && (
              <View style={s.dateChip}>
                <Ionicons name="navigate-outline" size={13} color="#666" />
                <Text style={s.dateChipText}>{booking.route.distance} km</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── PASSENGER CARD ── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Passenger</Text>
          {[
            {
              icon: "person-outline",
              label: "Full Name",
              value: booking.passenger.fullName,
            },
            {
              icon: "call-outline",
              label: "Phone",
              value: booking.passenger.phone,
            },
            {
              icon: "mail-outline",
              label: "Email",
              value: booking.passenger.email,
            },
            {
              icon: "people-outline",
              label: "Seats",
              value:
                `${booking.numberOfSeats} seat${booking.numberOfSeats > 1 ? "s" : ""}` +
                (booking.seatNumbers?.length
                  ? ` (${booking.seatNumbers.join(", ")})`
                  : ""),
            },
          ].map((row, i, arr) => (
            <View
              key={row.label}
              style={[
                s.infoRow,
                i === arr.length - 1 && { borderBottomWidth: 0 },
              ]}
            >
              <View style={s.infoIconWrap}>
                <Ionicons name={row.icon} size={16} color="#1A1A1A" />
              </View>
              <Text style={s.infoLabel}>{row.label}</Text>
              <Text style={s.infoValue} numberOfLines={1}>
                {row.value}
              </Text>
            </View>
          ))}
        </View>

        {/* ── VEHICLE CARD ── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Vehicle</Text>
          {[
            {
              icon: "bus-outline",
              label: "Type",
              value: booking.vehicle.type.replace("_", " ").toUpperCase(),
            },
            {
              icon: "card-outline",
              label: "Number",
              value: booking.vehicle.number || "TBA",
            },
          ].map((row, i) => (
            <View
              key={row.label}
              style={[
                s.infoRow,
                i === 1 &&
                  !booking.vehicle.amenities?.length && {
                    borderBottomWidth: 0,
                  },
              ]}
            >
              <View style={s.infoIconWrap}>
                <Ionicons name={row.icon} size={16} color="#1A1A1A" />
              </View>
              <Text style={s.infoLabel}>{row.label}</Text>
              <Text style={s.infoValue}>{row.value}</Text>
            </View>
          ))}

          {booking.vehicle.amenities?.length > 0 && (
            <View style={s.amenitiesSection}>
              <Text style={s.amenitiesSectionLabel}>Amenities</Text>
              <View style={s.amenitiesWrap}>
                {booking.vehicle.amenities.map((a, i) => (
                  <View key={i} style={s.amenityChip}>
                    <Ionicons
                      name="checkmark-circle"
                      size={12}
                      color="#10B981"
                    />
                    <Text style={s.amenityChipText}>{a}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* ── COMPANY CARD ── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Transport Company</Text>
          <View style={s.companyRow}>
            <View style={s.companyIconWrap}>
              <MaterialIcons name="directions-bus" size={24} color="#1A1A1A" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.companyName}>{booking.company.name}</Text>
              {booking.company.phone && (
                <TouchableOpacity
                  onPress={() =>
                    Linking.openURL(`tel:${booking.company.phone}`)
                  }
                >
                  <Text style={s.companyPhone}>📞 {booking.company.phone}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* ── PAYMENT CARD ── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Payment</Text>
          <View style={s.paymentRow}>
            <Text style={s.paymentLabel}>Total Amount</Text>
            <Text style={s.paymentAmount}>
              ₦{parseFloat(booking.totalAmountInNaira).toLocaleString()}
            </Text>
          </View>
          <View style={[s.paymentRow, { borderBottomWidth: 0 }]}>
            <Text style={s.paymentLabel}>Status</Text>
            <View style={s.paidBadge}>
              <Text style={s.paidBadgeText}>PAID</Text>
            </View>
          </View>
        </View>

        {/* ── SPECIAL REQUESTS ── */}
        {booking.specialRequests && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Special Requests</Text>
            <Text style={s.specialRequestsText}>{booking.specialRequests}</Text>
          </View>
        )}

        {/* ── CANCELLATION CARD ── */}
        {booking.status === "cancelled" && (
          <View style={[s.card, s.cancelCard]}>
            <View style={s.cancelCardHeader}>
              <Ionicons name="alert-circle" size={20} color="#EF4444" />
              <Text style={s.cancelCardTitle}>Booking Cancelled</Text>
            </View>
            {booking.cancellationDate && (
              <Text style={s.cancelCardSub}>
                Cancelled on {formatDate(booking.cancellationDate)}
              </Text>
            )}
            {booking.cancellationReason && (
              <Text style={s.cancelCardReason}>
                Reason: {booking.cancellationReason}
              </Text>
            )}
          </View>
        )}
      </ScrollView>

      {/* ── ACTION BAR ── */}
      {(canCancel() ||
        (booking.status === "confirmed" &&
          new Date(booking.departure?.date) > new Date())) && (
        <View style={s.actionBar}>
          {canCancel() && (
            <TouchableOpacity
              style={s.cancelActionBtn}
              onPress={handleCancelBooking}
              activeOpacity={0.88}
            >
              <Ionicons name="close-circle" size={18} color="#EF4444" />
              <Text style={s.cancelActionBtnText}>Cancel Booking</Text>
            </TouchableOpacity>
          )}
          {booking.status === "confirmed" &&
            new Date(booking.departure?.date) > new Date() && (
              <TouchableOpacity
                style={s.checkInActionBtn}
                onPress={() =>
                  Alert.alert("Check-In", "Check-in feature coming soon!")
                }
                activeOpacity={0.88}
              >
                <Ionicons name="qr-code" size={18} color="#fff" />
                <Text style={s.checkInActionBtnText}>Check In</Text>
              </TouchableOpacity>
            )}
        </View>
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

  // ── Status card ──
  statusCard: {
    backgroundColor: "#1A1A1A",
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 22,
    padding: 24,
    alignItems: "center",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16,
  },
  statusLabel: { fontSize: 13, fontWeight: "800", letterSpacing: 0.8 },
  bookingRef: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
    letterSpacing: 1,
    marginBottom: 6,
  },
  bookingDateText: { fontSize: 13, color: "rgba(255,255,255,0.5)" },

  // ── Generic card ──
  card: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 20,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 5,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#aaa",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 16,
  },

  // ── Route ──
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F0",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  routeTimeBlock: { flex: 1 },
  routeTime: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1A1A1A",
    letterSpacing: -0.5,
    marginBottom: 3,
  },
  routeCity: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1A1A1A",
    marginBottom: 2,
  },
  routeTerminal: { fontSize: 11, color: "#aaa" },
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
    width: 14,
    height: 2,
    backgroundColor: "#DCDCDC",
    marginHorizontal: 3,
  },
  routeDurationWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 4,
  },
  routeDuration: {
    fontSize: 9,
    fontWeight: "700",
    color: "#aaa",
    letterSpacing: 0.3,
  },
  dateChipRow: { flexDirection: "row", gap: 8 },
  dateChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F5F5F0",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  dateChipText: { fontSize: 12, fontWeight: "600", color: "#555" },

  // ── Info rows ──
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F0",
  },
  infoIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#F5F5F0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  infoLabel: { fontSize: 13, color: "#888", flex: 1 },
  infoValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1A1A1A",
    maxWidth: "55%",
    textAlign: "right",
  },

  // ── Amenities ──
  amenitiesSection: { paddingTop: 14, marginTop: 2 },
  amenitiesSectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#aaa",
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  amenitiesWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  amenityChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#ECFDF5",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  amenityChipText: { fontSize: 11, color: "#059669", fontWeight: "600" },

  // ── Company ──
  companyRow: { flexDirection: "row", alignItems: "center" },
  companyIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#F5F5F0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  companyName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1A1A1A",
    marginBottom: 4,
  },
  companyPhone: { fontSize: 13, color: "#3B82F6", fontWeight: "600" },

  // ── Payment ──
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F0",
  },
  paymentLabel: { fontSize: 13, color: "#888" },
  paymentAmount: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1A1A1A",
    letterSpacing: -0.5,
  },
  paidBadge: {
    backgroundColor: "#ECFDF5",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  paidBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#10B981",
    letterSpacing: 0.5,
  },

  // ── Special requests ──
  specialRequestsText: { fontSize: 14, color: "#666", lineHeight: 22 },

  // ── Cancel card ──
  cancelCard: {
    borderWidth: 1.5,
    borderColor: "#FEE2E2",
    backgroundColor: "#FEF2F2",
  },
  cancelCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  cancelCardTitle: { fontSize: 15, fontWeight: "800", color: "#EF4444" },
  cancelCardSub: { fontSize: 13, color: "#B91C1C", marginBottom: 4 },
  cancelCardReason: { fontSize: 13, color: "#DC2626", fontStyle: "italic" },

  // ── Action bar ──
  actionBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: Platform.OS === "ios" ? 32 : 16,
    flexDirection: "row",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "#EBEBEB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 10,
  },
  cancelActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: "#FEE2E2",
    borderRadius: 16,
    paddingVertical: 15,
  },
  cancelActionBtnText: { fontSize: 15, fontWeight: "800", color: "#EF4444" },
  checkInActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    paddingVertical: 15,
  },
  checkInActionBtnText: { fontSize: 15, fontWeight: "800", color: "#fff" },

  // ── Centered states ──
  centeredState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  centeredStateText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#888",
    marginTop: 14,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },
  backPill: {
    marginTop: 20,
    backgroundColor: "#1A1A1A",
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 13,
  },
  backPillText: { color: "#fff", fontWeight: "800", fontSize: 14 },
});
