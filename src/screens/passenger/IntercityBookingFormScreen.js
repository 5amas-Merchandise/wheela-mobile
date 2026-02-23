// src/screens/passenger/IntercityBookingFormScreen.js
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
  StatusBar,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import axios from "axios";
import * as Auth from "../../utils/auth";

const API_URL = "https://wheels-backend-7ydc.onrender.com";
const axiosInstance = axios.create({ timeout: 30000 });

export default function IntercityBookingFormScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { trip } = route.params;

  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [numberOfSeats, setNumberOfSeats] = useState("1");
  const [specialRequests, setSpecialRequests] = useState("");
  const [showNextOfKin, setShowNextOfKin] = useState(false);
  const [nextOfKinName, setNextOfKinName] = useState("");
  const [nextOfKinPhone, setNextOfKinPhone] = useState("");
  const [nextOfKinRel, setNextOfKinRel] = useState("");

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const storedUser = await Auth.getStoredUser();
      if (storedUser) {
        setFullName(storedUser.name || storedUser.fullName || "");
        setEmail(storedUser.email || "");
        setPhone(storedUser.phone || "");
      }
    } catch {}
  };

  const validateForm = () => {
    if (!fullName.trim()) {
      Alert.alert("Missing Info", "Please enter your full name.");
      return false;
    }
    if (!email.trim() || !email.includes("@")) {
      Alert.alert("Missing Info", "Please enter a valid email address.");
      return false;
    }
    if (!phone.trim() || phone.length < 10) {
      Alert.alert("Missing Info", "Please enter a valid phone number.");
      return false;
    }
    const seats = parseInt(numberOfSeats);
    if (isNaN(seats) || seats < 1 || seats > 10) {
      Alert.alert("Missing Info", "Seats must be between 1 and 10.");
      return false;
    }
    if (seats > trip.availability.availableSeats) {
      Alert.alert(
        "Not Available",
        `Only ${trip.availability.availableSeats} seats available.`,
      );
      return false;
    }
    return true;
  };

  const handleBooking = async () => {
    if (!validateForm()) return;
    try {
      setLoading(true);
      const token = await Auth.getAuthToken();
      if (!token) {
        navigation.navigate("Login");
        return;
      }

      const bookingData = {
        scheduleId: trip.scheduleId,
        passengerDetails: {
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
        },
        numberOfSeats: parseInt(numberOfSeats),
        specialRequests: specialRequests.trim() || undefined,
      };

      if (showNextOfKin && nextOfKinName.trim() && nextOfKinPhone.trim()) {
        bookingData.passengerDetails.nextOfKin = {
          name: nextOfKinName.trim(),
          phone: nextOfKinPhone.trim(),
          relationship: nextOfKinRel.trim() || "Not specified",
        };
      }

      const response = await axiosInstance.post(
        `${API_URL}/intercity/bookings`,
        bookingData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (response.data.success) {
        const b = response.data.booking;
        Alert.alert(
          "Booking Confirmed! 🎉",
          `Reference: ${b.bookingReference}\nAmount: ₦${b.totalAmountInNaira}\nSeats: ${b.numberOfSeats}`,
          [
            {
              text: "View Booking",
              onPress: () =>
                navigation.navigate("IntercityBookingDetails", {
                  bookingId: b.id,
                  bookingReference: b.bookingReference,
                }),
            },
            {
              text: "My Bookings",
              onPress: () => navigation.navigate("IntercityBookings"),
            },
          ],
        );
      } else {
        throw new Error(response.data.error?.message || "Booking failed");
      }
    } catch (error) {
      let msg = "Unable to complete booking. Please try again.";
      if (error.code === "ECONNABORTED")
        msg = "Request timed out. Check your connection.";
      else if (error.response?.data?.error?.message)
        msg = error.response.data.error.message;
      else if (!error.response && error.request)
        msg = "No response from server. Check your connection.";
      Alert.alert("Booking Failed", msg);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (time) => {
    if (!time) return "N/A";
    const [h, m] = time.split(":");
    const hr = parseInt(h);
    return `${hr % 12 || 12}:${m} ${hr >= 12 ? "PM" : "AM"}`;
  };

  const getDuration = (d) => {
    if (!d) return "N/A";
    return `${Math.floor(d / 60)}h ${d % 60}m`;
  };

  const calculateTotal = () => {
    const seats = parseInt(numberOfSeats) || 1;
    return (seats * parseFloat(trip.pricing.priceInNaira)).toLocaleString();
  };

  return (
    <SafeAreaView style={s.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent
      />

      {/* ── TOP BAR ── */}
      <View style={s.topBar}>
        <TouchableOpacity
          style={s.topBarBtn}
          onPress={() => navigation.goBack()}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={20} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={s.topBarTitle}>Complete Booking</Text>
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 140 }}
        >
          {/* ── TRIP SUMMARY CARD ── */}
          <View style={s.summaryCard}>
            <Text style={s.summaryLabel}>TRIP SUMMARY</Text>
            <View style={s.routeRow}>
              <View style={s.routeTimeBlock}>
                <Text style={s.routeTime}>
                  {formatTime(trip.departure.time)}
                </Text>
                <Text style={s.routeCity}>{trip.route.from.split(",")[0]}</Text>
              </View>
              <View style={s.routeCenter}>
                <View style={s.routeDot} />
                <View style={s.routeDash} />
                <Text style={s.routeDurationText}>
                  {getDuration(trip.route.duration)}
                </Text>
                <View style={s.routeDash} />
                <View style={[s.routeDot, { backgroundColor: "#EF4444" }]} />
              </View>
              <View style={[s.routeTimeBlock, { alignItems: "flex-end" }]}>
                <Text style={s.routeTime}>{formatTime(trip.arrival.time)}</Text>
                <Text style={s.routeCity}>{trip.route.to.split(",")[0]}</Text>
              </View>
            </View>
            <View style={s.summaryChipsRow}>
              <View style={s.summaryChip}>
                <MaterialIcons name="directions-bus" size={13} color="#666" />
                <Text style={s.summaryChipText}>{trip.company.name}</Text>
              </View>
              <View style={s.summaryChip}>
                <Ionicons name="calendar-outline" size={13} color="#666" />
                <Text style={s.summaryChipText}>
                  {new Date(trip.departure.date).toLocaleDateString("en-US", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </Text>
              </View>
            </View>
          </View>

          {/* ── PASSENGER FORM ── */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Passenger Info</Text>

            <InputField
              label="Full Name *"
              value={fullName}
              onChangeText={setFullName}
              placeholder="Enter full name"
              editable={!loading}
            />
            <InputField
              label="Email Address *"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              editable={!loading}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <InputField
              label="Phone Number *"
              value={phone}
              onChangeText={setPhone}
              placeholder="+234 800 000 0000"
              editable={!loading}
              keyboardType="phone-pad"
            />
            <InputField
              label="Number of Seats *"
              value={numberOfSeats}
              onChangeText={setNumberOfSeats}
              placeholder="1"
              editable={!loading}
              keyboardType="number-pad"
              helper={`${trip.availability.availableSeats} seats available`}
            />
            <InputField
              label="Special Requests"
              value={specialRequests}
              onChangeText={setSpecialRequests}
              placeholder="Any special requirements"
              editable={!loading}
              multiline
              isLast
            />
          </View>

          {/* ── NEXT OF KIN (collapsible) ── */}
          <View style={s.card}>
            <TouchableOpacity
              style={s.collapsibleHeader}
              onPress={() => setShowNextOfKin(!showNextOfKin)}
              disabled={loading}
              activeOpacity={0.7}
            >
              <Text style={s.cardTitle}>Next of Kin</Text>
              <View style={s.collapsibleBadge}>
                <Text style={s.collapsibleBadgeText}>Optional</Text>
                <Ionicons
                  name={showNextOfKin ? "chevron-up" : "chevron-down"}
                  size={16}
                  color="#888"
                />
              </View>
            </TouchableOpacity>
            {showNextOfKin && (
              <>
                <InputField
                  label="Name"
                  value={nextOfKinName}
                  onChangeText={setNextOfKinName}
                  placeholder="Next of kin full name"
                  editable={!loading}
                />
                <InputField
                  label="Phone"
                  value={nextOfKinPhone}
                  onChangeText={setNextOfKinPhone}
                  placeholder="+234 800 000 0000"
                  editable={!loading}
                  keyboardType="phone-pad"
                />
                <InputField
                  label="Relationship"
                  value={nextOfKinRel}
                  onChangeText={setNextOfKinRel}
                  placeholder="e.g. Spouse, Parent, Sibling"
                  editable={!loading}
                  isLast
                />
              </>
            )}
          </View>

          {/* ── PRICE SUMMARY ── */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Price Summary</Text>

            <View style={s.priceRow}>
              <Text style={s.priceRowLabel}>
                Price per seat × {numberOfSeats || 1}
              </Text>
              <Text style={s.priceRowValue}>
                ₦{parseFloat(trip.pricing.priceInNaira).toLocaleString()}
              </Text>
            </View>

            <View style={s.priceDivider} />

            <View style={s.priceRow}>
              <Text style={s.priceTotalLabel}>Total</Text>
              <Text style={s.priceTotalValue}>₦{calculateTotal()}</Text>
            </View>

            <Text style={s.priceNote}>
              * Payment collected at the terminal before departure
            </Text>
          </View>
        </ScrollView>

        {/* ── ACTION BAR ── */}
        <View style={s.actionBar}>
          <View style={s.actionBarTop}>
            <Text style={s.actionBarLabel}>Total Amount</Text>
            <Text style={s.actionBarAmount}>₦{calculateTotal()}</Text>
          </View>
          <TouchableOpacity
            style={[s.confirmBtn, loading && s.confirmBtnDisabled]}
            onPress={handleBooking}
            disabled={loading}
            activeOpacity={0.88}
          >
            {loading ? (
              <>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={s.confirmBtnText}>Processing…</Text>
              </>
            ) : (
              <>
                <Text style={s.confirmBtnText}>Confirm Booking</Text>
                <Ionicons
                  name="arrow-forward"
                  size={20}
                  color="#fff"
                  style={{ marginLeft: 8 }}
                />
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Reusable input ─────────────────────────────────────────────────────────
function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  editable = true,
  keyboardType,
  autoCapitalize,
  multiline,
  helper,
  isLast,
}) {
  return (
    <View style={[f.group, isLast && { marginBottom: 0 }]}>
      <Text style={f.label}>{label}</Text>
      <TextInput
        style={[f.input, multiline && f.textArea]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#bbb"
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize || "sentences"}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        editable={editable}
      />
      {helper && <Text style={f.helper}>{helper}</Text>}
    </View>
  );
}

const f = StyleSheet.create({
  group: { marginBottom: 16 },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: "#aaa",
    letterSpacing: 0.7,
    marginBottom: 7,
  },
  input: {
    backgroundColor: "#F5F5F0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    fontWeight: "600",
    color: "#1A1A1A",
  },
  textArea: { height: 80, textAlignVertical: "top" },
  helper: { fontSize: 11, color: "#aaa", marginTop: 5 },
});

// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F0" },

  // ── Top bar ──
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 12 : 44,
    paddingBottom: 14,
    backgroundColor: "#F5F5F0",
  },
  topBarBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1A1A1A",
    letterSpacing: -0.3,
  },

  // ── Summary card ──
  summaryCard: {
    backgroundColor: "#1A1A1A",
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 22,
    padding: 20,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "rgba(255,255,255,0.4)",
    letterSpacing: 1,
    marginBottom: 16,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  routeTimeBlock: { flex: 1 },
  routeTime: {
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.5,
    marginBottom: 3,
  },
  routeCity: { fontSize: 12, color: "rgba(255,255,255,0.5)" },
  routeCenter: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  routeDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#10B981",
  },
  routeDash: {
    flex: 1,
    height: 2,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginHorizontal: 3,
    minWidth: 10,
  },
  routeDurationText: {
    fontSize: 9,
    fontWeight: "700",
    color: "rgba(255,255,255,0.4)",
    paddingHorizontal: 4,
  },
  summaryChipsRow: { flexDirection: "row", gap: 8 },
  summaryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  summaryChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255,255,255,0.6)",
  },

  // ── Generic card ──
  card: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 20,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 5,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#aaa",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 16,
  },

  // ── Collapsible header ──
  collapsibleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  collapsibleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F5F5F0",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  collapsibleBadgeText: { fontSize: 11, color: "#888", fontWeight: "600" },

  // ── Price rows ──
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  priceRowLabel: { fontSize: 13, color: "#888" },
  priceRowValue: { fontSize: 13, fontWeight: "700", color: "#1A1A1A" },
  priceDivider: { height: 1, backgroundColor: "#F5F5F0", marginBottom: 12 },
  priceTotalLabel: { fontSize: 15, fontWeight: "800", color: "#1A1A1A" },
  priceTotalValue: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1A1A1A",
    letterSpacing: -0.5,
  },
  priceNote: {
    fontSize: 11,
    color: "#aaa",
    fontStyle: "italic",
    marginTop: 10,
    lineHeight: 16,
  },

  // ── Action bar ──
  actionBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: Platform.OS === "ios" ? 32 : 16,
    borderTopWidth: 1,
    borderTopColor: "#EBEBEB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 10,
  },
  actionBarTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  actionBarLabel: { fontSize: 12, color: "#aaa", fontWeight: "600" },
  actionBarAmount: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1A1A1A",
    letterSpacing: -0.5,
  },
  confirmBtn: {
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    paddingVertical: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtnDisabled: { backgroundColor: "#C0C0C0" },
  confirmBtnText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
});
