// src/screens/passenger/WalletScreen.js
//
// Full redesign — balance card, paginated transaction history, Paystack top-up.
// Handles every transaction category from your backend:
//   referral_reward  → Referral Bonus  (purple gift)
//   ride_payment     → Ride Payment    (dark car)
//   ride_earning     → Ride Earning    (green cash — driver-side, shown if user is driver)
//   wallet_funding   → Wallet Top-up   (blue add)
//   deposit          → Deposit         (blue arrow-down)
//   admin_credit     → Admin Credit    (green shield)
//   admin_debit      → Admin Debit     (red shield)
//   bonus            → Bonus           (amber star)
//   refund           → Refund          (blue return)
//   other / unknown  → Transaction     (grey swap)
//
// ── MISSING BACKEND THINGS — ACTION REQUIRED ────────────────────────────────
//
//  1. MOUNT POINT: Make sure in app.js you have:
//       app.use('/wallet', require('./routes/wallet.routes'));
//     The OLD screen called /users/wallet — that no longer exists in your code.
//
//  2. AUTH CONSISTENCY: wallet.js uses req.user.sub; referral.js uses
//     req.user._id. Standardise in your auth middleware so both properties are
//     always set. Otherwise some routes will silently fail.
//
//  3. INSTALL expo-web-browser for the Paystack redirect:
//       npx expo install expo-web-browser
//
//  4. totalIn / totalOut are NOT currently returned by GET /wallet.
//     The stats row shows 0 gracefully. To fix, add to wallet.js GET /:
//       const [inRes, outRes] = await Promise.all([
//         Transaction.aggregate([
//           { $match: { userId: userObjectId, type: { $in: ['credit','referral_reward','deposit'] } } },
//           { $group: { _id: null, t: { $sum: '$amount' } } }
//         ]),
//         Transaction.aggregate([
//           { $match: { userId: userObjectId, type: 'debit' } },
//           { $group: { _id: null, t: { $sum: '$amount' } } }
//         ])
//       ]);
//     Then include in res: totalIn: inRes[0]?.t || 0, totalOut: outRes[0]?.t || 0
//     These are in kobo — screen divides by 100 automatically.
//
//  5. Transaction amounts: GET /wallet/transactions already returns amounts in
//     NAIRA (divided by 100 in the route). This screen formats them directly
//     as naira. Do NOT pass kobo here or amounts will be 100x too large.
// ────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as WebBrowser from "expo-web-browser";
import { getAuthToken } from "../../utils/auth";

import { BASE_URL } from '../../config';

// ─── Transaction display map ─────────────────────────────────────────────────

const TX_META = {
  referral_reward: {
    label: "Referral Bonus",
    icon: "gift",
    iconBg: "#6D28D9",
    isCredit: true,
  },
  ride_payment: {
    label: "Ride Payment",
    icon: "car-sport",
    iconBg: "#1A1A1A",
    isCredit: false,
  },
  ride_earning: {
    label: "Ride Earning",
    icon: "cash",
    iconBg: "#059669",
    isCredit: true,
  },
  wallet_funding: {
    label: "Wallet Top-up",
    icon: "add-circle",
    iconBg: "#0284C7",
    isCredit: true,
  },
  deposit: {
    label: "Deposit",
    icon: "arrow-down-circle",
    iconBg: "#0369A1",
    isCredit: true,
  },
  admin_credit: {
    label: "Admin Credit",
    icon: "shield-checkmark",
    iconBg: "#065F46",
    isCredit: true,
  },
  admin_debit: {
    label: "Admin Debit",
    icon: "shield",
    iconBg: "#7F1D1D",
    isCredit: false,
  },
  bonus: { label: "Bonus", icon: "star", iconBg: "#B45309", isCredit: true },
  refund: {
    label: "Refund",
    icon: "return-up-back",
    iconBg: "#1D4ED8",
    isCredit: true,
  },
  other: {
    label: "Transaction",
    icon: "swap-horizontal",
    iconBg: "#374151",
    isCredit: null,
  },
};

