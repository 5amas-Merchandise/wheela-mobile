// src/screens/passenger/HelpScreen.js
import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  Platform,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

const FAQS = [
  {
    q: "How do I book a ride?",
    a: "Tap the destination field on the home screen, enter where you're going, pick a ride type, then hit Request Ride. It's that simple.",
  },
  {
    q: "What payment methods are accepted?",
    a: "Wheela is cash-only. Pay your driver directly at the end of the trip — no cards, no surprises.",
  },
  {
    q: "How does pricing work?",
    a: "Fares are calculated based on distance and ride type. You'll always see the estimated fare before you confirm.",
  },
  {
    q: "Is my trip safe?",
    a: "All Wheela drivers pass background checks and vehicle inspections. You can share your trip live with trusted contacts anytime.",
  },
  {
    q: "What if I left something in the vehicle?",
    a: 'Go to your trip history, open the completed trip, and use the "Contact Driver" option to get in touch.',
  },
];

function FAQItem({ item }) {
  const [open, setOpen] = useState(false);

  return (
    <TouchableOpacity
      style={s.faqItem}
      onPress={() => setOpen(!open)}
      activeOpacity={0.8}
    >
      <View style={s.faqRow}>
        <Text style={s.faqQuestion}>{item.q}</Text>
        <View style={[s.faqChevron, open && s.faqChevronOpen]}>
          <Ionicons name="chevron-down" size={14} color="#1A1A1A" />
        </View>
      </View>
      {open && <Text style={s.faqAnswer}>{item.a}</Text>}
    </TouchableOpacity>
  );
}

export default function HelpScreen() {
  const navigation = useNavigation();

  const contactSupport = () => {
    Alert.alert(
      "Contact Support",
      "Call: +234 700 000 0000\nEmail: support@wheela.com\n\nWe're available 24/7!",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Call Now",
          onPress: () => Linking.openURL("tel:+2347000000000"),
        },
      ],
    );
  };

  return (
    <SafeAreaView style={s.container}>
      {/* ── TOP BAR ── */}
      <View style={s.topBar}>
        <TouchableOpacity
          style={s.topBarBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={20} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={s.topBarTitle}>Help & Support</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.content}
      >
        {/* ── CONTACT CARD (dark hero) ── */}
        <View style={s.heroCard}>
          <View style={s.heroIconWrap}>
            <Ionicons name="headset-outline" size={32} color="#fff" />
          </View>
          <Text style={s.heroTitle}>We're here to help</Text>
          <Text style={s.heroSub}>
            Our support team is available 24/7 — reach out anytime.
          </Text>
          <TouchableOpacity
            style={s.heroBtn}
            onPress={contactSupport}
            activeOpacity={0.88}
          >
            <Text style={s.heroBtnText}>Talk to Support</Text>
            <Ionicons name="arrow-forward" size={16} color="#1A1A1A" />
          </TouchableOpacity>
        </View>

        {/* ── FAQ CARD ── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>FAQ</Text>
          {FAQS.map((item, i) => (
            <FAQItem key={i} item={item} />
          ))}
        </View>

        {/* ── SAFETY CARD ── */}
        <View style={s.safetyCard}>
          <View style={s.safetyHeader}>
            <View style={s.safetyIconWrap}>
              <Ionicons
                name="shield-checkmark-outline"
                size={20}
                color="#10B981"
              />
            </View>
            <Text style={s.safetyTitle}>Your Safety Matters</Text>
          </View>
          <Text style={s.safetyText}>
            Every Wheela driver passes background checks and vehicle
            inspections. Share your trip live with trusted contacts and reach
            our team instantly if anything feels off.
          </Text>
        </View>

        {/* ── EMERGENCY BUTTON ── */}
        <TouchableOpacity
          style={s.emergencyBtn}
          onPress={() => Linking.openURL("tel:112")}
          activeOpacity={0.85}
        >
          <View style={s.emergencyIconWrap}>
            <Ionicons name="alert-circle-outline" size={20} color="#EF4444" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.emergencyTitle}>Emergency Assistance</Text>
            <Text style={s.emergencySub}>Tap to call emergency services</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#EF4444" />
        </TouchableOpacity>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

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

  content: { paddingHorizontal: 16 },

  // ── Hero card ──
  heroCard: {
    backgroundColor: "#1A1A1A",
    borderRadius: 22,
    padding: 24,
    alignItems: "center",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 7,
  },
  heroIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 8,
    letterSpacing: -0.4,
  },
  heroSub: {
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 20,
  },
  heroBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 24,
  },
  heroBtnText: { fontSize: 15, fontWeight: "800", color: "#1A1A1A" },

  // ── Generic card ──
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
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
    marginBottom: 6,
  },

  // ── FAQ ──
  faqItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F0",
  },
  faqRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  faqQuestion: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: "#1A1A1A",
    paddingRight: 12,
  },
  faqChevron: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: "#F5F5F0",
    justifyContent: "center",
    alignItems: "center",
  },
  faqChevronOpen: {
    backgroundColor: "#1A1A1A",
    transform: [{ rotate: "180deg" }],
  },
  faqAnswer: { fontSize: 13, color: "#666", lineHeight: 20, marginTop: 10 },

  // ── Safety card ──
  safetyCard: {
    backgroundColor: "#ECFDF5",
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#D1FAE5",
  },
  safetyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  safetyIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  safetyTitle: { fontSize: 15, fontWeight: "800", color: "#065F46" },
  safetyText: { fontSize: 13, color: "#065F46", lineHeight: 20, opacity: 0.8 },

  // ── Emergency button ──
  emergencyBtn: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1.5,
    borderColor: "#FEE2E2",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  emergencyIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: "#FEF2F2",
    justifyContent: "center",
    alignItems: "center",
  },
  emergencyTitle: { fontSize: 14, fontWeight: "800", color: "#EF4444" },
  emergencySub: { fontSize: 11, color: "#aaa", marginTop: 2 },
});
