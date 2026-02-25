// src/screens/driver/RideRequestScreen.js
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
  Linking,
  StatusBar,
  Platform,
  Modal,
  ScrollView,
  BackHandler,
  Vibration,
  Animated,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { getAuthToken } from "../../utils/auth";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";

const { width, height } = Dimensions.get("window");
const ASPECT_RATIO = width / height;
const baseUrl = "https://wheels-backend-7ydc.onrender.com";
const GOOGLE_API_KEY = "AIzaSyAbOQwCqiWYfyKe-t1SmzUcfgNVFYaXTFo";

const MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#f5f5f0" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f5f5f5" }] },
  {
    featureType: "administrative.land_parcel",
    elementType: "labels.text.fill",
    stylers: [{ color: "#bdbdbd" }],
  },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ color: "#eeeeee" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#757575" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#d5e8d4" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9e9e9e" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }],
  },
  {
    featureType: "road.arterial",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }],
  },
  {
    featureType: "road.arterial",
    elementType: "labels.text.fill",
    stylers: [{ color: "#757575" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#f8e8a0" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#e8d870" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#616161" }],
  },
  {
    featureType: "road.local",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9e9e9e" }],
  },
  {
    featureType: "transit.line",
    elementType: "geometry",
    stylers: [{ color: "#e5e5e5" }],
  },
  {
    featureType: "transit.station",
    elementType: "geometry",
    stylers: [{ color: "#eeeeee" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#b8d4e8" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9e9e9e" }],
  },
];

// ─── Payment meta ─────────────────────────────────────────────────────────────
const PAYMENT_META = {
  wallet: {
    label: "Wallet",
    icon: "wallet",
    color: "#059669",
    bg: "#ECFDF5",
    borderColor: "#A7F3D0",
    driverNote:
      "Fare will be credited to your wallet automatically — no cash to collect.",
    confirmNote:
      "This is a wallet trip. The fare will be automatically credited to your wallet after completion.",
    completeBtnLabel: "Complete Trip",
  },
  cash: {
    label: "Cash",
    icon: "cash",
    color: "#1A1A1A",
    bg: "#F5F5F0",
    borderColor: "#E5E5E5",
    driverNote: "Collect cash from passenger after completing the trip.",
    confirmNote:
      "Confirm you have received the cash from the passenger before completing.",
    completeBtnLabel: "Confirm Cash & Complete",
  },
  // ✅ FIX: Added free_ride entry — driver sees wallet credit message,
  // never told to collect cash. Passenger pays nothing.
  free_ride: {
    label: "Kilometre Club 🎁",
    icon: "gift",
    color: "#7C3AED",
    bg: "#F5F3FF",
    borderColor: "#DDD6FE",
    driverNote:
      "This is a Kilometre Club free ride. Do NOT collect cash — the fare will be credited to your wallet by the platform.",
    confirmNote:
      "This passenger's ride is completely free (Kilometre Club reward). The platform will credit the full fare to your wallet automatically.",
    completeBtnLabel: "Complete Trip",
  },
};

// ─── Service config ───────────────────────────────────────────────────────────
const SERVICE_CONFIG = {
  CITY_RIDE: {
    icon: "car-sport",
    color: "#1A1A1A",
    bg: "#F0F0F0",
    label: "City Ride",
  },
  DELIVERY_BIKE: {
    icon: "bicycle",
    color: "#059669",
    bg: "#ECFDF5",
    label: "Delivery Bike",
  },
  KEKE: { icon: "triangle", color: "#D97706", bg: "#FFFBEB", label: "Keke" },
  LUXURY_RENTAL: {
    icon: "diamond",
    color: "#7C3AED",
    bg: "#F5F3FF",
    label: "Luxury",
  },
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

function decodePolyline(encoded) {
  if (!encoded) return [];
  const pts = [];
  let i = 0,
    lat = 0,
    lng = 0;
  while (i < encoded.length) {
    let b,
      s = 0,
      r = 0;
    do {
      b = encoded.charCodeAt(i++) - 63;
      r |= (b & 0x1f) << s;
      s += 5;
    } while (b >= 0x20);
    lat += r & 1 ? ~(r >> 1) : r >> 1;
    s = 0;
    r = 0;
    do {
      b = encoded.charCodeAt(i++) - 63;
      r |= (b & 0x1f) << s;
      s += 5;
    } while (b >= 0x20);
    lng += r & 1 ? ~(r >> 1) : r >> 1;
    pts.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return pts;
}

function haversineDistance(c1, c2) {
  const R = 6371;
  const dLat = ((c2.latitude - c1.latitude) * Math.PI) / 180;
  const dLon = ((c2.longitude - c1.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((c1.latitude * Math.PI) / 180) *
      Math.cos((c2.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function estTimeMinutes(distKm) {
  return Math.max(Math.ceil((distKm / 35) * 60), 1);
}

export default function RideRequestScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const mapRef = useRef(null);
  const notifListenerRef = useRef();
  const locationSubRef = useRef(null);
  const cardAnim = useRef(new Animated.Value(0)).current;

  const {
    tripId,
    passengerName = "Passenger",
    passengerPhone = "",
    serviceType = "CITY_RIDE",
    fare = 0,
    pickup,
    destination,
    pickupAddress = "Pickup location",
    destinationAddress = "Destination",
    paymentMethod: routePaymentMethod,
  } = route.params || {};

  // ✅ FIX: Added "free_ride" to VALID so it is never silently
  // replaced with "cash" when the route param arrives.
  const VALID = ["cash", "wallet", "free_ride"];
  const [paymentMethod, setPaymentMethod] = useState(
    VALID.includes(routePaymentMethod) ? routePaymentMethod : "cash",
  );

  const [tripPhase, setTripPhase] = useState("pickup");
  const [tripStatus, setTripStatus] = useState("assigned");
  const [tripValid, setTripValid] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [isMapReady, setIsMapReady] = useState(false);
  const [driverLocation, setDriverLocation] = useState(null);
  const [pickupCoord, setPickupCoord] = useState(null);
  const [dropoffCoord, setDropoffCoord] = useState(null);
  const [routeCoords, setRouteCoords] = useState([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [distKm, setDistKm] = useState(null);
  const [etaMin, setEtaMin] = useState(null);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completingTrip, setCompletingTrip] = useState(false);
  const [completionResult, setCompletionResult] = useState(null);
  const [lastNotifTime, setLastNotifTime] = useState(0);

  const pmeta = PAYMENT_META[paymentMethod] || PAYMENT_META.cash;
  const isWallet = paymentMethod === "wallet";
  const isFreeRide = paymentMethod === "free_ride";
  const svcConfig = SERVICE_CONFIG[serviceType] || SERVICE_CONFIG.CITY_RIDE;

  // ── Card entrance animation ────────────────────────────────────────────────
  useEffect(() => {
    Animated.spring(cardAnim, {
      toValue: 1,
      tension: 55,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, []);

  // ── Notifications ──────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const { status: existing } = await Notifications.getPermissionsAsync();
        if (existing !== "granted")
          await Notifications.requestPermissionsAsync();
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("wheels_ride", {
            name: "Wheels Ride",
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: "#1A1A1A",
          });
        }
      } catch {}
    })();
    notifListenerRef.current = Notifications.addNotificationReceivedListener(
      () => Vibration.vibrate(300),
    );
    return () => notifListenerRef.current?.remove();
  }, []);

  const sendNotification = useCallback(async (title, body, data = {}) => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: { ...data, screen: "RideRequestScreen" },
          sound: true,
        },
        trigger: null,
      });
    } catch {}
  }, []);

  // ── Guard ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!tripId) {
      Alert.alert("Invalid Trip", "Unable to load trip information.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } else {
      sendNotification("🚗 Ride Assigned", `Pick up ${passengerName}`, {
        tripId,
      });
    }
  }, [tripId]);

  // ── Hardware back ──────────────────────────────────────────────────────────
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      handleBackPress();
      return true;
    });
    return () => sub.remove();
  }, [tripPhase, tripValid]);

  // ── Fetch Google route ─────────────────────────────────────────────────────
  const fetchRoute = useCallback(
    async (from, to) => {
      if (!from || !to) return;
      setRouteLoading(true);
      try {
        const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${from.latitude},${from.longitude}&destination=${to.latitude},${to.longitude}&key=${GOOGLE_API_KEY}&mode=driving`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.status === "OK" && data.routes?.length > 0) {
          const route = data.routes[0];
          const leg = route.legs[0];
          const decoded = decodePolyline(route.overview_polyline.points);
          setRouteCoords(decoded);

          const distM = leg.distance?.value || 0;
          const durS = leg.duration?.value || 0;
          setDistKm((distM / 1000).toFixed(1));
          setEtaMin(Math.ceil(durS / 60));

          if (decoded.length > 0 && mapRef.current && isMapReady) {
            mapRef.current.fitToCoordinates(decoded, {
              edgePadding: { top: 80, right: 50, bottom: 320, left: 50 },
              animated: true,
            });
          }
        } else {
          setRouteCoords([from, to]);
          const d = haversineDistance(from, to);
          setDistKm(d.toFixed(1));
          setEtaMin(estTimeMinutes(d));
        }
      } catch {
        setRouteCoords([from, to]);
      } finally {
        setRouteLoading(false);
      }
    },
    [isMapReady],
  );

  useEffect(() => {
    if (!driverLocation) return;
    if (tripPhase === "pickup" && pickupCoord) {
      fetchRoute(driverLocation, pickupCoord);
    } else if (tripPhase === "in_progress" && dropoffCoord) {
      fetchRoute(driverLocation, dropoffCoord);
    }
  }, [tripPhase, isMapReady]);

  // ── Initialization ─────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        if (!pickup?.coordinates || pickup.coordinates.length < 2) {
          throw new Error("Invalid pickup location data");
        }

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Location Required",
            "Enable location access to navigate.",
            [{ text: "OK", onPress: () => navigation.goBack() }],
          );
          return;
        }

        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.BestForNavigation,
        });
        const driverLoc = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        setDriverLocation(driverLoc);

        const [pLng, pLat] = pickup.coordinates;
        const pCoord = { latitude: pLat, longitude: pLng };
        setPickupCoord(pCoord);

        if (destination?.coordinates?.length === 2) {
          const [dLng, dLat] = destination.coordinates;
          setDropoffCoord({ latitude: dLat, longitude: dLng });
        }

        const quickDist = haversineDistance(driverLoc, pCoord);
        setDistKm(quickDist.toFixed(1));
        setEtaMin(estTimeMinutes(quickDist));

        setInitializing(false);

        sendNotification(
          "📍 Navigate to Pickup",
          `Pick up ${passengerName} from ${pickupAddress}`,
          { tripId },
        );
      } catch (e) {
        Alert.alert(
          "Error",
          e.message || "Failed to initialize. Please go back.",
          [{ text: "OK", onPress: () => navigation.goBack() }],
        );
        setInitializing(false);
      }
    })();

    return () => {
      locationSubRef.current?.remove();
    };
  }, []);

  // ── Start location tracking ────────────────────────────────────────────────
  useEffect(() => {
    if (initializing || !pickupCoord) return;

    let sub = null;
    (async () => {
      try {
        sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 6000,
            distanceInterval: 15,
          },
          (pos) => {
            if (!pos) return;
            const loc = {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            };
            setDriverLocation(loc);

            const target = tripPhase === "pickup" ? pickupCoord : dropoffCoord;
            if (!target) return;

            const d = haversineDistance(loc, target);
            setDistKm(d.toFixed(1));
            setEtaMin(estTimeMinutes(d));

            const now = Date.now();
            if (now - lastNotifTime > 30000) {
              fetchRoute(loc, target);
              if (d < 0.1) {
                sendNotification(
                  tripPhase === "pickup"
                    ? "📍 Arrived at Pickup"
                    : "🏁 Arrived at Destination",
                  tripPhase === "pickup"
                    ? "You have arrived at pickup"
                    : "You have arrived at destination",
                  { tripId },
                );
                setLastNotifTime(now);
              } else if (d < 0.5) {
                sendNotification(
                  tripPhase === "pickup"
                    ? "🚗 Approaching Pickup"
                    : "🏁 Approaching Destination",
                  `${d.toFixed(1)} km away`,
                  { tripId },
                );
                setLastNotifTime(now);
              }
            }
          },
        );
        locationSubRef.current = sub;
      } catch {}
    })();

    return () => {
      sub?.remove();
    };
  }, [initializing, pickupCoord, tripPhase]);

  // ── Poll trip status ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!tripId || !tripValid) return;

    const poll = async () => {
      try {
        const token = await getAuthToken();
        if (!token) return;
        const res = await fetch(`${baseUrl}/trips/${tripId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          if (res.status === 404) {
            setTripValid(false);
            Alert.alert("Trip Not Found", "This trip is no longer available.", [
              {
                text: "OK",
                onPress: () => navigation.navigate("DriverOnlineMap"),
              },
            ]);
          }
          return;
        }
        const data = await res.json();
        if (!data.trip) return;

        const status = data.trip.status;
        setTripStatus(status);

        // ✅ FIX: VALID now includes "free_ride" so the polled payment
        // method is never silently dropped back to "cash".
        if (
          data.trip.paymentMethod &&
          VALID.includes(data.trip.paymentMethod)
        ) {
          setPaymentMethod(data.trip.paymentMethod);
        }

        if (status === "started" || status === "in_progress")
          setTripPhase("in_progress");

        if (status === "cancelled" || status === "completed") {
          setTripValid(false);
          Alert.alert(
            "Trip Ended",
            status === "cancelled"
              ? "This trip was cancelled."
              : "Trip completed!",
            [
              {
                text: "OK",
                onPress: () =>
                  navigation.reset({
                    index: 0,
                    routes: [{ name: "DriverOnlineMap" }],
                  }),
              },
            ],
          );
        }
      } catch {}
    };

    poll();
    const iv = setInterval(poll, 10000);
    return () => clearInterval(iv);
  }, [tripId, tripValid]);

  // ── Map ready → fetch route ────────────────────────────────────────────────
  const handleMapReady = useCallback(() => {
    setIsMapReady(true);
    if (driverLocation && pickupCoord) {
      fetchRoute(driverLocation, pickupCoord);
    }
  }, [driverLocation, pickupCoord, fetchRoute]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const openNavigation = useCallback(() => {
    const target = tripPhase === "pickup" ? pickupCoord : dropoffCoord;
    if (!target) {
      Alert.alert("Error", "Destination not available");
      return;
    }
    const url = Platform.select({
      ios: `http://maps.apple.com/?daddr=${target.latitude},${target.longitude}&dirflg=d`,
      android: `https://www.google.com/maps/dir/?api=1&destination=${target.latitude},${target.longitude}&travelmode=driving`,
    });
    Linking.openURL(url).catch(() =>
      Alert.alert("Error", "Cannot open navigation app."),
    );
  }, [tripPhase, pickupCoord, dropoffCoord]);

  const makePhoneCall = useCallback(() => {
    if (!passengerPhone) {
      Alert.alert("No Number", "Passenger phone number not available");
      return;
    }
    const num = passengerPhone.replace(/\D/g, "");
    if (num.length < 7) {
      Alert.alert("Invalid", "Invalid phone number format");
      return;
    }
    Linking.openURL(`tel:${num}`).catch(() =>
      Alert.alert("Error", "Cannot make phone call."),
    );
  }, [passengerPhone]);

  const startTrip = useCallback(async () => {
    if (!tripId || !tripValid) {
      Alert.alert("Error", "Trip no longer available.");
      return;
    }
    setLoading(true);
    try {
      const token = await getAuthToken();
      if (!token) throw new Error("Authentication error");
      const res = await fetch(`${baseUrl}/trips/${tripId}/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        setTripPhase("in_progress");
        setTripStatus("started");
        sendNotification("🚗 Trip Started", "Navigate to the destination.", {
          tripId,
        });
        if (dropoffCoord && driverLocation) {
          fetchRoute(driverLocation, dropoffCoord);
        }
      } else {
        const data = await res.json().catch(() => ({}));
        Alert.alert(
          "Failed",
          data.error?.message || "Could not start trip. Please try again.",
        );
      }
    } catch {
      Alert.alert(
        "Network Error",
        "Failed to start trip. Check your connection.",
      );
    } finally {
      setLoading(false);
    }
  }, [
    tripId,
    tripValid,
    dropoffCoord,
    driverLocation,
    fetchRoute,
    sendNotification,
  ]);

  const finishTrip = useCallback(() => {
    if (!tripId || !tripValid) {
      Alert.alert("Error", "Trip no longer available.");
      return;
    }
    setShowCompleteModal(true);
  }, [tripId, tripValid]);

  const completeTrip = useCallback(async () => {
    if (completingTrip || !tripId || !tripValid) return;
    setCompletingTrip(true);
    try {
      const token = await getAuthToken();
      if (!token) throw new Error("Authentication error");
      const res = await fetch(`${baseUrl}/trips/${tripId}/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      let data;
      try {
        data = await res.json();
      } catch {
        throw new Error("Invalid server response");
      }

      if (res.ok && data.success !== false) {
        const payment = data.payment || {};
        const resolvedMethod = payment.method || paymentMethod;
        const resolvedIsFreeRide =
          resolvedMethod === "free_ride" ||
          resolvedMethod === "free_ride_pending";
        const resolvedIsWallet = resolvedMethod === "wallet";
        const resolvedFare = payment.fareNaira || Number(fare) || 0;
        const driverMessage =
          payment.driverMessage ||
          (resolvedIsFreeRide
            ? `🎁 Kilometre Club ride! ₦${resolvedFare.toLocaleString()} has been credited to your wallet by the platform. Do NOT collect cash.`
            : resolvedIsWallet
              ? `₦${resolvedFare.toLocaleString()} has been credited to your wallet.`
              : `Collect ₦${resolvedFare.toLocaleString()} in cash from the passenger.`);

        setCompletionResult({
          resolvedMethod,
          resolvedIsFreeRide,
          resolvedIsWallet,
          resolvedFare,
          driverMessage,
          driverWallet: payment.driverWallet || null,
        });
        setShowCompleteModal(false);
        setTripValid(false);
        sendNotification(
          resolvedIsFreeRide
            ? "🎁 Kilometre Club Ride Complete!"
            : "✅ Trip Completed",
          `Fare: ₦${resolvedFare.toLocaleString()}`,
          { tripId },
        );
      } else {
        const code = data?.error?.code;
        const msg = data?.error?.message || "Failed to complete trip.";
        if (code === "TRIP_ALREADY_ENDED") {
          setTripValid(false);
          setShowCompleteModal(false);
          Alert.alert("Already Completed", "This trip has already ended.", [
            {
              text: "OK",
              onPress: () =>
                navigation.reset({
                  index: 0,
                  routes: [{ name: "DriverOnlineMap" }],
                }),
            },
          ]);
        } else {
          Alert.alert("Completion Failed", msg, [{ text: "OK" }]);
        }
      }
    } catch (e) {
      if (e.message.includes("Network") || e.message.includes("fetch")) {
        Alert.alert("Network Error", "Cannot connect to server.", [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => setShowCompleteModal(false),
          },
          {
            text: "Retry",
            onPress: () => {
              setCompletingTrip(false);
              setTimeout(completeTrip, 1000);
            },
          },
        ]);
      } else {
        Alert.alert("Error", e.message);
      }
    } finally {
      setCompletingTrip(false);
    }
  }, [
    completingTrip,
    tripId,
    tripValid,
    paymentMethod,
    fare,
    sendNotification,
    navigation,
  ]);

  const cancelTrip = useCallback(() => {
    if (!tripId || !tripValid) return;
    Alert.alert("Cancel Trip", "Are you sure you want to cancel?", [
      { text: "Keep Trip", style: "cancel" },
      {
        text: "Cancel Trip",
        style: "destructive",
        onPress: async () => {
          try {
            const token = await getAuthToken();
            if (!token) return;
            const res = await fetch(`${baseUrl}/trips/${tripId}/cancel`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ reason: "driver_cancelled" }),
            });
            if (res.ok) {
              setTripValid(false);
              navigation.reset({
                index: 0,
                routes: [{ name: "DriverOnlineMap" }],
              });
            } else {
              Alert.alert("Error", "Failed to cancel trip.");
            }
          } catch {
            Alert.alert("Error", "Network error.");
          }
        },
      },
    ]);
  }, [tripId, tripValid, navigation]);

  const handleBackPress = useCallback(() => {
    Alert.alert("Leave Trip?", "What would you like to do?", [
      { text: "Stay", style: "cancel" },
      {
        text: tripPhase === "in_progress" ? "End Trip" : "Cancel Trip",
        style: "destructive",
        onPress: () =>
          tripPhase === "in_progress" ? finishTrip() : cancelTrip(),
      },
      {
        text: "Just Leave",
        onPress: () => navigation.navigate("DriverOnlineMap"),
      },
    ]);
  }, [tripPhase, finishTrip, cancelTrip, navigation]);

  const cardTranslateY = cardAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [300, 0],
  });

  // ─────────────────────────────────────────────────────────────────────────
  // LOADING
  // ─────────────────────────────────────────────────────────────────────────
  if (initializing) {
    return (
      <View style={s.loadingScreen}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor="transparent"
          translucent
        />
        <View style={s.loadingCard}>
          <View style={s.loadingIconWrap}>
            <Ionicons name="navigate" size={36} color="#1A1A1A" />
          </View>
          <ActivityIndicator
            size="large"
            color="#1A1A1A"
            style={{ marginTop: 20 }}
          />
          <Text style={s.loadingTitle}>Loading navigation…</Text>
          <Text style={s.loadingSubtitle}>Acquiring your location</Text>
        </View>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // COMPLETION RESULT SCREEN
  // ─────────────────────────────────────────────────────────────────────────
  if (completionResult) {
    const {
      resolvedIsFreeRide,
      resolvedIsWallet,
      resolvedFare,
      driverMessage,
      driverWallet,
      resolvedMethod,
    } = completionResult;

    // ✅ FIX: Free ride uses purple theme matching Kilometre Club branding.
    // Wallet uses green. Cash uses dark.
    const iconColor = resolvedIsFreeRide
      ? "#7C3AED"
      : resolvedIsWallet
        ? "#10B981"
        : "#1A1A1A";
    const iconBg = resolvedIsFreeRide
      ? "#F5F3FF"
      : resolvedIsWallet
        ? "#ECFDF5"
        : "#F5F5F0";
    const iconName = resolvedIsFreeRide
      ? "gift"
      : resolvedIsWallet
        ? "wallet"
        : "cash";

    return (
      <View style={s.completionScreen}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor="transparent"
          translucent
        />

        <View
          style={[
            s.completionCheck,
            { backgroundColor: resolvedIsFreeRide ? "#7C3AED" : "#1A1A1A" },
          ]}
        >
          <Ionicons name="checkmark" size={40} color="#fff" />
        </View>

        <Text style={s.completionLabel}>TRIP COMPLETE</Text>
        <Text style={s.completionFare}>₦{resolvedFare.toLocaleString()}</Text>

        <View style={[s.completionBadge, { backgroundColor: iconBg }]}>
          <Ionicons name={iconName} size={15} color={iconColor} />
          <Text style={[s.completionBadgeText, { color: iconColor }]}>
            {resolvedIsFreeRide
              ? "Kilometre Club 🎁"
              : resolvedIsWallet
                ? "Wallet Payment"
                : "Cash Payment"}
          </Text>
        </View>

        <View style={[s.completionMsgCard, { borderLeftColor: iconColor }]}>
          <Ionicons name={iconName} size={22} color={iconColor} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={s.completionMsgTitle}>
              {resolvedIsFreeRide
                ? "Do NOT collect cash!"
                : resolvedIsWallet
                  ? "No cash needed!"
                  : "Collect cash from passenger"}
            </Text>
            <Text style={s.completionMsgBody}>{driverMessage}</Text>
            {(resolvedIsWallet || resolvedIsFreeRide) && driverWallet && (
              <Text style={[s.completionMsgBalance, { color: iconColor }]}>
                New balance: {driverWallet.balanceFormatted}
              </Text>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={[
            s.doneBtnLarge,
            {
              backgroundColor: resolvedIsFreeRide ? "#7C3AED" : "#1A1A1A",
            },
          ]}
          onPress={() =>
            navigation.reset({
              index: 0,
              routes: [{ name: "DriverOnlineMap" }],
            })
          }
          activeOpacity={0.88}
        >
          <Ionicons name="home" size={20} color="#fff" />
          <Text style={s.doneBtnLargeText}>Back to Dashboard</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ACTIVE TRIP VIEW
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={s.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent
      />

      {/* ── MAP ── */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={s.map}
        customMapStyle={MAP_STYLE}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        showsTraffic={false}
        onMapReady={handleMapReady}
        initialRegion={
          driverLocation
            ? {
                ...driverLocation,
                latitudeDelta: 0.012,
                longitudeDelta: 0.012 * ASPECT_RATIO,
              }
            : {
                latitude: 9.0765,
                longitude: 7.3986,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              }
        }
      >
        {driverLocation && (
          <Marker coordinate={driverLocation} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={s.driverPin}>
              <Ionicons name="car-sport" size={20} color="#fff" />
            </View>
          </Marker>
        )}

        {pickupCoord && (
          <Marker coordinate={pickupCoord} anchor={{ x: 0.5, y: 1 }}>
            <View style={s.pickupPinWrap}>
              <View style={s.pickupPin}>
                <Ionicons name="person" size={14} color="#fff" />
              </View>
              <View style={s.pinTailGreen} />
            </View>
          </Marker>
        )}

        {dropoffCoord && (
          <Marker coordinate={dropoffCoord} anchor={{ x: 0.5, y: 1 }}>
            <View style={s.dropoffPinWrap}>
              <View style={s.dropoffPin}>
                <Ionicons name="flag" size={14} color="#fff" />
              </View>
              <View style={s.pinTailRed} />
            </View>
          </Marker>
        )}

        {routeCoords.length > 1 && (
          <>
            <Polyline
              coordinates={routeCoords}
              strokeColor="rgba(0,0,0,0.08)"
              strokeWidth={10}
            />
            <Polyline
              coordinates={routeCoords}
              strokeColor={tripPhase === "pickup" ? "#10B981" : "#1A1A1A"}
              strokeWidth={5}
            />
          </>
        )}
      </MapView>

      {/* ── TOP BAR ── */}
      <View style={s.topBar}>
        <TouchableOpacity
          style={s.iconBtn}
          onPress={handleBackPress}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={20} color="#1A1A1A" />
        </TouchableOpacity>

        <View style={s.topCenter}>
          <View
            style={[
              s.topStatusDot,
              {
                backgroundColor: tripPhase === "pickup" ? "#10B981" : "#1A1A1A",
              },
            ]}
          />
          <Text style={s.topCenterText}>
            {tripPhase === "pickup" ? "To Pickup" : "In Progress"}
          </Text>
        </View>

        <TouchableOpacity
          style={s.iconBtn}
          onPress={() => {
            const target = tripPhase === "pickup" ? pickupCoord : dropoffCoord;
            const src = driverLocation;
            if (target && src && mapRef.current) {
              mapRef.current.fitToCoordinates(
                routeCoords.length > 1 ? routeCoords : [src, target],
                {
                  edgePadding: { top: 80, right: 50, bottom: 320, left: 50 },
                  animated: true,
                },
              );
            }
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="expand" size={20} color="#1A1A1A" />
        </TouchableOpacity>
      </View>

      {routeLoading && (
        <View style={s.routeLoadingBadge}>
          <ActivityIndicator size="small" color="#1A1A1A" />
          <Text style={s.routeLoadingText}>Finding route…</Text>
        </View>
      )}

      {/* ── BOTTOM CARD ── */}
      <Animated.View
        style={[
          s.bottomCard,
          { transform: [{ translateY: cardTranslateY }], opacity: cardAnim },
        ]}
      >
        <View style={s.sheetHandle} />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scrollContent}
          bounces={false}
        >
          {/* Passenger row */}
          <View style={s.passengerRow}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>
                {(passengerName || "P").charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={s.passengerInfo}>
              <Text style={s.passengerName} numberOfLines={1}>
                {passengerName}
              </Text>
              <View style={[s.serviceChip, { backgroundColor: svcConfig.bg }]}>
                <Ionicons
                  name={svcConfig.icon}
                  size={11}
                  color={svcConfig.color}
                />
                <Text style={[s.serviceChipText, { color: svcConfig.color }]}>
                  {svcConfig.label}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[s.callBtn, !passengerPhone && s.callBtnDisabled]}
              onPress={makePhoneCall}
              activeOpacity={0.85}
              disabled={!passengerPhone}
            >
              <Ionicons name="call" size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* ✅ FIX: Free ride banner — shown above route card when isFreeRide */}
          {isFreeRide && (
            <View style={s.freeRideBanner}>
              <Ionicons name="gift" size={16} color="#7C3AED" />
              <Text style={s.freeRideBannerText}>
                Kilometre Club Free Ride — Do NOT collect cash from passenger
              </Text>
            </View>
          )}

          {/* Route card */}
          <View style={s.routeCard}>
            <View style={s.routeRow}>
              <View style={s.routeDotGreen} />
              <View style={s.routeTextBlock}>
                <Text style={s.routeRowLabel}>PICKUP</Text>
                <Text style={s.routeRowAddress} numberOfLines={2}>
                  {pickupAddress}
                </Text>
              </View>
            </View>
            <View style={s.routeConnector}>
              <View style={s.routeConnectorLine} />
            </View>
            <View style={s.routeRow}>
              <View style={s.routeDotRed} />
              <View style={s.routeTextBlock}>
                <Text style={s.routeRowLabel}>DESTINATION</Text>
                <Text style={s.routeRowAddress} numberOfLines={2}>
                  {destinationAddress}
                </Text>
              </View>
            </View>
          </View>

          {/* Trip chips */}
          <View style={s.chipsRow}>
            <View style={s.chip}>
              <Ionicons name="navigate-outline" size={13} color="#666" />
              <Text style={s.chipText}>{distKm ? `${distKm} km` : "—"}</Text>
            </View>
            <View style={s.chipDivider} />
            <View style={s.chip}>
              <Ionicons name="time-outline" size={13} color="#666" />
              <Text style={s.chipText}>{etaMin ? `${etaMin} min` : "—"}</Text>
            </View>
            <View style={s.chipDivider} />
            <View style={s.chip}>
              <Ionicons name="cash-outline" size={13} color="#666" />
              <Text style={s.chipText}>₦{Number(fare).toLocaleString()}</Text>
            </View>
          </View>

          {/* Payment notice — now correctly shows free_ride messaging */}
          <View
            style={[
              s.paymentNotice,
              { backgroundColor: pmeta.bg, borderLeftColor: pmeta.color },
            ]}
          >
            <Ionicons name={pmeta.icon} size={15} color={pmeta.color} />
            <Text style={[s.paymentNoticeText, { color: pmeta.color }]}>
              {pmeta.driverNote}
            </Text>
          </View>

          {/* Action buttons */}
          <View style={s.actionsRow}>
            <TouchableOpacity
              style={s.navBtn}
              onPress={openNavigation}
              activeOpacity={0.85}
            >
              <Ionicons name="navigate" size={20} color="#1A1A1A" />
              <Text style={s.navBtnText}>Navigate</Text>
            </TouchableOpacity>

            {tripPhase === "pickup" ? (
              <TouchableOpacity
                style={[
                  s.primaryBtn,
                  (loading || !tripValid || tripStatus !== "assigned") &&
                    s.primaryBtnDisabled,
                ]}
                onPress={startTrip}
                disabled={loading || !tripValid || tripStatus !== "assigned"}
                activeOpacity={0.88}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="play-circle" size={20} color="#fff" />
                    <Text style={s.primaryBtnText}>Start Trip</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[
                  s.primaryBtn,
                  !tripValid && s.primaryBtnDisabled,
                  {
                    backgroundColor: isFreeRide
                      ? "#7C3AED"
                      : isWallet
                        ? "#10B981"
                        : "#1A1A1A",
                  },
                ]}
                onPress={finishTrip}
                disabled={!tripValid}
                activeOpacity={0.88}
              >
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={s.primaryBtnText}>{pmeta.completeBtnLabel}</Text>
              </TouchableOpacity>
            )}
          </View>

          {tripValid && (
            <TouchableOpacity
              style={s.cancelBtn}
              onPress={cancelTrip}
              activeOpacity={0.8}
            >
              <Ionicons name="close-circle-outline" size={16} color="#EF4444" />
              <Text style={s.cancelBtnText}>Cancel Trip</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </Animated.View>

      {/* ── COMPLETE MODAL ── */}
      <Modal
        visible={showCompleteModal}
        transparent
        animationType="slide"
        statusBarTranslucent
      >
        <TouchableOpacity
          style={s.modalBackdrop}
          activeOpacity={1}
          onPress={() => !completingTrip && setShowCompleteModal(false)}
        />
        <View style={s.modalSheet}>
          <View style={s.sheetHandle} />

          <View style={s.modalHeaderRow}>
            <View>
              <Text style={s.modalHeaderLabel}>COMPLETE TRIP</Text>
              <Text style={s.modalHeaderTitle}>Confirm & Finish</Text>
            </View>
            <TouchableOpacity
              style={s.modalCloseBtn}
              onPress={() => !completingTrip && setShowCompleteModal(false)}
              disabled={completingTrip}
            >
              <Ionicons name="close" size={18} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Payment banner */}
          <View
            style={[
              s.modalPaymentBanner,
              { backgroundColor: pmeta.bg, borderColor: pmeta.borderColor },
            ]}
          >
            <View
              style={[
                s.modalPaymentIconWrap,
                {
                  backgroundColor: isFreeRide
                    ? "#EDE9FE"
                    : isWallet
                      ? "#ECFDF5"
                      : "#F0F0F0",
                },
              ]}
            >
              <Ionicons name={pmeta.icon} size={20} color={pmeta.color} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[s.modalPaymentTitle, { color: pmeta.color }]}>
                {pmeta.label} Trip
              </Text>
              <Text style={[s.modalPaymentNote, { color: pmeta.color }]}>
                {pmeta.confirmNote}
              </Text>
            </View>
          </View>

          {/* Summary */}
          <View style={s.summaryCard}>
            {[
              { label: "Passenger", value: passengerName },
              { label: "Service", value: svcConfig.label },
            ].map((row) => (
              <View key={row.label} style={s.summaryRow}>
                <Text style={s.summaryLabel}>{row.label}</Text>
                <Text style={s.summaryValue}>{row.value}</Text>
              </View>
            ))}
            <View style={s.summaryRow}>
              <Text style={s.summaryLabel}>Payment</Text>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
              >
                <Ionicons name={pmeta.icon} size={14} color={pmeta.color} />
                <Text style={[s.summaryValue, { color: pmeta.color }]}>
                  {pmeta.label}
                </Text>
              </View>
            </View>
            <View style={[s.summaryRow, { borderBottomWidth: 0 }]}>
              <Text style={s.summaryLabel}>Fare</Text>
              <Text style={s.summaryFare}>
                ₦{Number(fare).toLocaleString()}
              </Text>
            </View>
          </View>

          <View style={s.modalActionsRow}>
            <TouchableOpacity
              style={s.modalSecondaryBtn}
              onPress={() => !completingTrip && setShowCompleteModal(false)}
              disabled={completingTrip}
              activeOpacity={0.8}
            >
              <Text style={s.modalSecondaryBtnText}>Go Back</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                s.modalPrimaryBtn,
                {
                  backgroundColor: isFreeRide
                    ? "#7C3AED"
                    : isWallet
                      ? "#10B981"
                      : "#1A1A1A",
                },
                completingTrip && s.primaryBtnDisabled,
              ]}
              onPress={completeTrip}
              disabled={completingTrip}
              activeOpacity={0.88}
            >
              {completingTrip ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={s.modalPrimaryBtnText}>Completing…</Text>
                </View>
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color="#fff" />
                  <Text style={s.modalPrimaryBtnText}>
                    {pmeta.completeBtnLabel}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F0" },
  map: { flex: 1 },

  loadingScreen: {
    flex: 1,
    backgroundColor: "#F5F5F0",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 40,
    alignItems: "center",
    width: width * 0.72,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 10,
  },
  loadingIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: "#F0F0F0",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1A1A1A",
    marginTop: 16,
  },
  loadingSubtitle: { fontSize: 13, color: "#999", marginTop: 4 },

  topBar: {
    position: "absolute",
    top: Platform.OS === "ios" ? 54 : 44,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 10,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  topCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  topStatusDot: { width: 8, height: 8, borderRadius: 4 },
  topCenterText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1A1A1A",
    letterSpacing: 0.3,
  },

  routeLoadingBadge: {
    position: "absolute",
    top: Platform.OS === "ios" ? 114 : 104,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  routeLoadingText: { fontSize: 13, fontWeight: "600", color: "#666" },

  driverPin: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#1A1A1A",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 7,
  },
  pickupPinWrap: { alignItems: "center" },
  pickupPin: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#10B981",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#fff",
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 5,
  },
  pinTailGreen: {
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 10,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#10B981",
    marginTop: -1,
  },
  dropoffPinWrap: { alignItems: "center" },
  dropoffPin: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#EF4444",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#fff",
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 5,
  },
  pinTailRed: {
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 10,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#EF4444",
    marginTop: -1,
  },

  bottomCard: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 36 : 20,
    maxHeight: height * 0.58,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 16,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E0E0E0",
    alignSelf: "center",
    marginBottom: 16,
  },
  scrollContent: { paddingBottom: 4 },

  passengerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#1A1A1A",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { color: "#fff", fontSize: 20, fontWeight: "800" },
  passengerInfo: { flex: 1 },
  passengerName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 5,
  },
  serviceChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  serviceChipText: { fontSize: 11, fontWeight: "700" },
  callBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#1A1A1A",
    justifyContent: "center",
    alignItems: "center",
  },
  callBtnDisabled: { backgroundColor: "#E0E0E0" },

  // ✅ NEW: Free ride banner style
  freeRideBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F5F3FF",
    borderWidth: 1.5,
    borderColor: "#DDD6FE",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  freeRideBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: "#7C3AED",
    lineHeight: 18,
  },

  routeCard: {
    backgroundColor: "#F8F8F8",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  routeRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  routeDotGreen: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#10B981",
    marginTop: 4,
  },
  routeDotRed: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#EF4444",
    marginTop: 4,
  },
  routeTextBlock: { flex: 1 },
  routeRowLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#bbb",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  routeRowAddress: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1A1A1A",
    lineHeight: 20,
  },
  routeConnector: { paddingLeft: 5, paddingVertical: 4 },
  routeConnectorLine: { width: 2, height: 16, backgroundColor: "#E5E5E5" },

  chipsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  chip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12 },
  chipText: { fontSize: 13, color: "#666", fontWeight: "600", marginLeft: 5 },
  chipDivider: { width: 1, height: 14, backgroundColor: "#E0E0E0" },

  paymentNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderLeftWidth: 3,
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  paymentNoticeText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 17,
  },

  actionsRow: { flexDirection: "row", gap: 12, marginBottom: 10 },
  navBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: "#F5F5F0",
    borderRadius: 14,
    paddingVertical: 15,
    borderWidth: 1.5,
    borderColor: "#E5E5E5",
  },
  navBtnText: { color: "#1A1A1A", fontSize: 14, fontWeight: "700" },
  primaryBtn: {
    flex: 1.8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#1A1A1A",
    borderRadius: 14,
    paddingVertical: 15,
  },
  primaryBtnDisabled: { backgroundColor: "#C0C0C0" },
  primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  cancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 10,
  },
  cancelBtnText: { color: "#EF4444", fontSize: 14, fontWeight: "700" },

  modalBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.38)",
  },
  modalSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 36 : 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 20,
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  modalHeaderLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#bbb",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  modalHeaderTitle: { fontSize: 22, fontWeight: "800", color: "#1A1A1A" },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F5F5F0",
    justifyContent: "center",
    alignItems: "center",
  },
  modalPaymentBanner: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 16,
  },
  modalPaymentIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  modalPaymentTitle: { fontSize: 14, fontWeight: "800", marginBottom: 3 },
  modalPaymentNote: { fontSize: 12, fontWeight: "500", lineHeight: 17 },

  summaryCard: {
    backgroundColor: "#F8F8F8",
    borderRadius: 16,
    padding: 14,
    marginBottom: 18,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: "#EFEFEF",
  },
  summaryLabel: { fontSize: 13, color: "#888", fontWeight: "600" },
  summaryValue: { fontSize: 14, color: "#1A1A1A", fontWeight: "700" },
  summaryFare: { fontSize: 20, fontWeight: "900", color: "#1A1A1A" },

  modalActionsRow: { flexDirection: "row", gap: 12 },
  modalSecondaryBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: "#F5F5F0",
    borderWidth: 1.5,
    borderColor: "#E5E5E5",
    alignItems: "center",
  },
  modalSecondaryBtnText: { color: "#666", fontSize: 14, fontWeight: "700" },
  modalPrimaryBtn: {
    flex: 1.8,
    paddingVertical: 16,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  modalPrimaryBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },

  completionScreen: {
    flex: 1,
    backgroundColor: "#F5F5F0",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingBottom: Platform.OS === "ios" ? 36 : 20,
  },
  completionCheck: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  completionLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#aaa",
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  completionFare: {
    fontSize: 48,
    fontWeight: "900",
    color: "#1A1A1A",
    marginBottom: 16,
  },
  completionBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 20,
  },
  completionBadgeText: { fontSize: 14, fontWeight: "700" },
  completionMsgCard: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#fff",
    borderRadius: 16,
    borderLeftWidth: 4,
    padding: 16,
    marginBottom: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 4,
  },
  completionMsgTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1A1A1A",
    marginBottom: 4,
  },
  completionMsgBody: { fontSize: 13, color: "#555", lineHeight: 19 },
  completionMsgBalance: { fontSize: 13, fontWeight: "700", marginTop: 8 },
  doneBtnLarge: {
    borderRadius: 16,
    paddingVertical: 17,
    paddingHorizontal: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    width: "100%",
    justifyContent: "center",
  },
  doneBtnLargeText: { color: "#fff", fontSize: 17, fontWeight: "800" },
});
