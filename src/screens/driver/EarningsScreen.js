// src/screens/shared/TripHistoryScreen.js
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Platform,
  StatusBar,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { getAuthToken, removeAuthToken } from "../../utils/auth";

import { BASE_URL } from '../../config';
import { fetchWithTimeout, FETCH_TIMEOUT_MS } from '../../utils/fetchWithTimeout';

// ── Helpers ───────────────────────────────────────────────────────────────────
const SERVICE_LABELS = {
  CITY_RIDE: "City Ride",
  DELIVERY_BIKE: "Bike",
  KEKE: "Keke",
  LUXURY_RENTAL: "Luxury",
  INTERSTATE: "Interstate",
  TRUCK: "Truck",
};

const STATUS_META = {
  completed: {
    label: "Completed",
    color: "#22C55E",
    bg: "rgba(34,197,94,0.12)",
  },
  cancelled: {
    label: "Cancelled",
    color: "#EF4444",
    bg: "rgba(239,68,68,0.12)",
  },
  assigned: {
    label: "Assigned",
    color: "#F59E0B",
    bg: "rgba(245,158,11,0.12)",
  },
  started: { label: "Started", color: "#3B82F6", bg: "rgba(59,130,246,0.12)" },
  default: { label: "Unknown", color: "#888", bg: "rgba(136,136,136,0.1)" },
};

const PAYMENT_META = {
  wallet: { icon: "wallet-outline", color: "#22C55E", label: "Wallet" },
  cash: { icon: "cash-outline", color: "#888", label: "Cash" },
};

function getStatusMeta(status) {
  return STATUS_META[status] || STATUS_META.default;
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-NG", {
      weekday: "short",
      day: "numeric",
      month: "short",
    }) +
    " · " +
    d.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })
  );
}

