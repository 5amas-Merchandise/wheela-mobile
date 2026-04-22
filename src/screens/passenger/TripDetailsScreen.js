// src/screens/TripDetailsScreen.js
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Linking,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { getAuthToken } from "../../utils/auth";

import { BASE_URL as API_BASE_URL } from '../../config';
const GOOGLE_API_KEY = "AIzaSyAbOQwCqiWYfyKe-t1SmzUcfgNVFYaXTFo";

const SERVICE_NAMES = {
  CITY_RIDE: "City Ride",
  OUTSTATION: "Outstation",
  RENTAL: "Rental",
  LUXURY: "Luxury",
  LUXURY_RENTAL: "Luxury",
  BIKE: "Bike",
  DELIVERY_BIKE: "Delivery Bike",
  KEKE: "Keke",
};

const STATUS_CONFIG = {
  completed: {
    color: "#10B981",
    bg: "#ECFDF5",
    icon: "checkmark-circle",
    label: "COMPLETED",
  },
  cancelled: {
    color: "#EF4444",
    bg: "#FEF2F2",
    icon: "close-circle",
    label: "CANCELLED",
  },
  active: {
    color: "#3B82F6",
    bg: "#EFF6FF",
    icon: "time-outline",
    label: "ACTIVE",
  },
  pending: {
    color: "#8B5CF6",
    bg: "#F5F3FF",
    icon: "time-outline",
    label: "PENDING",
  },
};

