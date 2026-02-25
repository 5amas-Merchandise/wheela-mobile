// src/screens/driver/TripFlowScreen.js
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, Polyline } from "react-native-maps";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { getAuthToken } from "../../utils/auth";

const BASE_URL = "https://wheels-backend-7ydc.onrender.com";
const GOOGLE_API_KEY = "AIzaSyAbOQwCqiWYfyKe-t1SmzUcfgNVFYaXTFo";

function decodePolyline(encoded) {
  let index = 0,
    lat = 0,
    lng = 0;
  const polyline = [];
  while (index < encoded.length) {
    let shift = 0,
      result = 0,
      byte;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    polyline.push({ latitude: lat * 1e-5, longitude: lng * 1e-5 });
  }
  return polyline;
}

export default function TripFlowScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const {
    tripId,
    passengerName,
    passengerPhone,
    destination,
    destinationAddress,
    fare,
    paymentMethod: initialPaymentMethod,
  } = route.params;

  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [token, setToken] = useState("");
  const [currentLocation, setCurrentLocation] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [tripDistance, setTripDistance] = useState("Calculating...");
  const [tripDuration, setTripDuration] = useState("Calculating...");
  const [completionResult, setCompletionResult] = useState(null);

  useEffect(() => {
    const initialize = async () => {
      const authToken = await getAuthToken();
      setToken(authToken);
      try {
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        setCurrentLocation(position.coords);
      } catch {}
      fetchTrip(authToken);
    };
    initialize();
  }, []);

  useEffect(() => {
    if (currentLocation && trip?.dropoffLocation?.coordinates) {
      const [destLng, destLat] = trip.dropoffLocation.coordinates;
      fetchRoute(
        currentLocation.latitude,
        currentLocation.longitude,
        destLat,
        destLng,
      );
    }
  }, [currentLocation, trip]);

  const fetchRoute = async (originLat, originLng, destLat, destLng) => {
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/directions/json?origin=${originLat},${originLng}&destination=${destLat},${destLng}&key=${GOOGLE_API_KEY}`,
      );
      const data = await res.json();
      if (data.routes?.length > 0) {
        const coords = decodePolyline(data.routes[0].overview_polyline.points);
        setRouteCoordinates(coords);
        setTripDistance(data.routes[0].legs[0].distance.text);
        setTripDuration(data.routes[0].legs[0].duration.text);
      }
    } catch (err) {
      console.error("Failed to fetch route:", err);
    }
  };

  const fetchTrip = async (authToken) => {
    try {
      const res = await fetch(`${BASE_URL}/trips/${tripId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTrip(data.trip);
      } else {
        Alert.alert("Error", "Could not load trip");
      }
    } catch {
      Alert.alert("Error", "Could not load trip");
    } finally {
      setLoading(false);
    }
  };

  const completeTrip = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/trips/${tripId}/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        // No body needed — backend reads paymentMethod from the Trip document
      });
      const data = await res.json();

      if (res.ok && data.success) {
        const payment = data.payment || {};
        const isWallet = payment.method === "wallet";
        const isFallback = payment.method === "cash_fallback";
        const isCash = payment.method === "cash";
        const fareNaira = payment.fareNaira || fare || 0;

        // ✅ Use the message the backend already crafted
        const driverMessage =
          payment.driverMessage ||
          (isWallet
            ? `₦${fareNaira.toLocaleString()} has been credited to your wallet. No cash needed.`
            : isFallback
              ? `Wallet payment failed. Collect ₦${fareNaira.toLocaleString()} in cash.`
              : `Collect ₦${fareNaira.toLocaleString()} in cash from the passenger.`);

        setCompletionResult({
          isWallet,
          isFallback,
          isCash,
          driverMessage,
          fareNaira,
          driverWallet: payment.driverWallet || null,
        });
      } else {
        Alert.alert("Error", data?.error?.message || "Could not complete trip");
      }
    } catch {
      Alert.alert("Error", "Network error — please try again");
    } finally {
      setActionLoading(false);
    }
  };

  const openNavigation = () => {
    const coords =
      destination?.coordinates || trip?.dropoffLocation?.coordinates;
    if (coords) {
      const [lng, lat] = coords;
      Linking.openURL(
        `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`,
      );
    }
  };

  const callPassenger = () => {
    if (passengerPhone) Linking.openURL(`tel:${passengerPhone}`);
  };

  const whatsappPassenger = () => {
    if (passengerPhone)
      Linking.openURL(
        `whatsapp://send?phone=${passengerPhone.replace("+", "")}`,
      );
  };

  // ── Loading ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.loadingContainer}>
        <ActivityIndicator size="large" color="#1A1A1A" />
        <Text style={s.loadingText}>Loading trip...</Text>
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={s.loadingContainer}>
        <Text style={s.loadingText}>Trip not found</Text>
      </View>
    );
  }

  // ── Trip Completion Screen ─────────────────────────────────────────────
  if (completionResult) {
    const {
      isWallet,
      isFallback,
      isCash,
      driverMessage,
      fareNaira,
      driverWallet,
    } = completionResult;

    // Wallet: green theme | Cash fallback: amber | Cash: blue
    const iconBg = isWallet ? "#ECFDF5" : isFallback ? "#FFFBEB" : "#EFF6FF";
    const iconColor = isWallet ? "#10B981" : isFallback ? "#D97706" : "#3B82F6";
    const iconName = isWallet ? "wallet" : isFallback ? "warning" : "cash";
    const badgeBg = isWallet ? "#ECFDF5" : isFallback ? "#FFFBEB" : "#EFF6FF";
    const badgeColor = isWallet
      ? "#10B981"
      : isFallback
        ? "#D97706"
        : "#3B82F6";
    const badgeBorder = isWallet
      ? "#A7F3D0"
      : isFallback
        ? "#FDE68A"
        : "#BFDBFE";
    const badgeLabel = isWallet
      ? "Wallet Payment"
      : isFallback
        ? "Cash (Wallet Failed)"
        : "Cash Payment";
    const boxBg = isWallet ? "#F0FDF4" : isFallback ? "#FFFBEB" : "#EFF6FF";
    const boxBorder = isWallet ? "#10B981" : isFallback ? "#D97706" : "#3B82F6";
    const titleColor = isWallet
      ? "#065F46"
      : isFallback
        ? "#92400E"
        : "#1E40AF";
    const bodyColor = isWallet ? "#047857" : isFallback ? "#B45309" : "#1D4ED8";

    return (
      <View style={s.completionContainer}>
        {/* Icon */}
        <View style={[s.completionIconWrap, { backgroundColor: iconBg }]}>
          <Ionicons name={iconName} size={44} color={iconColor} />
        </View>

        <Text style={s.completionTitle}>Trip Completed! 🎉</Text>
        <Text style={s.completionFare}>₦{fareNaira.toLocaleString()}</Text>

        {/* Payment badge */}
        <View
          style={[
            s.paymentBadge,
            { backgroundColor: badgeBg, borderColor: badgeBorder },
          ]}
        >
          <Ionicons name={iconName} size={16} color={badgeColor} />
          <Text style={[s.paymentBadgeText, { color: badgeColor }]}>
            {badgeLabel}
          </Text>
        </View>

        {/* Message box */}
        <View
          style={[
            s.messageBox,
            { backgroundColor: boxBg, borderLeftColor: boxBorder },
          ]}
        >
          <Ionicons
            name={
              isWallet
                ? "checkmark-circle"
                : isFallback
                  ? "warning"
                  : "information-circle"
            }
            size={22}
            color={boxBorder}
            style={s.messageIcon}
          />
          <View style={{ flex: 1 }}>
            <Text style={[s.messageTitle, { color: titleColor }]}>
              {isWallet
                ? "No cash needed!"
                : isFallback
                  ? "Collect cash from passenger"
                  : "Collect cash from passenger"}
            </Text>
            <Text style={[s.messageBody, { color: bodyColor }]}>
              {driverMessage}
            </Text>
            {isWallet && driverWallet && (
              <Text style={[s.messageWalletBalance, { color: titleColor }]}>
                Your new wallet balance: {driverWallet.balanceFormatted}
              </Text>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={s.doneBtn}
          onPress={() => navigation.replace("DriverOnlineMap")}
          activeOpacity={0.88}
        >
          <Ionicons
            name="home"
            size={20}
            color="#fff"
            style={{ marginRight: 8 }}
          />
          <Text style={s.doneBtnText}>Back to Dashboard</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Active Trip View ───────────────────────────────────────────────────
  const destLat = trip.dropoffLocation?.coordinates?.[1] || 0;
  const destLng = trip.dropoffLocation?.coordinates?.[0] || 0;
  const fareDisplay = fare || trip.estimatedFare || 0;

  // ✅ Always read paymentMethod from the fetched trip (ground truth from DB)
  const paymentMethod = trip.paymentMethod || initialPaymentMethod || "cash";
  const isWalletPayment = paymentMethod === "wallet";

  return (
    <View style={s.container}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={s.map}
        initialRegion={{
          latitude: currentLocation?.latitude || destLat || 9.082,
          longitude: currentLocation?.longitude || destLng || 8.6753,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {currentLocation && (
          <Marker
            coordinate={{
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
            }}
          >
            <View style={s.driverMarker}>
              <Ionicons name="car-sport" size={18} color="#fff" />
            </View>
          </Marker>
        )}
        {destLat !== 0 && (
          <Marker coordinate={{ latitude: destLat, longitude: destLng }}>
            <View style={s.destMarker}>
              <Ionicons name="flag" size={14} color="#fff" />
            </View>
          </Marker>
        )}
        {routeCoordinates.length > 0 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#1A1A1A"
            strokeWidth={4}
          />
        )}
      </MapView>

      <ScrollView style={s.bottomCard} showsVerticalScrollIndicator={false}>
        {/* Status pill */}
        <View style={s.statusPill}>
          <View style={s.statusDot} />
          <Text style={s.statusText}>Trip In Progress</Text>
        </View>

        {/* Passenger */}
        <View style={s.infoRow}>
          <View style={s.infoIconBox}>
            <Ionicons name="person" size={16} color="#1A1A1A" />
          </View>
          <Text style={s.infoLabel}>Passenger</Text>
          <Text style={s.infoValue}>{passengerName || "N/A"}</Text>
        </View>

        {/* Destination */}
        <View style={s.infoRow}>
          <View style={s.infoIconBox}>
            <Ionicons name="location" size={16} color="#EF4444" />
          </View>
          <Text style={s.infoLabel}>Destination</Text>
          <Text style={s.infoValue} numberOfLines={2}>
            {destinationAddress || "N/A"}
          </Text>
        </View>

        {/* Distance & time chips */}
        <View style={s.chipsRow}>
          <View style={s.chip}>
            <Ionicons name="navigate-outline" size={14} color="#666" />
            <Text style={s.chipText}>{tripDistance}</Text>
          </View>
          <View style={s.chipDivider} />
          <View style={s.chip}>
            <Ionicons name="time-outline" size={14} color="#666" />
            <Text style={s.chipText}>{tripDuration}</Text>
          </View>
          <View style={s.chipDivider} />
          {/* ✅ Payment method chip sourced from DB trip */}
          <View
            style={[
              s.chip,
              s.chipPayment,
              { backgroundColor: isWalletPayment ? "#ECFDF5" : "#F5F5F0" },
            ]}
          >
            <Ionicons
              name={isWalletPayment ? "wallet-outline" : "cash-outline"}
              size={14}
              color={isWalletPayment ? "#059669" : "#666"}
            />
            <Text
              style={[
                s.chipText,
                { color: isWalletPayment ? "#059669" : "#666" },
              ]}
            >
              {isWalletPayment ? "Wallet" : "Cash"}
            </Text>
          </View>
        </View>

        {/* Fare */}
        <View style={s.fareRow}>
          <Text style={s.fareLabel}>Fare</Text>
          <View style={s.fareRight}>
            <Text style={s.fareAmount}>₦{fareDisplay.toLocaleString()}</Text>
            {isWalletPayment && (
              <View style={s.walletTag}>
                <Ionicons name="checkmark-circle" size={12} color="#059669" />
                <Text style={s.walletTagText}>Auto-paid</Text>
              </View>
            )}
          </View>
        </View>

        {/* Wallet notice — driver sees this before completing */}
        {isWalletPayment && (
          <View style={s.walletNoticeBanner}>
            <Ionicons name="information-circle" size={18} color="#059669" />
            <Text style={s.walletNoticeText}>
              Payment via wallet — no cash needed from passenger after
              completion. Your wallet will be credited automatically.
            </Text>
          </View>
        )}

        {/* Action buttons */}
        <View style={s.actionsRow}>
          <TouchableOpacity
            style={s.actionBtn}
            onPress={callPassenger}
            activeOpacity={0.8}
          >
            <Ionicons name="call" size={22} color="#1A1A1A" />
            <Text style={s.actionBtnText}>Call</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.actionBtn}
            onPress={whatsappPassenger}
            activeOpacity={0.8}
          >
            <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
            <Text style={s.actionBtnText}>WhatsApp</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.actionBtn}
            onPress={openNavigation}
            activeOpacity={0.8}
          >
            <Ionicons name="navigate" size={22} color="#3B82F6" />
            <Text style={s.actionBtnText}>Navigate</Text>
          </TouchableOpacity>
        </View>

        {/* Complete button */}
        <TouchableOpacity
          style={[s.completeBtn, actionLoading && s.completeBtnDisabled]}
          onPress={completeTrip}
          disabled={actionLoading}
          activeOpacity={0.88}
        >
          {actionLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons
                name="checkmark-circle"
                size={22}
                color="#fff"
                style={{ marginRight: 8 }}
              />
              <Text style={s.completeBtnText}>Complete Trip</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F0" },
  map: { flex: 1 },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F5F0",
  },
  loadingText: {
    color: "#1A1A1A",
    marginTop: 16,
    fontSize: 16,
    fontWeight: "600",
  },
  driverMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1A1A1A",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  destMarker: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#EF4444",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  bottomCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === "ios" ? 36 : 20,
    maxHeight: "50%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 12,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#F0FDF4",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginBottom: 16,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
    marginRight: 8,
  },
  statusText: { fontSize: 13, fontWeight: "700", color: "#065F46" },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  infoIconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "#F5F5F0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  infoLabel: {
    fontSize: 13,
    color: "#999",
    fontWeight: "600",
    width: 80,
    paddingTop: 5,
  },
  infoValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: "#1A1A1A",
    paddingTop: 5,
  },
  chipsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
  },
  chipPayment: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  chipText: { fontSize: 12, color: "#666", fontWeight: "600", marginLeft: 5 },
  chipDivider: { width: 1, height: 14, backgroundColor: "#E0E0E0" },
  fareRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  fareLabel: { fontSize: 14, color: "#888", fontWeight: "600" },
  fareRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  fareAmount: { fontSize: 26, fontWeight: "800", color: "#1A1A1A" },
  walletTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ECFDF5",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  walletTagText: { fontSize: 11, fontWeight: "700", color: "#059669" },
  walletNoticeBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#F0FDF4",
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
    borderLeftWidth: 3,
    borderLeftColor: "#10B981",
  },
  walletNoticeText: {
    flex: 1,
    fontSize: 12,
    color: "#047857",
    fontWeight: "500",
    lineHeight: 17,
  },
  actionsRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  actionBtn: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5F5F0",
    borderRadius: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1A1A1A",
    marginTop: 4,
  },
  completeBtn: {
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    paddingVertical: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  completeBtnDisabled: { backgroundColor: "#C0C0C0" },
  completeBtnText: { color: "#fff", fontSize: 17, fontWeight: "800" },
  // Completion screen
  completionContainer: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingBottom: Platform.OS === "ios" ? 36 : 20,
  },
  completionIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  completionTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#1A1A1A",
    marginBottom: 6,
  },
  completionFare: {
    fontSize: 42,
    fontWeight: "900",
    color: "#1A1A1A",
    marginBottom: 16,
  },
  paymentBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginBottom: 20,
  },
  paymentBadgeText: { fontSize: 14, fontWeight: "700" },
  messageBox: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 14,
    borderLeftWidth: 4,
    padding: 14,
    marginBottom: 24,
  },
  messageIcon: { marginRight: 12, marginTop: 2 },
  messageTitle: { fontSize: 15, fontWeight: "800", marginBottom: 4 },
  messageBody: { fontSize: 13, fontWeight: "500", lineHeight: 19 },
  messageWalletBalance: { fontSize: 13, fontWeight: "700", marginTop: 8 },
  doneBtn: {
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    paddingVertical: 17,
    paddingHorizontal: 32,
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    justifyContent: "center",
  },
  doneBtnText: { color: "#fff", fontSize: 17, fontWeight: "800" },
});