function getFare(item) {
  const raw = item.fareInNaira ?? item.finalFare ?? item.estimatedFare ?? 0;
  return Number(raw).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ── Trip card ─────────────────────────────────────────────────────────────────
function TripCard({ item, role }) {
  const sm = getStatusMeta(item.status);
  const pm = PAYMENT_META[item.paymentMethod] || PAYMENT_META.cash;
  const pickup =
    item.pickupAddress ||
    item.pickup?.address ||
    item.pickupLocation?.address ||
    "Pickup";
  const dropoff =
    item.dropoffAddress ||
    item.dropoff?.address ||
    item.dropoffLocation?.address ||
    "Destination";
  const service =
    SERVICE_LABELS[item.serviceType] ||
    item.serviceType?.replace(/_/g, " ") ||
    "Ride";

  return (
    <View style={c.tripCard}>
      {/* Top row */}
      <View style={c.tripTop}>
        <View style={{ flex: 1 }}>
          <Text style={c.tripDate}>
            {formatDate(
              item.completedAt || item.cancelledAt || item.requestedAt,
            )}
          </Text>
          <View style={[c.statusPill, { backgroundColor: sm.bg }]}>
            <View style={[c.statusDot, { backgroundColor: sm.color }]} />
            <Text style={[c.statusPillText, { color: sm.color }]}>
              {sm.label}
            </Text>
          </View>
        </View>
        <View style={c.fareCol}>
          <Text style={c.fareAmount}>₦{getFare(item)}</Text>
          <View style={c.paymentRow}>
            <Ionicons name={pm.icon} size={11} color={pm.color} />
            <Text style={[c.paymentLabel, { color: pm.color }]}>
              {pm.label}
            </Text>
          </View>
        </View>
      </View>

      {/* Route */}
      <View style={c.route}>
        <View style={c.routeTrack}>
          <View style={c.routeDotGreen} />
          <View style={c.routeLine} />
          <View style={c.routeDotRed} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={c.routeText} numberOfLines={1}>
            {pickup}
          </Text>
          <View style={{ height: 14 }} />
          <Text style={c.routeText} numberOfLines={1}>
            {dropoff}
          </Text>
        </View>
      </View>

      {/* Footer chips */}
      <View style={c.tripFooter}>
        <View style={c.chip}>
          <Ionicons name="car-outline" size={12} color="#555" />
          <Text style={c.chipText}>{service}</Text>
        </View>
        {item.distanceKm != null && (
          <View style={c.chip}>
            <Ionicons name="navigate-outline" size={12} color="#555" />
            <Text style={c.chipText}>{item.distanceKm} km</Text>
          </View>
        )}
        {item.durationMinutes != null && (
          <View style={c.chip}>
            <Ionicons name="time-outline" size={12} color="#555" />
            <Text style={c.chipText}>{item.durationMinutes} min</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function TripHistoryScreen() {
  const navigation = useNavigation();

  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [role, setRole] = useState("driver");
  const [fetchError, setFetchError] = useState(null);
  const [stats, setStats] = useState({
    totalTrips: 0,
    completedTrips: 0,
    cancelledTrips: 0,
    totalValue: 0,
  });

  const fetchingRef = useRef(false);

  const fetchHistory = useCallback(
    async (showLoader = true) => {
      if (fetchingRef.current) return;
      fetchingRef.current = true;
      if (showLoader) setLoading(true);
      setFetchError(null);

      try {
        const token = await getAuthToken();
        if (!token) {
          await removeAuthToken();
          navigation.replace("Login");
          return;
        }

        const headers = {
          Authorization: `Bearer ${token}`,
          "Cache-Control": "no-cache",
        };

        // Primary endpoint
        const res = await fetchWithTimeout(
          `${BASE_URL}/trips/history?role=${role}&limit=50&status=all`,
          { headers },
        );

        if (res.status === 401 || res.status === 403) {
          await removeAuthToken();
          Alert.alert("Session Expired", "Please log in again.", [
            { text: "Log In", onPress: () => navigation.replace("Login") },
          ]);
          return;
        }

        let data;
        try {
          data = await res.json();
        } catch {
          throw new Error("SERVER");
        }

        if (res.ok && data.success) {
          const list = data.trips || [];
          setTrips(list);
          setStats({
            totalTrips: data.stats?.totalTrips ?? list.length,
            completedTrips:
              data.stats?.completedTrips ??
              list.filter((t) => t.status === "completed").length,
            cancelledTrips:
              data.stats?.cancelledTrips ??
              list.filter((t) => t.status === "cancelled").length,
            totalValue:
              data.stats?.totalSpent ??
              list
                .filter((t) => t.status === "completed")
                .reduce(
                  (s, t) =>
                    s + (t.fareInNaira || t.finalFare || t.estimatedFare || 0),
                  0,
                ),
          });
          return;
        }

        // Fallback endpoint
        const fallbackRes = await fetchWithTimeout(
          `${BASE_URL}/trips?role=${role}&limit=50`,
          { headers },
        );

        if (fallbackRes.ok) {
          const fb = await fallbackRes.json();
          const list = (fb.trips || []).filter((t) =>
            ["completed", "cancelled"].includes(t.status),
          );
          setTrips(list);
          setStats({
            totalTrips: list.length,
            completedTrips: list.filter((t) => t.status === "completed").length,
            cancelledTrips: list.filter((t) => t.status === "cancelled").length,
            totalValue: list
              .filter((t) => t.status === "completed")
              .reduce(
                (s, t) =>
                  s + (t.fareInNaira || t.finalFare || t.estimatedFare || 0),
                0,
              ),
          });
          return;
        }

        setFetchError("SERVER");
      } catch (err) {
        console.error("fetchHistory:", err.message);
        if (err.message === "TIMEOUT") setFetchError("TIMEOUT");
        else setFetchError("NETWORK");
      } finally {
        setLoading(false);
        setRefreshing(false);
        fetchingRef.current = false;
      }
    },
    [role],
  );

  useEffect(() => {
    fetchHistory(true);
  }, [role]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchHistory(false);
  };

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={c.loadingScreen}>
        <StatusBar barStyle="light-content" backgroundColor="#0D0D0D" />
        <ActivityIndicator size="large" color="#1A6BFF" />
        <Text style={c.loadingText}>Loading trip history...</Text>
      </View>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────────
  if (fetchError) {
    const errConfig = {
      TIMEOUT: {
        icon: "time-outline",
        title: "Request Timed Out",
        body: "Server took too long. Try again.",
      },
      NETWORK: {
        icon: "wifi-outline",
        title: "No Connection",
        body: "Check your internet and try again.",
      },
      SERVER: {
        icon: "server-outline",
        title: "Server Error",
        body: "Something went wrong. Try again later.",
      },
    };
    const ec = errConfig[fetchError] || errConfig.SERVER;

    return (
      <View style={c.loadingScreen}>
        <StatusBar barStyle="light-content" backgroundColor="#0D0D0D" />
        <View style={c.errorIconWrap}>
          <Ionicons name={ec.icon} size={44} color="#333" />
        </View>
        <Text style={c.errorTitle}>{ec.title}</Text>
        <Text style={c.errorBody}>{ec.body}</Text>
        <TouchableOpacity
          style={c.errorRetryBtn}
          onPress={() => fetchHistory(true)}
          activeOpacity={0.85}
        >
          <Ionicons
            name="refresh-outline"
            size={18}
            color="#fff"
            style={{ marginRight: 8 }}
          />
          <Text style={c.errorRetryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isDriver = role === "driver";

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: "#0D0D0D" }}>
      <StatusBar barStyle="light-content" backgroundColor="#0D0D0D" />

      {/* ── Sticky header ── */}
      <View style={c.header}>
        <TouchableOpacity
          style={c.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>

        <Text style={c.headerTitle}>Trip History</Text>

        {/* Role toggle */}
        <TouchableOpacity
          style={c.roleToggle}
          onPress={() =>
            setRole((r) => (r === "driver" ? "passenger" : "driver"))
          }
          activeOpacity={0.75}
        >
          <Ionicons
            name={isDriver ? "car-sport-outline" : "person-outline"}
            size={14}
            color="#1A6BFF"
          />
          <Text style={c.roleToggleText}>
            {isDriver ? "Driver" : "Passenger"}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#1A6BFF"
            colors={["#1A6BFF"]}
          />
        }
      >
        {/* ── Stats grid ── */}
        <View style={c.statsGrid}>
          <StatCard
            icon="document-text-outline"
            iconColor="#1A6BFF"
            value={stats.totalTrips}
            label="Total"
            accent="#1A6BFF"
          />
          <StatCard
            icon="checkmark-circle-outline"
            iconColor="#22C55E"
            value={stats.completedTrips}
            label="Completed"
            accent="#22C55E"
          />
          <StatCard
            icon="close-circle-outline"
            iconColor="#EF4444"
            value={stats.cancelledTrips}
            label="Cancelled"
            accent="#EF4444"
          />
          <StatCard
            icon={isDriver ? "cash-outline" : "card-outline"}
            iconColor="#F59E0B"
            value={`₦${Number(stats.totalValue).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`}
            label={isDriver ? "Earned" : "Spent"}
            accent="#F59E0B"
          />
        </View>

        {/* ── Section header ── */}
        <View style={c.sectionHeader}>
          <Text style={c.sectionTitle}>Recent Trips</Text>
          <Text style={c.sectionCount}>
            {trips.length} {trips.length === 1 ? "trip" : "trips"}
          </Text>
        </View>

        {/* ── List ── */}
        {trips.length === 0 ? (
          <View style={c.emptyState}>
            <View style={c.emptyIconWrap}>
              <Ionicons name="car-outline" size={40} color="#333" />
            </View>
            <Text style={c.emptyTitle}>No Trips Yet</Text>
            <Text style={c.emptyBody}>
              {isDriver
                ? "Accept rides to see your history here."
                : "Book your first ride to see your history here."}
            </Text>
            <TouchableOpacity
              style={c.emptyRefreshBtn}
              onPress={onRefresh}
              activeOpacity={0.8}
            >
              <Ionicons
                name="refresh-outline"
                size={16}
                color="#fff"
                style={{ marginRight: 6 }}
              />
              <Text style={c.emptyRefreshText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={trips}
            keyExtractor={(item) =>
              item._id || item.id || Math.random().toString()
            }
            renderItem={({ item }) => <TripCard item={item} role={role} />}
            scrollEnabled={false}
            contentContainerStyle={{ paddingHorizontal: 16 }}
          />
        )}

        <Text style={c.viewingNote}>Viewing as {role}</Text>
      </ScrollView>
    </View>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ icon, iconColor, value, label, accent }) {
  return (
    <View style={[c.statCard, { borderTopColor: accent }]}>
      <View style={[c.statIconWrap, { backgroundColor: `${accent}15` }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <Text style={c.statValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={c.statLabel}>{label}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const c = StyleSheet.create({
  // Loading / error screens
  loadingScreen: {
    flex: 1,
    backgroundColor: "#0D0D0D",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  loadingText: {
    color: "#555",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 16,
  },
  errorIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#1A1A1A",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 8,
    textAlign: "center",
  },
  errorBody: {
    fontSize: 13,
    color: "#555",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 28,
  },
  errorRetryBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A6BFF",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  errorRetryText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#141414",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 58 : 44,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1E1E1E",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#fff" },
  roleToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(26,107,255,0.1)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "rgba(26,107,255,0.2)",
  },
  roleToggleText: { color: "#1A6BFF", fontSize: 13, fontWeight: "700" },

  // Stats
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },
  statCard: {
    width: "47.5%",
    backgroundColor: "#141414",
    borderRadius: 16,
    padding: 16,
    alignItems: "flex-start",
    borderTopWidth: 3,
    borderWidth: 1,
    borderColor: "#1E1E1E",
  },
  statIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "900",
    color: "#fff",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#555",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },

  // Section header
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  sectionTitle: { fontSize: 17, fontWeight: "800", color: "#fff" },
  sectionCount: { fontSize: 12, fontWeight: "600", color: "#555" },

  // Trip card
  tripCard: {
    backgroundColor: "#141414",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#1E1E1E",
  },
  tripTop: { flexDirection: "row", alignItems: "flex-start", marginBottom: 14 },
  tripDate: { fontSize: 11, color: "#555", fontWeight: "600", marginBottom: 6 },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusPillText: { fontSize: 11, fontWeight: "700" },
  fareCol: { alignItems: "flex-end" },
  fareAmount: {
    fontSize: 20,
    fontWeight: "900",
    color: "#fff",
    marginBottom: 4,
  },
  paymentRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  paymentLabel: { fontSize: 10, fontWeight: "700" },

  // Route
  route: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: "#0D0D0D",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 10,
  },
  routeTrack: {
    width: 16,
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  routeDotGreen: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#22C55E",
  },
  routeLine: { flex: 1, width: 2, backgroundColor: "#222", marginVertical: 3 },
  routeDotRed: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#EF4444",
  },
  routeText: { fontSize: 13, fontWeight: "600", color: "#ccc", lineHeight: 20 },

  // Footer chips
  tripFooter: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#1A1A1A",
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "#222",
  },
  chipText: { fontSize: 11, color: "#666", fontWeight: "600" },

  // Empty
  emptyState: {
    alignItems: "center",
    paddingVertical: 56,
    paddingHorizontal: 32,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#1A1A1A",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 8,
  },
  emptyBody: {
    fontSize: 13,
    color: "#555",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyRefreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  emptyRefreshText: { color: "#fff", fontSize: 14, fontWeight: "700" },

  viewingNote: {
    textAlign: "center",
    fontSize: 11,
    color: "#333",
    marginTop: 20,
    fontWeight: "500",
  },
});
