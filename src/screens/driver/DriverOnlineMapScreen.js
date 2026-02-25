// src/screens/driver/DriverOnlineMapScreen.js
import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Dimensions,
  Platform,
  Animated,
  Modal,
  Vibration,
  StatusBar,
  Image,
} from "react-native";
import MapView, {
  Marker,
  PROVIDER_GOOGLE,
  Circle,
  Polyline,
} from "react-native-maps";
import * as Location from "expo-location";
import { Audio } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { getAuthToken } from "../../utils/auth";
import {
  initWebSocket,
  sendWS,
  addListener,
  removeListener,
  isWebSocketConnected,
  closeWebSocket,
} from "../../utils/socket";
import * as Notifications from "expo-notifications";

const baseUrl = "https://wheels-backend-7ydc.onrender.com";
const { width, height } = Dimensions.get("window");
const LATITUDE_DELTA = 0.008;
const LONGITUDE_DELTA = LATITUDE_DELTA * (width / height);

// ─── Map style matching passenger home ───────────────────────────────────────
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

// ─── Notification setup ───────────────────────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

if (Platform.OS === "android") {
  Notifications.setNotificationChannelAsync("wheels_driver", {
    name: "Wheels Driver",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#1A1A1A",
    sound: "default",
    enableVibrate: true,
    showBadge: true,
  }).catch(() => {});
}

// ─── Service type config ──────────────────────────────────────────────────────
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

