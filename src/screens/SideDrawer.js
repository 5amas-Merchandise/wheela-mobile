// src/screens/SideDrawer.js
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAuthToken, logout, removeAuthToken } from "../utils/auth";

const baseUrl = "https://wheels-backend-7ydc.onrender.com";
const USER_PROFILE_CACHE_KEY = "USER_PROFILE_CACHE";
const USER_PROFILE_TIMESTAMP_KEY = "USER_PROFILE_TIMESTAMP";
const CACHE_DURATION = 5 * 60 * 1000;

const SideDrawer = ({ navigation }) => {
  const [user, setUser] = useState({
    name: "Loading...",
    phone: "",
    profilePicUrl: "",
  });
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const isCacheValid = async () => {
    try {
      const timestampStr = await AsyncStorage.getItem(
        USER_PROFILE_TIMESTAMP_KEY,
      );
      if (!timestampStr) return false;
      return Date.now() - parseInt(timestampStr, 10) < CACHE_DURATION;
    } catch {
      return false;
    }
  };

  const getCachedProfile = async () => {
    try {
      const cached = await AsyncStorage.getItem(USER_PROFILE_CACHE_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  };

  const cacheProfile = async (profileData) => {
    try {
      await AsyncStorage.setItem(
        USER_PROFILE_CACHE_KEY,
        JSON.stringify(profileData),
      );
      await AsyncStorage.setItem(
        USER_PROFILE_TIMESTAMP_KEY,
        Date.now().toString(),
      );
    } catch {}
  };

  const fetchUserProfile = async (forceRefresh = false) => {
    try {
      const token = await getAuthToken();
      if (!token) {
        await logout();
        navigation.replace("Welcome");
        return;
      }

      if (!forceRefresh) {
        const cacheValid = await isCacheValid();
        if (cacheValid) {
          const cachedProfile = await getCachedProfile();
          if (cachedProfile) {
            setUser(cachedProfile);
            setLoading(false);
            return;
          }
        }
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await axios.get(`${baseUrl}/users/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        timeout: 8000,
      });
      clearTimeout(timeoutId);

      if (res.data?.user) {
        const u = res.data.user;
        const profileData = {
          name: u.name || "Passenger",
          phone: u.phone || "Not set",
          profilePicUrl: u.profilePicUrl || "",
        };
        setUser(profileData);
        setUserData(u);
        await cacheProfile(profileData);
        setRetryCount(0);
      }
    } catch (err) {
      const cachedProfile = await getCachedProfile();
      if (cachedProfile) {
        setUser(cachedProfile);
      } else if (err.code === "ECONNABORTED" || err.message === "canceled") {
        if (retryCount < 2) {
          setTimeout(
            () => {
              setRetryCount((p) => p + 1);
              fetchUserProfile();
            },
            1000 * (retryCount + 1),
          );
        } else {
          setUser({
            name: "Network Error",
            phone: "Check your connection",
            profilePicUrl: "",
          });
        }
      } else if (err.response?.status === 401) {
        await logout();
        navigation.replace("Welcome");
      } else {
        setUser({
          name: "Error Loading",
          phone: "Tap to retry",
          profilePicUrl: "",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setLoading(true);
    setRetryCount(0);
    fetchUserProfile(true);
  };

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const handleDeleteAccount = () => {
    if (userData?.isActive === false) {
      Alert.alert(
        "Account Already Deleted",
        "Your account has already been deleted.",
        [{ text: "OK" }],
      );
      return;
    }
    Alert.alert(
      "Delete Account",
      "This will permanently DELETE your account and cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          style: "destructive",
          onPress: () => confirmDeleteAccount(),
        },
      ],
    );
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      "Confirm Deletion",
      "Type DELETE to confirm account deletion:",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Type DELETE",
          style: "destructive",
          onPress: () => showTypeDeleteInput(),
        },
      ],
    );
  };

  const showTypeDeleteInput = () => {
    Alert.prompt(
      "Type DELETE",
      "Please type DELETE to confirm:",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          style: "destructive",
          onPress: (input) => {
            if (input?.toUpperCase() === "DELETE") proceedWithDeletion();
            else Alert.alert("Incorrect", "You must type DELETE exactly.");
          },
        },
      ],
      "plain-text",
    );
  };

  const proceedWithDeletion = async () => {
    Alert.alert(
      "Final Warning",
      "Your account will be permanently DELETED. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "DELETE MY ACCOUNT",
          style: "destructive",
          onPress: async () => {
            setDeletingAccount(true);
            try {
              const authToken = await getAuthToken();
              const response = await axios.delete(
                `${baseUrl}/auth/delete-account`,
                {
                  headers: {
                    Authorization: `Bearer ${authToken}`,
                    "Content-Type": "application/json",
                  },
                  data: {
                    reason: "User requested account deletion",
                    userId: userData?.userId,
                  },
                  timeout: 10000,
                },
              );
              if (response.data.ok) {
                await AsyncStorage.multiRemove([
                  USER_PROFILE_CACHE_KEY,
                  USER_PROFILE_TIMESTAMP_KEY,
                ]);
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
              }
            } catch (error) {
              if (error.response?.status === 403)
                Alert.alert(
                  "Already Suspended",
                  "This account has already been suspended.",
                );
              else if (error.response?.status === 401) {
                await removeAuthToken();
                navigation.replace("Login");
              } else
                Alert.alert(
                  "Deletion Failed",
                  "Failed to delete account. Please try again.",
                );
            } finally {
              setDeletingAccount(false);
            }
          },
        },
      ],
    );
  };

  const menuItems = [
    {
      id: "home",
      title: "Home",
      icon: "home-outline",
      screen: "PassengerHome",
    },
    {
      id: "history",
      title: "Ride History",
      icon: "time-outline",
      screen: "TripHistory",
    },
    {
      id: "intercity",
      title: "City to City",
      icon: "car-outline",
      screen: "CityToCity",
    },
    {
      id: "wallet",
      title: "Payment Methods",
      icon: "card-outline",
      screen: "PaymentMethods",
    },
    {
      id: "promos",
      title: "Promotions",
      icon: "pricetag-outline",
      screen: "Promotions",
    },
    {
      id: "Passwallet",
      title: "Wallet",
      icon: "card-outline",
      screen: "PassWallet",
    },
    { id: "help", title: "Help", icon: "help-circle-outline", screen: "Help" },
    {
      id: "settings",
      title: "Settings",
      icon: "settings-outline",
      screen: "Settings",
    },
  ];

  const handleNavigate = (screen) => {
    navigation.navigate(screen);
    navigation.closeDrawer();
  };

  const handleLogout = () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          try {
            await AsyncStorage.multiRemove([
              USER_PROFILE_CACHE_KEY,
              USER_PROFILE_TIMESTAMP_KEY,
            ]);
          } catch {}
          await logout();
          navigation.replace("Welcome");
        },
      },
    ]);
  };

  const handleBecomeDriver = () => {
    Alert.alert(
      "Become a Driver",
      "You will be logged out and redirected to the driver registration flow. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          onPress: async () => {
            await logout();
            navigation.replace("Welcome");
          },
        },
      ],
    );
  };

  const isError =
    user.name === "Error Loading" || user.name === "Network Error";
  const initials = (user.name || "P").charAt(0).toUpperCase();

  return (
    <SafeAreaView style={s.container}>
      {/* ── HEADER / PROFILE ── */}
      <View style={s.profileSection}>
        {/* Avatar */}
        {loading ? (
          <View style={s.avatarRing}>
            <ActivityIndicator color="#1A1A1A" />
          </View>
        ) : user.profilePicUrl ? (
          <Image source={{ uri: user.profilePicUrl }} style={s.avatarImage} />
        ) : (
          <TouchableOpacity onPress={handleRetry} activeOpacity={0.8}>
            <View style={[s.avatarRing, isError && s.avatarRingError]}>
              <Text style={s.avatarInitial}>{initials}</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Info */}
        <TouchableOpacity
          style={s.profileInfo}
          onPress={handleRetry}
          disabled={loading}
          activeOpacity={0.7}
        >
          <Text style={s.profileName} numberOfLines={1}>
            {user.name}
            {retryCount > 0 ? ` (${retryCount}/2)` : ""}
          </Text>
          <Text style={s.profilePhone}>{user.phone}</Text>
          <View style={s.profileRatingRow}>
            <Ionicons name="star" size={13} color="#F59E0B" />
            <Text style={s.profileRating}>4.92</Text>
            {isError && (
              <View style={s.retryPill}>
                <Ionicons name="refresh" size={11} color="#fff" />
                <Text style={s.retryPillText}>Retry</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        {/* ── MENU ITEMS ── */}
        <View style={s.menuSection}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={item.id}
              style={[
                s.menuItem,
                index === menuItems.length - 1 && { borderBottomWidth: 0 },
              ]}
              onPress={() => handleNavigate(item.screen)}
              activeOpacity={0.7}
            >
              <View style={s.menuIconWrap}>
                <Ionicons name={item.icon} size={20} color="#1A1A1A" />
              </View>
              <Text style={s.menuText}>{item.title}</Text>
              <Ionicons name="chevron-forward" size={16} color="#ccc" />
            </TouchableOpacity>
          ))}
        </View>

        {/* ── DRIVER CTA ── */}
        <TouchableOpacity
          style={s.driverCTA}
          onPress={handleBecomeDriver}
          activeOpacity={0.85}
        >
          <View style={s.driverCTAIcon}>
            <Ionicons name="car-sport" size={24} color="#1A1A1A" />
          </View>
          <View style={s.driverCTAText}>
            <Text style={s.driverCTATitle}>Drive with Wheela</Text>
            <Text style={s.driverCTASub}>Earn money on your schedule</Text>
          </View>
          <View style={s.driverCTABadge}>
            <Text style={s.driverCTABadgeText}>Join</Text>
          </View>
        </TouchableOpacity>

        {/* ── DELETE ACCOUNT ── */}
        <TouchableOpacity
          style={s.deleteBtn}
          onPress={handleDeleteAccount}
          disabled={deletingAccount}
          activeOpacity={0.8}
        >
          {deletingAccount ? (
            <ActivityIndicator size="small" color="#EF4444" />
          ) : (
            <>
              <Ionicons name="trash-outline" size={18} color="#EF4444" />
              <Text style={s.deleteBtnText}>Delete Account</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* ── FOOTER ── */}
      <View style={s.footer}>
        <TouchableOpacity
          style={s.logoutBtn}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <View style={s.logoutIconWrap}>
            <Ionicons name="log-out-outline" size={18} color="#EF4444" />
          </View>
          <Text style={s.logoutText}>Log Out</Text>
        </TouchableOpacity>
        <Text style={s.version}>Wheela v1.2.0</Text>
      </View>
    </SafeAreaView>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// STYLES — mirrors PassengerHomeScreen design language
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F0",
  },

  // ── Profile section ──
  profileSection: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1A1A",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 16 : 28,
    paddingBottom: 28,
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.2)",
  },
  avatarRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.25)",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarRingError: {
    borderColor: "#EF4444",
  },
  avatarInitial: {
    fontSize: 26,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.5,
  },
  profileInfo: {
    flex: 1,
    marginLeft: 16,
  },
  profileName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.3,
    marginBottom: 3,
  },
  profilePhone: {
    fontSize: 13,
    color: "rgba(255,255,255,0.55)",
    marginBottom: 6,
  },
  profileRatingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  profileRating: {
    fontSize: 13,
    fontWeight: "700",
    color: "rgba(255,255,255,0.75)",
  },
  retryPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EF4444",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
    marginLeft: 6,
  },
  retryPillText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },

  // ── Menu section ──
  menuSection: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 5,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F0",
  },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#F5F5F0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  menuText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#1A1A1A",
    letterSpacing: -0.1,
  },

  // ── Driver CTA ──
  driverCTA: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 18,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 5,
  },
  driverCTAIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#F5F5F0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  driverCTAText: {
    flex: 1,
  },
  driverCTATitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1A1A1A",
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  driverCTASub: {
    fontSize: 12,
    color: "#888",
  },
  driverCTABadge: {
    backgroundColor: "#1A1A1A",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  driverCTABadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
  },

  // ── Delete button ──
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    paddingVertical: 15,
    borderWidth: 1.5,
    borderColor: "#FEE2E2",
    gap: 8,
  },
  deleteBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#EF4444",
  },

  // ── Footer ──
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#EBEBEB",
    backgroundColor: "#fff",
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  logoutIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#FEF2F2",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#EF4444",
  },
  version: {
    fontSize: 12,
    color: "#bbb",
    textAlign: "center",
    letterSpacing: 0.5,
  },
});

export default SideDrawer;
