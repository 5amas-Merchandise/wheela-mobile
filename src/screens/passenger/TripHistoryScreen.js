// src/screens/passenger/TripHistoryScreen.js
import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { getAuthToken } from "../../utils/auth";

import { BASE_URL as API_BASE_URL } from '../../config';
const GOOGLE_API_KEY = "AIzaSyAbOQwCqiWYfyKe-t1SmzUcfgNVFYaXTFo";
const LIMIT = 20;

const SERVICE_ICONS = {
  CITY_RIDE: "car-sport",
  OUTSTATION: "airplane-outline",
  RENTAL: "time-outline",
  LUXURY: "diamond",
  LUXURY_RENTAL: "diamond",
  BIKE: "bicycle",
  DELIVERY_BIKE: "bicycle",
  KEKE: "triangle",
};

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

const SERVICE_COLORS = {
  CITY_RIDE: "#1A1A1A",
  OUTSTATION: "#3B82F6",
  RENTAL: "#8B5CF6",
  LUXURY: "#7C3AED",
  LUXURY_RENTAL: "#7C3AED",
  BIKE: "#059669",
  DELIVERY_BIKE: "#059669",
  KEKE: "#D97706",
};

const SERVICE_BG = {
  CITY_RIDE: "#F5F5F0",
  OUTSTATION: "#EFF6FF",
  RENTAL: "#F5F3FF",
  LUXURY: "#F5F3FF",
  LUXURY_RENTAL: "#F5F3FF",
  BIKE: "#ECFDF5",
  DELIVERY_BIKE: "#ECFDF5",
  KEKE: "#FFFBEB",
};

const STATUS_CONFIG = {
  completed: { color: "#10B981", bg: "#ECFDF5", label: "COMPLETED" },
  cancelled: { color: "#EF4444", bg: "#FEF2F2", label: "CANCELLED" },
  active: { color: "#3B82F6", bg: "#EFF6FF", label: "ACTIVE" },
  pending: { color: "#8B5CF6", bg: "#F5F3FF", label: "PENDING" },
};