export default function DriverOnlineMapScreen() {
  const navigation = useNavigation();
  const mapRef = useRef(null);
  const notificationListener = useRef();
  const soundIntervalRef = useRef(null);
  const pollingRef = useRef(null);
  const slideAnim = useRef(new Animated.Value(height)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const statusCardAnim = useRef(new Animated.Value(0)).current;
  const earningsCountAnim = useRef(new Animated.Value(0)).current;

  const [token, setToken] = useState(null);
  const [location, setLocation] = useState(null);
  const [heading, setHeading] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);
  const [locationSubscription, setLocationSubscription] = useState(null);
  const [incomingRequest, setIncomingRequest] = useState(null);
  const [wsStatus, setWsStatus] = useState("connecting");
  const [offerVisible, setOfferVisible] = useState(false);
  const [offerTimeout, setOfferTimeout] = useState(null);
  const [timeLeft, setTimeLeft] = useState(20);
  const [pickupAddress, setPickupAddress] = useState("Fetching pickup…");
  const [destinationAddress, setDestinationAddress] = useState(
    "Shared after acceptance",
  );
  const [sound, setSound] = useState(null);
  const [todayTrips, setTodayTrips] = useState(0);
  const [isMapReady, setIsMapReady] = useState(false);
  const [wsConnecting, setWsConnecting] = useState(true);
  const [connectionAttempts, setConnectionAttempts] = useState(0);

  // ── Notification helper ────────────────────────────────────────────────────
  const sendNotification = useCallback(async (title, body, data = {}) => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: { title, body, data, sound: true },
        trigger: null,
      });
    } catch {}
  }, []);

  // ── Register notifications ────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const { status: existing } = await Notifications.getPermissionsAsync();
        if (existing !== "granted")
          await Notifications.requestPermissionsAsync();
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("wheels_driver", {
            name: "Wheels Driver",
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: "#1A1A1A",
          });
        }
      } catch {}
    })();
    notificationListener.current =
      Notifications.addNotificationReceivedListener(() => {
        Vibration.vibrate(200);
      });
    return () => notificationListener.current?.remove();
  }, []);

  // ── Load sound ─────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const { sound: s } = await Audio.Sound.createAsync(
          require("../../../assets/sound/sound1.mp3"),
          { shouldPlay: false, isLooping: false },
        );
        setSound(s);
      } catch {}
    })();
    return () => {
      sound?.unloadAsync().catch(() => {});
      if (soundIntervalRef.current) clearInterval(soundIntervalRef.current);
    };
  }, []);

  // ── Status card entrance ───────────────────────────────────────────────────
  useEffect(() => {
    Animated.spring(statusCardAnim, {
      toValue: 1,
      tension: 60,
      friction: 9,
      useNativeDriver: true,
    }).start();
  }, []);

  // ── Pulse animation ────────────────────────────────────────────────────────
  useEffect(() => {
    if (isOnline) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.5,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [isOnline]);

  // ── WebSocket ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const setup = async () => {
      try {
        await initWebSocket();
        addListener("connect", () => {
          setWsStatus("connected");
          setWsConnecting(false);
          setConnectionAttempts(0);
          sendNotification("Connected", "Now receiving ride requests.");
        });
        addListener("disconnect", () => {
          setWsStatus("disconnected");
          setWsConnecting(true);
          sendNotification("Connection lost", "Reconnecting…");
        });
        addListener("error", () => setWsStatus("error"));
        addListener("trip_offered", handleIncomingOffer);
        addListener("notification", (d) => {
          if (
            d.type === "trip_offered" ||
            d.notificationType === "trip_offered"
          )
            handleIncomingOffer(d.data || d);
        });
      } catch {}
    };
    setup();
    return () => {
      removeListener("connect");
      removeListener("disconnect");
      removeListener("error");
      removeListener("trip_offered");
      removeListener("notification");
    };
  }, []);

  // ── Fetch offer details ────────────────────────────────────────────────────
  const fetchOfferDetails = useCallback(async () => {
    try {
      const authToken = token || (await getAuthToken());
      const res = await fetch(`${baseUrl}/drivers/offered-request`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json.request || null;
    } catch {
      return null;
    }
  }, [token]);

  // ── Sound helpers ──────────────────────────────────────────────────────────
  const startSoundLoop = useCallback(async () => {
    if (!sound) return;
    try {
      if (soundIntervalRef.current) clearInterval(soundIntervalRef.current);
      await sound.replayAsync();
      soundIntervalRef.current = setInterval(async () => {
        try {
          await sound.replayAsync();
        } catch {}
      }, 3000);
    } catch {}
  }, [sound]);

  const stopSoundLoop = useCallback(async () => {
    if (soundIntervalRef.current) {
      clearInterval(soundIntervalRef.current);
      soundIntervalRef.current = null;
    }
    try {
      await sound?.stopAsync();
    } catch {}
  }, [sound]);

  // ── Show/hide offer card ───────────────────────────────────────────────────
  const showOfferCard = useCallback(() => {
    setOfferVisible(true);
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 75,
      friction: 10,
      useNativeDriver: true,
    }).start();
  }, [slideAnim]);

  const hideOfferCard = useCallback(
    (cb) => {
      stopSoundLoop();
      Animated.timing(slideAnim, {
        toValue: height,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setOfferVisible(false);
        setIncomingRequest(null);
        if (offerTimeout) {
          clearTimeout(offerTimeout);
          setOfferTimeout(null);
        }
        if (cb) setTimeout(cb, 80);
      });
    },
    [slideAnim, stopSoundLoop, offerTimeout],
  );

  const startOfferTimer = useCallback(() => {
    if (offerTimeout) clearTimeout(offerTimeout);
    setTimeLeft(20);
    const tid = setTimeout(() => {
      sendNotification("Ride Expired", "Request timed out.");
      rejectRide();
    }, 20000);
    setOfferTimeout(tid);
    const cd = setInterval(() => {
      setTimeLeft((p) => {
        if (p <= 1) {
          clearInterval(cd);
          return 0;
        }
        return p - 1;
      });
    }, 1000);
  }, [offerTimeout]);

  // ── Handle incoming offer ──────────────────────────────────────────────────
  const handleIncomingOffer = useCallback(
    async (data) => {
      const requestId = data.requestId || data.tripId;
      if (
        !requestId ||
        (incomingRequest?.requestId === requestId && offerVisible)
      )
        return;

      sendNotification("🚗 New Ride Request", "Tap to view details.");
      Vibration.vibrate([0, 300, 100, 300]);

      try {
        const details = await fetchOfferDetails();
        if (!details) return;

        const offer = {
          requestId: details.requestId,
          passengerName: details.passengerName || "Passenger",
          passengerPhone: details.passengerPhone || "",
          serviceType: details.serviceType || "CITY_RIDE",
          fare: details.estimatedFare || details.fare || 0,
          pickup: details.pickup,
          destination: details.dropoff || null,
          paymentMethod: details.paymentMethod || "cash",
          distance: details.distance || 0,
          duration: details.duration || 0,
          pickupAddress: details.pickupAddress || "Fetching…",
          destinationAddress:
            details.dropoffAddress || "Shared after acceptance",
          passengerId: details.passengerId,
        };

        setIncomingRequest(offer);

        // Reverse geocode pickup
        if (offer.pickup?.coordinates?.length === 2) {
          const [lng, lat] = offer.pickup.coordinates;
          try {
            const addrs = await Location.reverseGeocodeAsync({
              latitude: lat,
              longitude: lng,
            });
            if (addrs?.[0]) {
              const a = addrs[0];
              setPickupAddress(
                [a.name, a.street, a.city].filter(Boolean).join(", ") ||
                  "Pickup nearby",
              );
            }
          } catch {
            setPickupAddress(details.pickupAddress || "Pickup nearby");
          }
        } else setPickupAddress(details.pickupAddress || "Pickup nearby");

        // Reverse geocode dropoff
        if (details.dropoffAddress) {
          setDestinationAddress(details.dropoffAddress);
        } else if (details.dropoff?.coordinates?.length === 2) {
          const [lng, lat] = details.dropoff.coordinates;
          try {
            const addrs = await Location.reverseGeocodeAsync({
              latitude: lat,
              longitude: lng,
            });
            if (addrs?.[0]) {
              const a = addrs[0];
              setDestinationAddress(
                [a.name, a.street, a.city].filter(Boolean).join(", ") ||
                  "Destination nearby",
              );
            }
          } catch {
            setDestinationAddress("Destination nearby");
          }
        } else setDestinationAddress("Shared after acceptance");

        showOfferCard();
        startOfferTimer();
        startSoundLoop();
      } catch {}
    },
    [
      incomingRequest,
      offerVisible,
      fetchOfferDetails,
      showOfferCard,
      startOfferTimer,
      startSoundLoop,
      sendNotification,
    ],
  );

  // ── Driver state cleanup ───────────────────────────────────────────────────
  const checkAndCleanupDriverState = useCallback(async () => {
    try {
      const authToken = token || (await getAuthToken());
      if (!authToken) return false;
      const res = await fetch(`${baseUrl}/drivers/current-state`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) return false;
      const state = await res.json();
      if (!state.needsCleanup) return false;
      const cleanup = await fetch(`${baseUrl}/drivers/cleanup-state`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
      });
      return cleanup.ok;
    } catch {
      return false;
    }
  }, [token]);

  // ── Accept ride ────────────────────────────────────────────────────────────
  const acceptRide = useCallback(async () => {
    if (!incomingRequest?.requestId) {
      hideOfferCard();
      return;
    }
    try {
      stopSoundLoop();
      if (offerTimeout) {
        clearTimeout(offerTimeout);
        setOfferTimeout(null);
      }
      await checkAndCleanupDriverState();

      const authToken = token || (await getAuthToken());
      if (!authToken) {
        Alert.alert("Session Error", "Please go offline and online again.", [
          {
            text: "OK",
            onPress: () => navigation.replace("DriverHomeOffline"),
          },
        ]);
        return;
      }

      const idempotencyKey = `accept_${incomingRequest.requestId}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const controller = new AbortController();
      const tOut = setTimeout(() => controller.abort(), 30000);

      const res = await fetch(`${baseUrl}/trips/accept`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Idempotency-Key": idempotencyKey,
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          requestId: incomingRequest.requestId,
          idempotencyKey,
        }),
        signal: controller.signal,
      });
      clearTimeout(tOut);

      let data;
      try {
        data = JSON.parse(await res.text());
      } catch {
        throw new Error("Invalid server response.");
      }

      if (res.ok && data.success) {
        setTodayTrips((p) => p + 1);
        sendNotification("Ride Accepted!", "Navigating to trip…");
        hideOfferCard(() => {
          setTimeout(() => {
            navigation.replace("RideRequest", {
              tripId: data.tripId,
              requestId: data.requestId || incomingRequest.requestId,
              passengerName: incomingRequest.passengerName,
              passengerPhone: incomingRequest.passengerPhone,
              serviceType: incomingRequest.serviceType,
              fare: incomingRequest.fare,
              pickup: incomingRequest.pickup,
              destination: incomingRequest.destination,
              pickupAddress,
              destinationAddress,
              driverId: data.driverId,
            });
          }, 300);
        });
      } else {
        const errMsg = data?.error?.message || "Could not accept ride.";
        const errCode = data?.error?.code;
        if (errMsg.includes("already on") || errCode === "TRIP_UNAVAILABLE") {
          Alert.alert("Status Issue", "Driver status needs refresh. Fix now?", [
            { text: "Cancel", style: "cancel", onPress: () => hideOfferCard() },
            {
              text: "Fix & Retry",
              onPress: async () => {
                const cleaned = await checkAndCleanupDriverState();
                if (cleaned) setTimeout(() => acceptRide(), 500);
                else hideOfferCard();
              },
            },
          ]);
          return;
        }
        Alert.alert("Accept Failed", errMsg, [
          { text: "OK", onPress: () => hideOfferCard() },
        ]);
      }
    } catch (err) {
      const msg =
        err.name === "AbortError"
          ? "Request timed out. The ride may have been assigned already."
          : err.message || "Failed to accept ride.";
      Alert.alert("Error", msg, [
        { text: "OK", onPress: () => hideOfferCard() },
      ]);
    }
  }, [
    incomingRequest,
    token,
    hideOfferCard,
    stopSoundLoop,
    offerTimeout,
    checkAndCleanupDriverState,
    pickupAddress,
    destinationAddress,
    navigation,
    sendNotification,
  ]);

  // ── Reject ride ────────────────────────────────────────────────────────────
  const rejectRide = useCallback(async () => {
    if (!incomingRequest?.requestId) {
      hideOfferCard();
      return;
    }
    stopSoundLoop();
    const authToken = token || (await getAuthToken());
    try {
      if (authToken) {
        await fetch(`${baseUrl}/trips/reject`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ requestId: incomingRequest.requestId }),
        });
      }
    } catch {}
    hideOfferCard();
  }, [incomingRequest, token, hideOfferCard, stopSoundLoop]);

  // ── Polling fallback ───────────────────────────────────────────────────────
  const startPolling = useCallback(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      if (!token || !isOnline || offerVisible) return;
      try {
        const res = await fetch(`${baseUrl}/drivers/offered-request`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const json = await res.json();
          if (json.request)
            handleIncomingOffer({ requestId: json.request.requestId });
        }
      } catch {}
    }, 5000);
  }, [token, isOnline, offerVisible, handleIncomingOffer]);

  useEffect(() => {
    if (isOnline && token && !offerVisible) startPolling();
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [isOnline, token, offerVisible, startPolling]);

  // ── Go online helper ───────────────────────────────────────────────────────
  const goOnline = useCallback(async (coords, authToken) => {
    try {
      const res = await fetch(`${baseUrl}/drivers/availability`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          isAvailable: true,
          location: {
            type: "Point",
            coordinates: [coords.longitude, coords.latitude],
          },
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }, []);

  // ── Location tracking ──────────────────────────────────────────────────────
  const startLocationTracking = useCallback(async (authToken) => {
    try {
      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 5000,
          distanceInterval: 10,
        },
        async (pos) => {
          if (!pos) return;
          const newLoc = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            heading: pos.coords.heading ?? 0,
          };
          setLocation(newLoc);
          setHeading(newLoc.heading);

          if (isWebSocketConnected()) {
            sendWS({
              type: "driver:location",
              ...newLoc,
              timestamp: Date.now(),
            });
          }

          try {
            await fetch(`${baseUrl}/drivers/availability`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${authToken}`,
              },
              body: JSON.stringify({
                isAvailable: true,
                location: {
                  type: "Point",
                  coordinates: [newLoc.longitude, newLoc.latitude],
                },
              }),
            });
          } catch {}

          mapRef.current?.animateToRegion(
            {
              ...newLoc,
              latitudeDelta: LATITUDE_DELTA,
              longitudeDelta: LONGITUDE_DELTA,
            },
            1200,
          );
        },
      );
      setLocationSubscription(sub);
      return sub;
    } catch {
      return null;
    }
  }, []);

  // ── Initialization ─────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    let sub = null;

    (async () => {
      try {
        const authToken = await getAuthToken();
        if (!authToken) {
          navigation.replace("Login");
          return;
        }
        if (mounted) setToken(authToken);

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Location Required",
            "Enable location to receive ride requests.",
            [
              {
                text: "OK",
                onPress: () => navigation.replace("DriverHomeOffline"),
              },
            ],
          );
          return;
        }

        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.BestForNavigation,
        });
        const coords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          heading: pos.coords.heading || 0,
        };

        if (mounted) {
          setLocation(coords);
          setHeading(coords.heading);
          setLoading(false);
        }

        await goOnline(coords, authToken);
        if (mounted) setIsOnline(true);

        sub = await startLocationTracking(authToken);
      } catch (err) {
        if (mounted) {
          Alert.alert("Error", "Failed to initialize. Please try again.", [
            {
              text: "OK",
              onPress: () => navigation.replace("DriverHomeOffline"),
            },
          ]);
        }
      }
    })();

    return () => {
      mounted = false;
      sub?.remove();
      if (pollingRef.current) clearInterval(pollingRef.current);
      stopSoundLoop();
    };
  }, []);

  // ── Go offline ─────────────────────────────────────────────────────────────
  const goOffline = useCallback(() => {
    Alert.alert("Go Offline?", "You will stop receiving new ride requests.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Go Offline",
        style: "destructive",
        onPress: async () => {
          try {
            const authToken = token || (await getAuthToken());
            if (authToken) {
              await fetch(`${baseUrl}/drivers/availability`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${authToken}`,
                },
                body: JSON.stringify({ isAvailable: false }),
              });
            }
          } catch {}
          setIsOnline(false);
          locationSubscription?.remove();
          if (pollingRef.current) clearInterval(pollingRef.current);
          stopSoundLoop();
          closeWebSocket();
          navigation.replace("DriverHomeOffline");
        },
      },
    ]);
  }, [token, locationSubscription, stopSoundLoop, navigation]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const serviceConfig =
    SERVICE_CONFIG[incomingRequest?.serviceType] || SERVICE_CONFIG.CITY_RIDE;
  const wsColor =
    wsStatus === "connected"
      ? "#10B981"
      : wsStatus === "connecting"
        ? "#F59E0B"
        : "#EF4444";
  const wsLabel =
    wsStatus === "connected"
      ? "Live"
      : wsStatus === "connecting"
        ? "Syncing…"
        : "Offline";

  const statusCardTranslateY = statusCardAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-80, 0],
  });

  // ─────────────────────────────────────────────────────────────────────────
  // LOADING STATE
  // ─────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.loadingContainer}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor="transparent"
          translucent
        />
        <View style={s.loadingCard}>
          <View style={s.loadingIconWrap}>
            <Ionicons name="car-sport" size={36} color="#1A1A1A" />
          </View>
          <ActivityIndicator
            size="large"
            color="#1A1A1A"
            style={{ marginTop: 20 }}
          />
          <Text style={s.loadingTitle}>Getting ready…</Text>
          <Text style={s.loadingSubtitle}>Acquiring your location</Text>
        </View>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MAIN RENDER
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
        initialRegion={{
          latitude: location?.latitude || 9.0765,
          longitude: location?.longitude || 7.3986,
          latitudeDelta: LATITUDE_DELTA,
          longitudeDelta: LONGITUDE_DELTA,
        }}
        showsTraffic={false}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        onMapReady={() => setIsMapReady(true)}
      >
        {location && (
          <>
            {/* Accuracy pulse ring */}
            <Circle
              center={location}
              radius={80}
              strokeColor="rgba(16,185,129,0.25)"
              fillColor="rgba(16,185,129,0.08)"
            />
            {/* Driver marker */}
            <Marker coordinate={location} anchor={{ x: 0.5, y: 0.5 }} flat>
              <Animated.View
                style={[
                  s.driverMarkerOuter,
                  { transform: [{ scale: pulseAnim }] },
                ]}
              >
                <View style={s.driverMarkerInner}>
                  <Ionicons name="car-sport" size={22} color="#fff" />
                </View>
              </Animated.View>
            </Marker>
          </>
        )}
      </MapView>

      {/* ── CONNECTION BANNER ── */}
      {wsConnecting && (
        <View style={s.connectionBanner}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={s.connectionBannerText}>
            {connectionAttempts > 0
              ? `Reconnecting… (${connectionAttempts})`
              : "Connecting…"}
          </Text>
        </View>
      )}

      {/* ── TOP BAR ── */}
      <Animated.View
        style={[
          s.topBar,
          {
            transform: [{ translateY: statusCardTranslateY }],
            opacity: statusCardAnim,
          },
        ]}
      >
        {/* Menu */}
        <TouchableOpacity
          style={s.iconBtn}
          activeOpacity={0.8}
          onPress={() => navigation.openDrawer?.()}
        >
          <Ionicons name="menu" size={22} color="#1A1A1A" />
        </TouchableOpacity>

        {/* Center status pill */}
        <View style={s.topCenter}>
          <View
            style={[
              s.liveIndicator,
              { backgroundColor: isOnline ? "#10B981" : "#EF4444" },
            ]}
          />
          <Text style={s.topCenterLabel}>
            {isOnline ? "Online" : "Offline"}
          </Text>
          <View style={s.topDivider} />
          <View style={[s.wsIndicator, { backgroundColor: wsColor }]} />
          <Text style={s.topCenterLabel}>{wsLabel}</Text>
        </View>

        {/* Locate me */}
        <TouchableOpacity
          style={s.iconBtn}
          activeOpacity={0.8}
          onPress={() =>
            location &&
            mapRef.current?.animateToRegion(
              {
                ...location,
                latitudeDelta: LATITUDE_DELTA,
                longitudeDelta: LONGITUDE_DELTA,
              },
              800,
            )
          }
        >
          <Ionicons name="locate" size={20} color="#1A1A1A" />
        </TouchableOpacity>
      </Animated.View>

      {/* ── STATS CARD ── */}
      <Animated.View
        style={[
          s.statsCard,
          {
            transform: [
              {
                translateY: statusCardAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [100, 0],
                }),
              },
            ],
            opacity: statusCardAnim,
          },
        ]}
      >
        {/* Online indicator chip */}
        <View
          style={[
            s.statusChip,
            { backgroundColor: isOnline ? "#ECFDF5" : "#FEF2F2" },
          ]}
        >
          <View
            style={[
              s.statusChipDot,
              { backgroundColor: isOnline ? "#10B981" : "#EF4444" },
            ]}
          />
          <Text
            style={[
              s.statusChipText,
              { color: isOnline ? "#065F46" : "#991B1B" },
            ]}
          >
            {isOnline ? "Accepting rides" : "Not accepting rides"}
          </Text>
        </View>

        {/* Trip count */}
        <View style={s.statsRow}>
          <View style={s.statItem}>
            <Text style={s.statValue}>{todayTrips}</Text>
            <Text style={s.statLabel}>Trips today</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={s.statValue}>{wsLabel}</Text>
            <Text style={s.statLabel}>Connection</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={s.statValue}>{location ? "✓" : "…"}</Text>
            <Text style={s.statLabel}>Location</Text>
          </View>
        </View>

        {/* Go offline button */}
        <TouchableOpacity
          style={s.goOfflineBtn}
          onPress={goOffline}
          activeOpacity={0.85}
        >
          <Ionicons name="power" size={16} color="#EF4444" />
          <Text style={s.goOfflineBtnText}>Go Offline</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* ── INCOMING RIDE OFFER MODAL ── */}
      <Modal
        transparent
        visible={offerVisible}
        animationType="none"
        statusBarTranslucent
      >
        {/* Backdrop */}
        <TouchableOpacity
          style={s.modalBackdrop}
          activeOpacity={1}
          onPress={() => {}}
        />

        <Animated.View
          style={[s.offerSheet, { transform: [{ translateY: slideAnim }] }]}
        >
          {/* Sheet handle */}
          <View style={s.sheetHandle} />

          {/* Header */}
          <View style={s.offerHeader}>
            <View style={s.offerHeaderLeft}>
              <View
                style={[
                  s.serviceIconWrap,
                  { backgroundColor: serviceConfig.bg },
                ]}
              >
                <Ionicons
                  name={serviceConfig.icon}
                  size={22}
                  color={serviceConfig.color}
                />
              </View>
              <View>
                <Text style={s.offerHeaderLabel}>NEW REQUEST</Text>
                <Text style={s.offerHeaderTitle}>{serviceConfig.label}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={s.offerCloseBtn}
              onPress={rejectRide}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={18} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Timer bar */}
          <View style={s.timerBarTrack}>
            <Animated.View
              style={[
                s.timerBarFill,
                {
                  width: `${(timeLeft / 20) * 100}%`,
                  backgroundColor:
                    timeLeft > 10
                      ? "#10B981"
                      : timeLeft > 5
                        ? "#F59E0B"
                        : "#EF4444",
                },
              ]}
            />
          </View>
          <Text style={s.timerLabel}>{timeLeft}s remaining</Text>

          {/* Passenger */}
          <View style={s.passengerRow}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>
                {(incomingRequest?.passengerName || "P")
                  .charAt(0)
                  .toUpperCase()}
              </Text>
            </View>
            <View style={s.passengerInfo}>
              <Text style={s.passengerName}>
                {incomingRequest?.passengerName || "Passenger"}
              </Text>
              {incomingRequest?.passengerPhone ? (
                <Text style={s.passengerPhone}>
                  {incomingRequest.passengerPhone}
                </Text>
              ) : null}
            </View>
            {/* Payment badge */}
            <View
              style={[
                s.paymentBadge,
                {
                  backgroundColor:
                    incomingRequest?.paymentMethod === "wallet"
                      ? "#F5F3FF"
                      : "#F0FDF4",
                },
              ]}
            >
              <Ionicons
                name={
                  incomingRequest?.paymentMethod === "wallet"
                    ? "wallet"
                    : "cash"
                }
                size={13}
                color={
                  incomingRequest?.paymentMethod === "wallet"
                    ? "#7C3AED"
                    : "#059669"
                }
              />
              <Text
                style={[
                  s.paymentBadgeText,
                  {
                    color:
                      incomingRequest?.paymentMethod === "wallet"
                        ? "#7C3AED"
                        : "#059669",
                  },
                ]}
              >
                {incomingRequest?.paymentMethod === "wallet"
                  ? "Wallet"
                  : "Cash"}
              </Text>
            </View>
          </View>

          {/* Route card */}
          <View style={s.routeCard}>
            <View style={s.routePoint}>
              <View style={s.routeDotGreen} />
              <View style={s.routeTextWrap}>
                <Text style={s.routePointLabel}>PICKUP</Text>
                <Text style={s.routePointText} numberOfLines={2}>
                  {pickupAddress}
                </Text>
              </View>
            </View>
            <View style={s.routeConnectorRow}>
              <View style={s.routeConnectorLine} />
            </View>
            <View style={s.routePoint}>
              <View style={s.routeDotRed} />
              <View style={s.routeTextWrap}>
                <Text style={s.routePointLabel}>DESTINATION</Text>
                <Text style={s.routePointText} numberOfLines={2}>
                  {destinationAddress}
                </Text>
              </View>
            </View>
          </View>

          {/* Trip chips */}
          {(incomingRequest?.distance > 0 || incomingRequest?.duration > 0) && (
            <View style={s.tripChipsRow}>
              {incomingRequest?.distance > 0 && (
                <View style={s.tripChip}>
                  <Ionicons name="navigate-outline" size={13} color="#666" />
                  <Text style={s.tripChipText}>
                    {incomingRequest.distance.toFixed(1)} km
                  </Text>
                </View>
              )}
              {incomingRequest?.distance > 0 &&
                incomingRequest?.duration > 0 && (
                  <View style={s.tripChipDivider} />
                )}
              {incomingRequest?.duration > 0 && (
                <View style={s.tripChip}>
                  <Ionicons name="time-outline" size={13} color="#666" />
                  <Text style={s.tripChipText}>
                    {Math.round(incomingRequest.duration / 60)} min
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Fare */}
          <View style={s.fareRow}>
            <Text style={s.fareLabel}>Your earnings</Text>
            <Text style={s.fareAmount}>
              {incomingRequest?.fare && incomingRequest.fare > 0
                ? `₦${Number(incomingRequest.fare).toLocaleString()}`
                : "Calculating…"}
            </Text>
          </View>

          {/* Action buttons */}
          <View style={s.actionRow}>
            <TouchableOpacity
              style={s.declineBtn}
              onPress={rejectRide}
              activeOpacity={0.85}
            >
              <Text style={s.declineBtnText}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.acceptBtn}
              onPress={acceptRide}
              activeOpacity={0.88}
            >
              <Text style={s.acceptBtnText}>Accept Ride</Text>
              <Ionicons
                name="arrow-forward"
                size={18}
                color="#fff"
                style={{ marginLeft: 8 }}
              />
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Modal>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES — matching passenger home's refined, minimal, premium aesthetic
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F0" },
  map: { flex: 1 },

  // ── Loading ──────────────────────────────────────────────────────────────
  loadingContainer: {
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
    width: width * 0.7,
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

  // ── Connection banner ─────────────────────────────────────────────────────
  connectionBanner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "#1A1A1A",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: Platform.OS === "ios" ? 50 : 32,
    paddingBottom: 10,
    zIndex: 999,
  },
  connectionBannerText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 8,
  },

  // ── Top bar ───────────────────────────────────────────────────────────────
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
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  liveIndicator: { width: 8, height: 8, borderRadius: 4 },
  wsIndicator: { width: 8, height: 8, borderRadius: 4 },
  topCenterLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1A1A1A",
    letterSpacing: 0.3,
  },
  topDivider: { width: 1, height: 14, backgroundColor: "#E5E5E5" },

  // ── Driver marker ─────────────────────────────────────────────────────────
  driverMarkerOuter: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(16,185,129,0.18)",
    justifyContent: "center",
    alignItems: "center",
  },
  driverMarkerInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1A1A1A",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },

  // ── Stats card ────────────────────────────────────────────────────────────
  statsCard: {
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
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.09,
    shadowRadius: 20,
    elevation: 16,
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginBottom: 16,
    gap: 7,
  },
  statusChipDot: { width: 8, height: 8, borderRadius: 4 },
  statusChipText: { fontSize: 13, fontWeight: "700", letterSpacing: 0.2 },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    marginBottom: 16,
  },
  statItem: { alignItems: "center", flex: 1 },
  statValue: { fontSize: 20, fontWeight: "800", color: "#1A1A1A" },
  statLabel: {
    fontSize: 11,
    color: "#999",
    fontWeight: "600",
    marginTop: 2,
    letterSpacing: 0.5,
  },
  statDivider: { width: 1, height: 32, backgroundColor: "#F0F0F0" },

  goOfflineBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#EF4444",
    borderRadius: 14,
    paddingVertical: 13,
    gap: 8,
  },
  goOfflineBtnText: { color: "#EF4444", fontSize: 15, fontWeight: "700" },

  // ── Modal backdrop ────────────────────────────────────────────────────────
  modalBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.38)",
  },

  // ── Offer bottom sheet ────────────────────────────────────────────────────
  offerSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 36 : 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 20,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E0E0E0",
    alignSelf: "center",
    marginBottom: 16,
  },

  // ── Offer header ──────────────────────────────────────────────────────────
  offerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  offerHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  serviceIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  offerHeaderLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#aaa",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  offerHeaderTitle: { fontSize: 20, fontWeight: "800", color: "#1A1A1A" },
  offerCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F5F5F0",
    justifyContent: "center",
    alignItems: "center",
  },

  // ── Timer bar ─────────────────────────────────────────────────────────────
  timerBarTrack: {
    height: 4,
    backgroundColor: "#F0F0F0",
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 6,
  },
  timerBarFill: { height: "100%", borderRadius: 2 },
  timerLabel: {
    fontSize: 11,
    color: "#999",
    fontWeight: "600",
    marginBottom: 14,
    letterSpacing: 0.3,
  },

  // ── Passenger row ─────────────────────────────────────────────────────────
  passengerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
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
  passengerName: { fontSize: 16, fontWeight: "700", color: "#1A1A1A" },
  passengerPhone: { fontSize: 13, color: "#888", marginTop: 2 },
  paymentBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 5,
  },
  paymentBadgeText: { fontSize: 12, fontWeight: "700" },

  // ── Route card ────────────────────────────────────────────────────────────
  routeCard: {
    backgroundColor: "#F8F8F8",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  routePoint: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
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
  routeTextWrap: { flex: 1 },
  routePointLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#bbb",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  routePointText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1A1A1A",
    lineHeight: 20,
  },
  routeConnectorRow: { paddingLeft: 5, paddingVertical: 4 },
  routeConnectorLine: { width: 2, height: 16, backgroundColor: "#E5E5E5" },

  // ── Trip chips ────────────────────────────────────────────────────────────
  tripChipsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  tripChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  tripChipText: {
    fontSize: 13,
    color: "#666",
    fontWeight: "600",
    marginLeft: 5,
  },
  tripChipDivider: { width: 1, height: 14, backgroundColor: "#E0E0E0" },

  // ── Fare ──────────────────────────────────────────────────────────────────
  fareRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8F8F8",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
  },
  fareLabel: { fontSize: 13, color: "#888", fontWeight: "600" },
  fareAmount: { fontSize: 24, fontWeight: "800", color: "#1A1A1A" },

  // ── Actions ───────────────────────────────────────────────────────────────
  actionRow: { flexDirection: "row", gap: 12 },
  declineBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E5E5E5",
    alignItems: "center",
    justifyContent: "center",
  },
  declineBtnText: { color: "#EF4444", fontSize: 15, fontWeight: "700" },
  acceptBtn: {
    flex: 1.8,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: "#1A1A1A",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  acceptBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});
