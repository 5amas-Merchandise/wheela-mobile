// src/screens/passenger/PassengerHomeScreen.js
import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
  FlatList,
  TextInput,
  Animated,
  StatusBar,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, Polyline } from "react-native-maps";
import * as Location from "expo-location";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { DrawerActions } from "@react-navigation/native";
import {
  initWebSocket,
  sendWS,
  addListener,
  removeListener,
  isWebSocketConnected,
} from "../../utils/socket";
import { getAuthToken } from "../../utils/auth";

const { width, height } = Dimensions.get("window");
const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.012;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;
const GOOGLE_API_KEY = "AIzaSyAbOQwCqiWYfyKe-t1SmzUcfgNVFYaXTFo";
const BASE_URL = "https://wheels-backend-7ydc.onrender.com";

const DEFAULT_REGION = {
  latitude: 9.0765,
  longitude: 7.3986,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

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

const RIDE_TYPES = [
  {
    id: "CITY_RIDE",
    name: "Ride",
    icon: "car-sport",
    color: "#1A1A1A",
    bg: "#F0F0F0",
    multiplier: 1.5,
    eta: "3 min",
    desc: "Affordable everyday rides",
  },
  {
    id: "DELIVERY_BIKE",
    name: "Delivery Bike",
    icon: "bicycle",
    color: "#059669",
    bg: "#ECFDF5",
    multiplier: 1.0,
    eta: "2 min",
    desc: "Fast & cheap motorcycle",
  },
  {
    id: "KEKE",
    name: "Keke",
    icon: "triangle",
    color: "#D97706",
    bg: "#FFFBEB",
    multiplier: 0.8,
    eta: "4 min",
    desc: "Budget tricycle option",
  },
  {
    id: "LUXURY_RENTAL",
    name: "Luxury",
    icon: "diamond",
    color: "#7C3AED",
    bg: "#F5F3FF",
    multiplier: 2.5,
    eta: "8 min",
    desc: "Premium comfort rides",
  },
];

// ── Fare is always stored and sent in NAIRA (no *100) ────────────────────────
function calcFareNaira(distanceKm, multiplier) {
  return Math.round(500 + distanceKm * 150 * multiplier);
}

export default function PassengerHomeScreen() {
  const navigation = useNavigation();
  const mapRef = useRef(null);

  const bottomSheetAnim = useRef(new Animated.Value(0)).current;
  const searchCardAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Core state
  const [currentLocation, setCurrentLocation] = useState(DEFAULT_REGION);
  const [pickupLocation, setPickupLocation] = useState(null);
  const [dropoffLocation, setDropoffLocation] = useState(null);
  const [pickupAddress, setPickupAddress] = useState("Getting your location…");
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [selectedRideType, setSelectedRideType] = useState("CITY_RIDE");
  // estimatedFare is NAIRA — always. No *100 anywhere in this file.
  const [estimatedFare, setEstimatedFare] = useState(null);
  const [routeCoords, setRouteCoords] = useState([]);
  const [routeDistance, setRouteDistance] = useState(0);
  const [routeDuration, setRouteDuration] = useState(0);
  const [loading, setLoading] = useState(false);

  // Payment
  const [paymentMethod, setPaymentMethod] = useState("cash"); // 'cash' | 'wallet'
  // walletBalance is KOBO as returned by the backend GET /wallet
  const [walletBalance, setWalletBalance] = useState(null);
  const [walletLoading, setWalletLoading] = useState(false);

  // UI
  const [showRideModal, setShowRideModal] = useState(false);
  const [showPickupSearch, setShowPickupSearch] = useState(false);
  const [pickupSearchQuery, setPickupSearchQuery] = useState("");
  const [pickupSearchResults, setPickupSearchResults] = useState([]);
  const [pickupSearchLoading, setPickupSearchLoading] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const [locationPermissionGranted, setLocationPermissionGranted] =
    useState(false);

  // Connection
  const [wsReady, setWsReady] = useState(false);
  const [wsConnecting, setWsConnecting] = useState(true);
  const [connectionAttempts, setConnectionAttempts] = useState(0);

  // Trip
  const [tripStatus, setTripStatus] = useState(null);
  const [driverData, setDriverData] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);

  // ── Derived: wallet in naira for comparison against fare (naira) ─────────
  const walletBalanceNaira =
    walletBalance !== null ? walletBalance / 100 : null;
  const walletInsufficient =
    walletBalanceNaira !== null &&
    estimatedFare !== null &&
    walletBalanceNaira < estimatedFare;

  // ── Auth header ──────────────────────────────────────────────────────────
  const authH = async () => {
    const token = await getAuthToken();
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  // ── Wallet fetch ─────────────────────────────────────────────────────────
  const fetchWalletBalance = useCallback(async () => {
    try {
      setWalletLoading(true);
      const res = await fetch(`${BASE_URL}/wallet`, { headers: await authH() });
      if (!res.ok) return;
      const body = await res.json();
      setWalletBalance(body.wallet?.balance ?? 0); // kobo from backend
    } catch (e) {
      console.warn("wallet fetch:", e.message);
    } finally {
      setWalletLoading(false);
    }
  }, []);

  useEffect(() => {
    if (estimatedFare && dropoffLocation) fetchWalletBalance();
  }, [estimatedFare, dropoffLocation]);

  // Revert to cash automatically if wallet becomes insufficient
  useEffect(() => {
    if (walletInsufficient && paymentMethod === "wallet")
      setPaymentMethod("cash");
  }, [walletInsufficient]);

  // ── Animations ───────────────────────────────────────────────────────────
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  useEffect(() => {
    Animated.spring(searchCardAnim, {
      toValue: 1,
      tension: 60,
      friction: 9,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    if (estimatedFare && dropoffLocation) {
      Animated.spring(bottomSheetAnim, {
        toValue: 1,
        tension: 55,
        friction: 8,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(bottomSheetAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }
  }, [estimatedFare, dropoffLocation]);

  // ── Location ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          if (isMounted) {
            setLocationPermissionGranted(false);
            setPickupAddress("Location permission denied");
          }
          return;
        }
        if (isMounted) setLocationPermissionGranted(true);
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!isMounted) return;
        const region = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: LATITUDE_DELTA,
          longitudeDelta: LONGITUDE_DELTA,
        };
        setCurrentLocation(region);
        setPickupLocation(region);
        await reverseGeocodeGoogle(region, true);
      } catch {
        if (isMounted) setPickupAddress("Unable to get location");
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (
      isMapReady &&
      locationPermissionGranted &&
      currentLocation.latitude !== DEFAULT_REGION.latitude
    ) {
      mapRef.current?.animateToRegion(currentLocation, 1200);
    }
  }, [isMapReady, locationPermissionGranted]);

  // ── WebSocket ────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    let retryTimeout = null;
    const init = async () => {
      try {
        if (isWebSocketConnected()) {
          if (mounted) {
            setWsReady(true);
            setWsConnecting(false);
          }
          return;
        }
        await initWebSocket();
        if (mounted) {
          setWsReady(isWebSocketConnected());
          setWsConnecting(false);
        }
      } catch {
        if (mounted) {
          setWsReady(false);
          const delay = Math.min(1500 * Math.pow(2, connectionAttempts), 12000);
          retryTimeout = setTimeout(() => {
            if (mounted) {
              setConnectionAttempts((p) => p + 1);
              init();
            }
          }, delay);
        }
      }
    };
    init();
    const onConnect = () => {
      if (mounted) {
        setWsReady(true);
        setWsConnecting(false);
        setConnectionAttempts(0);
      }
    };
    const onDisconnect = () => {
      if (mounted) {
        setWsReady(false);
        setWsConnecting(true);
      }
    };
    addListener("connect", onConnect);
    addListener("disconnect", onDisconnect);
    return () => {
      mounted = false;
      if (retryTimeout) clearTimeout(retryTimeout);
      removeListener("connect", onConnect);
      removeListener("disconnect", onDisconnect);
    };
  }, []);

  // ── Trip events ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!wsReady) return;
    const onAccepted = (d) => {
      setDriverData(d);
      setTripStatus("driver_nearby");
    };
    const onDriverLocation = (d) => {
      if (d.driverLocation) setDriverLocation(d.driverLocation);
    };
    const onStarted = () => setTripStatus("trip_started");
    const onCompleted = () => {
      setTripStatus("trip_completed");
      setDriverData(null);
      setDriverLocation(null);
    };
    addListener("trip:accepted", onAccepted);
    addListener("trip:driver_location", onDriverLocation);
    addListener("trip:started", onStarted);
    addListener("trip:completed", onCompleted);
    return () => {
      removeListener("trip:accepted", onAccepted);
      removeListener("trip:driver_location", onDriverLocation);
      removeListener("trip:started", onStarted);
      removeListener("trip:completed", onCompleted);
    };
  }, [wsReady]);

  // ── Google helpers ───────────────────────────────────────────────────────
  const reverseGeocodeGoogle = async (coords, isPickup = false) => {
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${coords.latitude},${coords.longitude}&key=${GOOGLE_API_KEY}`,
      );
      const data = await res.json();
      if (data.status === "OK" && data.results.length > 0) {
        if (isPickup) setPickupAddress(data.results[0].formatted_address);
        else setDropoffAddress(data.results[0].formatted_address);
      }
    } catch {}
  };

  const fetchGoogleRoute = async (origin, dest) => {
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${dest.latitude},${dest.longitude}&key=${GOOGLE_API_KEY}&mode=driving`,
      );
      const data = await res.json();
      if (data.status === "OK" && data.routes.length > 0) {
        const route = data.routes[0];
        const leg = route.legs[0];
        return {
          coordinates: decodePolyline(route.overview_polyline.points),
          distance: leg.distance.value / 1000,
          duration: leg.duration.value,
        };
      }
      return null;
    } catch {
      return null;
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

  const displayRoute = async (origin, dest) => {
    if (!origin || !dest) return;
    setLoading(true);
    const routeData = await fetchGoogleRoute(origin, dest);
    if (routeData) {
      setRouteCoords(routeData.coordinates);
      setRouteDistance(routeData.distance);
      setRouteDuration(routeData.duration);
      const ride = RIDE_TYPES.find((r) => r.id === selectedRideType);
      // ✅ NAIRA — no *100
      setEstimatedFare(calcFareNaira(routeData.distance, ride.multiplier));
      if (mapRef.current && isMapReady) {
        mapRef.current.fitToCoordinates(routeData.coordinates, {
          edgePadding: { top: 120, right: 60, bottom: 400, left: 60 },
          animated: true,
        });
      }
    }
    setLoading(false);
  };

  // ── Pickup search ────────────────────────────────────────────────────────
  const searchPickupLocation = async (text) => {
    setPickupSearchQuery(text);
    if (text.trim().length < 2) {
      setPickupSearchResults([]);
      return;
    }
    setPickupSearchLoading(true);
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&key=${GOOGLE_API_KEY}&components=country:ng`,
      );
      const data = await res.json();
      setPickupSearchResults(data.status === "OK" ? data.predictions : []);
    } catch {
      setPickupSearchResults([]);
    } finally {
      setPickupSearchLoading(false);
    }
  };

  const selectPickupLocation = async (item) => {
    setPickupSearchLoading(true);
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${item.place_id}&fields=geometry,formatted_address&key=${GOOGLE_API_KEY}`,
      );
      const data = await res.json();
      if (data.status === "OK") {
        const { lat, lng } = data.result.geometry.location;
        const coords = {
          latitude: lat,
          longitude: lng,
          latitudeDelta: LATITUDE_DELTA,
          longitudeDelta: LONGITUDE_DELTA,
        };
        setPickupLocation(coords);
        setPickupAddress(data.result.formatted_address || item.description);
        setShowPickupSearch(false);
        mapRef.current?.animateToRegion(coords, 1000);
        if (dropoffLocation) displayRoute(coords, dropoffLocation);
      }
    } catch {
      Alert.alert("Error", "Failed to select location");
    } finally {
      setPickupSearchLoading(false);
    }
  };

  // ── Ride type ────────────────────────────────────────────────────────────
  const selectRide = (rideId) => {
    setSelectedRideType(rideId);
    setShowRideModal(false);
    if (routeDistance > 0) {
      const ride = RIDE_TYPES.find((r) => r.id === rideId);
      // ✅ NAIRA — no *100
      setEstimatedFare(calcFareNaira(routeDistance, ride.multiplier));
    }
  };

  const cancelTrip = useCallback(() => {
    if (!driverData?.tripId || !wsReady) return;
    Alert.alert("Cancel Trip", "Are you sure you want to cancel?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes",
        style: "destructive",
        onPress: () => {
          sendWS({ type: "trip:cancel", tripId: driverData.tripId });
          setTripStatus(null);
          setDriverData(null);
          setDriverLocation(null);
        },
      },
    ]);
  }, [driverData, wsReady]);

  const goToSearchDestination = () => {
    navigation.navigate("SearchDestination", {
      onSelect: (coords, address) => {
        setDropoffLocation(coords);
        setDropoffAddress(address);
        if (pickupLocation) displayRoute(pickupLocation, coords);
      },
    });
  };

  const selectedRide =
    RIDE_TYPES.find((r) => r.id === selectedRideType) || RIDE_TYPES[0];

  const bottomSheetTranslateY = bottomSheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [400, 0],
  });
  const searchCardTranslateY = searchCardAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [60, 0],
  });

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={s.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent
      />

      {/* MAP */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={s.map}
        customMapStyle={MAP_STYLE}
        initialRegion={currentLocation}
        showsUserLocation={locationPermissionGranted}
        showsMyLocationButton={false}
        showsCompass={false}
        showsTraffic={false}
        onMapReady={() => setIsMapReady(true)}
      >
        {pickupLocation && (
          <Marker coordinate={pickupLocation} anchor={{ x: 0.5, y: 1 }}>
            <View style={s.pickupPin}>
              <View style={s.pickupPinInner} />
            </View>
          </Marker>
        )}
        {dropoffLocation && (
          <Marker coordinate={dropoffLocation} anchor={{ x: 0.5, y: 1 }}>
            <View style={s.dropoffPinWrap}>
              <View style={s.dropoffPin}>
                <Ionicons name="flag" size={14} color="#fff" />
              </View>
              <View style={s.dropoffPinTail} />
            </View>
          </Marker>
        )}
        {driverLocation && (
          <Marker coordinate={driverLocation} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={s.driverPin}>
              <Ionicons name="car-sport" size={20} color="#fff" />
            </View>
          </Marker>
        )}
        {routeCoords.length > 0 && (
          <>
            <Polyline
              coordinates={routeCoords}
              strokeColor="rgba(0,0,0,0.08)"
              strokeWidth={10}
            />
            <Polyline
              coordinates={routeCoords}
              strokeColor="#1A1A1A"
              strokeWidth={5}
            />
          </>
        )}
      </MapView>

      {/* CONNECTION BANNER */}
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

      {/* TOP BAR */}
      <View style={s.topBar}>
        <TouchableOpacity
          style={s.menuBtn}
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
          activeOpacity={0.8}
        >
          <Ionicons name="menu" size={22} color="#1A1A1A" />
        </TouchableOpacity>
        <View style={s.topCenter}>
          <View
            style={[
              s.liveIndicator,
              { backgroundColor: wsReady ? "#10B981" : "#F59E0B" },
            ]}
          />
          <Text style={s.topCenterText}>{wsReady ? "Live" : "Offline"}</Text>
        </View>
        <TouchableOpacity
          style={s.locateBtn}
          onPress={() =>
            currentLocation &&
            mapRef.current?.animateToRegion(currentLocation, 800)
          }
          activeOpacity={0.8}
        >
          <Ionicons name="locate" size={20} color="#1A1A1A" />
        </TouchableOpacity>
      </View>

      {/* PICKUP SEARCH OVERLAY */}
      {showPickupSearch && (
        <View style={s.searchOverlay}>
          <View style={s.searchOverlayHeader}>
            <TouchableOpacity
              style={s.searchBackBtn}
              onPress={() => {
                setShowPickupSearch(false);
                setPickupSearchQuery("");
                setPickupSearchResults([]);
              }}
            >
              <Ionicons name="arrow-back" size={22} color="#1A1A1A" />
            </TouchableOpacity>
            <View style={s.searchInputWrap}>
              <Ionicons
                name="search"
                size={16}
                color="#999"
                style={{ marginLeft: 12 }}
              />
              <TextInput
                style={s.searchInput}
                placeholder="Search pickup location…"
                placeholderTextColor="#999"
                value={pickupSearchQuery}
                onChangeText={searchPickupLocation}
                autoFocus
              />
              {pickupSearchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setPickupSearchQuery("");
                    setPickupSearchResults([]);
                  }}
                  style={{ padding: 8 }}
                >
                  <Ionicons name="close-circle" size={16} color="#ccc" />
                </TouchableOpacity>
              )}
            </View>
          </View>
          {pickupSearchLoading && (
            <View style={s.searchLoadingRow}>
              <ActivityIndicator size="small" color="#1A1A1A" />
              <Text style={s.searchLoadingText}>Searching…</Text>
            </View>
          )}
          <FlatList
            data={pickupSearchResults}
            keyExtractor={(item) => item.place_id}
            keyboardShouldPersistTaps="handled"
            ItemSeparatorComponent={() => <View style={s.searchSeparator} />}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={s.searchResultItem}
                onPress={() => selectPickupLocation(item)}
                activeOpacity={0.7}
              >
                <View style={s.searchResultIcon}>
                  <Ionicons name="location" size={16} color="#1A1A1A" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.searchResultMain} numberOfLines={1}>
                    {item.structured_formatting?.main_text || item.description}
                  </Text>
                  <Text style={s.searchResultSub} numberOfLines={1}>
                    {item.structured_formatting?.secondary_text || ""}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* SEARCH CARD */}
      {!tripStatus && (
        <Animated.View
          style={[
            s.searchCard,
            {
              transform: [{ translateY: searchCardTranslateY }],
              opacity: searchCardAnim,
            },
          ]}
        >
          <TouchableOpacity
            style={s.locationInputRow}
            onPress={() => setShowPickupSearch(true)}
            activeOpacity={0.8}
          >
            <View style={s.dotGreen} />
            <View style={s.locationInputContent}>
              <Text style={s.locationInputLabel}>PICKUP</Text>
              <Text style={s.locationInputText} numberOfLines={1}>
                {pickupAddress}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#ccc" />
          </TouchableOpacity>
          <View style={s.routeLineWrap}>
            <View style={s.routeLineVertical} />
          </View>
          <TouchableOpacity
            style={s.locationInputRow}
            onPress={goToSearchDestination}
            activeOpacity={0.8}
          >
            <View style={s.dotBlack} />
            <View style={s.locationInputContent}>
              <Text style={s.locationInputLabel}>DESTINATION</Text>
              <Text
                style={[
                  s.locationInputText,
                  !dropoffAddress && s.locationInputPlaceholder,
                ]}
                numberOfLines={1}
              >
                {dropoffAddress || "Where are you going?"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#ccc" />
          </TouchableOpacity>
          {loading && (
            <View style={s.routeLoadingRow}>
              <ActivityIndicator size="small" color="#1A1A1A" />
              <Text style={s.routeLoadingText}>Finding best route…</Text>
            </View>
          )}
        </Animated.View>
      )}

      {/* BOTTOM SHEET */}
      {!tripStatus && dropoffLocation && estimatedFare && (
        <Animated.View
          style={[
            s.bottomSheet,
            { transform: [{ translateY: bottomSheetTranslateY }] },
          ]}
        >
          <View style={s.sheetHandle} />

          {/* Ride picker */}
          <TouchableOpacity
            style={s.ridePickerRow}
            onPress={() => setShowRideModal(true)}
            activeOpacity={0.85}
          >
            <View
              style={[s.ridePickerIcon, { backgroundColor: selectedRide.bg }]}
            >
              <Ionicons
                name={selectedRide.icon}
                size={26}
                color={selectedRide.color}
              />
            </View>
            <View style={s.ridePickerInfo}>
              <Text style={s.ridePickerName}>{selectedRide.name}</Text>
              <Text style={s.ridePickerSub}>
                {selectedRide.eta} • {selectedRide.desc}
              </Text>
            </View>
            <View style={s.ridePickerRight}>
              {/* estimatedFare is naira — display directly, no division */}
              <Text style={s.ridePickerFare}>
                ₦{estimatedFare.toLocaleString()}
              </Text>
              <View style={s.changeTag}>
                <Text style={s.changeTagText}>Change</Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Trip chips */}
          <View style={s.tripChipsRow}>
            <View style={s.tripChip}>
              <Ionicons name="navigate-outline" size={13} color="#666" />
              <Text style={s.tripChipText}>{routeDistance.toFixed(1)} km</Text>
            </View>
            <View style={s.tripChipDivider} />
            <View style={s.tripChip}>
              <Ionicons name="time-outline" size={13} color="#666" />
              <Text style={s.tripChipText}>
                {Math.round(routeDuration / 60)} min
              </Text>
            </View>
            <View style={s.tripChipDivider} />
            <View style={s.tripChip}>
              <Ionicons name="cash-outline" size={13} color="#666" />
              <Text style={s.tripChipText}>
                {paymentMethod === "wallet" ? "Wallet" : "Cash"}
              </Text>
            </View>
          </View>

          {/* ── PAYMENT METHOD SELECTOR ── */}
          <View style={s.paymentSection}>
            <Text style={s.paymentLabel}>PAYMENT METHOD</Text>
            <View style={s.paymentRow}>
              {/* Cash */}
              <TouchableOpacity
                style={[
                  s.paymentOption,
                  paymentMethod === "cash" && s.paymentOptionSelected,
                ]}
                onPress={() => setPaymentMethod("cash")}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    s.paymentOptionIcon,
                    {
                      backgroundColor:
                        paymentMethod === "cash" ? "#1A1A1A" : "#F5F5F0",
                    },
                  ]}
                >
                  <Ionicons
                    name="cash"
                    size={18}
                    color={paymentMethod === "cash" ? "#fff" : "#666"}
                  />
                </View>
                <View style={s.paymentOptionText}>
                  <Text
                    style={[
                      s.paymentOptionTitle,
                      paymentMethod === "cash" && s.paymentOptionTitleSelected,
                    ]}
                  >
                    Cash
                  </Text>
                  <Text style={s.paymentOptionSub}>Pay driver directly</Text>
                </View>
                {paymentMethod === "cash" && (
                  <View style={s.paymentCheckCircle}>
                    <Ionicons name="checkmark" size={12} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>

              {/* Wallet */}
              <TouchableOpacity
                style={[
                  s.paymentOption,
                  paymentMethod === "wallet" && s.paymentOptionSelected,
                  walletInsufficient && s.paymentOptionDisabled,
                ]}
                onPress={() => {
                  if (!walletInsufficient) setPaymentMethod("wallet");
                }}
                activeOpacity={walletInsufficient ? 1 : 0.8}
                disabled={walletInsufficient}
              >
                <View
                  style={[
                    s.paymentOptionIcon,
                    {
                      backgroundColor: walletInsufficient
                        ? "#F0F0F0"
                        : paymentMethod === "wallet"
                          ? "#1A1A1A"
                          : "#F5F5F0",
                    },
                  ]}
                >
                  <Ionicons
                    name="wallet"
                    size={18}
                    color={
                      walletInsufficient
                        ? "#ccc"
                        : paymentMethod === "wallet"
                          ? "#fff"
                          : "#666"
                    }
                  />
                </View>
                <View style={s.paymentOptionText}>
                  <Text
                    style={[
                      s.paymentOptionTitle,
                      paymentMethod === "wallet" &&
                        !walletInsufficient &&
                        s.paymentOptionTitleSelected,
                      walletInsufficient && s.paymentOptionTitleDisabled,
                    ]}
                  >
                    Wallet
                  </Text>
                  {walletLoading ? (
                    <ActivityIndicator
                      size="small"
                      color="#ccc"
                      style={{ alignSelf: "flex-start", marginTop: 2 }}
                    />
                  ) : walletInsufficient ? (
                    <Text style={s.paymentOptionInsufficient}>
                      ₦
                      {walletBalanceNaira?.toLocaleString("en-NG", {
                        minimumFractionDigits: 2,
                      })}{" "}
                      — insufficient
                    </Text>
                  ) : walletBalanceNaira !== null ? (
                    <Text style={s.paymentOptionSub}>
                      Balance: ₦
                      {walletBalanceNaira?.toLocaleString("en-NG", {
                        minimumFractionDigits: 2,
                      })}
                    </Text>
                  ) : (
                    <Text style={s.paymentOptionSub}>Tap to use</Text>
                  )}
                </View>
                {walletInsufficient ? (
                  <View style={s.paymentLockBadge}>
                    <Ionicons name="lock-closed" size={11} color="#EF4444" />
                  </View>
                ) : paymentMethod === "wallet" ? (
                  <View style={s.paymentCheckCircle}>
                    <Ionicons name="checkmark" size={12} color="#fff" />
                  </View>
                ) : null}
              </TouchableOpacity>
            </View>

            {/* Insufficient banner */}
            {walletInsufficient && (
              <View style={s.insufficientBanner}>
                <Ionicons name="information-circle" size={14} color="#EF4444" />
                <Text style={s.insufficientBannerText}>
                  Your wallet (₦
                  {walletBalanceNaira?.toLocaleString("en-NG", {
                    minimumFractionDigits: 2,
                  })}
                  ) is less than the fare (₦{estimatedFare?.toLocaleString()}).
                  Please top up or pay cash.
                </Text>
              </View>
            )}
          </View>

          {/* Request button */}
          <TouchableOpacity
            style={[
              s.requestBtn,
              (!wsReady || !locationPermissionGranted) && s.requestBtnDisabled,
            ]}
            onPress={() => {
              if (!locationPermissionGranted) {
                Alert.alert(
                  "Location Required",
                  "Please enable location to request a ride.",
                );
                return;
              }
              if (!wsReady) {
                Alert.alert(
                  "Not Connected",
                  "Please wait while we reconnect to the server.",
                );
                return;
              }
              navigation.navigate("DriverMatching", {
                pickup: pickupLocation,
                dropoff: dropoffLocation,
                pickupAddress,
                dropoffAddress,
                serviceType: selectedRideType,
                estimatedFare, // ✅ naira — same unit the backend has always expected
                distance: routeDistance,
                duration: routeDuration,
                paymentMethod, // 'cash' | 'wallet'
              });
            }}
            activeOpacity={0.88}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={s.requestBtnText}>
                  {!locationPermissionGranted
                    ? "Location Required"
                    : !wsReady
                      ? "Reconnecting…"
                      : `Request Ride · ${paymentMethod === "wallet" ? "Wallet" : "Cash"}`}
                </Text>
                <Ionicons
                  name="arrow-forward"
                  size={20}
                  color="#fff"
                  style={{ marginLeft: 8 }}
                />
              </>
            )}
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* RIDE TYPE MODAL */}
      <Modal
        visible={showRideModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRideModal(false)}
      >
        <TouchableOpacity
          style={s.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowRideModal(false)}
        />
        <View style={s.rideModal}>
          <View style={s.sheetHandle} />
          <View style={s.rideModalHeader}>
            <Text style={s.rideModalTitle}>Choose ride type</Text>
          </View>
          {RIDE_TYPES.map((ride) => {
            const isSelected = selectedRideType === ride.id;
            // ✅ naira — no *100
            const rideFare =
              routeDistance > 0
                ? calcFareNaira(routeDistance, ride.multiplier)
                : null;
            return (
              <TouchableOpacity
                key={ride.id}
                style={[s.rideOption, isSelected && s.rideOptionSelected]}
                onPress={() => selectRide(ride.id)}
                activeOpacity={0.85}
              >
                <View style={[s.rideOptionIcon, { backgroundColor: ride.bg }]}>
                  <Ionicons name={ride.icon} size={28} color={ride.color} />
                </View>
                <View style={s.rideOptionInfo}>
                  <Text style={s.rideOptionName}>{ride.name}</Text>
                  <Text style={s.rideOptionDesc}>
                    {ride.eta} • {ride.desc}
                  </Text>
                </View>
                <View style={s.rideOptionRight}>
                  {rideFare && (
                    <Text style={s.rideOptionFare}>
                      ₦{rideFare.toLocaleString()}
                    </Text>
                  )}
                  {isSelected && (
                    <View style={s.rideOptionCheck}>
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
          <View style={{ height: Platform.OS === "ios" ? 28 : 12 }} />
        </View>
      </Modal>

      {/* ACTIVE TRIP CARD */}
      {tripStatus && driverData && (
        <View style={s.tripCard}>
          <View style={s.tripCardPill}>
            <View
              style={[
                s.tripCardPillDot,
                {
                  backgroundColor:
                    tripStatus === "driver_nearby" ? "#3B82F6" : "#10B981",
                },
              ]}
            />
            <Text style={s.tripCardPillText}>
              {tripStatus === "driver_nearby"
                ? "Driver on the way"
                : "Trip in progress"}
            </Text>
          </View>
          <View style={s.tripDriverRow}>
            <View style={s.tripDriverAvatar}>
              <Text style={s.tripDriverAvatarText}>
                {(driverData.driverName || "D").charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={s.tripDriverInfo}>
              <Text style={s.tripDriverName}>
                {driverData.driverName || "Driver"}
              </Text>
              <Text style={s.tripDriverVehicle}>
                {driverData.vehicleModel || "Vehicle"} ·{" "}
                {driverData.vehiclePlate || "—"}
              </Text>
              <View style={s.tripRatingRow}>
                <Ionicons name="star" size={13} color="#F59E0B" />
                <Text style={s.tripRatingText}>
                  {driverData.rating || "4.8"}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={s.tripCallBtn} activeOpacity={0.8}>
              <Ionicons name="call" size={18} color="#1A1A1A" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={s.tripCancelBtn}
            onPress={cancelTrip}
            activeOpacity={0.85}
          >
            <Text style={s.tripCancelText}>Cancel trip</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F0" },
  map: { flex: 1 },

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
  menuBtn: {
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  liveIndicator: { width: 8, height: 8, borderRadius: 4, marginRight: 7 },
  topCenterText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1A1A1A",
    letterSpacing: 0.3,
  },
  locateBtn: {
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

  pickupPin: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#fff",
    borderWidth: 3,
    borderColor: "#1A1A1A",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  pickupPinInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#1A1A1A",
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
  dropoffPinTail: {
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

  searchOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#fff",
    zIndex: 90,
    paddingTop: Platform.OS === "ios" ? 50 : 30,
  },
  searchOverlayHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  searchBackBtn: { padding: 8, marginRight: 8 },
  searchInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F0",
    borderRadius: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#1A1A1A",
    paddingHorizontal: 8,
  },
  searchLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    paddingBottom: 8,
  },
  searchLoadingText: { marginLeft: 10, color: "#666", fontSize: 14 },
  searchSeparator: { height: 1, backgroundColor: "#f5f5f5", marginLeft: 60 },
  searchResultItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  searchResultIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F5F5F0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  searchResultMain: { fontSize: 15, fontWeight: "600", color: "#1A1A1A" },
  searchResultSub: { fontSize: 13, color: "#999", marginTop: 2 },

  searchCard: {
    position: "absolute",
    top: Platform.OS === "ios" ? 114 : 104,
    left: 16,
    right: 16,
    backgroundColor: "#fff",
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
  locationInputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
  },
  dotGreen: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#10B981",
    marginRight: 14,
  },
  dotBlack: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#1A1A1A",
    marginRight: 14,
  },
  locationInputContent: { flex: 1 },
  locationInputLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#aaa",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  locationInputText: { fontSize: 15, fontWeight: "600", color: "#1A1A1A" },
  locationInputPlaceholder: { color: "#bbb", fontWeight: "400" },
  routeLineWrap: { paddingLeft: 5, paddingVertical: 2 },
  routeLineVertical: { width: 2, height: 18, backgroundColor: "#E5E5E5" },
  routeLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F5F5F0",
  },
  routeLoadingText: { marginLeft: 10, fontSize: 13, color: "#888" },

  bottomSheet: {
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

  ridePickerRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#F8F8F8",
    marginBottom: 12,
  },
  ridePickerIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  ridePickerInfo: { flex: 1 },
  ridePickerName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 2,
  },
  ridePickerSub: { fontSize: 12, color: "#888" },
  ridePickerRight: { alignItems: "flex-end" },
  ridePickerFare: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1A1A1A",
    marginBottom: 6,
  },
  changeTag: {
    backgroundColor: "#1A1A1A",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  changeTagText: { color: "#fff", fontSize: 11, fontWeight: "700" },

  tripChipsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
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

  paymentSection: { marginBottom: 16 },
  paymentLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#bbb",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  paymentRow: { flexDirection: "row", gap: 10 },
  paymentOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8F8F8",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: "transparent",
    position: "relative",
  },
  paymentOptionSelected: { backgroundColor: "#fff", borderColor: "#1A1A1A" },
  paymentOptionDisabled: {
    backgroundColor: "#FAFAFA",
    borderColor: "#F0F0F0",
    opacity: 0.7,
  },
  paymentOptionIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  paymentOptionText: { flex: 1 },
  paymentOptionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#888",
    marginBottom: 2,
  },
  paymentOptionTitleSelected: { color: "#1A1A1A" },
  paymentOptionTitleDisabled: { color: "#ccc" },
  paymentOptionSub: { fontSize: 10, color: "#aaa", fontWeight: "500" },
  paymentOptionInsufficient: {
    fontSize: 10,
    color: "#EF4444",
    fontWeight: "600",
  },
  paymentCheckCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#1A1A1A",
    justifyContent: "center",
    alignItems: "center",
    position: "absolute",
    top: 8,
    right: 8,
  },
  paymentLockBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    justifyContent: "center",
    alignItems: "center",
    position: "absolute",
    top: 8,
    right: 8,
  },
  insufficientBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  insufficientBannerText: {
    flex: 1,
    fontSize: 11,
    color: "#EF4444",
    fontWeight: "500",
    lineHeight: 16,
  },

  requestBtn: {
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    paddingVertical: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  requestBtnDisabled: { backgroundColor: "#C0C0C0" },
  requestBtnText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.3,
  },

  modalBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  rideModal: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  rideModalHeader: {
    marginBottom: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  rideModalTitle: { fontSize: 18, fontWeight: "800", color: "#1A1A1A" },
  rideOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 14,
    paddingHorizontal: 4,
    marginVertical: 4,
  },
  rideOptionSelected: { backgroundColor: "#F8F8F8" },
  rideOptionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  rideOptionInfo: { flex: 1 },
  rideOptionName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 3,
  },
  rideOptionDesc: { fontSize: 12, color: "#888" },
  rideOptionRight: { alignItems: "flex-end", gap: 6 },
  rideOptionFare: { fontSize: 17, fontWeight: "800", color: "#1A1A1A" },
  rideOptionCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#10B981",
    justifyContent: "center",
    alignItems: "center",
  },

  tripCard: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 36 : 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 12,
  },
  tripCardPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#F5F5F0",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginBottom: 16,
  },
  tripCardPillDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  tripCardPillText: { fontSize: 14, fontWeight: "700", color: "#1A1A1A" },
  tripDriverRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  tripDriverAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#1A1A1A",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  tripDriverAvatarText: { color: "#fff", fontSize: 22, fontWeight: "800" },
  tripDriverInfo: { flex: 1 },
  tripDriverName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 2,
  },
  tripDriverVehicle: { fontSize: 13, color: "#888", marginBottom: 4 },
  tripRatingRow: { flexDirection: "row", alignItems: "center" },
  tripRatingText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
    marginLeft: 4,
  },
  tripCallBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#F5F5F0",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  tripCancelBtn: {
    borderWidth: 1.5,
    borderColor: "#E5E5E5",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  tripCancelText: { color: "#EF4444", fontSize: 15, fontWeight: "700" },
});