const formatDate = (dateString) => {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

const getAddressFromCoordinates = async (coordinates) => {
  if (!Array.isArray(coordinates) || coordinates.length < 2)
    return "Unknown Location";
  try {
    const [lng, lat] = coordinates;
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_API_KEY}`,
    );
    const data = await res.json();
    if (data.status === "OK" && data.results[0])
      return data.results[0].formatted_address;
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch {
    const [lng, lat] = coordinates;
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
};

// ── InfoRow helper ─────────────────────────────────────────────────────────
function InfoRow({ icon, label, value, isLast, valueStyle }) {
  return (
    <View style={[r.row, isLast && { borderBottomWidth: 0 }]}>
      <View style={r.iconWrap}>
        <Ionicons name={icon} size={16} color="#1A1A1A" />
      </View>
      <Text style={r.label}>{label}</Text>
      <Text style={[r.value, valueStyle]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}
const r = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F0",
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#F5F5F0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  label: { flex: 1, fontSize: 13, color: "#888" },
  value: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1A1A1A",
    maxWidth: "55%",
    textAlign: "right",
    textTransform: "capitalize",
  },
});

// ─────────────────────────────────────────────────────────────────────────────
export default function TripDetailsScreen({ route }) {
  const navigation = useNavigation();
  const { trip: initialTrip, role } = route.params || {};

  const [trip, setTrip] = useState(initialTrip);
  const [loading, setLoading] = useState(!initialTrip);
  const [addresses, setAddresses] = useState({ pickup: "", dropoff: "" });
  const [loadingAddr, setLoadingAddr] = useState(false);

  useEffect(() => {
    if (!initialTrip && route.params?.tripId)
      fetchTripDetails(route.params.tripId);
    else if (initialTrip) fetchAddresses(initialTrip);
  }, []);

  const fetchTripDetails = async (tripId) => {
    try {
      setLoading(true);
      const token = await getAuthToken();
      const res = await fetch(`${API_BASE_URL}/trips/${tripId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch trip details");
      const data = await res.json();
      setTrip(data.trip);
      await fetchAddresses(data.trip);
    } catch {
      Alert.alert("Error", "Failed to load trip details");
    } finally {
      setLoading(false);
    }
  };

  const fetchAddresses = async (tripData) => {
    try {
      setLoadingAddr(true);
      let pickup = tripData.pickupAddress || tripData.pickupLocationName || "";
      let dropoff =
        tripData.dropoffAddress || tripData.dropoffLocationName || "";
      if (!pickup && tripData.pickupLocation?.coordinates)
        pickup = await getAddressFromCoordinates(
          tripData.pickupLocation.coordinates,
        );
      if (!dropoff && tripData.dropoffLocation?.coordinates)
        dropoff = await getAddressFromCoordinates(
          tripData.dropoffLocation.coordinates,
        );
      setAddresses({
        pickup: pickup || "Pickup Location",
        dropoff: dropoff || "Destination",
      });
    } catch {
      setAddresses({ pickup: "Pickup Location", dropoff: "Destination" });
    } finally {
      setLoadingAddr(false);
    }
  };

  const openMaps = (coordinates) => {
    if (!Array.isArray(coordinates) || coordinates.length < 2) return;
    const [lng, lat] = coordinates;
    Linking.openURL(
      `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    ).catch(() => Alert.alert("Error", "Could not open maps."));
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <TopBar navigation={navigation} />
        <View style={s.centeredState}>
          <ActivityIndicator size="large" color="#1A1A1A" />
          <Text style={s.centeredStateText}>Loading trip…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (!trip) {
    return (
      <SafeAreaView style={s.container}>
        <TopBar navigation={navigation} />
        <View style={s.centeredState}>
          <View style={s.emptyIconWrap}>
            <Ionicons name="alert-circle-outline" size={34} color="#EF4444" />
          </View>
          <Text style={[s.centeredStateText, { color: "#EF4444" }]}>
            Trip details unavailable
          </Text>
          <TouchableOpacity
            style={s.backPill}
            onPress={() => navigation.goBack()}
            activeOpacity={0.88}
          >
            <Text style={s.backPillText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isCancelled = trip.status === "cancelled";
  const isCompleted = trip.status === "completed";
  const fareAmount = trip.finalFare || trip.estimatedFare || 0;
  const driverEarn = trip.driverEarnings || fareAmount;
  const commission = trip.commission || 0;
  const statusCfg = STATUS_CONFIG[trip.status] || STATUS_CONFIG.pending;
  const serviceName =
    SERVICE_NAMES[trip.serviceType] ||
    trip.serviceType?.replace(/_/g, " ") ||
    "Ride";

  return (
    <SafeAreaView style={s.container}>
      <TopBar navigation={navigation} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 50 }}
      >
        {/* ── STATUS CARD (dark) ── */}
        <View style={s.statusCard}>
          <View style={[s.statusBadge, { backgroundColor: statusCfg.bg }]}>
            <Ionicons name={statusCfg.icon} size={16} color={statusCfg.color} />
            <Text style={[s.statusBadgeText, { color: statusCfg.color }]}>
              {statusCfg.label}
            </Text>
          </View>
          <Text style={s.fareHero}>₦{fareAmount.toLocaleString()}</Text>
          <Text style={s.fareHeroSub}>
            {serviceName} · {formatDate(trip.completedAt || trip.requestedAt)}
          </Text>
        </View>

        {/* ── ROUTE CARD ── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Route</Text>

          {/* Pickup */}
          <TouchableOpacity
            style={s.routeRow}
            onPress={() =>
              trip.pickupLocation?.coordinates &&
              openMaps(trip.pickupLocation.coordinates)
            }
            disabled={!trip.pickupLocation?.coordinates}
            activeOpacity={0.75}
          >
            <View style={s.routeLeft}>
              <View style={s.dotGreen} />
              <View style={s.routeLine} />
            </View>
            <View style={s.routeAddrBlock}>
              <Text style={s.routeAddrLabel}>PICKUP</Text>
              {loadingAddr ? (
                <ActivityIndicator
                  size="small"
                  color="#1A1A1A"
                  style={{ alignSelf: "flex-start" }}
                />
              ) : (
                <Text style={s.routeAddrText}>{addresses.pickup}</Text>
              )}
            </View>
            {trip.pickupLocation?.coordinates && (
              <Ionicons name="open-outline" size={16} color="#ccc" />
            )}
          </TouchableOpacity>

          {/* Dropoff */}
          <TouchableOpacity
            style={[s.routeRow, { paddingTop: 0 }]}
            onPress={() =>
              trip.dropoffLocation?.coordinates &&
              openMaps(trip.dropoffLocation.coordinates)
            }
            disabled={!trip.dropoffLocation?.coordinates}
            activeOpacity={0.75}
          >
            <View style={s.routeLeft}>
              <View style={s.dotRed} />
            </View>
            <View style={s.routeAddrBlock}>
              <Text style={s.routeAddrLabel}>DESTINATION</Text>
              {loadingAddr ? (
                <ActivityIndicator
                  size="small"
                  color="#1A1A1A"
                  style={{ alignSelf: "flex-start" }}
                />
              ) : (
                <Text style={s.routeAddrText}>{addresses.dropoff}</Text>
              )}
            </View>
            {trip.dropoffLocation?.coordinates && (
              <Ionicons name="open-outline" size={16} color="#ccc" />
            )}
          </TouchableOpacity>
        </View>

        {/* ── FARE CARD ── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Fare</Text>

          <View style={s.fareCenterRow}>
            <Text style={s.fareBig}>₦{fareAmount.toLocaleString()}</Text>
            <View style={s.paymentChip}>
              <Ionicons
                name={
                  trip.paymentMethod === "cash"
                    ? "cash-outline"
                    : "wallet-outline"
                }
                size={13}
                color="#666"
              />
              <Text style={s.paymentChipText}>
                {trip.paymentMethod === "cash" ? "Cash" : "Wallet"}
              </Text>
            </View>
          </View>

          {/* Driver breakdown */}
          {role === "driver" && isCompleted && (
            <View style={s.breakdownSection}>
              <View style={s.breakdownRow}>
                <Text style={s.breakdownLabel}>Fare</Text>
                <Text style={s.breakdownValue}>
                  ₦{fareAmount.toLocaleString()}
                </Text>
              </View>
              {commission > 0 && (
                <View style={s.breakdownRow}>
                  <Text style={s.breakdownLabel}>Commission</Text>
                  <Text style={[s.breakdownValue, { color: "#EF4444" }]}>
                    -₦{commission.toLocaleString()}
                  </Text>
                </View>
              )}
              <View style={[s.breakdownRow, s.breakdownTotal]}>
                <Text style={s.breakdownTotalLabel}>Your Earnings</Text>
                <Text style={s.breakdownTotalValue}>
                  ₦{driverEarn.toLocaleString()}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* ── TRIP INFO CARD ── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Trip Info</Text>
          <InfoRow
            icon="calendar-outline"
            label="Requested"
            value={formatDate(trip.requestedAt)}
          />
          {trip.startedAt && (
            <InfoRow
              icon="play-outline"
              label="Started"
              value={formatDate(trip.startedAt)}
            />
          )}
          {trip.completedAt && (
            <InfoRow
              icon="checkmark-outline"
              label="Completed"
              value={formatDate(trip.completedAt)}
            />
          )}
          {trip.cancelledAt && (
            <InfoRow
              icon="close-outline"
              label="Cancelled"
              value={formatDate(trip.cancelledAt)}
            />
          )}
          <InfoRow icon="car-sport" label="Service" value={serviceName} />
          {trip.distanceKm > 0 && (
            <InfoRow
              icon="navigate-outline"
              label="Distance"
              value={`${trip.distanceKm.toFixed(1)} km`}
            />
          )}
          {trip.durationMinutes > 0 && (
            <InfoRow
              icon="time-outline"
              label="Duration"
              value={`${trip.durationMinutes} min`}
              isLast
            />
          )}
        </View>

        {/* ── CANCELLATION CARD ── */}
        {isCancelled && trip.cancellationReason && (
          <View style={[s.card, s.cancelCard]}>
            <View style={s.cancelCardHeader}>
              <View style={s.cancelIconWrap}>
                <Ionicons
                  name="alert-circle-outline"
                  size={18}
                  color="#EF4444"
                />
              </View>
              <Text style={s.cancelCardTitle}>Cancellation Reason</Text>
            </View>
            <Text style={s.cancelCardReason}>
              {trip.cancellationReason.replace(/_/g, " ")}
            </Text>
          </View>
        )}

        {/* ── CASH CONFIRMED CARD ── */}
        {isCompleted && trip.paymentMethod === "cash" && (
          <View style={[s.card, s.cashConfirmCard]}>
            <View style={s.cashConfirmRow}>
              <View style={s.cashConfirmIconWrap}>
                <Ionicons name="checkmark-circle" size={18} color="#10B981" />
              </View>
              <Text style={s.cashConfirmTitle}>Cash Payment Confirmed</Text>
            </View>
            {trip.cashReceivedAt && (
              <Text style={s.cashConfirmSub}>
                Received on {formatDate(trip.cashReceivedAt)}
              </Text>
            )}
            {trip.cashAmount && (
              <Text style={s.cashConfirmAmount}>
                ₦{trip.cashAmount.toLocaleString()}
              </Text>
            )}
          </View>
        )}

        {/* Trip ID */}
        <Text style={s.tripId}>Trip ID: {trip._id || trip.id}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Shared top bar ─────────────────────────────────────────────────────────
function TopBar({ navigation }) {
  return (
    <View style={s.topBar}>
      <TouchableOpacity
        style={s.topBarBtn}
        onPress={() => navigation.goBack()}
        activeOpacity={0.8}
      >
        <Ionicons name="arrow-back" size={20} color="#1A1A1A" />
      </TouchableOpacity>
      <Text style={s.topBarTitle}>Trip Details</Text>
      <View style={{ width: 44 }} />
    </View>
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
    marginBottom: 12,
    borderRadius: 22,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 7,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 14,
    marginBottom: 16,
  },
  statusBadgeText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.7 },
  fareHero: {
    fontSize: 36,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: -1,
    marginBottom: 6,
  },
  fareHeroSub: {
    fontSize: 12,
    color: "rgba(255,255,255,0.45)",
    textAlign: "center",
  },

  // ── Generic card ──
  card: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 20,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 5,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#aaa",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 14,
  },

  // ── Route ──
  routeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingBottom: 6,
  },
  routeLeft: { alignItems: "center", marginRight: 14, paddingTop: 3 },
  dotGreen: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#10B981",
  },
  routeLine: {
    width: 2,
    height: 28,
    backgroundColor: "#EBEBEB",
    marginVertical: 4,
  },
  dotRed: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#EF4444",
  },
  routeAddrBlock: { flex: 1, paddingBottom: 8 },
  routeAddrLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#aaa",
    letterSpacing: 0.7,
    marginBottom: 5,
  },
  routeAddrText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1A1A1A",
    lineHeight: 20,
  },

  // ── Fare ──
  fareCenterRow: { alignItems: "center", marginBottom: 4 },
  fareBig: {
    fontSize: 30,
    fontWeight: "900",
    color: "#1A1A1A",
    letterSpacing: -1,
    marginBottom: 8,
  },
  paymentChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F5F5F0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  paymentChipText: { fontSize: 12, fontWeight: "600", color: "#666" },
  breakdownSection: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#F5F5F0",
    paddingTop: 14,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F0",
  },
  breakdownLabel: { fontSize: 13, color: "#888" },
  breakdownValue: { fontSize: 13, fontWeight: "700", color: "#1A1A1A" },
  breakdownTotal: {
    borderBottomWidth: 0,
    borderTopWidth: 2,
    borderTopColor: "#EBEBEB",
    marginTop: 6,
    paddingTop: 14,
  },
  breakdownTotalLabel: { fontSize: 15, fontWeight: "800", color: "#1A1A1A" },
  breakdownTotalValue: {
    fontSize: 18,
    fontWeight: "900",
    color: "#10B981",
    letterSpacing: -0.5,
  },

  // ── Cancel card ──
  cancelCard: { borderWidth: 1.5, borderColor: "#FEE2E2" },
  cancelCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  cancelIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#FEF2F2",
    justifyContent: "center",
    alignItems: "center",
  },
  cancelCardTitle: { fontSize: 14, fontWeight: "800", color: "#EF4444" },
  cancelCardReason: {
    fontSize: 13,
    color: "#EF4444",
    opacity: 0.8,
    textTransform: "capitalize",
    lineHeight: 19,
  },

  // ── Cash confirm card ──
  cashConfirmCard: { borderWidth: 1.5, borderColor: "#D1FAE5" },
  cashConfirmRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  cashConfirmIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#ECFDF5",
    justifyContent: "center",
    alignItems: "center",
  },
  cashConfirmTitle: { fontSize: 14, fontWeight: "800", color: "#065F46" },
  cashConfirmSub: { fontSize: 12, color: "#059669", marginBottom: 4 },
  cashConfirmAmount: { fontSize: 17, fontWeight: "800", color: "#059669" },

  // ── Trip ID ──
  tripId: {
    fontSize: 11,
    color: "#ccc",
    textAlign: "center",
    marginTop: 4,
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
  },

  // ── Centered states ──
  centeredState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  centeredStateText: {
    fontSize: 14,
    color: "#aaa",
    fontWeight: "600",
    marginTop: 14,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 5,
  },
  backPill: {
    backgroundColor: "#1A1A1A",
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 24,
    marginTop: 20,
  },
  backPillText: { color: "#fff", fontWeight: "800", fontSize: 14 },
});
