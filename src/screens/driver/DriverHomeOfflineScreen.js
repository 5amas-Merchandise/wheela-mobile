import React, { useEffect, useState } from "react";
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
} from "react-native";
import axios from "axios";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

// Utils
import { getAuthToken, removeAuthToken, logout } from "../../utils/auth";

// Backend URL
const baseUrl = "https://wheels-backend-7ydc.onrender.com";

export default function DriverHomeOfflineScreen() {
  const navigation = useNavigation();

  const [driverData, setDriverData] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [token, setToken] = useState(null);
  const [goingOnline, setGoingOnline] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const fetchProfileData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setIsRefreshing(true);

    try {
      const authToken = await getAuthToken();
      if (!authToken) {
        Alert.alert("Session Expired", "Please log in again.", [
          { text: "OK", onPress: () => navigation.replace("Login") },
        ]);
        return;
      }

      setToken(authToken);

      // Fetch user data
      const res = await axios.get(`${baseUrl}/users/me`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      });

      console.log("User profile response:", res.data);

      if (res.data && res.data.user) {
        const user = res.data.user;

        // Set user data
        setUserData({
          name: user.name || "Driver",
          phone: user.phone || "Not set",
          email: user.email || "Not set",
          isActive: user.isActive,
          userId: user._id,
        });

        // Set driver data with proper defaults
        setDriverData({
          driverProfile: user.driverProfile || {
            verified: false,
            verificationState: "pending",
            isAvailable: false,
          },
          roles: user.roles || { isUser: true, isDriver: true, isAdmin: false },
        });
      } else {
        throw new Error("Invalid response format");
      }
    } catch (err) {
      console.error("Error fetching profile:", err);

      if (err.code === "ECONNABORTED") {
        Alert.alert(
          "Connection Timeout",
          "Server is taking too long to respond."
        );
      } else if (err.response) {
        if (err.response.status === 401) {
          await removeAuthToken();
          Alert.alert("Session Expired", "Please log in again.", [
            { text: "OK", onPress: () => navigation.replace("Login") },
          ]);
        } else if (err.response.status === 404) {
          Alert.alert("Not Found", "User profile not found.");
        } else if (err.response.status === 500) {
          Alert.alert("Server Error", "Please try again later.");
        } else {
          Alert.alert(
            "Error",
            err.response.data?.error?.message || "Could not load your profile.",
            [{ text: "Retry", onPress: () => fetchProfileData(true) }]
          );
        }
      } else if (err.request) {
        Alert.alert(
          "Network Error",
          "Please check your internet connection and try again."
        );
      } else {
        Alert.alert("Error", "An unexpected error occurred.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      setIsRefreshing(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchProfileData(true);
      return () => {};
    }, [])
  );

  const onRefresh = () => {
    if (!isRefreshing) {
      setRefreshing(true);
      fetchProfileData(false);
    }
  };

  const handleGoOnline = async () => {
    const profile = driverData?.driverProfile || {};
    const isVerified = profile.verified === true;
    const verificationState = profile.verificationState || "pending";

    if (verificationState !== "approved") {
      Alert.alert(
        "Verification Pending",
        verificationState === "rejected"
          ? "Your verification was rejected. Please update your documents and try again."
          : "Your documents are still under review. You will be notified once approved (usually 24-48 hours).",
        [
          { text: "OK" },
          {
            text: "Update Documents",
            onPress: () => navigation.navigate("DriverProfileVerification"),
          },
        ]
      );
      return;
    }

    if (!isVerified) {
      Alert.alert(
        "Account Not Verified",
        "Your account is not verified yet. Please contact support.",
        [{ text: "OK" }]
      );
      return;
    }

    Alert.alert(
      "Go Online",
      "Are you ready to start accepting rides? Make sure you have a stable internet connection.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Go Online",
          onPress: async () => {
            setGoingOnline(true);
            try {
              const response = await axios.post(
                `${baseUrl}/drivers/availability`,
                {
                  isAvailable: true,
                  lastSeen: new Date().toISOString(),
                },
                {
                  headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                  },
                  timeout: 10000,
                }
              );

              console.log("Go online response:", response.data);

              navigation.replace("DriverOnlineMap");
            } catch (err) {
              console.error("Error going online:", err);

              if (err.response?.status === 401) {
                await removeAuthToken();
                Alert.alert("Session Expired", "Please log in again.", [
                  { text: "OK", onPress: () => navigation.replace("Login") },
                ]);
              } else {
                Alert.alert(
                  "Error",
                  err.response?.data?.error?.message ||
                    "Failed to go online. Please check your connection and try again.",
                  [{ text: "OK" }]
                );
              }
            } finally {
              setGoingOnline(false);
            }
          },
        },
      ]
    );
  };

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

  const handleDeleteAccount = () => {
    // Check if account is already suspended
    if (userData && userData.isActive === false) {
      Alert.alert(
        "Account Already Suspended",
        "Your account has already been suspended.",
        [{ text: "OK" }]
      );
      return;
    }

    Alert.alert(
      "Delete Account",
      "Are you sure you want to delete your account? This action will SUSPEND your account and cannot be undone. You will not be able to log in again.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Continue",
          style: "destructive",
          onPress: () => confirmDeleteAccount(),
        },
      ]
    );
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      "Confirm Deletion",
      "Type DELETE to confirm account suspension:",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Type DELETE",
          style: "destructive",
          onPress: () => showTypeDeleteInput(),
        },
      ]
    );
  };

  const showTypeDeleteInput = () => {
    Alert.prompt(
      "Type DELETE",
      "Please type DELETE to confirm account suspension:",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
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
      'plain-text'
    );
  };

  const proceedWithDeletion = async () => {
    Alert.alert(
      "Final Warning",
      "This is your last chance to cancel. Your account will be permanently SUSPENDED. This cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "SUSPEND MY ACCOUNT",
          style: "destructive",
          onPress: async () => {
            setDeletingAccount(true);
            try {
              const authToken = await getAuthToken();
              
              // Call the delete/suspend account API
              const response = await axios.delete(`${baseUrl}/auth/delete-account`, {
                headers: {
                  Authorization: `Bearer ${authToken}`,
                  "Content-Type": "application/json",
                },
                data: {
                  reason: "User requested account deletion",
                  userId: userData?.userId,
                },
                timeout: 10000,
              });

              if (response.data.ok) {
                await logout();
                Alert.alert(
                  "Account Suspended",
                  "Your account has been suspended successfully. You will not be able to log in again.",
                  [
                    {
                      text: "OK",
                      onPress: () => navigation.replace("Welcome"),
                    },
                  ]
                );
              }
            } catch (error) {
              console.error("Error deleting account:", error);
              
              // Handle specific error cases
              if (error.response?.status === 403) {
                Alert.alert(
                  "Account Already Suspended",
                  "This account has already been suspended."
                );
              } else if (error.response?.status === 400) {
                if (error.response.data?.error?.message?.includes('active rides')) {
                  Alert.alert(
                    "Active Rides Found",
                    "Please complete or cancel all active rides before deleting your account.",
                    [
                      { text: "OK" },
                      {
                        text: "Go to Rides",
                        onPress: () => navigation.navigate("DriverRides"),
                      }
                    ]
                  );
                } else if (error.response.data?.error?.message?.includes('balance')) {
                  Alert.alert(
                    "Wallet Balance",
                    "Please withdraw your remaining balance before deleting your account.",
                    [
                      { text: "OK" },
                      {
                        text: "Go to Wallet",
                        onPress: () => navigation.navigate("Wallet"),
                      }
                    ]
                  );
                } else {
                  Alert.alert(
                    "Cannot Delete Account",
                    error.response.data?.error?.message || "Failed to delete account"
                  );
                }
              } else if (error.response?.status === 401) {
                await removeAuthToken();
                Alert.alert(
                  "Session Expired",
                  "Please log in again.",
                  [
                    { text: "OK", onPress: () => navigation.replace("Login") },
                  ]
                );
              } else if (error.request) {
                Alert.alert(
                  "Network Error",
                  "Please check your internet connection and try again."
                );
              } else {
                Alert.alert(
                  "Deletion Failed",
                  "Failed to delete account. Please try again or contact support."
                );
              }
            } finally {
              setDeletingAccount(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066FF" />
        <Text style={styles.loadingText}>Loading your profile...</Text>
      </View>
    );
  }

  const profile = driverData?.driverProfile || {};
  const user = userData || {};
  const roles = driverData?.roles || {
    isUser: true,
    isDriver: true,
    isAdmin: false,
  };

  const isVerified = profile.verified === true;
  const verificationState = profile.verificationState || "pending";
  const profilePicUrl = profile.profilePicUrl || "";
  const isAvailable = profile.isAvailable || false;
  const isAccountActive = user.isActive !== false; // Default to true if not specified

  const vehicleDisplay =
    profile.vehicleMake && profile.vehicleModel && profile.vehicleNumber
      ? `${profile.vehicleMake} ${
          profile.vehicleModel
        } • ${profile.vehicleNumber.toUpperCase()}`
      : "Not set";

  let statusText = "";
  let statusColor = "#F59E0B";

  switch (verificationState) {
    case "approved":
      statusText = "Verified";
      statusColor = "#10B981";
      break;
    case "rejected":
      statusText = "Rejected";
      statusColor = "#EF4444";
      break;
    default:
      statusText = "Pending Review";
      statusColor = "#F59E0B";
  }

  // Account status badge
  const accountStatusText = isAccountActive ? "Active" : "Suspended";
  const accountStatusColor = isAccountActive ? "#10B981" : "#EF4444";

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={["#0066FF"]}
          tintColor="#0066FF"
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.userName}>{user.name || "Driver"}</Text>
          </View>
          {profilePicUrl ? (
            <Image
              source={{ uri: profilePicUrl }}
              style={styles.profileImage}
              resizeMode="cover"
              onError={() => console.log("Failed to load profile image")}
            />
          ) : (
            <View style={styles.defaultAvatar}>
              <Ionicons name="person" size={32} color="#0066FF" />
            </View>
          )}
        </View>
      </View>

      {/* Account Status Badge */}
      {!isAccountActive && (
        <View style={styles.suspendedWarning}>
          <Ionicons name="alert-circle" size={20} color="#FFFFFF" />
          <Text style={styles.suspendedWarningText}>
            ACCOUNT SUSPENDED
          </Text>
        </View>
      )}

      {/* Status Card */}
      <View style={styles.statusCard}>
        <View style={styles.statusHeader}>
          <Text style={styles.statusTitle}>Account Status</Text>
          <View style={styles.statusBadge}>
            <View
              style={[styles.statusDot, { backgroundColor: statusColor }]}
            />
            <Text style={[styles.statusBadgeText, { color: statusColor }]}>
              {statusText}
            </Text>
          </View>
        </View>

        <View style={styles.statusDetail}>
          <Ionicons
            name={isAvailable ? "checkmark-circle" : "close-circle"}
            size={20}
            color={isAvailable ? "#10B981" : "#6B7280"}
          />
          <Text style={styles.statusDetailText}>
            {isAvailable ? "Currently Online" : "Currently Offline"}
          </Text>
        </View>

        {/* Account Active Status */}
        <View style={styles.accountStatusRow}>
          <Ionicons
            name={isAccountActive ? "shield-checkmark" : "shield-off"}
            size={20}
            color={accountStatusColor}
          />
          <Text style={[styles.accountStatusText, { color: accountStatusColor }]}>
            Account: {accountStatusText}
          </Text>
        </View>

        {verificationState === "pending" && (
          <View style={styles.statusNote}>
            <Ionicons name="time-outline" size={16} color="#F59E0B" />
            <Text style={styles.statusNoteText}>
              Your documents are under review. You'll be notified once approved
              (usually 24-48 hours).
            </Text>
          </View>
        )}

        {verificationState === "rejected" && (
          <View style={[styles.statusNote, { backgroundColor: "#FEF2F2" }]}>
            <Ionicons name="alert-circle-outline" size={16} color="#EF4444" />
            <Text style={[styles.statusNoteText, { color: "#991B1B" }]}>
              Your verification was rejected. Please update your documents and
              try again.
            </Text>
          </View>
        )}

        {(verificationState === "pending" ||
          verificationState === "rejected") && (
          <TouchableOpacity
            style={styles.updateDocButton}
            onPress={() => navigation.navigate("DriverProfileVerification")}
          >
            <Ionicons name="document-text-outline" size={18} color="#FFFFFF" />
            <Text style={styles.updateDocButtonText}>
              {verificationState === "rejected"
                ? "Re-submit Documents"
                : "Update Documents"}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Go Online Button */}
      <TouchableOpacity
        style={[
          styles.goOnlineBtn,
          (!isVerified || !isAccountActive) && styles.disabledBtn,
          verificationState === "rejected" && styles.rejectedBtn,
          (goingOnline || !isAccountActive) && styles.loadingBtn,
        ]}
        onPress={handleGoOnline}
        disabled={!isVerified || goingOnline || !isAccountActive}
      >
        {goingOnline ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : !isAccountActive ? (
          <>
            <Ionicons name="ban-outline" size={24} color="#FFFFFF" />
            <Text style={styles.goOnlineText}>ACCOUNT SUSPENDED</Text>
          </>
        ) : (
          <>
            <Ionicons name="radio-button-on" size={24} color="#FFFFFF" />
            <Text style={styles.goOnlineText}>
              {isVerified
                ? "GO ONLINE"
                : verificationState === "rejected"
                ? "ACCOUNT REJECTED"
                : "WAITING FOR APPROVAL"}
            </Text>
          </>
        )}
      </TouchableOpacity>

      {/* Vehicle Information Card */}
      <View style={styles.infoCard}>
        <View style={styles.cardHeader}>
          <Ionicons name="car-sport" size={20} color="#0066FF" />
          <Text style={styles.cardTitle}>Vehicle Information</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Vehicle</Text>
          <Text style={styles.infoValue}>{vehicleDisplay}</Text>
        </View>

        {profile.nin && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>NIN</Text>
            <Text style={styles.infoValue}>{profile.nin}</Text>
          </View>
        )}

        {profile.licenseNumber && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>License Number</Text>
            <Text style={styles.infoValue}>{profile.licenseNumber}</Text>
          </View>
        )}

        {profile.serviceCategories && profile.serviceCategories.length > 0 && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Service Type</Text>
            <Text style={styles.infoValue}>
              {profile.serviceCategories
                .map((cat) => {
                  const serviceMap = {
                    CITY_RIDE: "City Ride",
                    DELIVERY_BIKE: "Delivery (Bike)",
                    TRUCK: "Truck/Logistics",
                    INTERSTATE: "Interstate Travel",
                    KEKE: "Keke/Tricycle",
                    LUXURY_RENTAL: "Luxury Rental",
                  };
                  return serviceMap[cat] || cat.replace("_", " ");
                })
                .join(", ")}
            </Text>
          </View>
        )}
      </View>

      {/* Contact Information Card */}
      <View style={styles.infoCard}>
        <View style={styles.cardHeader}>
          <Ionicons name="person" size={20} color="#0066FF" />
          <Text style={styles.cardTitle}>Contact Information</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Phone</Text>
          <Text style={styles.infoValue}>{user.phone || "Not set"}</Text>
        </View>

        {user.email && user.email !== "Not set" && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{user.email}</Text>
          </View>
        )}
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={[styles.actionCard, !isAccountActive && styles.disabledActionCard]}
          onPress={() => navigation.navigate("Subscription")}
          disabled={!isAccountActive}
        >
          <View style={styles.actionIconContainer}>
            <Ionicons name="card-outline" size={24} color="#0066FF" />
          </View>
          <Text style={styles.actionTitle}>Subscription</Text>
          <Text style={styles.actionSubtitle}>Manage plan</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, !isAccountActive && styles.disabledActionCard]}
          onPress={() => navigation.navigate("Wallet")}
          disabled={!isAccountActive}
        >
          <View style={styles.actionIconContainer}>
            <Ionicons name="wallet-outline" size={24} color="#0066FF" />
          </View>
          <Text style={styles.actionTitle}>Wallet</Text>
          <Text style={styles.actionSubtitle}>View balance</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, !isAccountActive && styles.disabledActionCard]}
          onPress={() => navigation.navigate("Earnings")}
          disabled={!isAccountActive}
        >
          <View style={styles.actionIconContainer}>
            <Ionicons name="cash-outline" size={24} color="#0066FF" />
          </View>
          <Text style={styles.actionTitle}>Earnings</Text>
          <Text style={styles.actionSubtitle}>View your earnings</Text>
        </TouchableOpacity>
      </View>

      {/* Delete Account Button */}
      <TouchableOpacity
        style={[
          styles.deleteAccountBtn,
          deletingAccount && styles.loadingBtn,
          !isAccountActive && styles.disabledDeleteBtn,
        ]}
        onPress={handleDeleteAccount}
        disabled={deletingAccount || !isAccountActive}
      >
        {deletingAccount ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : !isAccountActive ? (
          <>
            <Ionicons name="ban-outline" size={20} color="#FFFFFF" />
            <Text style={styles.deleteAccountText}>ACCOUNT SUSPENDED</Text>
          </>
        ) : (
          <>
            <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
            <Text style={styles.deleteAccountText}>Delete Account</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Logout Button */}
      <TouchableOpacity 
        style={styles.logoutBtn} 
        onPress={handleLogout}
        disabled={deletingAccount}
      >
        <Ionicons name="log-out-outline" size={20} color="#EF4444" />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      {/* Info Note */}
      {isAccountActive && (
        <View style={styles.infoNote}>
          <Ionicons name="information-circle-outline" size={16} color="#6B7280" />
          <Text style={styles.infoNoteText}>
            Account deletion will suspend your account. You will not be able to log in again.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  contentContainer: {
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#6B7280",
    fontSize: 16,
    marginTop: 16,
  },
  header: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  greeting: {
    color: "#6B7280",
    fontSize: 14,
    marginBottom: 4,
  },
  userName: {
    color: "#111827",
    fontSize: 28,
    fontWeight: "700",
  },
  profileImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: "#0066FF",
  },
  defaultAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#DBEAFE",
  },
  suspendedWarning: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#EF4444",
    marginHorizontal: 20,
    marginTop: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  suspendedWarningText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  statusCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statusHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  statusTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "600",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 13,
    fontWeight: "600",
  },
  statusDetail: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  statusDetailText: {
    color: "#6B7280",
    fontSize: 14,
  },
  accountStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  accountStatusText: {
    fontSize: 14,
    fontWeight: "600",
  },
  statusNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#FFFBEB",
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  statusNoteText: {
    color: "#92400E",
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  updateDocButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#0066FF",
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  updateDocButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  goOnlineBtn: {
    backgroundColor: "#0066FF",
    marginHorizontal: 20,
    marginTop: 20,
    paddingVertical: 18,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: "#0066FF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  disabledBtn: {
    backgroundColor: "#9CA3AF",
    shadowOpacity: 0.1,
  },
  rejectedBtn: {
    backgroundColor: "#EF4444",
  },
  loadingBtn: {
    opacity: 0.7,
  },
  goOnlineText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  infoCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  cardTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "600",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  infoLabel: {
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "500",
  },
  infoValue: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
    textAlign: "right",
  },
  quickActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: 20,
    marginTop: 16,
    gap: 12,
  },
  actionCard: {
    backgroundColor: "#FFFFFF",
    flex: 1,
    minWidth: "47%",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  disabledActionCard: {
    backgroundColor: "#F3F4F6",
    opacity: 0.6,
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  actionTitle: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  actionSubtitle: {
    color: "#6B7280",
    fontSize: 12,
    textAlign: "center",
  },
  deleteAccountBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 20,
    marginTop: 16,
    paddingVertical: 16,
    borderRadius: 8,
    backgroundColor: "#DC2626",
  },
  disabledDeleteBtn: {
    backgroundColor: "#9CA3AF",
  },
  deleteAccountText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 20,
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: "#FEF2F2",
  },
  logoutText: {
    color: "#EF4444",
    fontSize: 16,
    fontWeight: "600",
  },
  infoNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 20,
    marginTop: 12,
    padding: 12,
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
  },
  infoNoteText: {
    color: "#6B7280",
    fontSize: 12,
    flex: 1,
  },
});