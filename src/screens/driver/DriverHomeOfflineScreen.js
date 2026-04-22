// src/screens/driver/DriverHomeOfflineScreen.js
import { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  ScrollView,
  RefreshControl,
  Platform,
  StatusBar,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { getAuthToken, removeAuthToken, logout } from "../../utils/auth";

import { BASE_URL } from '../../config';
import { fetchWithTimeout, FETCH_TIMEOUT_MS } from '../../utils/fetchWithTimeout';

// ─── Error classifier ─────────────────────────────────────────────────────────
function classifyError(err, status) {
  if (status === 401 || status === 403) return "AUTH";
  if (err.message === "TIMEOUT") return "TIMEOUT";
  if (!status) return "NETWORK";
  if (status >= 500) return "SERVER";
  return "UNKNOWN";
}

const SERVICE_MAP = {
  CITY_RIDE: "City Ride",
  DELIVERY_BIKE: "Delivery (Bike)",
  TRUCK: "Truck / Logistics",
  INTERSTATE: "Interstate Travel",
  KEKE: "Keke / Tricycle",
  LUXURY_RENTAL: "Luxury Rental",
};

export default function DriverHomeOfflineScreen() {
  const navigation = useNavigation();

  const [driverData, setDriverData] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [goingOnline, setGoingOnline] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [fetchError, setFetchError] = useState(null); // 'AUTH' | 'TIMEOUT' | 'NETWORK' | 'SERVER' | null

  // Prevent double-fetch on fast focus transitions
  const fetchingRef = useRef(false);

  // ── Core data fetch ──────────────────────────────────────────────────────
  const fetchProfileData = useCallback(async (showLoader = true) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    if (showLoader) setLoading(true);
    setFetchError(null);

    try {
      const authToken = await getAuthToken();

      // ✅ No token in storage at all → go to Login immediately, don't hang
      if (!authToken) {
        handleAuthFailure("Your session has expired. Please log in again.");
        return;
      }

      const res = await fetchWithTimeout(`${BASE_URL}/users/me`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        },
      });

      // ✅ Auth failure from server → clear token + redirect
      if (res.status === 401 || res.status === 403) {
        await removeAuthToken();
        handleAuthFailure("Your session has expired. Please log in again.");
        return;
      }

      if (!res.ok) {
        const errorType = classifyError({}, res.status);
        setFetchError(errorType);
        return;
      }

      const data = await res.json();

      if (!data?.user) {
        setFetchError("SERVER");
        return;
      }

      const user = data.user;

      setUserData({
        name: user.name || "Driver",
        phone: user.phone || "Not set",
        email: user.email || "",
        isActive: user.isActive !== false,
        userId: user._id,
      });

      setDriverData({
        driverProfile: user.driverProfile || {
          verified: false,
          verificationState: "pending",
          isAvailable: false,
        },
        roles: user.roles || { isUser: true, isDriver: true, isAdmin: false },
      });

      setFetchError(null);
    } catch (err) {
      console.error("fetchProfileData error:", err.message);
      const errorType = classifyError(err, null);

      if (errorType === "AUTH") {
        await removeAuthToken();
        handleAuthFailure("Your session has expired. Please log in again.");
      } else {
        setFetchError(errorType);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      fetchingRef.current = false;
    }
  }, []);

  // ✅ Redirect to Login — always clears state first so screen doesn't render stale data
  const handleAuthFailure = useCallback(
    (message) => {
      setLoading(false);
      setRefreshing(false);
      fetchingRef.current = false;
      // Small delay so Alert renders after nav stack settles
      setTimeout(() => {
        Alert.alert("Session Expired", message, [
          {
            text: "Log In",
            onPress: () => navigation.replace("Login"),
          },
        ]);
      }, 100);
    },
    [navigation],
  );

  useFocusEffect(
    useCallback(() => {
      fetchProfileData(true);
    }, [fetchProfileData]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchProfileData(false);
  };

  // ── Go Online ─────────────────────────────────────────────────────────────
  const handleGoOnline = async () => {
    const profile = driverData?.driverProfile || {};
    const isVerified = profile.verified === true;
    const verificationState = profile.verificationState || "pending";

    if (verificationState !== "approved" || !isVerified) {
      Alert.alert(
        verificationState === "rejected"
          ? "Verification Rejected"
          : "Verification Pending",
        verificationState === "rejected"
          ? "Your documents were rejected. Please re-submit and try again."
          : "Your documents are under review. You will be notified within 24-48 hours.",
        [
          { text: "OK" },
          {
            text: "Update Documents",
            onPress: () => navigation.navigate("DriverProfileVerification"),
          },
        ],
      );
      return;
    }

    Alert.alert(
      "Go Online",
      "Ready to accept rides? Ensure you have a stable connection.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Go Online",
          onPress: async () => {
            setGoingOnline(true);
            try {
              const authToken = await getAuthToken();
              if (!authToken) {
                handleAuthFailure("Session expired.");
                return;
              }

              const res = await fetchWithTimeout(
                `${BASE_URL}/drivers/availability`,
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${authToken}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    isAvailable: true,
                    lastSeen: new Date().toISOString(),
                  }),
                },
              );

              if (res.status === 401 || res.status === 403) {
                await removeAuthToken();
                handleAuthFailure("Session expired.");
                return;
              }

              if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                Alert.alert(
                  "Error",
                  d?.error?.message || "Failed to go online. Try again.",
                );
                return;
              }

              navigation.replace("DriverOnlineMap");
            } catch (err) {
              if (err.message === "TIMEOUT") {
                Alert.alert(
                  "Timeout",
                  "Server took too long. Check your connection and try again.",
                );
              } else {
                Alert.alert(
                  "Network Error",
                  "Could not connect. Please try again.",
                );
              }
            } finally {
              setGoingOnline(false);
            }
          },
        },
      ],
    );
  };

  // ── Logout ────────────────────────────────────────────────────────────────
  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await logout();
          navigation.replace("Welcome");
        },
      },
    ]);
  };

  // ── Delete Account ────────────────────────────────────────────────────────
  const handleDeleteAccount = () => {
    if (userData && !userData.isActive) {
      Alert.alert("Account Suspended", "Your account is already suspended.", [
        { text: "OK" },
      ]);
      return;
    }

    Alert.alert(
      "Delete Account",
      "This will permanently delete your account. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          style: "destructive",
          onPress: confirmDeleteAccount,
        },
      ],
    );
  };

  const confirmDeleteAccount = () => {
    Alert.alert("Confirm Deletion", "Are you absolutely sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Type DELETE",
        style: "destructive",
        onPress: showTypeDeleteInput,
      },
    ]);
  };

  const showTypeDeleteInput = () => {
    Alert.prompt(
      "Type DELETE",
      "Type DELETE to confirm account deletion:",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          style: "destructive",
          onPress: (input) => {
            if (input?.toUpperCase() === "DELETE") {
              proceedWithDeletion();
            } else {
              Alert.alert("Incorrect", "You must type DELETE exactly.");
            }
          },
        },
      ],
      "plain-text",
    );
  };

  const proceedWithDeletion = async () => {
    Alert.alert(
      "Final Warning",
      "Your account will be permanently deleted. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete My Account",
          style: "destructive",
          onPress: async () => {
            setDeletingAccount(true);
            try {
              const authToken = await getAuthToken();

              const res = await fetchWithTimeout(
                `${BASE_URL}/auth/delete-account`,
                {
                  method: "DELETE",
                  headers: {
                    Authorization: `Bearer ${authToken}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    reason: "User requested account deletion",
                    userId: userData?.userId,
                  }),
                },
              );

              const d = await res.json().catch(() => ({}));

              if (res.ok && d.ok) {
                await logout();
                Alert.alert(
                  "Account Deleted",
                  "Your account has been deleted.",
                  [
                    {
                      text: "OK",
                      onPress: () => navigation.replace("Welcome"),
                    },
                  ],
                );
              } else if (res.status === 400) {
                const msg = d?.error?.message || "";
                if (msg.includes("active rides")) {
                  Alert.alert(
                    "Active Rides",
                    "Complete or cancel all active rides first.",
                    [
                      { text: "OK" },
                      {
                        text: "Go to Rides",
                        onPress: () => navigation.navigate("DriverRides"),
                      },
                    ],
                  );
                } else if (msg.includes("balance")) {
                  Alert.alert(
                    "Wallet Balance",
                    "Withdraw your remaining balance first.",
                    [
                      { text: "OK" },
                      {
                        text: "Go to Wallet",
                        onPress: () => navigation.navigate("Wallet"),
                      },
                    ],
                  );
                } else {
                  Alert.alert(
                    "Cannot Delete",
                    msg || "Failed to delete account.",
                  );
                }
              } else if (res.status === 401 || res.status === 403) {
                await removeAuthToken();
                handleAuthFailure("Session expired.");
              } else {
                Alert.alert(
                  "Error",
                  "Failed to delete account. Contact support.",
                );
              }
            } catch (err) {
              Alert.alert(
                err.message === "TIMEOUT" ? "Timeout" : "Network Error",
                "Could not connect to server. Please try again.",
              );
            } finally {
              setDeletingAccount(false);
            }
          },
        },
      ],
    );
  };

  // ── Error state screen ────────────────────────────────────────────────────
  const renderErrorState = () => {
    const config = {
      NETWORK: {
        icon: "wifi-outline",
        title: "No Connection",
        body: "Check your internet connection and try again.",
        btnText: "Retry",
      },
      TIMEOUT: {
        icon: "time-outline",
        title: "Request Timed Out",
        body: "The server is taking too long. Please try again.",
        btnText: "Retry",
      },
      SERVER: {
        icon: "server-outline",
        title: "Server Error",
        body: "Something went wrong on our end. Please try again later.",
        btnText: "Retry",
      },
      UNKNOWN: {
        icon: "alert-circle-outline",
        title: "Something Went Wrong",
        body: "An unexpected error occurred.",
        btnText: "Retry",
      },
    };

    const c = config[fetchError] || config.UNKNOWN;

    return (
      <View style={s.errorScreen}>
        <StatusBar barStyle="light-content" backgroundColor="#0D0D0D" />

        {/* Logo area */}
        <View style={s.errorLogoWrap}>
          <View style={s.errorLogoCircle}>
            <Ionicons name="car-sport" size={32} color="#1A6BFF" />
          </View>
        </View>

        <View style={s.errorIconWrap}>
          <Ionicons name={c.icon} size={48} color="#444" />
        </View>

        <Text style={s.errorTitle}>{c.title}</Text>
        <Text style={s.errorBody}>{c.body}</Text>

        <TouchableOpacity
          style={s.errorRetryBtn}
          onPress={() => fetchProfileData(true)}
          activeOpacity={0.85}
        >
          <Ionicons
            name="refresh-outline"
            size={18}
            color="#fff"
            style={{ marginRight: 8 }}
          />
          <Text style={s.errorRetryText}>{c.btnText}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.errorLogoutBtn}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <Text style={s.errorLogoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.loadingScreen}>
        <StatusBar barStyle="light-content" backgroundColor="#0D0D0D" />
        <View style={s.loadingLogoCircle}>
          <Ionicons name="car-sport" size={32} color="#1A6BFF" />
        </View>
        <ActivityIndicator
          size="large"
          color="#1A6BFF"
          style={{ marginTop: 32 }}
        />
        <Text style={s.loadingText}>Loading your profile...</Text>
      </View>
    );
  }

  // ── Error (non-auth) ──────────────────────────────────────────────────────
  if (fetchError) return renderErrorState();

  // ── Derived values ────────────────────────────────────────────────────────
  const profile = driverData?.driverProfile || {};
  const user = userData || {};
  const isVerified = profile.verified === true;
  const verificationState = profile.verificationState || "pending";
  const isAvailable = profile.isAvailable || false;
  const isAccountActive = user.isActive !== false;
  const profilePicUrl = profile.profilePicUrl || "";

  const vehicleDisplay =
    profile.vehicleMake && profile.vehicleModel && profile.vehicleNumber
      ? `${profile.vehicleMake} ${profile.vehicleModel} · ${profile.vehicleNumber.toUpperCase()}`
      : null;

  const verificationMeta = {
    approved: {
      label: "Verified",
      color: "#22C55E",
      bg: "rgba(34,197,94,0.1)",
      icon: "shield-checkmark",
    },
    rejected: {
      label: "Rejected",
      color: "#EF4444",
      bg: "rgba(239,68,68,0.1)",
      icon: "close-circle",
    },
    pending: {
      label: "Under Review",
      color: "#F59E0B",
      bg: "rgba(245,158,11,0.1)",
      icon: "time",
    },
  };
  const vm = verificationMeta[verificationState] || verificationMeta.pending;

  const canGoOnline =
    isVerified && isAccountActive && verificationState === "approved";

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: "#0D0D0D" }}>
      <StatusBar barStyle="light-content" backgroundColor="#0D0D0D" />

      <ScrollView
        style={s.container}
        contentContainerStyle={s.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#1A6BFF"
            colors={["#1A6BFF"]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero Header ── */}
        <View style={s.hero}>
          <View style={s.heroTop}>
            {/* Left: greeting */}
            <View style={{ flex: 1 }}>
              <Text style={s.heroGreeting}>Welcome back</Text>
              <Text style={s.heroName} numberOfLines={1}>
                {user.name || "Driver"}
              </Text>

              {/* Online / offline pill */}
              <View
                style={[
                  s.onlinePill,
                  {
                    backgroundColor: isAvailable
                      ? "rgba(34,197,94,0.15)"
                      : "rgba(255,255,255,0.07)",
                  },
                ]}
              >
                <View
                  style={[
                    s.onlineDot,
                    { backgroundColor: isAvailable ? "#22C55E" : "#555" },
                  ]}
                />
                <Text
                  style={[
                    s.onlinePillText,
                    { color: isAvailable ? "#22C55E" : "#888" },
                  ]}
                >
                  {isAvailable ? "Online" : "Offline"}
                </Text>
              </View>
            </View>

            {/* Right: avatar */}
            {profilePicUrl ? (
              <Image source={{ uri: profilePicUrl }} style={s.avatar} />
            ) : (
              <View style={s.avatarDefault}>
                <Text style={s.avatarInitial}>
                  {(user.name || "D")[0].toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          {/* Suspended banner */}
          {!isAccountActive && (
            <View style={s.suspendedBanner}>
              <Ionicons name="ban-outline" size={16} color="#EF4444" />
              <Text style={s.suspendedBannerText}>Account Suspended</Text>
            </View>
          )}
        </View>

        {/* ── Verification card ── */}
        <View style={s.verificationCard}>
          <View style={s.verificationCardTop}>
            <Text style={s.cardLabel}>VERIFICATION STATUS</Text>
            <View style={[s.verificationBadge, { backgroundColor: vm.bg }]}>
              <Ionicons name={vm.icon} size={13} color={vm.color} />
              <Text style={[s.verificationBadgeText, { color: vm.color }]}>
                {vm.label}
              </Text>
            </View>
          </View>

          {verificationState === "pending" && (
            <View style={s.verificationNote}>
              <Ionicons name="time-outline" size={14} color="#F59E0B" />
              <Text style={s.verificationNoteText}>
                Documents under review — usually 24–48 hours.
              </Text>
            </View>
          )}

          {verificationState === "rejected" && (
            <View style={[s.verificationNote, { borderLeftColor: "#EF4444" }]}>
              <Ionicons name="alert-circle-outline" size={14} color="#EF4444" />
              <Text style={[s.verificationNoteText, { color: "#EF4444" }]}>
                Verification rejected. Update your documents and resubmit.
              </Text>
            </View>
          )}

          {verificationState !== "approved" && (
            <TouchableOpacity
              style={s.updateDocsBtn}
              onPress={() => navigation.navigate("DriverProfileVerification")}
              activeOpacity={0.85}
            >
              <Ionicons
                name="document-text-outline"
                size={16}
                color="#1A6BFF"
              />
              <Text style={s.updateDocsBtnText}>
                {verificationState === "rejected"
                  ? "Re-submit Documents"
                  : "View / Update Documents"}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── GO ONLINE button ── */}
        <TouchableOpacity
          style={[
            s.goOnlineBtn,
            !canGoOnline && s.goOnlineBtnDisabled,
            goingOnline && { opacity: 0.7 },
          ]}
          onPress={handleGoOnline}
          disabled={!canGoOnline || goingOnline}
          activeOpacity={0.88}
        >
          {goingOnline ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <View
                style={[
                  s.goOnlinePulse,
                  !canGoOnline && { backgroundColor: "#333" },
                ]}
              />
              <Text style={s.goOnlineBtnText}>
                {!isAccountActive
                  ? "ACCOUNT SUSPENDED"
                  : verificationState === "rejected"
                    ? "ACCOUNT REJECTED"
                    : verificationState !== "approved"
                      ? "AWAITING APPROVAL"
                      : "GO ONLINE"}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* ── Quick actions ── */}
        <View style={s.quickActions}>
          <QuickAction
            icon="card-outline"
            label="Subscription"
            sub="Manage plan"
            onPress={() => navigation.navigate("Subscription")}
            disabled={!isAccountActive}
          />
          <QuickAction
            icon="wallet-outline"
            label="Wallet"
            sub="View balance"
            onPress={() => navigation.navigate("Wallet")}
            disabled={!isAccountActive}
          />
          <QuickAction
            icon="bar-chart-outline"
            label="Earnings"
            sub="Trip history"
            onPress={() => navigation.navigate("Earnings")}
            disabled={!isAccountActive}
          />
        </View>

        {/* ── Profile card ── */}
        <View style={s.infoCard}>
          <View style={s.infoCardHeader}>
            <Ionicons name="person-circle-outline" size={18} color="#1A6BFF" />
            <Text style={s.infoCardTitle}>Profile</Text>
          </View>

          <InfoRow label="Phone" value={user.phone || "Not set"} />
          {!!user.email && <InfoRow label="Email" value={user.email} />}
        </View>

        {/* ── Vehicle card ── */}
        <View style={s.infoCard}>
          <View style={s.infoCardHeader}>
            <Ionicons name="car-sport-outline" size={18} color="#1A6BFF" />
            <Text style={s.infoCardTitle}>Vehicle</Text>
          </View>

          <InfoRow label="Vehicle" value={vehicleDisplay || "Not set"} />
          {!!profile.nin && <InfoRow label="NIN" value={profile.nin} />}
          {!!profile.licenseNumber && (
            <InfoRow label="License" value={profile.licenseNumber} />
          )}
          {profile.serviceCategories?.length > 0 && (
            <InfoRow
              label="Service Types"
              value={profile.serviceCategories
                .map((c) => SERVICE_MAP[c] || c)
                .join(", ")}
            />
          )}
        </View>

        {/* ── Danger zone ── */}
        <View style={s.dangerZone}>
          <TouchableOpacity
            style={s.logoutBtn}
            onPress={handleLogout}
            disabled={deletingAccount}
            activeOpacity={0.8}
          >
            <Ionicons name="log-out-outline" size={18} color="#fff" />
            <Text style={s.logoutBtnText}>Log Out</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              s.deleteBtn,
              (!isAccountActive || deletingAccount) && s.deleteBtnDisabled,
            ]}
            onPress={handleDeleteAccount}
            disabled={deletingAccount || !isAccountActive}
            activeOpacity={0.8}
          >
            {deletingAccount ? (
              <ActivityIndicator color="#EF4444" size="small" />
            ) : (
              <>
                <Ionicons name="trash-outline" size={16} color="#EF4444" />
                <Text style={s.deleteBtnText}>
                  {!isAccountActive ? "Account Suspended" : "Delete Account"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <Text style={s.footerNote}>
          Deleting your account is permanent and cannot be undone.
        </Text>
      </ScrollView>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function QuickAction({ icon, label, sub, onPress, disabled }) {
  return (
    <TouchableOpacity
      style={[s.quickActionCard, disabled && s.quickActionDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.75}
    >
      <View style={s.quickActionIcon}>
        <Ionicons name={icon} size={22} color={disabled ? "#444" : "#1A6BFF"} />
      </View>
      <Text style={[s.quickActionLabel, disabled && { color: "#444" }]}>
        {label}
      </Text>
      <Text style={s.quickActionSub}>{sub}</Text>
    </TouchableOpacity>
  );
}

function InfoRow({ label, value }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoRowLabel}>{label}</Text>
      <Text style={s.infoRowValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  // Screens
  loadingScreen: {
    flex: 1,
    backgroundColor: "#0D0D0D",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingLogoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(26,107,255,0.12)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(26,107,255,0.25)",
  },
  loadingText: {
    color: "#555",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 16,
  },
  errorScreen: {
    flex: 1,
    backgroundColor: "#0D0D0D",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingBottom: Platform.OS === "ios" ? 48 : 24,
  },
  errorLogoWrap: { marginBottom: 32 },
  errorLogoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(26,107,255,0.12)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(26,107,255,0.25)",
  },
  errorIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#1A1A1A",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 10,
    textAlign: "center",
  },
  errorBody: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
  },
  errorRetryBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A6BFF",
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 32,
    marginBottom: 14,
    width: "100%",
    justifyContent: "center",
  },
  errorRetryText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  errorLogoutBtn: { paddingVertical: 12 },
  errorLogoutText: { color: "#555", fontSize: 14, fontWeight: "600" },

  // Main scroll
  container: { flex: 1, backgroundColor: "#0D0D0D" },
  contentContainer: { paddingBottom: 48 },

  // Hero
  hero: {
    backgroundColor: "#141414",
    paddingHorizontal: 22,
    paddingTop: Platform.OS === "ios" ? 60 : 48,
    paddingBottom: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },
  heroTop: { flexDirection: "row", alignItems: "flex-start" },
  heroGreeting: {
    fontSize: 13,
    color: "#666",
    fontWeight: "600",
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  heroName: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  onlinePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  onlineDot: { width: 7, height: 7, borderRadius: 3.5 },
  onlinePillText: { fontSize: 12, fontWeight: "700" },
  avatar: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2,
    borderColor: "#1A6BFF",
    marginLeft: 16,
  },
  avatarDefault: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#1A1A1A",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 16,
    borderWidth: 2,
    borderColor: "#222",
  },
  avatarInitial: { fontSize: 24, fontWeight: "800", color: "#1A6BFF" },

  suspendedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    backgroundColor: "rgba(239,68,68,0.1)",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.25)",
    alignSelf: "flex-start",
  },
  suspendedBannerText: { color: "#EF4444", fontSize: 13, fontWeight: "700" },

  // Verification card
  verificationCard: {
    backgroundColor: "#141414",
    marginHorizontal: 16,
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#222",
  },
  verificationCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  cardLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#555",
    letterSpacing: 1.2,
  },
  verificationBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  verificationBadgeText: { fontSize: 12, fontWeight: "700" },
  verificationNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "rgba(245,158,11,0.07)",
    borderLeftWidth: 3,
    borderLeftColor: "#F59E0B",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  verificationNoteText: {
    flex: 1,
    fontSize: 12,
    color: "#F59E0B",
    fontWeight: "500",
    lineHeight: 17,
  },
  updateDocsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(26,107,255,0.1)",
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(26,107,255,0.2)",
  },
  updateDocsBtnText: { color: "#1A6BFF", fontSize: 13, fontWeight: "700" },

  // Go Online
  goOnlineBtn: {
    backgroundColor: "#1A6BFF",
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 18,
    paddingVertical: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: "#1A6BFF",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12,
  },
  goOnlineBtnDisabled: {
    backgroundColor: "#1C1C1C",
    shadowOpacity: 0,
    elevation: 0,
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  goOnlinePulse: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#fff",
  },
  goOnlineBtnText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 1,
  },

  // Quick actions
  quickActions: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 14,
    gap: 10,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: "#141414",
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#222",
  },
  quickActionDisabled: { opacity: 0.4 },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(26,107,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  quickActionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 2,
  },
  quickActionSub: {
    fontSize: 10,
    color: "#555",
    fontWeight: "500",
    textAlign: "center",
  },

  // Info cards
  infoCard: {
    backgroundColor: "#141414",
    marginHorizontal: 16,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 8,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#222",
  },
  infoCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1E1E1E",
  },
  infoCardTitle: { fontSize: 14, fontWeight: "700", color: "#fff" },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1A1A1A",
  },
  infoRowLabel: {
    fontSize: 13,
    color: "#555",
    fontWeight: "600",
    flexShrink: 0,
    marginRight: 12,
  },
  infoRowValue: {
    fontSize: 13,
    color: "#ccc",
    fontWeight: "600",
    flex: 1,
    textAlign: "right",
  },

  // Danger zone
  dangerZone: {
    marginHorizontal: 16,
    marginBottom: 10,
    gap: 10,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#1A1A1A",
    borderRadius: 14,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  logoutBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(239,68,68,0.08)",
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.2)",
  },
  deleteBtnDisabled: { opacity: 0.4 },
  deleteBtnText: { color: "#EF4444", fontSize: 14, fontWeight: "700" },
  footerNote: {
    textAlign: "center",
    fontSize: 11,
    color: "#333",
    marginHorizontal: 32,
    lineHeight: 16,
  },
});