function getTxMeta(txn) {
  return TX_META[txn.category] || TX_META[txn.type] || TX_META.other;
}

function getTxSign(txn) {
  const meta = getTxMeta(txn);
  const isCredit =
    meta.isCredit !== null
      ? meta.isCredit
      : txn.type === "credit" ||
        txn.type === "referral_reward" ||
        txn.type === "deposit";
  return {
    isCredit,
    color: isCredit ? "#10B981" : "#EF4444",
    sign: isCredit ? "+" : "-",
  };
}

// ─── Formatters ──────────────────────────────────────────────────────────────

function fmtNaira(val) {
  return (
    "₦" +
    Number(val).toLocaleString("en-NG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}
function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
function fmtTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Filters ─────────────────────────────────────────────────────────────────

const FILTERS = [
  { key: "all", label: "All" },
  { key: "credits", label: "Money In" },
  { key: "debits", label: "Money Out" },
  { key: "rides", label: "Rides" },
  { key: "bonuses", label: "Bonuses" },
];

function applyFilter(txns, key) {
  switch (key) {
    case "credits":
      return txns.filter((t) => getTxSign(t).isCredit);
    case "debits":
      return txns.filter((t) => !getTxSign(t).isCredit);
    case "rides":
      return txns.filter((t) =>
        ["ride_payment", "ride_earning"].includes(t.category),
      );
    case "bonuses":
      return txns.filter((t) =>
        ["referral_reward", "bonus"].includes(t.category),
      );
    default:
      return txns;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
export default function WalletScreen2() {
  const navigation = useNavigation();

  const [wallet, setWallet] = useState(null);
  const [txns, setTxns] = useState([]);
  const [loadingW, setLoadingW] = useState(true);
  const [loadingT, setLoadingT] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setMoreBusy] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // ── FIX: use refs for offset and in-flight guard so we always read the
  //         latest value synchronously, avoiding stale-closure duplicates.
  const txOffsetRef = useRef(0);
  const isFetchingTxRef = useRef(false);

  const [activeFilter, setFilter] = useState("all");
  const [selTx, setSelTx] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [fundOpen, setFundOpen] = useState(false);
  const [fundAmt, setFundAmt] = useState("");
  const [fundEmail, setFundEmail] = useState("");
  const [fundBusy, setFundBusy] = useState(false);

  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    init();
  }, []);

  useEffect(() => {
    if (wallet) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 55,
        friction: 8,
      }).start();
    }
  }, [wallet]);

  const authH = async () => {
    const token = await getAuthToken();
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const fetchWallet = async () => {
    try {
      setLoadingW(true);
      const res = await fetch(`${BASE_URL}/wallet`, { headers: await authH() });
      if (!res.ok) return;
      const body = await res.json();
      setWallet(body.wallet);
    } catch (e) {
      console.warn("wallet:", e.message);
    } finally {
      setLoadingW(false);
    }
  };

  const fetchTxns = async (reset = false) => {
    // ── Guard: never run two fetches at the same time ──
    if (isFetchingTxRef.current) return;

    // ── Guard: nothing more to load (only relevant when not resetting) ──
    if (!reset && !hasMore) return;

    isFetchingTxRef.current = true;

    const off = reset ? 0 : txOffsetRef.current;

    try {
      reset ? setLoadingT(true) : setMoreBusy(true);

      const res = await fetch(
        `${BASE_URL}/wallet/transactions?limit=20&offset=${off}`,
        { headers: await authH() },
      );
      if (!res.ok) return;

      const body = await res.json();
      const list = body.data?.transactions || [];
      const pag = body.data?.pagination || {};

      if (reset) {
        // Replace list entirely and reset offset
        setTxns(list);
        txOffsetRef.current = list.length;
      } else {
        // Append without duplicating: only add items whose id isn't already present
        setTxns((prev) => {
          const existingIds = new Set(prev.map((t) => t.id?.toString()));
          const fresh = list.filter((t) => !existingIds.has(t.id?.toString()));
          return [...prev, ...fresh];
        });
        txOffsetRef.current = off + list.length;
      }

      setHasMore(pag.hasMore ?? false);
    } catch (e) {
      console.warn("txns:", e.message);
    } finally {
      setLoadingT(false);
      setMoreBusy(false);
      isFetchingTxRef.current = false;
    }
  };

  const init = async () => {
    // Reset offset before parallel fetch so wallet + txns start clean
    txOffsetRef.current = 0;
    isFetchingTxRef.current = false;
    await Promise.all([fetchWallet(), fetchTxns(true)]);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    scaleAnim.setValue(0);
    setHasMore(true);
    await init();
    setRefreshing(false);
  }, []);

  const handleFund = async () => {
    const amount = parseFloat(fundAmt);
    if (!amount || amount < 100)
      return Alert.alert("Invalid", "Minimum top-up is ₦100.");
    if (!fundEmail.includes("@"))
      return Alert.alert("Invalid", "Enter a valid email address.");
    try {
      setFundBusy(true);
      const res = await fetch(`${BASE_URL}/wallet/fund/initialize`, {
        method: "POST",
        headers: await authH(),
        body: JSON.stringify({ amount, email: fundEmail }),
      });
      const data = await res.json();
      if (!data.success)
        throw new Error(data.error?.message || "Could not initialise payment");
      setFundOpen(false);
      setFundAmt("");
      await WebBrowser.openBrowserAsync(data.data.authorizationUrl);
      await init();
      Alert.alert("Payment", "Wallet updated if payment was successful.");
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setFundBusy(false);
    }
  };

  const displayed = applyFilter(txns, activeFilter);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.topBar}>
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={20} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={s.topBarTitle}>My Wallet</Text>
        <View style={{ width: 44 }} />
      </View>

      <FlatList
        data={displayed}
        keyExtractor={(item, i) => item.id?.toString() || i.toString()}
        contentContainerStyle={s.listPad}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#1A1A1A"
            colors={["#1A1A1A"]}
          />
        }
        ListHeaderComponent={
          <>
            {/* ── Balance card ── */}
            <View style={s.card}>
              <View style={s.cardTop}>
                <Text style={s.balLbl}>AVAILABLE BALANCE</Text>
                {loadingW ? (
                  <ActivityIndicator
                    color="#fff"
                    size="large"
                    style={{ marginVertical: 12 }}
                  />
                ) : (
                  <Animated.Text
                    style={[
                      s.balAmt,
                      {
                        opacity: scaleAnim,
                        transform: [
                          {
                            scale: scaleAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.88, 1],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    {wallet ? fmtNaira(wallet.balance / 100) : "₦0.00"}
                  </Animated.Text>
                )}
                <Text style={s.balSub}>Wheela Wallet · NGN</Text>
              </View>

              {/* Stats */}
              <View style={s.statsRow}>
                <StatCell
                  icon="arrow-down-circle-outline"
                  iconColor="#10B981"
                  label="Total In"
                  value={
                    loadingW ? "—" : fmtNaira((wallet?.totalIn ?? 0) / 100)
                  }
                />
                <View style={s.statDiv} />
                <StatCell
                  icon="arrow-up-circle-outline"
                  iconColor="#EF4444"
                  label="Total Out"
                  value={
                    loadingW ? "—" : fmtNaira((wallet?.totalOut ?? 0) / 100)
                  }
                />
                <View style={s.statDiv} />
                <StatCell
                  icon="receipt-outline"
                  iconColor="#aaa"
                  label="Activity"
                  value={`${txns.length} txn${txns.length !== 1 ? "s" : ""}`}
                />
              </View>
            </View>

            {/* ── Filter pills ── */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.pillsRow}
              style={{ marginBottom: 4 }}
            >
              {FILTERS.map((f) => (
                <TouchableOpacity
                  key={f.key}
                  style={[s.pill, activeFilter === f.key && s.pillOn]}
                  onPress={() => setFilter(f.key)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[s.pillTxt, activeFilter === f.key && s.pillTxtOn]}
                  >
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Section header */}
            <View style={s.secHdr}>
              <Text style={s.secLbl}>TRANSACTIONS</Text>
              {loadingT && <ActivityIndicator size="small" color="#ccc" />}
            </View>
          </>
        }
        renderItem={({ item, index }) => (
          <TxRow
            txn={item}
            isFirst={index === 0}
            isLast={index === displayed.length - 1}
            onPress={() => {
              setSelTx(item);
              setDetailOpen(true);
            }}
          />
        )}
        ListEmptyComponent={!loadingT ? <EmptyState /> : null}
        onEndReached={() => {
          if (hasMore && !loadingMore && !isFetchingTxRef.current) {
            fetchTxns(false);
          }
        }}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator color="#ccc" style={{ marginVertical: 20 }} />
          ) : (
            <View style={{ height: 24 }} />
          )
        }
      />

      {/* Fund modal */}
      <FundModal
        visible={fundOpen}
        onClose={() => setFundOpen(false)}
        amount={fundAmt}
        setAmount={setFundAmt}
        email={fundEmail}
        setEmail={setFundEmail}
        busy={fundBusy}
        onConfirm={handleFund}
      />

      {/* Detail modal */}
      {selTx && (
        <TxDetailModal
          txn={selTx}
          visible={detailOpen}
          onClose={() => setDetailOpen(false)}
        />
      )}
    </SafeAreaView>
  );
}

// ─── StatCell ─────────────────────────────────────────────────────────────────
function StatCell({ icon, iconColor, label, value }) {
  return (
    <View style={s.statCell}>
      <Ionicons name={icon} size={16} color={iconColor} />
      <Text style={s.statLbl}>{label}</Text>
      <Text style={s.statVal}>{value}</Text>
    </View>
  );
}

// ─── TxRow ────────────────────────────────────────────────────────────────────
function TxRow({ txn, isFirst, isLast, onPress }) {
  const meta = getTxMeta(txn);
  const { color, sign } = getTxSign(txn);
  return (
    <TouchableOpacity
      style={[s.txRow, isFirst && s.txFirst, isLast && s.txLast]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[s.txIcon, { backgroundColor: meta.iconBg }]}>
        <Ionicons name={meta.icon} size={18} color="#fff" />
      </View>
      <View style={s.txInfo}>
        <Text style={s.txTitle} numberOfLines={1}>
          {meta.label}
        </Text>
        {txn.description ? (
          <Text style={s.txDesc} numberOfLines={1}>
            {txn.description}
          </Text>
        ) : null}
        <Text style={s.txDate}>
          {fmtDate(txn.createdAt)} · {fmtTime(txn.createdAt)}
        </Text>
      </View>
      <View style={s.txRight}>
        <Text style={[s.txAmt, { color }]}>
          {sign}
          {fmtNaira(txn.amount)}
        </Text>
        <StatusPill status={txn.status} />
      </View>
    </TouchableOpacity>
  );
}

// ─── StatusPill ───────────────────────────────────────────────────────────────
function StatusPill({ status }) {
  const map = {
    completed: { bg: "#ECFDF5", color: "#10B981", text: "Done" },
    pending: { bg: "#FFFBEB", color: "#F59E0B", text: "Pending" },
    failed: { bg: "#FEF2F2", color: "#EF4444", text: "Failed" },
  };
  const c = map[status] || {
    bg: "#F3F4F6",
    color: "#9CA3AF",
    text: status || "—",
  };
  return (
    <View style={[s.pill2, { backgroundColor: c.bg }]}>
      <Text style={[s.pill2Txt, { color: c.color }]}>{c.text}</Text>
    </View>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <View style={s.empty}>
      <View style={s.emptyIcon}>
        <Ionicons name="receipt-outline" size={30} color="#888" />
      </View>
      <Text style={s.emptyTitle}>No transactions yet</Text>
      <Text style={s.emptySub}>
        Top up your wallet or complete a ride and your activity will appear
        here.
      </Text>
    </View>
  );
}

// ─── FundModal ────────────────────────────────────────────────────────────────
function FundModal({
  visible,
  onClose,
  amount,
  setAmount,
  email,
  setEmail,
  busy,
  onConfirm,
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.handle} />
          <Text style={s.sheetTitle}>Add Money</Text>
          <Text style={s.sheetSub}>
            You'll be redirected to Paystack to complete payment securely.
          </Text>

          <Text style={s.inputLbl}>AMOUNT (₦)</Text>
          <View style={s.inputRow}>
            <Text style={s.inputPre}>₦</Text>
            <TextInput
              style={s.inputField}
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor="#999"
              keyboardType="numeric"
            />
          </View>

          <View style={s.quickRow}>
            {[500, 1000, 2000, 5000].map((v) => (
              <TouchableOpacity
                key={v}
                style={s.chip}
                onPress={() => setAmount(v.toString())}
                activeOpacity={0.8}
              >
                <Text style={s.chipTxt}>₦{v.toLocaleString()}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.inputLbl}>EMAIL FOR RECEIPT</Text>
          <View style={s.inputRow}>
            <Ionicons
              name="mail-outline"
              size={15}
              color="#999"
              style={{ marginRight: 8 }}
            />
            <TextInput
              style={s.inputField}
              value={email}
              onChangeText={setEmail}
              placeholder="you@email.com"
              placeholderTextColor="#999"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity
            style={[s.payBtn, busy && { opacity: 0.6 }]}
            onPress={onConfirm}
            disabled={busy}
            activeOpacity={0.85}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="card-outline" size={18} color="#fff" />
                <Text style={s.payBtnTxt}>Pay via Paystack</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={s.cancelTouch} onPress={onClose}>
            <Text style={s.cancelTxt}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── TxDetailModal ────────────────────────────────────────────────────────────
function TxDetailModal({ txn, visible, onClose }) {
  const meta = getTxMeta(txn);
  const { color, sign } = getTxSign(txn);
  const rows = [
    { label: "Type", value: meta.label },
    {
      label: "Status",
      value: txn.status
        ? txn.status.charAt(0).toUpperCase() + txn.status.slice(1)
        : "—",
    },
    { label: "Amount", value: `${sign}${fmtNaira(txn.amount)}` },
    { label: "Date", value: fmtDate(txn.createdAt) },
    { label: "Time", value: fmtTime(txn.createdAt) },
    txn.balanceBefore != null && {
      label: "Balance Before",
      value: fmtNaira(txn.balanceBefore),
    },
    txn.balanceAfter != null && {
      label: "Balance After",
      value: fmtNaira(txn.balanceAfter),
    },
    txn.reference && { label: "Reference", value: txn.reference },
  ].filter(Boolean);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={s.overlay}>
        <View style={[s.sheet, { paddingTop: 28 }]}>
          <View style={s.handle} />
          <View style={[s.detailIconWrap, { backgroundColor: meta.iconBg }]}>
            <Ionicons name={meta.icon} size={26} color="#fff" />
          </View>
          <Text style={s.detailLbl}>{meta.label}</Text>
          <Text style={[s.detailAmt, { color }]}>
            {sign}
            {fmtNaira(txn.amount)}
          </Text>
          <View style={s.detailDiv} />
          {rows.map((r) => (
            <View key={r.label} style={s.detailRow}>
              <Text style={s.detailKey}>{r.label}</Text>
              <Text style={s.detailVal} numberOfLines={2}>
                {r.value}
              </Text>
            </View>
          ))}
          {txn.description ? (
            <View style={s.descBox}>
              <Ionicons
                name="information-circle-outline"
                size={13}
                color="#999"
              />
              <Text style={s.descTxt}>{txn.description}</Text>
            </View>
          ) : null}
          <TouchableOpacity
            style={s.payBtn}
            onPress={onClose}
            activeOpacity={0.85}
          >
            <Text style={s.payBtnTxt}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F5F0" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 12 : 44,
    paddingBottom: 14,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1A1A1A",
    letterSpacing: -0.3,
  },
  listPad: { paddingBottom: 60 },

  // card
  card: {
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 14,
  },
  cardTop: { backgroundColor: "#1A1A1A", padding: 24, paddingBottom: 22 },
  balLbl: {
    fontSize: 10,
    fontWeight: "800",
    color: "rgba(255,255,255,0.36)",
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  balAmt: {
    fontSize: 44,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: -1.5,
    marginBottom: 4,
  },
  balSub: { fontSize: 12, color: "rgba(255,255,255,0.28)", marginBottom: 22 },
  topUpBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignSelf: "flex-start",
  },
  topUpTxt: { fontSize: 14, fontWeight: "800", color: "#1A1A1A" },

  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  statCell: { flex: 1, alignItems: "center", gap: 4 },
  statDiv: { width: 1, height: 34, backgroundColor: "#F0F0F0" },
  statLbl: {
    fontSize: 10,
    color: "#bbb",
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  statVal: { fontSize: 13, fontWeight: "800", color: "#1A1A1A" },

  // pills
  pillsRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 10 },
  pill: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#E8E8E8",
  },
  pillOn: { backgroundColor: "#1A1A1A", borderColor: "#1A1A1A" },
  pillTxt: { fontSize: 13, fontWeight: "700", color: "#999" },
  pillTxtOn: { color: "#fff" },

  // section
  secHdr: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    marginBottom: 4,
  },
  secLbl: {
    fontSize: 10,
    fontWeight: "800",
    color: "#bbb",
    letterSpacing: 0.8,
  },

  // tx rows
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F0",
    marginHorizontal: 16,
  },
  txFirst: { borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  txLast: {
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    borderBottomWidth: 0,
  },
  txIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    flexShrink: 0,
  },
  txInfo: { flex: 1 },
  txTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 2,
  },
  txDesc: { fontSize: 11, color: "#bbb", marginBottom: 2 },
  txDate: { fontSize: 10, color: "#ccc" },
  txRight: { alignItems: "flex-end", gap: 5, marginLeft: 8 },
  txAmt: { fontSize: 15, fontWeight: "800" },

  pill2: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  pill2Txt: { fontSize: 9, fontWeight: "800", letterSpacing: 0.3 },

  // empty
  empty: {
    margin: 16,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 36,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: "#F5F5F0",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1A1A1A",
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    color: "#aaa",
    textAlign: "center",
    lineHeight: 19,
  },

  // modal
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: Platform.OS === "ios" ? 44 : 28,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E0E0E0",
    alignSelf: "center",
    marginBottom: 22,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1A1A1A",
    marginBottom: 6,
  },
  sheetSub: { fontSize: 13, color: "#888", lineHeight: 19, marginBottom: 22 },
  inputLbl: {
    fontSize: 10,
    fontWeight: "800",
    color: "#aaa",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F0",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
  },
  inputPre: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1A1A1A",
    marginRight: 6,
  },
  inputField: { flex: 1, fontSize: 16, fontWeight: "700", color: "#1A1A1A" },
  quickRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: "#F5F5F0",
    borderWidth: 1.5,
    borderColor: "#E8E8E8",
  },
  chipTxt: { fontSize: 13, fontWeight: "700", color: "#1A1A1A" },
  payBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    paddingVertical: 16,
    marginBottom: 10,
  },
  payBtnTxt: { fontSize: 15, fontWeight: "800", color: "#fff" },
  cancelTouch: { alignItems: "center", paddingVertical: 12 },
  cancelTxt: { fontSize: 14, fontWeight: "700", color: "#aaa" },

  // detail
  detailIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 12,
  },
  detailLbl: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1A1A1A",
    textAlign: "center",
    marginBottom: 4,
  },
  detailAmt: {
    fontSize: 30,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -0.5,
    marginBottom: 20,
  },
  detailDiv: { height: 1, backgroundColor: "#F0F0F0", marginBottom: 16 },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 11,
  },
  detailKey: { fontSize: 13, color: "#bbb", fontWeight: "600", flex: 1 },
  detailVal: {
    fontSize: 13,
    color: "#1A1A1A",
    fontWeight: "700",
    flex: 2,
    textAlign: "right",
  },
  descBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: "#F5F5F0",
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    marginTop: 4,
  },
  descTxt: { flex: 1, fontSize: 12, color: "#666", lineHeight: 18 },
});