const formatDate = (dateString) => {
  if (!dateString) return "";
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatTime = (dateString) => {
  if (!dateString) return "";
  return new Date(dateString).toLocaleTimeString("en-US", {
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
    if (data.status === "OK" && data.results[0]) {
      const addr = data.results[0].formatted_address;
      if (addr.includes("Lagos")) {
        for (const c of data.results[0].address_components) {
          if (
            c.types.includes("neighborhood") ||
            c.types.includes("sublocality") ||
            c.types.includes("locality")
          )
            return `${c.long_name}, Lagos`;
        }
      }
      return addr.length > 40 ? addr.substring(0, 40) + "…" : addr;
    }
    const [l, a] = coordinates;
    return `${a.toFixed(4)}, ${l.toFixed(4)}`;
  } catch {
    const [lng, lat] = coordinates;
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
};

export default function TripHistoryScreen({ route }) {
  const navigation = useNavigation();
  const role = route?.params?.role || "passenger";

  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchTripHistory = async (isRefresh = false, loadMore = false) => {
    try {
      const currentOffset = loadMore ? offset : 0;
      if (loadMore) setLoadingMore(true);
      else if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const token = await getAuthToken();
      if (!token) throw new Error("Not authenticated. Please login again.");

      const res = await fetch(
        `${API_BASE_URL}/trips?role=${role}&limit=${LIMIT}&offset=${currentOffset}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );
      if (!res.ok) throw new Error("Failed to fetch trip history");
      const data = await res.json();

      const processed = await Promise.all(
        (data.trips || []).map(async (trip) => {
          let pickupAddress =
            trip.pickupAddress || trip.pickupLocationName || "";
          let dropoffAddress =
            trip.dropoffAddress || trip.dropoffLocationName || "";
          if (!pickupAddress && trip.pickupLocation?.coordinates)
            pickupAddress = await getAddressFromCoordinates(
              trip.pickupLocation.coordinates,
            );
          if (!dropoffAddress && trip.dropoffLocation?.coordinates)
            dropoffAddress = await getAddressFromCoordinates(
              trip.dropoffLocation.coordinates,
            );
          return {
            ...trip,
            pickupDisplayAddress: pickupAddress || "Pickup Location",
            dropoffDisplayAddress: dropoffAddress || "Destination",
          };
        }),
      );

      if (loadMore) {
        setTrips((prev) => [...prev, ...processed]);
        setOffset(currentOffset + LIMIT);
      } else {
        setTrips(processed);
        setOffset(LIMIT);
      }

      const completed = processed.filter((t) => t.status === "completed");
      const totalSpent = completed.reduce(
        (s, t) => s + (t.finalFare || t.estimatedFare || 0),
        0,
      );
      setStats({
        totalTrips: processed.length,
        completedTrips: completed.length,
        totalSpent,
      });
      setHasMore(processed.length === LIMIT);
    } catch (err) {
      setError(err.message);
      if (err.message.includes("Not authenticated"))
        Alert.alert("Session Expired", "Please log in again.", [
          { text: "OK", onPress: () => navigation.navigate("Login") },
        ]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchTripHistory();
  }, [role]);
  const onRefresh = useCallback(() => fetchTripHistory(true), [role]);
  const loadMoreTrips = () => {
    if (!loadingMore && hasMore && trips.length > 0)
      fetchTripHistory(false, true);
  };

  const viewTripDetails = (trip) => {
    navigation.navigate("TripDetails", {
      trip: {
        ...trip,
        id: trip._id,
        fareAmount: trip.finalFare || trip.estimatedFare || 0,
        pickupAddress: trip.pickupDisplayAddress,
        dropoffAddress: trip.dropoffDisplayAddress,
        completedAt: trip.completedAt || trip.requestedAt,
      },
      role,
    });
  };

  const renderTripItem = ({ item }) => {
    const isCancelled = item.status === "cancelled";
    const isCompleted = item.status === "completed";
    const displayDate =
      item.completedAt || item.cancelledAt || item.requestedAt;
    const serviceIcon = SERVICE_ICONS[item.serviceType] || "car-sport";
    const serviceName = SERVICE_NAMES[item.serviceType] || item.serviceType;
    const serviceColor = SERVICE_COLORS[item.serviceType] || "#1A1A1A";
    const serviceBg = SERVICE_BG[item.serviceType] || "#F5F5F0";
    const fareAmount = item.finalFare || item.estimatedFare || 0;
    const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;

    return (
      <TouchableOpacity
        style={[s.tripCard, isCancelled && s.tripCardCancelled]}
        onPress={() => viewTripDetails(item)}
        activeOpacity={0.85}
      >
        {/* Top row: date + status */}
        <View style={s.tripCardTop}>
          <View style={s.tripDateRow}>
            <Text style={s.tripDate}>{formatDate(displayDate)}</Text>
            <Text style={s.tripTime}>{formatTime(displayDate)}</Text>
          </View>
          <View style={[s.statusPill, { backgroundColor: statusCfg.bg }]}>
            <Text style={[s.statusPillText, { color: statusCfg.color }]}>
              {statusCfg.label}
            </Text>
          </View>
        </View>

        {/* Route */}
        <View style={s.routeBlock}>
          <View style={s.routeLeft}>
            <View style={s.dotGreen} />
            <View style={s.routeLine} />
            <View style={s.dotRed} />
          </View>
          <View style={s.routeAddresses}>
            <Text style={s.pickupText} numberOfLines={1}>
              {item.pickupDisplayAddress}
            </Text>
            <View style={{ flex: 1 }} />
            <Text style={s.dropoffText} numberOfLines={1}>
              {item.dropoffDisplayAddress}
            </Text>
          </View>
          {/* Service icon */}
          <View style={[s.serviceIconWrap, { backgroundColor: serviceBg }]}>
            <Ionicons name={serviceIcon} size={22} color={serviceColor} />
          </View>
        </View>

        {/* Footer row: type · distance · fare */}
        <View style={s.tripFooter}>
          <View style={s.tripChip}>
            <Text style={s.tripChipText}>{serviceName}</Text>
          </View>
          {item.distanceKm > 0 && (
            <>
              <View style={s.tripChipDivider} />
              <View style={s.tripChip}>
                <Ionicons name="navigate-outline" size={11} color="#888" />
                <Text style={s.tripChipText}>
                  {item.distanceKm.toFixed(1)} km
                </Text>
              </View>
            </>
          )}
          <View style={{ flex: 1 }} />
          <Text style={[s.fareText, isCancelled && s.fareTextCancelled]}>
            {isCancelled ? "Cancelled" : `₦${fareAmount.toLocaleString()}`}
          </Text>
        </View>

        {/* Cancellation reason */}
        {isCancelled && item.cancellationReason && (
          <View style={s.cancelBanner}>
            <Ionicons
              name="information-circle-outline"
              size={14}
              color="#EF4444"
            />
            <Text style={s.cancelBannerText}>
              {item.cancellationReason.replace(/_/g, " ")}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading && !refreshing) {
    return (
      <SafeAreaView style={s.container}>
        <TopBar navigation={navigation} role={role} />
        <View style={s.centeredState}>
          <ActivityIndicator size="large" color="#1A1A1A" />
          <Text style={s.centeredStateText}>Loading trips…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error && trips.length === 0) {
    return (
      <SafeAreaView style={s.container}>
        <TopBar navigation={navigation} role={role} />
        <View style={s.centeredState}>
          <View style={s.emptyIconWrap}>
            <Ionicons name="alert-circle-outline" size={36} color="#EF4444" />
          </View>
          <Text style={[s.centeredStateText, { color: "#EF4444" }]}>
            {error}
          </Text>
          <TouchableOpacity
            style={s.retryBtn}
            onPress={() => fetchTripHistory()}
            activeOpacity={0.88}
          >
            <Text style={s.retryBtnText}>Try Again</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <TopBar navigation={navigation} role={role} />

      {/* ── STATS BAR ── */}
      {stats && trips.length > 0 && (
        <View style={s.statsBar}>
          <StatItem value={stats.totalTrips} label="Total" />
          <View style={s.statsDivider} />
          <StatItem value={stats.completedTrips} label="Done" />
          <View style={s.statsDivider} />
          <StatItem
            value={`₦${stats.totalSpent.toLocaleString()}`}
            label="Spent"
          />
        </View>
      )}

      {/* ── LIST ── */}
      <FlatList
        data={trips}
        keyExtractor={(item) => item._id || item.id}
        renderItem={renderTripItem}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#1A1A1A"
            colors={["#1A1A1A"]}
          />
        }
        onEndReached={loadMoreTrips}
        onEndReachedThreshold={0.5}
        ListFooterComponent={() =>
          loadingMore ? (
            <View style={s.loadingMoreRow}>
              <ActivityIndicator size="small" color="#1A1A1A" />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={s.emptyState}>
            <View style={s.emptyIconWrap}>
              <Ionicons name="car-sport" size={36} color="#1A1A1A" />
            </View>
            <Text style={s.emptyTitle}>No trips yet</Text>
            <Text style={s.emptySub}>Your ride history will appear here</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────
function TopBar({ navigation, role }) {
  return (
    <View style={s.topBar}>
      <TouchableOpacity
        style={s.topBarBtn}
        onPress={() => navigation.goBack()}
        activeOpacity={0.8}
      >
        <Ionicons name="arrow-back" size={20} color="#1A1A1A" />
      </TouchableOpacity>
      <Text style={s.topBarTitle}>
        {role === "driver" ? "Driver History" : "Ride History"}
      </Text>
      <View style={{ width: 44 }} />
    </View>
  );
}

function StatItem({ value, label }) {
  return (
    <View style={s.statItem}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
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

  // ── Stats bar ──
  statsBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1A1A",
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 18,
    paddingVertical: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  statItem: { flex: 1, alignItems: "center" },
  statValue: {
    fontSize: 17,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.3,
    marginBottom: 3,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255,255,255,0.45)",
    letterSpacing: 0.5,
  },
  statsDivider: {
    width: 1,
    height: 28,
    backgroundColor: "rgba(255,255,255,0.12)",
  },

  // ── List ──
  listContent: { paddingHorizontal: 16, paddingBottom: 40 },

  // ── Trip card ──
  tripCard: {
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
  tripCardCancelled: {
    opacity: 0.75,
    borderWidth: 1.5,
    borderColor: "#FEE2E2",
  },

  tripCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  tripDateRow: {},
  tripDate: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 2,
  },
  tripTime: { fontSize: 12, color: "#aaa", fontWeight: "500" },

  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusPillText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.6 },

  // Route block
  routeBlock: { flexDirection: "row", alignItems: "stretch", marginBottom: 14 },
  routeLeft: { alignItems: "center", marginRight: 12, paddingVertical: 2 },
  dotGreen: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: "#10B981",
  },
  routeLine: {
    flex: 1,
    width: 2,
    backgroundColor: "#EBEBEB",
    marginVertical: 4,
    minHeight: 22,
  },
  dotRed: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: "#EF4444",
  },
  routeAddresses: { flex: 1, justifyContent: "space-between", minHeight: 50 },
  pickupText: { fontSize: 14, fontWeight: "700", color: "#1A1A1A" },
  dropoffText: { fontSize: 13, fontWeight: "600", color: "#888" },

  serviceIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 12,
  },

  // Footer row
  tripFooter: { flexDirection: "row", alignItems: "center" },
  tripChip: { flexDirection: "row", alignItems: "center", gap: 4 },
  tripChipText: { fontSize: 12, fontWeight: "600", color: "#888" },
  tripChipDivider: {
    width: 1,
    height: 12,
    backgroundColor: "#E0E0E0",
    marginHorizontal: 8,
  },
  fareText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1A1A1A",
    letterSpacing: -0.3,
  },
  fareTextCancelled: { color: "#EF4444", fontWeight: "700", fontSize: 14 },

  // Cancel banner
  cancelBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 10,
  },
  cancelBannerText: {
    fontSize: 12,
    color: "#EF4444",
    textTransform: "capitalize",
    fontWeight: "500",
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
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 5,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#1A1A1A",
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 24,
    marginTop: 20,
  },
  retryBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },

  // ── Empty state ──
  emptyState: { alignItems: "center", paddingTop: 60, paddingHorizontal: 40 },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1A1A1A",
    marginBottom: 6,
  },
  emptySub: { fontSize: 13, color: "#aaa", textAlign: "center" },

  // ── Load more ──
  loadingMoreRow: { paddingVertical: 20, alignItems: "center" },
});
