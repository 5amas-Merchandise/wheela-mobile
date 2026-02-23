// src/screens/passenger/SettingsScreen.js
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Switch,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

// ── Reusable setting row ───────────────────────────────────────────────────
function SettingRow({ icon, label, sub, onPress, rightElement, isLast }) {
  const Inner = (
    <View style={[r.row, isLast && { borderBottomWidth: 0 }]}>
      <View style={r.iconWrap}>
        <Ionicons name={icon} size={18} color="#1A1A1A" />
      </View>
      <View style={r.labelWrap}>
        <Text style={r.label}>{label}</Text>
        {sub ? <Text style={r.sub}>{sub}</Text> : null}
      </View>
      {rightElement || (
        <Ionicons name="chevron-forward" size={16} color="#ccc" />
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {Inner}
      </TouchableOpacity>
    );
  }
  return Inner;
}

const r = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F0",
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#F5F5F0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  labelWrap: { flex: 1 },
  label: { fontSize: 14, fontWeight: "700", color: "#1A1A1A" },
  sub: { fontSize: 11, color: "#aaa", marginTop: 2 },
});

// ── Section wrapper ────────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      <View style={s.sectionCard}>{children}</View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const navigation = useNavigation();
  const [notifications, setNotifications] = useState(true);
  const [locationAlways, setLocationAlways] = useState(false);

  const Toggle = ({ value, onChange }) => (
    <Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ false: "#E0E0E0", true: "#1A1A1A" }}
      thumbColor="#fff"
      ios_backgroundColor="#E0E0E0"
    />
  );

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
        <Text style={s.topBarTitle}>Settings</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.content}
      >
        {/* ── ACCOUNT ── */}
        <Section title="Account">
          <SettingRow
            icon="person-outline"
            label="Personal Information"
            onPress={() => navigation.navigate("Profile")}
          />
          <SettingRow
            icon="lock-closed-outline"
            label="Change Password"
            onPress={() => {}}
            isLast
          />
        </Section>

        {/* ── PREFERENCES ── */}
        <Section title="Preferences">
          <SettingRow
            icon="notifications-outline"
            label="Push Notifications"
            sub="Ride updates, promos, alerts"
            rightElement={
              <Toggle value={notifications} onChange={setNotifications} />
            }
          />
          <SettingRow
            icon="location-outline"
            label="Location Access"
            sub="Allow always for better pickup"
            rightElement={
              <Toggle value={locationAlways} onChange={setLocationAlways} />
            }
            isLast
          />
        </Section>

        {/* ── SUPPORT & LEGAL ── */}
        <Section title="Support & Legal">
          <SettingRow
            icon="help-circle-outline"
            label="Help & Support"
            onPress={() => navigation.navigate("Help")}
          />
          <SettingRow
            icon="document-text-outline"
            label="Terms of Service"
            onPress={() => {}}
          />
          <SettingRow
            icon="shield-checkmark-outline"
            label="Privacy Policy"
            onPress={() => {}}
            isLast
          />
        </Section>

        {/* ── ABOUT ── */}
        <Section title="About">
          <SettingRow
            icon="information-circle-outline"
            label="App Version"
            rightElement={<Text style={s.versionText}>v1.2.0</Text>}
            isLast
          />
        </Section>

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

  // ── Section ──
  section: { marginBottom: 12 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#aaa",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 5,
  },

  // ── Version text ──
  versionText: { fontSize: 13, fontWeight: "700", color: "#aaa" },
});
