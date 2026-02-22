// src/screens/passenger/TripTrackingScreen.js
import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Image,
  Animated,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, Polyline } from "react-native-maps";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { getAuthToken } from "../../utils/auth";
import * as Location from "expo-location";

const { width, height } = Dimensions.get("window");
const baseUrl = "https://wheels-backend-7ydc.onrender.com";
const GOOGLE_MAPS_API_KEY = "AIzaSyAbOQwCqiWYfyKe-t1SmzUcfgNVFYaXTFo";

const MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#f5f5f0" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f5f5f5" }] },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ color: "#eeeeee" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#d5e8d4" }],
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
    featureType: "transit.line",
    elementType: "geometry",
    stylers: [{ color: "#e5e5e5" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#b8d4e8" }],
  },
];

export default function TripTrackingScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const mapRef = useRef(null);
  const locationSubscriptionRef = useRef(null);

  const {
    tripId,
    driverId,
    passengerName = "Passenger",
    serviceType = "CITY_RIDE",
    fare = 0,
    pickup,
    destination,
    pickupAddress = "Pickup location",
    destinationAddress = "Destination",
    driverName = "Driver",
    driverPhone = "",
    driverRating = "4.8",
    vehicleModel = "Vehicle",
    vehiclePlate = "—",
    paymentMethod = "cash",
  } = route.params || {};

  // ── State ────────────────────────────────────────────────────────────────
  const [tripPhase, setTripPhase] = useState("pickup");
  const [tripStatus, setTripStatus] = useState("assigned");
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(true);
  const [driverLocation, setDriverLocation] = useState(null);
  const [passengerLocation, setPassengerLocation] = useState(null);
  const [pickupCoord, setPickupCoord] = useState(null);
  const [dropoffCoord, setDropoffCoord] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [distanceToTarget, setDistanceToTarget] = useState(null);
  const [timeToTarget, setTimeToTarget] = useState(null);
  const [tripValid, setTripValid] = useState(true);
  const [timer, setTimer] = useState(0);

  const [driverDetails, setDriverDetails] = useState({
    name: driverName || "Driver",
    phone: driverPhone || "",
    rating: driverRating || "4.8",
    vehicleModel: vehicleModel || "Vehicle",
    vehiclePlate: vehiclePlate || "—",
    profilePicUrl: null,
  });

  // ── Animations ────────────────────────────────────────────────────────────
  const cardSlide = useRef(new Animated.Value(80)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const phaseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(cardSlide, {
        toValue: 0,
        tension: 55,
        friction: 9,
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 380,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    Animated.timing(phaseAnim, {
      toValue: tripPhase === "in_progress" ? 1 : 0,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [tripPhase]);

  // Guard
  if (!tripId) {
    Alert.alert("Invalid Trip", "Unable to load trip information.", [
      { text: "OK", onPress: () => navigation.goBack() },
    ]);
    return null;
  }

  // ── Fetch driver details ─────────────────────────────────────────────────
  const fetchDriverDetails = async (id) => {
    try {
      const resolved = id || driverId;
      if (!resolved) return;

      const token = await getAuthToken();
      if (!token) return;

      const res = await fetch(`${baseUrl}/users/${resolved}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        console.log("Driver fetch failed:", res.status);
        return;
      }

      const data = await res.json();
      if (!data.user) return;

      const u = data.user;
      const dp = u.driverProfile || {};

      setDriverDetails((prev) => ({
        name: u.name || prev.name,
        phone: u.phone || prev.phone,
        rating: dp.rating != null ? String(dp.rating) : prev.rating,
        vehicleModel: dp.vehicleModel || prev.vehicleModel,
        vehiclePlate: dp.vehicleNumber || prev.vehiclePlate,
        profilePicUrl: dp.profilePicUrl || prev.profilePicUrl,
      }));
    } catch (e) {
      console.warn("fetchDriverDetails (non-fatal):", e.message);
    }
  };

  // ── Phone / WhatsApp ──────────────────────────────────────────────────────
  const makePhoneCall = () => {
    const raw = driverDetails.phone;
    if (!raw?.trim()) {
      Alert.alert("Unavailable", "Driver phone number is not available yet.");
      return;
    }
    let cleaned = raw.replace(/[^\d+]/g, "");
    if (cleaned.startsWith("0") && cleaned.length === 11)
      cleaned = "+234" + cleaned.slice(1);
    else if (!cleaned.startsWith("+") && cleaned.length === 10)
      cleaned = "+234" + cleaned;
    Linking.canOpenURL(`tel:${cleaned}`)
      .then((ok) =>
        ok
          ? Linking.openURL(`tel:${cleaned}`)
          : Alert.alert("Error", "Phone calls not supported."),
      )
      .catch(() => Alert.alert("Error", "Could not initiate call."));
  };

  const openWhatsApp = () => {
    const raw = driverDetails.phone;
    if (!raw?.trim()) {
      Alert.alert("Unavailable", "Driver phone number is not available yet.");
      return;
    }
    let cleaned = raw.replace(/[^\d]/g, "");
    if (cleaned.startsWith("0") && cleaned.length === 11)
      cleaned = "234" + cleaned.slice(1);
    const msg = encodeURIComponent(
      `Hello ${driverDetails.name}, this is ${passengerName} regarding trip #${tripId}`,
    );
    Linking.openURL(`whatsapp://send?phone=${cleaned}&text=${msg}`).catch(() =>
      Alert.alert("Error", "WhatsApp could not be opened."),
    );
  };

  // ── Poll trip status ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!tripId || !tripValid) return;
    const poll = async () => {
      try {
        const token = await getAuthToken();
        if (!token) return;
        const res = await fetch(`${baseUrl}/trips/${tripId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const { trip } = await res.json();
          if (!trip) return;
          setTripStatus(trip.status);
          if (trip.status === "started" || trip.status === "in_progress")
            setTripPhase("in_progress");
          const resolvedId =
            typeof trip.driverId === "object"
              ? trip.driverId._id?.toString() || trip.driverId.toString()
              : trip.driverId;
          if (resolvedId) fetchDriverDetails(resolvedId);

          if (trip.status === "completed") {
            setTripValid(false);
            const start = trip.startedAt
              ? new Date(trip.startedAt)
              : new Date(trip.requestedAt);
            const end = trip.completedAt
              ? new Date(trip.completedAt)
              : new Date();
            const duration = Math.floor((end - start) / 1000);
            setTimeout(
              () =>
                navigation.replace("TripCompleted", {
                  tripId,
                  driverId: resolvedId || driverId,
                  driverName: driverDetails.name,
                  driverRating: driverDetails.rating,
                  vehicleModel: driverDetails.vehicleModel,
                  vehiclePlate: driverDetails.vehiclePlate,
                  fare: trip.finalFare || trip.estimatedFare || fare,
                  serviceType: trip.serviceType || serviceType,
                  paymentMethod: trip.paymentMethod || paymentMethod,
                  tripDuration: duration,
                  pickupAddress,
                  destinationAddress,
                  distanceKm: trip.distanceKm || 0,
                }),
              1000,
            );
          } else if (trip.status === "cancelled") {
            setTripValid(false);
            Alert.alert("Trip Cancelled", "This trip has been cancelled.", [
              {
                text: "OK",
                onPress: () => navigation.navigate("PassengerMain"),
              },
            ]);
          }
        } else if (res.status === 404) {
          setTripValid(false);
          Alert.alert("Trip Not Found", "This trip is no longer available.", [
            { text: "OK", onPress: () => navigation.navigate("PassengerMain") },
          ]);
        }
      } catch (e) {
        console.warn("Poll (non-fatal):", e.message);
      }
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, [tripId, tripValid]);

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    initializeScreen();
    return () => locationSubscriptionRef.current?.remove?.();
  }, []);

  useEffect(() => {
    let iv;
    if (tripPhase === "in_progress")
      iv = setInterval(() => setTimer((p) => p + 1), 1000);
    return () => clearInterval(iv);
  }, [tripPhase]);

  useEffect(() => {
    if (tripPhase === "in_progress" && passengerLocation && dropoffCoord) {
      fetchRoute(passengerLocation, dropoffCoord);
      updateMapRegion(passengerLocation, dropoffCoord);
    } else if (tripPhase === "pickup" && driverLocation && pickupCoord) {
      fetchRoute(driverLocation, pickupCoord);
      updateMapRegion(driverLocation, pickupCoord);
    }
  }, [tripPhase, driverLocation, passengerLocation]);

  const initializeScreen = async () => {
    try {
      if (driverId) await fetchDriverDetails(driverId);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setPassengerLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      }
      let pC = null;
      if (pickup?.coordinates) {
        const [lng, lat] = pickup.coordinates;
        pC = { latitude: lat, longitude: lng };
      } else if (pickup?.latitude) pC = pickup;
      setPickupCoord(pC);

      let dC = null;
      if (destination?.coordinates) {
        const [lng, lat] = destination.coordinates;
        dC = { latitude: lat, longitude: lng };
      } else if (destination?.latitude) dC = destination;
      setDropoffCoord(dC);

      if (pC) {
        const sim = {
          latitude: pC.latitude + 0.003,
          longitude: pC.longitude + 0.003,
        };
        setDriverLocation(sim);
        setDistanceToTarget(calculateDistance(sim, pC));
        setTimeToTarget(calculateTime(sim, pC));
        await fetchRoute(sim, pC);
        updateMapRegion(sim, pC);
      }
      startLocationTracking();
      setInitializing(false);
      setLoading(false);
    } catch (e) {
      console.error("Init error:", e);
      setLoading(false);
      setInitializing(false);
    }
  };

  const updateMapRegion = (from, to) => {
    if (!from || !to || !mapRef.current) return;
    const lat = (from.latitude + to.latitude) / 2;
    const lng = (from.longitude + to.longitude) / 2;
    const latD = Math.abs(from.latitude - to.latitude) * 2.2 + 0.015;
    const lngD = Math.abs(from.longitude - to.longitude) * 2.2 + 0.015;
    setTimeout(
      () =>
        mapRef.current?.animateToRegion(
          {
            latitude: lat,
            longitude: lng,
            latitudeDelta: Math.max(latD, 0.02),
            longitudeDelta: Math.max(lngD, 0.02 * (width / height)),
          },
          1000,
        ),
      500,
    );
  };

  const fetchRoute = async (from, to) => {
    if (!from || !to) return;
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/directions/json?origin=${from.latitude},${from.longitude}&destination=${to.latitude},${to.longitude}&key=${GOOGLE_MAPS_API_KEY}&mode=driving`,
      );
      const data = await res.json();
      setRouteCoordinates(
        data.routes?.[0]
          ? decodePolyline(data.routes[0].overview_polyline.points)
          : [from, to],
      );
    } catch {
      setRouteCoordinates([from, to]);
    }
  };

  const decodePolyline = (encoded) => {
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
  };

  const startLocationTracking = async () => {
    try {
      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 10,
        },
        (pos) => {
          if (!pos) return;
          const loc = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          };
          setPassengerLocation(loc);
          if (tripPhase === "in_progress" && dropoffCoord) {
            setDistanceToTarget(calculateDistance(loc, dropoffCoord));
            setTimeToTarget(calculateTime(loc, dropoffCoord));
            fetchRoute(loc, dropoffCoord);
          }
        },
      );
      locationSubscriptionRef.current = sub;
    } catch (e) {
      console.error("Location tracking error:", e);
    }
  };

  const cancelTrip = async () => {
    if (!tripId || !tripValid) {
      Alert.alert("Error", "This trip is no longer available.");
      return;
    }
    Alert.alert("Cancel Trip", "Are you sure? A cancellation fee may apply.", [
      { text: "Keep Trip", style: "cancel" },
      {
        text: "Yes, Cancel",
        style: "destructive",
        onPress: async () => {
          try {
            const token = await getAuthToken();
            if (!token) {
              Alert.alert("Error", "Authentication error.");
              return;
            }
            const res = await fetch(`${baseUrl}/trips/${tripId}/cancel`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                reason: "passenger_cancelled",
                cancelledBy: "passenger",
              }),
            });
            if (res.ok) {
              Alert.alert("Cancelled", "Trip cancelled successfully.", [
                {
                  text: "OK",
                  onPress: () => navigation.navigate("PassengerMain"),
                },
              ]);
            } else {
              Alert.alert("Error", "Failed to cancel. Please try again.");
            }
          } catch {
            Alert.alert("Error", "Failed to cancel. Check your connection.");
          }
        },
      },
    ]);
  };

  const formatTime = (s) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const phaseColor = phaseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["#1A1A1A", "#10B981"],
  });

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading || initializing) {
    return (
      <SafeAreaView style={s.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color="#1A1A1A" />
          <Text style={s.loadingTitle}>Loading trip…</Text>
          <Text style={s.loadingSub}>Setting up your ride tracking</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => {
            if (!tripValid) {
              navigation.goBack();
              return;
            }
            Alert.alert("Leave Screen", "Leave trip tracking?", [
              { text: "Cancel", style: "cancel" },
              { text: "Leave", onPress: () => navigation.goBack() },
            ]);
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color="#1A1A1A" />
        </TouchableOpacity>

        <Text style={s.headerTitle}>
          {tripPhase === "pickup" ? "Driver En Route" : "Trip in Progress"}
        </Text>

        <Animated.View style={[s.phasePill, { backgroundColor: phaseColor }]}>
          <Text style={s.phasePillText}>
            {tripPhase === "pickup" ? "To Pickup" : "In Progress"}
          </Text>
        </Animated.View>
      </View>

      {/* ── Map ── */}
      <View style={s.mapWrap}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={s.map}
          customMapStyle={MAP_STYLE}
          showsUserLocation
          showsMyLocationButton={false}
          showsCompass={false}
          showsTraffic={false}
          initialRegion={{
            latitude:
              passengerLocation?.latitude ?? pickupCoord?.latitude ?? 9.082,
            longitude:
              passengerLocation?.longitude ?? pickupCoord?.longitude ?? 8.6753,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
        >
          {/* Passenger */}
          {passengerLocation && (
            <Marker coordinate={passengerLocation} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={s.passengerPin}>
                <View style={s.passengerPinInner} />
              </View>
            </Marker>
          )}

          {/* Driver */}
          {driverLocation && tripPhase === "pickup" && (
            <Marker coordinate={driverLocation} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={s.driverPin}>
                <Ionicons name="car-sport" size={20} color="#fff" />
              </View>
            </Marker>
          )}

          {/* Pickup */}
          {pickupCoord && (
            <Marker coordinate={pickupCoord} anchor={{ x: 0.5, y: 1 }}>
              <View style={s.mapPinWrap}>
                <View style={s.mapPinBlack}>
                  <Ionicons name="location" size={14} color="#fff" />
                </View>
                <View style={s.tailBlack} />
              </View>
            </Marker>
          )}

          {/* Destination */}
          {dropoffCoord && (
            <Marker coordinate={dropoffCoord} anchor={{ x: 0.5, y: 1 }}>
              <View style={s.mapPinWrap}>
                <View style={s.mapPinRed}>
                  <Ionicons name="flag" size={14} color="#fff" />
                </View>
                <View style={s.tailRed} />
              </View>
            </Marker>
          )}

          {/* Route */}
          {routeCoordinates.length > 0 && (
            <>
              <Polyline
                coordinates={routeCoordinates}
                strokeColor="rgba(0,0,0,0.07)"
                strokeWidth={10}
              />
              <Polyline
                coordinates={routeCoordinates}
                strokeColor={tripPhase === "pickup" ? "#1A1A1A" : "#10B981"}
                strokeWidth={5}
                lineDashPattern={tripPhase === "pickup" ? [12, 6] : undefined}
              />
            </>
          )}
        </MapView>

        {/* Recenter */}
        <TouchableOpacity
          style={s.recenterBtn}
          onPress={() => {
            if (
              tripPhase === "in_progress" &&
              passengerLocation &&
              dropoffCoord
            )
              updateMapRegion(passengerLocation, dropoffCoord);
            else if (driverLocation && pickupCoord)
              updateMapRegion(driverLocation, pickupCoord);
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="locate" size={22} color="#1A1A1A" />
        </TouchableOpacity>
      </View>

      {/* ── Bottom Sheet ── */}
      <Animated.View
        style={[
          s.sheet,
          { opacity: cardOpacity, transform: [{ translateY: cardSlide }] },
        ]}
      >
        <View style={s.sheetHandle} />
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Driver card */}
          <View style={s.driverCard}>
            {/* Avatar */}
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
            </View>

            {/* Info */}
            <View style={s.driverInfo}>
              <Text style={s.driverName}>{driverDetails.name}</Text>
              <View style={s.driverMetaRow}>
                <View style={s.ratingPill}>
                  <Ionicons name="star" size={12} color="#F59E0B" />
                  <Text style={s.ratingText}>{driverDetails.rating}</Text>
                </View>
                <Text style={s.vehicleText} numberOfLines={1}>
                  {driverDetails.vehicleModel}
                </Text>
              </View>
              <View style={s.platePill}>
                <Text style={s.platePillText}>
                  {driverDetails.vehiclePlate}
                </Text>
              </View>
              {driverDetails.phone ? (
                <TouchableOpacity onPress={makePhoneCall} activeOpacity={0.7}>
                  <Text style={s.phoneLink}>📞 {driverDetails.phone}</Text>
                </TouchableOpacity>
              ) : (
                <Text style={s.phonePending}>📞 Fetching number…</Text>
              )}
            </View>

            {/* Contact buttons */}
            <View style={s.contactCol}>
              <TouchableOpacity
                style={[s.contactBtn, !driverDetails.phone && s.contactBtnOff]}
                onPress={makePhoneCall}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="call"
                  size={18}
                  color={driverDetails.phone ? "#1A1A1A" : "#CCC"}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.contactBtn, !driverDetails.phone && s.contactBtnOff]}
                onPress={openWhatsApp}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="logo-whatsapp"
                  size={18}
                  color={driverDetails.phone ? "#25D366" : "#CCC"}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Status strip */}
          <Animated.View
            style={[s.statusStrip, { borderLeftColor: phaseColor }]}
          >
            <Animated.View
              style={[s.statusDot, { backgroundColor: phaseColor }]}
            />
            <View style={{ flex: 1 }}>
              <Text style={s.statusTitle}>
                {tripPhase === "pickup"
                  ? "Driver on the way"
                  : "Trip in progress"}
              </Text>
              <Text style={s.statusSub}>
                {tripPhase === "pickup"
                  ? `~${timeToTarget ?? "—"} min away · ${distanceToTarget ?? "—"} km`
                  : `En route to destination · ${formatTime(timer)} elapsed`}
              </Text>
            </View>
          </Animated.View>

          {/* Route */}
          <View style={s.routeCard}>
            <View style={s.routeRow}>
              <View style={s.routeTrack}>
                <View style={[s.routeDot, { backgroundColor: "#1A1A1A" }]} />
                <View style={s.routeLine} />
                <View style={[s.routeDot, { backgroundColor: "#EF4444" }]} />
              </View>
              <View style={s.routeAddresses}>
                <View style={s.addrBlock}>
                  <Text style={s.addrLabel}>
                    {tripPhase === "pickup" ? "PICKUP" : "YOUR LOCATION"}
                  </Text>
                  <Text style={s.addrText} numberOfLines={2}>
                    {tripPhase === "pickup"
                      ? pickupAddress
                      : "Tracking your location…"}
                  </Text>
                </View>
                <View style={s.addrBlock}>
                  <Text style={s.addrLabel}>DESTINATION</Text>
                  <Text style={s.addrText} numberOfLines={2}>
                    {destinationAddress}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Fare + metrics */}
          <View style={s.fareBlock}>
            <View style={s.fareRow}>
              <View>
                <Text style={s.fareLabel}>TRIP FARE</Text>
                <Text style={s.fareValue}>
                  ₦{Number(fare).toLocaleString()}
                </Text>
              </View>
              <View style={s.payMethodPill}>
                <Ionicons
                  name={
                    paymentMethod === "cash" ? "cash-outline" : "wallet-outline"
                  }
                  size={14}
                  color="#666"
                />
                <Text style={s.payMethodText}>
                  {paymentMethod === "cash" ? "Cash" : "Wallet"}
                </Text>
              </View>
            </View>

            {distanceToTarget !== null && timeToTarget !== null && (
              <View style={s.metricsRow}>
                <View style={s.metricChip}>
                  <Ionicons name="navigate-outline" size={13} color="#888" />
                  <Text style={s.metricText}>{distanceToTarget} km</Text>
                </View>
                <View style={s.metricDivider} />
                <View style={s.metricChip}>
                  <Ionicons name="time-outline" size={13} color="#888" />
                  <Text style={s.metricText}>
                    {timeToTarget} min {tripPhase === "pickup" ? "ETA" : "left"}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Cancel */}
          {tripValid &&
            tripStatus !== "completed" &&
            tripStatus !== "cancelled" && (
              <TouchableOpacity
                style={s.cancelBtn}
                onPress={cancelTrip}
                activeOpacity={0.85}
              >
                <Text style={s.cancelBtnText}>Cancel Trip</Text>
              </TouchableOpacity>
            )}

          <View style={{ height: 8 }} />
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const calculateDistance = (c1, c2) => {
  const R = 6371,
    dLat = ((c2.latitude - c1.latitude) * Math.PI) / 180,
    dLon = ((c2.longitude - c1.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((c1.latitude * Math.PI) / 180) *
      Math.cos((c2.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1);
};

const calculateTime = (c1, c2) =>
  Math.max(Math.ceil((parseFloat(calculateDistance(c1, c2)) / 40) * 60), 1);

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1A1A1A",
    marginTop: 20,
  },
  loadingSub: { fontSize: 14, color: "#888", marginTop: 6 },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 10 : 18,
    paddingBottom: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F5F5F0",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#1A1A1A" },
  phasePill: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  phasePillText: { fontSize: 12, fontWeight: "700", color: "#fff" },

  // Map
  mapWrap: { flex: 1, position: "relative" },
  map: { flex: 1 },
  recenterBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 6,
    elevation: 5,
  },

  // Markers
  passengerPin: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#fff",
    borderWidth: 3,
    borderColor: "#1A1A1A",
    justifyContent: "center",
    alignItems: "center",
  },
  passengerPinInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#1A1A1A",
  },
  driverPin: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#1A1A1A",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  mapPinWrap: { alignItems: "center" },
  mapPinBlack: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#1A1A1A",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#fff",
  },
  mapPinRed: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#EF4444",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#fff",
  },
  tailBlack: {
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 10,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#1A1A1A",
    marginTop: -1,
  },
  tailRed: {
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

  // Sheet
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 32 : 20,
    maxHeight: height * 0.52,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 12,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E0E0E0",
    alignSelf: "center",
    marginBottom: 16,
  },

  // Driver card
  driverCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8F8F8",
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },
  avatarWrap: { marginRight: 12 },
  avatarImg: { width: 56, height: 56, borderRadius: 28 },
  avatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#1A1A1A",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarLetter: { color: "#fff", fontSize: 22, fontWeight: "800" },
  driverInfo: { flex: 1 },
  driverName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 4,
  },
  driverMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
    gap: 8,
  },
  ratingPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF9E7",
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  ratingText: { fontSize: 12, color: "#666", marginLeft: 3, fontWeight: "700" },
  vehicleText: { fontSize: 12, color: "#888", flex: 1 },
  platePill: {
    alignSelf: "flex-start",
    backgroundColor: "#EFEFEF",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 5,
  },
  platePillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1A1A1A",
    letterSpacing: 0.5,
  },
  phoneLink: {
    fontSize: 13,
    color: "#1A1A1A",
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  phonePending: { fontSize: 13, color: "#aaa", fontStyle: "italic" },
  contactCol: { flexDirection: "column", gap: 8, marginLeft: 8 },
  contactBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E5E5",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 2,
    elevation: 2,
  },
  contactBtnOff: { borderColor: "#F5F5F5", backgroundColor: "#FAFAFA" },

  // Status strip
  statusStrip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8F8F8",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 4,
    gap: 10,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 2,
  },
  statusSub: { fontSize: 13, color: "#888" },

  // Route card
  routeCard: {
    backgroundColor: "#F8F8F8",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
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
    backgroundColor: "#E0E0E0",
    marginVertical: 5,
  },
  routeAddresses: { flex: 1 },
  addrBlock: { paddingVertical: 7 },
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

  // Fare
  fareBlock: { marginBottom: 12 },
  fareRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 12,
  },
  fareLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#BABABA",
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  fareValue: { fontSize: 28, fontWeight: "900", color: "#1A1A1A" },
  payMethodPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F5F5F0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  payMethodText: { fontSize: 13, fontWeight: "600", color: "#666" },
  metricsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8F8F8",
    borderRadius: 12,
    paddingVertical: 12,
  },
  metricChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 5,
  },
  metricText: { fontSize: 13, fontWeight: "600", color: "#666" },
  metricDivider: { width: 1, height: 14, backgroundColor: "#E0E0E0" },

  // Cancel
  cancelBtn: {
    borderWidth: 1.5,
    borderColor: "#F0F0F0",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    backgroundColor: "#FFF5F5",
  },
  cancelBtnText: { color: "#EF4444", fontSize: 15, fontWeight: "700" },
});
