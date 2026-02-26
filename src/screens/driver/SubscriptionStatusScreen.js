// src/screens/driver/SubscriptionScreen.js
import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  RefreshControl,
  Vibration,
  Platform,
  StatusBar,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { getAuthToken, removeAuthToken } from "../../utils/auth";
import * as Notifications from "expo-notifications";

const BASE_URL = "https://wheels-backend-7ydc.onrender.com";
const FETCH_TIMEOUT_MS = 12000;

// ── Fetch with timeout ────────────────────────────────────────────────────────
async function fetchWithTimeout(url, options = {}, ms = FETCH_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    if (err.name === "AbortError") throw new Error("TIMEOUT");
    throw err;
  }
}

// ── Notifications ─────────────────────────────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function sendNotification(title, body, data = {}) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { ...data, screen: "SubscriptionScreen" },
        sound: true,
      },
      trigger: null,
    });
  } catch {}
}

async function registerForPushNotifications() {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let final = existing;
    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      final = status;
    }
    if (final !== "granted") return null;

    const token = await Notifications.getExpoPushTokenAsync({
      projectId: "89ca3ed1-d2fb-429a-9fdb-614202a280e5",
    });

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Wheela Notifications",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#1A6BFF",
      });
    }
    return token.data;
  } catch {
    return null;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const VEHICLE_LABELS = {
  CITY_CAR: "City Car",
  KEKE: "Keke / Tricycle",
  BIKE: "Delivery Bike",
};

// Maps a driver's serviceCategories array → subscription vehicleType
// Must match the subscription model enum: 'CITY_CAR' | 'KEKE' | 'BIKE'
function resolveVehicleType(serviceCategories = []) {
  if (serviceCategories.includes("KEKE")) return "KEKE";
  if (serviceCategories.includes("BIKE")) return "BIKE";
  if (serviceCategories.includes("DELIVERY")) return "BIKE"; // DELIVERY drivers use BIKE plan
  // Everything else (CITY_CAR, LUXURY, VAN, TRUCK, INTERSTATE, LOGISTICS) → CITY_CAR plan
  return "CITY_CAR";
}

function formatTimeRemaining(expiresAt) {
  const diff = new Date(expiresAt) - new Date();
  if (diff <= 0) return "Expired";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}d ${hours}h remaining`;
  return `${hours}h remaining`;
}

function isExpiringSoon(expiresAt) {
  const diff = new Date(expiresAt) - new Date();
  return diff > 0 && diff < 24 * 60 * 60 * 1000;
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function SubscriptionScreen() {
  const navigation = useNavigation();
  const notifListener = useRef();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [currentSub, setCurrentSub] = useState(null);
  const [plans, setPlans] = useState([]);
  const [walletBalance, setWalletBalance] = useState(0); // kobo
  const [vehicleType, setVehicleType] = useState("CITY_CAR");
  const [subscribing, setSubscribing] = useState(false);

  const fetchingRef = useRef(false);

  // Notifications setup
  useEffect(() => {
    registerForPushNotifications();
    notifListener.current = Notifications.addNotificationReceivedListener(() =>
      Vibration.vibrate(300),
    );
    return () => {
      notifListener.current?.remove();
    };
  }, []);

  // ── Fetch all data ──────────────────────────────────────────────────────────
  const fetchAll = useCallback(async (showLoader = true) => {
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
        "Content-Type": "application/json",
      };

      // ── Step 1: Driver profile → resolve vehicle type ──────────────
      // IMPORTANT: Store the resolved type in a LOCAL variable so we can
      // use it immediately for the plans request below. Do NOT rely on
      // the `vehicleType` state variable here — React state updates are
      // async, so reading it after setVehicleType() still returns the
      // old value within the same function call.
      let resolvedVehicleType = "CITY_CAR"; // local variable, not state

      const profileRes = await fetchWithTimeout(`${BASE_URL}/users/me`, {
        headers,
      });
      if (profileRes.status === 401 || profileRes.status === 403) {
        await removeAuthToken();
        navigation.replace("Login");
        return;
      }
      if (profileRes.ok) {
        const pd = await profileRes.json();
        const cats = pd?.user?.driverProfile?.serviceCategories || [];
        console.log("🚗 Driver service categories:", cats);

        resolvedVehicleType = resolveVehicleType(cats);
        console.log(
          "✅ Resolved vehicle type for subscription plans:",
          resolvedVehicleType,
        );

        setVehicleType(resolvedVehicleType); // update state for UI display
      }

      // ── Step 2: Current subscription ──────────────────────────────
      const subRes = await fetchWithTimeout(
        `${BASE_URL}/subscriptions/current`,
        { headers },
      );
      if (subRes.ok) {
        const sd = await subRes.json();
        const sub = sd.hasActiveSubscription ? sd.subscription : null;
        setCurrentSub(sub);

        if (sub && isExpiringSoon(sub.expiresAt)) {
          const hrs = Math.ceil(
            (new Date(sub.expiresAt) - new Date()) / (1000 * 60 * 60),
          );
          sendNotification(
            "⚠️ Subscription Expiring",
            `Your plan expires in ${hrs} hour${hrs !== 1 ? "s" : ""}. Renew now!`,
            { action: "expiring_soon" },
          );
        }
      }

      // ── Step 3: Plans — use resolvedVehicleType, NOT the state var ─
      console.log(`📋 Fetching plans for vehicle type: ${resolvedVehicleType}`);
      const plansRes = await fetchWithTimeout(
        `${BASE_URL}/subscriptions/plans?vehicleType=${resolvedVehicleType}`,
        { headers },
      );
      if (plansRes.ok) {
        const pd = await plansRes.json();
        console.log(
          `✅ Got ${pd.plans?.length || 0} plans for ${resolvedVehicleType}`,
        );
        setPlans(pd.plans || []);
      }

      // ── Step 4: Wallet balance ─────────────────────────────────────
      const walletRes = await fetchWithTimeout(`${BASE_URL}/wallet`, {
        headers,
      });
      if (walletRes.ok) {
        const wd = await walletRes.json();
        setWalletBalance(wd.wallet?.balance || 0);
      }
    } catch (err) {
      console.error("SubscriptionScreen fetch:", err.message);
      if (err.message === "TIMEOUT") setFetchError("TIMEOUT");
      else setFetchError("NETWORK");
    } finally {
      setLoading(false);
      setRefreshing(false);
      fetchingRef.current = false;
    }
  }, []); // no dependency on vehicleType — we resolve it locally inside fetchAll

  useEffect(() => {
    fetchAll(true);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAll(false);
  };

  // ── Subscribe ───────────────────────────────────────────────────────────────
  const handleSubscribe = async (plan) => {
    const priceKobo = plan.price * 100;
    if (walletBalance < priceKobo) {
      Alert.alert(
        "Insufficient Balance",
        `You need ₦${plan.price.toLocaleString()} but your balance is ₦${(walletBalance / 100).toFixed(2)}. Contact admin to top up.`,
        [{ text: "OK" }],
      );
      return;
    }

    Alert.alert(
      "Confirm Subscription",
      `Subscribe to the ${plan.duration.toUpperCase()} plan for ₦${plan.price.toLocaleString()}?\n\nThis will be deducted from your wallet.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Subscribe",
          onPress: async () => {
            setSubscribing(true);
            try {
              const token = await getAuthToken();
              if (!token) {
                navigation.replace("Login");
                return;
              }

              const res = await fetchWithTimeout(
                `${BASE_URL}/subscriptions/subscribe`,
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                  },
                  // Use vehicleType state here — by the time the user taps subscribe,
                  // state is already correct from the fetchAll that ran on mount.
                  body: JSON.stringify({
                    vehicleType,
                    duration: plan.duration,
                    autoRenew: false,
                  }),
                },
              );

              const d = await res.json().catch(() => ({}));

              if (res.ok) {
                sendNotification(
                  "🎉 Subscription Activated!",
                  `Your ${plan.duration.toUpperCase()} plan is now active.`,
                  { action: "activated" },
                );
                Alert.alert(
                  "Subscribed!",
                  `Your ${plan.duration} plan is now active.`,
                );
                fetchAll(false);
              } else if (res.status === 401 || res.status === 403) {
                await removeAuthToken();
                navigation.replace("Login");
              } else {
                Alert.alert(
                  "Failed",
                  d?.error?.message || "Could not subscribe. Try again.",
                );
              }
            } catch (err) {
              Alert.alert(
                err.message === "TIMEOUT" ? "Timeout" : "Network Error",
                "Could not connect. Please try again.",
              );
            } finally {
              setSubscribing(false);
            }
          },
        },
      ],
    );
  };

  // ── Renew ───────────────────────────────────────────────────────────────────
  const handleRenew = async () => {
    if (!currentSub) return;
    const priceKobo = (currentSub.plan?.price || 0) * 100;
    if (walletBalance < priceKobo) {
      Alert.alert(
        "Insufficient Balance",
        `You need ₦${currentSub.plan?.price?.toLocaleString() || 0} to renew. Contact admin to top up.`,
        [{ text: "OK" }],
      );
      return;
    }

    Alert.alert(
      "Renew Subscription",
      `Renew your ${currentSub.plan?.duration?.toUpperCase()} plan for ₦${currentSub.plan?.price?.toLocaleString()}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Renew",
          onPress: async () => {
            setSubscribing(true);
            try {
              const token = await getAuthToken();
              if (!token) {
                navigation.replace("Login");
                return;
              }

              const res = await fetchWithTimeout(
                `${BASE_URL}/subscriptions/subscribe`,
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    vehicleType,
                    duration: currentSub.plan?.duration,
                    autoRenew: false,
                  }),
                },
              );

              const d = await res.json().catch(() => ({}));

              if (res.ok) {
                sendNotification(
                  "🔄 Subscription Renewed",
                  "Your plan has been renewed successfully.",
                  { action: "renewed" },
                );
                Alert.alert("Renewed!", "Your subscription has been renewed.");
                fetchAll(false);
              } else if (res.status === 401 || res.status === 403) {
                await removeAuthToken();
                navigation.replace("Login");
              } else {
                Alert.alert(
                  "Failed",
                  d?.error?.message || "Could not renew. Try again.",
                );
              }
            } catch (err) {
              Alert.alert(
                err.message === "TIMEOUT" ? "Timeout" : "Network Error",
                "Could not connect. Please try again.",
              );
            } finally {
              setSubscribing(false);
            }
          },
        },
      ],
    );
  };

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.centeredScreen}>
        <StatusBar barStyle="light-content" backgroundColor="#0D0D0D" />
        <ActivityIndicator size="large" color="#1A6BFF" />
        <Text style={s.loadingText}>Loading subscription...</Text>
      </View>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────────
  if (fetchError) {
    const ec =
      fetchError === "TIMEOUT"
        ? {
            icon: "time-outline",
            title: "Request Timed Out",
            body: "Server is taking too long. Try again.",
          }
        : {
            icon: "wifi-outline",
            title: "No Connection",
            body: "Check your internet and try again.",
          };

    return (
      <View style={s.centeredScreen}>
        <StatusBar barStyle="light-content" backgroundColor="#0D0D0D" />
        <View style={s.errorIconWrap}>
          <Ionicons name={ec.icon} size={40} color="#333" />
        </View>
        <Text style={s.errorTitle}>{ec.title}</Text>
        <Text style={s.errorBody}>{ec.body}</Text>
        <TouchableOpacity
          style={s.retryBtn}
          onPress={() => fetchAll(true)}
          activeOpacity={0.85}
        >
          <Ionicons
            name="refresh-outline"
            size={18}
            color="#fff"
            style={{ marginRight: 8 }}
          />
          <Text style={s.retryBtnText}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ marginTop: 14 }}
        >
          <Text style={{ color: "#555", fontSize: 14, fontWeight: "600" }}>
            Go Back
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const balanceNaira = (walletBalance / 100).toFixed(2);
  const expiringSoon = currentSub && isExpiringSoon(currentSub.expiresAt);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: "#0D0D0D" }}>
      <StatusBar barStyle="light-content" backgroundColor="#0D0D0D" />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Subscription</Text>
        <TouchableOpacity
          style={s.refreshBtn}
          onPress={onRefresh}
          disabled={refreshing}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh-outline" size={20} color="#1A6BFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
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
        {/* ── Wallet balance ── */}
        <View style={s.walletCard}>
          <View style={s.walletTop}>
            <View style={s.walletIconWrap}>
              <Ionicons name="wallet-outline" size={20} color="#1A6BFF" />
            </View>
            <Text style={s.walletLabel}>Wallet Balance</Text>
          </View>
          <Text style={s.walletAmount}>
            ₦
            {parseFloat(balanceNaira).toLocaleString("en-NG", {
              minimumFractionDigits: 2,
            })}
          </Text>
          <Text style={s.walletNote}>Contact admin to add funds</Text>
        </View>

        {/* ── Current subscription ── */}
        {currentSub ? (
          <View
            style={[s.currentSubCard, expiringSoon && s.currentSubCardWarning]}
          >
            {/* Active badge */}
            <View style={s.activeBadge}>
              <View style={s.activeDot} />
              <Text style={s.activeBadgeText}>Active</Text>
            </View>

            {/* Expiry warning */}
            {expiringSoon && (
              <View style={s.expiryWarning}>
                <Ionicons name="warning-outline" size={14} color="#F59E0B" />
                <Text style={s.expiryWarningText}>
                  Expiring soon — renew now!
                </Text>
              </View>
            )}

            <Text style={s.currentSubPlanLabel}>Current Plan</Text>
            <Text style={s.currentSubPlan}>
              {currentSub.plan?.duration?.toUpperCase()}
            </Text>

            <View style={s.subDetailRow}>
              <Text style={s.subDetailLabel}>Vehicle Type</Text>
              <Text style={s.subDetailValue}>
                {VEHICLE_LABELS[currentSub.vehicleType] ||
                  currentSub.vehicleType}
              </Text>
            </View>
            <View style={s.subDetailRow}>
              <Text style={s.subDetailLabel}>Price Paid</Text>
              <Text style={s.subDetailValue}>
                {currentSub.plan?.priceFormatted}
              </Text>
            </View>
            <View style={s.subDetailRow}>
              <Text style={s.subDetailLabel}>Expires</Text>
              <Text style={s.subDetailValue}>
                {new Date(currentSub.expiresAt).toLocaleDateString("en-NG", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </Text>
            </View>

            <View style={s.timeRemaining}>
              <Ionicons name="time-outline" size={16} color="#1A6BFF" />
              <Text style={s.timeRemainingText}>
                {formatTimeRemaining(currentSub.expiresAt)}
              </Text>
            </View>

            <TouchableOpacity
              style={[s.renewBtn, subscribing && { opacity: 0.6 }]}
              onPress={handleRenew}
              disabled={subscribing}
              activeOpacity={0.85}
            >
              {subscribing ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="refresh-outline" size={18} color="#fff" />
                  <Text style={s.renewBtnText}>Renew Subscription</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.noSubCard}>
            <View style={s.noSubIconWrap}>
              <Ionicons name="card-outline" size={36} color="#333" />
            </View>
            <Text style={s.noSubTitle}>No Active Subscription</Text>
            <Text style={s.noSubBody}>
              Choose a plan below to start accepting rides.
            </Text>
          </View>
        )}

        {/* ── Plans ── */}
        <View style={s.plansSection}>
          <Text style={s.sectionTitle}>
            Plans for {VEHICLE_LABELS[vehicleType] || vehicleType}
          </Text>

          {plans.length === 0 ? (
            <View style={s.noPlansCard}>
              <Ionicons name="document-text-outline" size={32} color="#333" />
              <Text style={s.noPlansText}>
                No plans available. Pull down to refresh.
              </Text>
            </View>
          ) : (
            plans.map((plan) => (
              <PlanCard
                key={plan.duration}
                plan={plan}
                isSubscribed={!!currentSub}
                subscribing={subscribing}
                onPress={() => handleSubscribe(plan)}
              />
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ── Plan card ─────────────────────────────────────────────────────────────────
function PlanCard({ plan, isSubscribed, subscribing, onPress }) {
  const rec = plan.recommended;
  return (
    <View style={[s.planCard, rec && s.planCardRecommended]}>
      {rec && (
        <View style={s.recommendedBadge}>
          <Ionicons name="star" size={11} color="#fff" />
          <Text style={s.recommendedText}>RECOMMENDED</Text>
        </View>
      )}

      <View style={s.planHeader}>
        <View>
          <Text style={s.planDuration}>{plan.duration?.toUpperCase()}</Text>
          <Text style={s.planDays}>{plan.durationDays} days access</Text>
        </View>
        <Text style={s.planPrice}>{plan.priceFormatted}</Text>
      </View>

      <View style={s.planFeatures}>
        {["Unlimited rides", "24/7 support", "Instant activation"].map((f) => (
          <View key={f} style={s.featureRow}>
            <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
            <Text style={s.featureText}>{f}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[s.subscribeBtn, isSubscribed && s.subscribeBtnDisabled]}
        onPress={onPress}
        disabled={isSubscribed || subscribing}
        activeOpacity={0.85}
      >
        {subscribing ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={s.subscribeBtnText}>
            {isSubscribed ? "Already Subscribed" : "Subscribe Now"}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  centeredScreen: {
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
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A6BFF",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  retryBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },

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
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1E1E1E",
    justifyContent: "center",
    alignItems: "center",
  },

  // Wallet
  walletCard: {
    backgroundColor: "#141414",
    margin: 16,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: "#1E1E1E",
  },
  walletTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  walletIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(26,107,255,0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  walletLabel: { fontSize: 13, color: "#666", fontWeight: "600" },
  walletAmount: {
    fontSize: 36,
    fontWeight: "900",
    color: "#fff",
    marginBottom: 6,
    letterSpacing: -1,
  },
  walletNote: { fontSize: 12, color: "#444", fontWeight: "500" },

  // Current sub
  currentSubCard: {
    backgroundColor: "#141414",
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1.5,
    borderColor: "#22C55E",
  },
  currentSubCardWarning: { borderColor: "#F59E0B" },
  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "rgba(34,197,94,0.1)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 10,
  },
  activeDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#22C55E",
  },
  activeBadgeText: { color: "#22C55E", fontSize: 12, fontWeight: "700" },
  expiryWarning: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "rgba(245,158,11,0.1)",
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#F59E0B",
  },
  expiryWarningText: { color: "#F59E0B", fontSize: 12, fontWeight: "600" },
  currentSubPlanLabel: {
    fontSize: 11,
    color: "#555",
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  currentSubPlan: {
    fontSize: 30,
    fontWeight: "900",
    color: "#fff",
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  subDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1E1E1E",
  },
  subDetailLabel: { fontSize: 13, color: "#555", fontWeight: "600" },
  subDetailValue: { fontSize: 13, color: "#ccc", fontWeight: "700" },
  timeRemaining: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(26,107,255,0.08)",
    borderRadius: 10,
    padding: 12,
    marginTop: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(26,107,255,0.15)",
  },
  timeRemainingText: { color: "#1A6BFF", fontSize: 14, fontWeight: "700" },
  renewBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#22C55E",
    borderRadius: 14,
    paddingVertical: 15,
  },
  renewBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  // No sub
  noSubCard: {
    backgroundColor: "#141414",
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 18,
    padding: 36,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1E1E1E",
  },
  noSubIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#1A1A1A",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  noSubTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 6,
  },
  noSubBody: {
    fontSize: 13,
    color: "#555",
    textAlign: "center",
    lineHeight: 19,
  },

  // Plans
  plansSection: { paddingHorizontal: 16, marginBottom: 8 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 12,
  },
  noPlansCard: {
    backgroundColor: "#141414",
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#1E1E1E",
  },
  noPlansText: {
    color: "#555",
    fontSize: 13,
    textAlign: "center",
    fontWeight: "500",
  },

  planCard: {
    backgroundColor: "#141414",
    borderRadius: 18,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#1E1E1E",
  },
  planCardRecommended: { borderColor: "#1A6BFF", borderWidth: 1.5 },
  recommendedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#1A6BFF",
    alignSelf: "flex-start",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 14,
  },
  recommendedText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  planHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  planDuration: { fontSize: 22, fontWeight: "900", color: "#fff" },
  planDays: { fontSize: 12, color: "#555", fontWeight: "600", marginTop: 4 },
  planPrice: { fontSize: 26, fontWeight: "900", color: "#1A6BFF" },
  planFeatures: { gap: 8, marginBottom: 16 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  featureText: { fontSize: 13, color: "#888", fontWeight: "500" },
  subscribeBtn: {
    backgroundColor: "#1A6BFF",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  subscribeBtnDisabled: { backgroundColor: "#222" },
  subscribeBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
