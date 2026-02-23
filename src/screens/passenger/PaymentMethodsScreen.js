// src/screens/passenger/PaymentMethodsScreen.js
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

const BENEFITS = [
  { icon: 'receipt-outline',         text: 'No hidden fees — pay exactly what the app shows.' },
  { icon: 'shield-checkmark-outline', text: 'No card data stored. Your financial info stays private.' },
  { icon: 'people-outline',          text: 'Works for everyone, with or without a bank account.' },
  { icon: 'handshake-outline',       text: 'Builds direct trust between riders and drivers.' },
];

export default function PaymentMethodsScreen() {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={s.container}>
      {/* ── TOP BAR ── */}
      <View style={s.topBar}>
        <TouchableOpacity style={s.topBarBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={20} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={s.topBarTitle}>Payment</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>

        {/* ── CASH METHOD CARD ── */}
        <View style={s.methodCard}>
          <View style={s.methodLeft}>
            <View style={s.methodIconWrap}>
              <Ionicons name="cash-outline" size={26} color="#1A1A1A" />
            </View>
            <View>
              <Text style={s.methodTitle}>Cash</Text>
              <Text style={s.methodSub}>Default payment method</Text>
            </View>
          </View>
          <View style={s.activeBadge}>
            <Ionicons name="checkmark" size={14} color="#fff" />
            <Text style={s.activeBadgeText}>Active</Text>
          </View>
        </View>

        {/* ── WHY CASH CARD ── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Why Cash Only?</Text>
          <Text style={s.cardBody}>
            Wheela runs on a cash-only model to keep things simple, transparent, and accessible for every rider and driver.
          </Text>

          <View style={s.benefitsList}>
            {BENEFITS.map((b, i) => (
              <View key={i} style={[s.benefitRow, i === BENEFITS.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={s.benefitIconWrap}>
                  <Ionicons name={b.icon} size={17} color="#1A1A1A" />
                </View>
                <Text style={s.benefitText}>{b.text}</Text>
              </View>
            ))}
          </View>

          <Text style={[s.cardBody, { marginTop: 16, fontSize: 13, color: '#aaa', lineHeight: 20 }]}>
            We believe this model fosters a more honest, reliable experience for everyone on the platform.
          </Text>
        </View>

        {/* ── SUPPORT BUTTON ── */}
        <TouchableOpacity
          style={s.supportBtn}
          onPress={() =>
            Alert.alert('Contact Support', 'Call: +234 700 000 0000\nEmail: support@wheela.com\n\nWe\'re here 24/7!', [{ text: 'OK' }])
          }
          activeOpacity={0.85}
        >
          <View style={s.supportBtnLeft}>
            <View style={s.supportIconWrap}>
              <Ionicons name="help-circle-outline" size={20} color="#1A1A1A" />
            </View>
            <Text style={s.supportBtnText}>Questions about payments?</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#ccc" />
        </TouchableOpacity>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F0' },

  // ── Top bar ──
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 12 : 44,
    paddingBottom: 14,
  },
  topBarBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 4,
  },
  topBarTitle: { fontSize: 17, fontWeight: '800', color: '#1A1A1A', letterSpacing: -0.3 },

  content: { paddingHorizontal: 16 },

  // ── Method card ──
  methodCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 20, padding: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18, shadowRadius: 14, elevation: 7,
  },
  methodLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  methodIconWrap: {
    width: 50, height: 50, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  methodTitle: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 3 },
  methodSub:   { fontSize: 12, color: 'rgba(255,255,255,0.45)' },
  activeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#10B981', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  activeBadgeText: { fontSize: 12, fontWeight: '800', color: '#fff' },

  // ── Generic card ──
  card: {
    backgroundColor: '#fff', borderRadius: 20, padding: 18, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07, shadowRadius: 12, elevation: 5,
  },
  cardTitle: {
    fontSize: 13, fontWeight: '800', color: '#aaa',
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10,
  },
  cardBody: { fontSize: 14, color: '#666', lineHeight: 21, marginBottom: 16 },

  // ── Benefits list ──
  benefitsList: { borderTopWidth: 1, borderTopColor: '#F5F5F0' },
  benefitRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: '#F5F5F0', gap: 14,
  },
  benefitIconWrap: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: '#F5F5F0',
    justifyContent: 'center', alignItems: 'center',
  },
  benefitText: { flex: 1, fontSize: 13, color: '#444', lineHeight: 19, fontWeight: '500' },

  // ── Support button ──
  supportBtn: {
    backgroundColor: '#fff', borderRadius: 18, padding: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07, shadowRadius: 12, elevation: 5,
  },
  supportBtnLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  supportIconWrap: {
    width: 38, height: 38, borderRadius: 11, backgroundColor: '#F5F5F0',
    justifyContent: 'center', alignItems: 'center',
  },
  supportBtnText: { fontSize: 14, fontWeight: '700', color: '#1A1A1A' },
});