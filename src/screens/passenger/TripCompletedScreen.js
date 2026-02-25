// src/screens/passenger/TripCompletedScreen.js
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  SafeAreaView,
  StatusBar,
  Platform,
  Dimensions,
  Animated,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { getAuthToken } from "../../utils/auth";

const { width } = Dimensions.get("window");
const baseUrl = "https://wheels-backend-7ydc.onrender.com";

const SERVICE_LABELS = {
  CITY_RIDE: "City Ride",
  DELIVERY_BIKE: "Bike",
  LUXURY_RENTAL: "Luxury",
  KEKE: "Keke",
};

export default function TripCompletedScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  const {
    tripId,
    driverId,
    driverName = "Driver",
    driverRating = "4.8",
    vehicleModel = "Car",
    vehiclePlate = "—",
    fare = 0,
    serviceType = "CITY_RIDE",
    paymentMethod = "cash",
    tripDuration = 0,
    pickupAddress = "",
    destinationAddress = "",
    distanceKm = 0,
  } = route.params || {};

  const [tripDetails, setTripDetails] = useState(null);
  const [driverDetails, setDriverDetails] = useState({
    name: driverName,
    rating: driverRating,
    vehicleModel,
    vehiclePlate,
    profilePicUrl: null,
  });
  const [referralBonus, setReferralBonus] = useState(null);

  // Animations
  const checkAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;
  const bonusAnim = useRef(new Animated.Value(0)).current;
  const checkScale = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    // Staggered entrance: checkmark first, then content
    Animated.sequence([
      Animated.parallel([
        Animated.spring(checkScale, {
          toValue: 1,
          tension: 60,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(checkAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(contentAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start();

    fetchTripDetails();
    fetchDriverDetails();
    checkReferralReward();
  }, []);

  useEffect(() => {
    if (referralBonus) {
      Animated.spring(bonusAnim, {
        toValue: 1,
        tension: 55,
        friction: 8,
        useNativeDriver: true,
      }).start();
    }
  }, [referralBonus]);

  const fetchTripDetails = async () => {
    try {
      const token = await getAuthToken();
      if (!token || !tripId) return;
      const res = await fetch(`${baseUrl}/trips/${tripId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTripDetails(data.trip);
      }
    } catch (e) {
      console.error("fetchTripDetails error:", e);
    }
  };

  const fetchDriverDetails = async () => {
    try {
      const token = await getAuthToken();
      if (!token || !driverId) return;
      const res = await fetch(`${baseUrl}/users/${driverId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setDriverDetails({
            name: data.user.name || driverName,
            rating: data.user.driverProfile?.rating || driverRating,
            vehicleModel: data.user.driverProfile?.vehicleModel || vehicleModel,
            vehiclePlate:
              data.user.driverProfile?.vehicleNumber || vehiclePlate,
            profilePicUrl: data.user.driverProfile?.profilePicUrl || null,
          });
        }
      }
    } catch (e) {
      console.warn("fetchDriverDetails error:", e);
    }
  };

  // FIX: checkReferralReward – only show if user has a completed referral
  const checkReferralReward = async () => {
    try {
      const token = await getAuthToken();
      if (!token) return;

      const meRes = await fetch(`${baseUrl}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!meRes.ok) return;
      const { user } = await meRes.json();

      // ✅ Only show bonus if user BOTH used a referral code AND this is their first trip
      if (!user?.usedReferralCode || !user?.hasCompletedFirstTrip) return;

      // ✅ Check that the referral event actually fired — look for a completed referral
      const refRes = await fetch(`${baseUrl}/referrals/history?limit=5`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!refRes.ok) return;

      const refData = await refRes.json();
      // Find a referral for THIS user as referee that is completed (not pending)
      const completedReferral = refData.referrals?.find(
        (r) =>
          r.refereeId === user._id &&
          (r.status === "completed" || r.status === "rewarded"),
      );

      if (!completedReferral) return; // ✅ No bonus to show

      setReferralBonus({
        amount: completedReferral.bonusAmount || 300,
        referrerName: completedReferral.referrer?.name || null,
      });
    } catch (e) {
      console.warn("checkReferralReward (non-fatal):", e);
    }
  };

  const formatTime = (s) => {
    if (!s) return "0 min";
    const h = Math.floor(s / 3600),
      m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m} min`;
  };

  const formatDate = (str) => {
    const d = str ? new Date(str) : new Date();
    return d.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const formatHour = (str) => {
    const d = str ? new Date(str) : new Date();
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const contentTranslate = contentAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [24, 0],
  });

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAFAFA" />

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Success hero ── */}
        <View style={s.hero}>
          <Animated.View
            style={[
              s.checkCircle,
              { transform: [{ scale: checkScale }], opacity: checkAnim },
            ]}
          >
            <View style={s.checkCircleInner}>
              <Ionicons name="checkmark" size={52} color="#fff" />
            </View>
            {/* Outer ring */}
            <Animated.View
              style={[
                s.checkRing,
                {
                  opacity: checkAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 0.25],
                  }),
                },
              ]}
            />
          </Animated.View>

          <Animated.View
            style={{
              opacity: contentAnim,
              transform: [{ translateY: contentTranslate }],
            }}
          >
            <Text style={s.heroTitle}>Trip completed!</Text>
            <Text style={s.heroDate}>
              {formatDate(tripDetails?.completedAt)}
            </Text>
            <Text style={s.heroTime}>
              at {formatHour(tripDetails?.completedAt)}
            </Text>
          </Animated.View>
        </View>

        <Animated.View
          style={{
            opacity: contentAnim,
            transform: [{ translateY: contentTranslate }],
          }}
        >
          {/* ── Referral bonus banner ── */}
          {referralBonus && (
            <Animated.View
              style={[
                s.bonusBanner,
                {
                  opacity: bonusAnim,
                  transform: [
                    {
                      scale: bonusAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.94, 1],
                      }),
                    },
                    {
                      translateY: bonusAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [16, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              {/* Decorative circles */}
              <View style={s.bannerDecorA} />
              <View style={s.bannerDecorB} />

              <View style={s.bonusContent}>
                <View style={s.bonusGiftWrap}>
                  <Text style={s.bonusGiftEmoji}>🎁</Text>
                </View>
                <View style={s.bonusTextWrap}>
                  <Text style={s.bonusTitle}>Referral Bonus!</Text>
                  <Text style={s.bonusSub}>
                    ₦{referralBonus.amount} added to your wallet
                  </Text>
                  {referralBonus.referrerName && (
                    <Text style={s.bonusNote}>
                      Your friend gets rewarded too 🙌
                    </Text>
                  )}
                </View>
                <View style={s.bonusAmountWrap}>
                  <Text style={s.bonusAmountLabel}>+₦</Text>
                  <Text style={s.bonusAmountValue}>{referralBonus.amount}</Text>
                </View>
              </View>
            </Animated.View>
          )}

          {/* ── Fare hero card ── */}
          <View style={s.fareCard}>
            <Text style={s.fareCardLabel}>TRIP FARE</Text>
            <Text style={s.fareCardValue}>
              ₦{Number(fare).toLocaleString()}
            </Text>
            <View style={s.fareCardMeta}>
              <View style={s.fareMetaChip}>
                <Ionicons
                  name={
                    paymentMethod === "cash" ? "cash-outline" : "wallet-outline"
                  }
                  size={14}
                  color="#666"
                />
                <Text style={s.fareMetaText}>
                  {paymentMethod === "cash" ? "Cash" : "Wallet"}
                </Text>
              </View>
              <View style={s.fareMetaChip}>
                <Ionicons name="car-outline" size={14} color="#666" />
                <Text style={s.fareMetaText}>
                  {SERVICE_LABELS[serviceType] || serviceType}
                </Text>
              </View>
            </View>
          </View>

          {/* ── Stats row ── */}
          <View style={s.statsRow}>
            <View style={s.statCard}>
              <View style={s.statIcon}>
                <Ionicons name="time-outline" size={20} color="#1A1A1A" />
              </View>
              <Text style={s.statValue}>{formatTime(tripDuration)}</Text>
              <Text style={s.statLabel}>Duration</Text>
            </View>
            <View style={s.statCard}>
              <View style={s.statIcon}>
                <Ionicons name="navigate-outline" size={20} color="#1A1A1A" />
              </View>
              <Text style={s.statValue}>{distanceKm || 0} km</Text>
              <Text style={s.statLabel}>Distance</Text>
            </View>
            <View style={s.statCard}>
              <View style={s.statIcon}>
                <Ionicons name="star-outline" size={20} color="#1A1A1A" />
              </View>
              <Text style={s.statValue}>{driverDetails.rating}</Text>
              <Text style={s.statLabel}>Rating</Text>
            </View>
          </View>

          {/* ── Route card ── */}
          {(pickupAddress || destinationAddress) && (
            <View style={s.card}>
              <Text style={s.cardTitle}>Route</Text>
              <View style={s.routeRow}>
                <View style={s.routeTrack}>
                  <View style={[s.routeDot, { backgroundColor: "#1A1A1A" }]} />
                  <View style={s.routeLine} />
                  <View style={[s.routeDot, { backgroundColor: "#EF4444" }]} />
                </View>
                <View style={s.routeAddresses}>
                  <View style={s.addrBlock}>
                    <Text style={s.addrLabel}>PICKUP</Text>
                    <Text style={s.addrText} numberOfLines={2}>
                      {pickupAddress || "Pickup location"}
                    </Text>
                  </View>
                  <View style={s.addrBlock}>
                    <Text style={s.addrLabel}>DROP-OFF</Text>
                    <Text style={s.addrText} numberOfLines={2}>
                      {destinationAddress || "Destination"}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* ── Driver card ── */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Your Driver</Text>
            <View style={s.driverRow}>
              <View style={s.avatarWrap}>
                {driverDetails.profilePicUrl ? (
                  <Image
                    source={{ uri: driverDetails.profilePicUrl }}
                    style={s.avatarImg}
                  />
                ) : (
                  <View style={s.avatarFallback}>
                    <Text style={s.avatarLetter}>
                      {driverDetails.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={s.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                </View>
              </View>
              <View style={s.driverInfo}>
                <Text style={s.driverName}>{driverDetails.name}</Text>
                <View style={s.ratingRow}>
                  <Ionicons name="star" size={14} color="#F59E0B" />
                  <Text style={s.ratingText}>{driverDetails.rating}</Text>
                  <Text style={s.ratingCount}>· 500+ trips</Text>
                </View>
                <View style={s.vehicleRow}>
                  <Ionicons name="car-sport-outline" size={14} color="#888" />
                  <Text style={s.vehicleText}>
                    {driverDetails.vehicleModel} · {driverDetails.vehiclePlate}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* ── Payment breakdown ── */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Payment</Text>
            <View style={s.payRow}>
              <Text style={s.payLabel}>Trip Fare</Text>
              <Text style={s.payValue}>₦{Number(fare).toLocaleString()}</Text>
            </View>

            {referralBonus && (
              <View style={s.payRow}>
                <View style={s.discountLabelWrap}>
                  <Text style={s.discountLabel}>Referral Bonus</Text>
                  <View style={s.appliedBadge}>
                    <Text style={s.appliedBadgeText}>APPLIED</Text>
                  </View>
                </View>
                <Text style={s.discountValue}>
                  +₦{referralBonus.amount} to wallet
                </Text>
              </View>
            )}

            <View style={s.payDivider} />

            <View style={s.payRow}>
              <Text style={s.totalLabel}>Total Paid</Text>
              <Text style={s.totalValue}>₦{Number(fare).toLocaleString()}</Text>
            </View>
            <View style={s.payMethodRow}>
              <Ionicons
                name={
                  paymentMethod === "cash" ? "cash-outline" : "wallet-outline"
                }
                size={15}
                color="#888"
              />
              <Text style={s.payMethodText}>
                Paid via {paymentMethod === "cash" ? "Cash" : "Wallet"}
              </Text>
            </View>
          </View>

          {/* ── Home button ── */}
          <TouchableOpacity
            style={s.homeBtn}
            onPress={() => navigation.navigate("PassengerMain")}
            activeOpacity={0.88}
          >
            <Ionicons
              name="home"
              size={20}
              color="#fff"
              style={{ marginRight: 8 }}
            />
            <Text style={s.homeBtnText}>Back to Home</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAFA" },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 20 : 30,
    paddingBottom: 20,
  },

  // Hero
  hero: { alignItems: "center", marginBottom: 28 },
  checkCircle: {
    marginBottom: 24,
    alignItems: "center",
    justifyContent: "center",
    width: 120,
    height: 120,
  },
  checkCircleInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#10B981",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12,
  },
  checkRing: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: "#10B981",
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: "900",
    color: "#1A1A1A",
    marginBottom: 6,
    textAlign: "center",
  },
  heroDate: {
    fontSize: 16,
    color: "#888",
    marginBottom: 2,
    textAlign: "center",
  },
  heroTime: { fontSize: 14, color: "#BABABA", textAlign: "center" },

  // Referral bonus banner
  bonusBanner: {
    backgroundColor: "#14532D",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    overflow: "hidden",
    shadowColor: "#14532D",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  bannerDecorA: {
    position: "absolute",
    left: -30,
    top: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  bannerDecorB: {
    position: "absolute",
    right: -20,
    bottom: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  bonusContent: { flexDirection: "row", alignItems: "center" },
  bonusGiftWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  bonusGiftEmoji: { fontSize: 24 },
  bonusTextWrap: { flex: 1, paddingRight: 8 },
  bonusTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 3,
  },
  bonusSub: {
    fontSize: 13,
    color: "rgba(255,255,255,0.88)",
    lineHeight: 17,
    marginBottom: 2,
  },
  bonusNote: { fontSize: 12, color: "rgba(255,255,255,0.7)", lineHeight: 16 },
  bonusAmountWrap: {
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center",
    minWidth: 60,
  },
  bonusAmountLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    fontWeight: "600",
  },
  bonusAmountValue: { fontSize: 24, fontWeight: "900", color: "#fff" },

  // Fare hero card
  fareCard: {
    backgroundColor: "#1A1A1A",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 6,
  },
  fareCardLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.5)",
    letterSpacing: 1,
    marginBottom: 6,
  },
  fareCardValue: {
    fontSize: 44,
    fontWeight: "900",
    color: "#fff",
    marginBottom: 14,
  },
  fareCardMeta: { flexDirection: "row", gap: 10 },
  fareMetaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  fareMetaText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "600",
  },

  // Stats
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#F5F5F0",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1A1A1A",
    marginBottom: 3,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#BABABA",
    letterSpacing: 0.4,
  },

  // Generic card
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1A1A1A",
    marginBottom: 16,
  },

  // Route
  routeRow: { flexDirection: "row" },
  routeTrack: {
    width: 20,
    alignItems: "center",
    marginRight: 14,
    paddingTop: 4,
  },
  routeDot: { width: 12, height: 12, borderRadius: 6 },
  routeLine: {
    flex: 1,
    width: 2,
    backgroundColor: "#E5E5E5",
    marginVertical: 5,
  },
  routeAddresses: { flex: 1 },
  addrBlock: { paddingVertical: 8 },
  addrLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#BABABA",
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  addrText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1A1A1A",
    lineHeight: 19,
  },

  // Driver
  driverRow: { flexDirection: "row", alignItems: "center" },
  avatarWrap: { marginRight: 16, position: "relative" },
  avatarImg: { width: 66, height: 66, borderRadius: 33 },
  avatarFallback: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: "#1A1A1A",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarLetter: { color: "#fff", fontSize: 26, fontWeight: "800" },
  verifiedBadge: {
    position: "absolute",
    bottom: 0,
    right: -2,
    backgroundColor: "#fff",
    borderRadius: 10,
  },
  driverInfo: { flex: 1 },
  driverName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 5,
  },
  ratingRow: { flexDirection: "row", alignItems: "center", marginBottom: 5 },
  ratingText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1A1A1A",
    marginLeft: 4,
  },
  ratingCount: { fontSize: 12, color: "#888", marginLeft: 4 },
  vehicleRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  vehicleText: { fontSize: 13, color: "#888", fontWeight: "500" },

  // Payment
  payRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  payLabel: { fontSize: 16, color: "#888" },
  payValue: { fontSize: 16, fontWeight: "600", color: "#1A1A1A" },
  discountLabelWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  discountLabel: { fontSize: 15, color: "#059669", fontWeight: "600" },
  appliedBadge: {
    backgroundColor: "#DCFCE7",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  appliedBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#059669",
    letterSpacing: 0.5,
  },
  discountValue: { fontSize: 14, color: "#059669", fontWeight: "600" },
  payDivider: { height: 1, backgroundColor: "#F0F0F0", marginVertical: 8 },
  totalLabel: { fontSize: 17, fontWeight: "800", color: "#1A1A1A" },
  totalValue: { fontSize: 22, fontWeight: "900", color: "#1A1A1A" },
  payMethodRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  payMethodText: { fontSize: 14, color: "#888" },

  // Home button
  homeBtn: {
    backgroundColor: "#1A1A1A",
    borderRadius: 18,
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
    marginTop: 4,
  },
  homeBtnText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
});
