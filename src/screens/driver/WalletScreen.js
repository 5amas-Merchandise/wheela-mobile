// src/screens/passenger/WalletScreen.js
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  RefreshControl,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { getAuthToken } from "../../utils/auth";

const BASE_URL = "https://wheels-backend-7ydc.onrender.com";

// ── Transaction display helpers ───────────────────────────────────────────────
const CATEGORY_META = {
  ride_payment: {
    label: "Ride Payment",
    icon: "car-sport-outline",
    color: "#EF4444",
    bg: "#FEF2F2",
  },
  ride_earning: {
    label: "Ride Earning",
    icon: "cash-outline",
    color: "#10B981",
    bg: "#ECFDF5",
  },
  wallet_funding: {
    label: "Wallet Top-Up",
    icon: "wallet-outline",
    color: "#3B82F6",
    bg: "#EFF6FF",
  },
  admin_credit: {
    label: "Admin Credit",
    icon: "shield-checkmark-outline",
    color: "#8B5CF6",
    bg: "#F5F3FF",
  },
  admin_debit: {
    label: "Admin Debit",
    icon: "shield-outline",
    color: "#F59E0B",
    bg: "#FFFBEB",
  },
  referral_reward: {
    label: "Referral Bonus",
    icon: "gift-outline",
    color: "#EC4899",
    bg: "#FDF2F8",
  },
  refund: {
    label: "Refund",
    icon: "return-down-back-outline",
    color: "#06B6D4",
    bg: "#ECFEFF",
  },
  bonus: {
    label: "Bonus",
    icon: "star-outline",
    color: "#F59E0B",
    bg: "#FFFBEB",
  },
  penalty: {
    label: "Penalty",
    icon: "warning-outline",
    color: "#EF4444",
    bg: "#FEF2F2",
  },
  other: {
    label: "Transaction",
    icon: "swap-horizontal-outline",
    color: "#6B7280",
    bg: "#F9FAFB",
  },
};

const STATUS_META = {
  completed: { label: "Completed", color: "#10B981", bg: "#ECFDF5" },
  pending: { label: "Pending", color: "#F59E0B", bg: "#FFFBEB" },
  failed: { label: "Failed", color: "#EF4444", bg: "#FEF2F2" },
  processing: { label: "Processing", color: "#3B82F6", bg: "#EFF6FF" },
};

function getCategoryMeta(txn) {
  // Prefer category if set, fall back to type
  return (
    CATEGORY_META[txn.category] ||
    CATEGORY_META[txn.type] ||
    CATEGORY_META.other
  );
}

function formatDate(iso) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-NG", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }) +
    " · " +
    d.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })
  );
}

export default function WalletScreen() {
  const navigation = useNavigation();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [txnError, setTxnError] = useState(null);

  useEffect(() => {
    fetchAll(true);
  }, []);

  const fetchAll = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setTxnError(null);

    try {
      const token = await getAuthToken();
      if (!token) {
        Alert.alert("Session Expired", "Please log in again.");
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };

      // ── Wallet balance ──────────────────────────────────────────────────
      const walletRes = await fetch(`${BASE_URL}/wallet`, { headers });
      if (!walletRes.ok) throw new Error("Could not load wallet");
      const walletData = await walletRes.json();
      setWallet(walletData.wallet);

      // ── Transaction history ─────────────────────────────────────────────
      // ✅ Correct endpoint: /wallet/transactions (not /wallet/transactions via separate router)
      const txnRes = await fetch(`${BASE_URL}/wallet/transactions?limit=50`, {
        headers,
      });
      if (!txnRes.ok) throw new Error("Could not load transactions");
      const txnData = await txnRes.json();

      // Backend returns { success, data: { transactions: [...], pagination: {...} } }
      const list = txnData?.data?.transactions || txnData?.transactions || [];
      setTransactions(list);

      console.log(`✅ Loaded ${list.length} transactions`);
    } catch (err) {
      console.error("WalletScreen fetch error:", err);
      setTxnError(err.message || "Failed to load data");
      Alert.alert("Error", err.message || "Could not load wallet data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAll(false);
  };

  // ── Loading state ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.loadingContainer}>
        <ActivityIndicator size="large" color="#1A1A1A" />
        <Text style={s.loadingText}>Loading wallet...</Text>
      </View>
    );
  }

  const balanceNaira = wallet?.balanceNaira
    ? parseFloat(wallet.balanceNaira).toFixed(2)
    : "0.00";

  // ── Group transactions by date ──────────────────────────────────────────────
  const grouped = transactions.reduce((acc, txn) => {
    const date = new Date(txn.createdAt).toLocaleDateString("en-NG", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    if (!acc[date]) acc[date] = [];
    acc[date].push(txn);
    return acc;
  }, {});

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#1A1A1A"
        />
      }
    >
      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>My Wallet</Text>
        <TouchableOpacity
          style={s.refreshBtn}
          onPress={onRefresh}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* ── Balance card ── */}
      <View style={s.balanceCard}>
        <View style={s.balanceTop}>
          <View style={s.balanceIconWrap}>
            <Ionicons name="wallet" size={28} color="#fff" />
          </View>
          <Text style={s.balanceLabel}>Available Balance</Text>
        </View>

        <Text style={s.balanceAmount}>₦{balanceNaira}</Text>

        <View style={s.balanceMeta}>
          <Ionicons
            name="lock-closed-outline"
            size={13}
            color="rgba(255,255,255,0.7)"
          />
          <Text style={s.balanceMetaText}>
            {wallet?.currency || "NGN"} · Contact admin to top up
          </Text>
        </View>
      </View>

      {/* ── Transactions ── */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Transaction History</Text>
          <Text style={s.sectionCount}>
            {transactions.length}{" "}
            {transactions.length === 1 ? "record" : "records"}
          </Text>
        </View>

        {/* Error state */}
        {txnError && (
          <View style={s.errorBox}>
            <Ionicons name="warning-outline" size={20} color="#EF4444" />
            <Text style={s.errorText}>{txnError}</Text>
            <TouchableOpacity onPress={onRefresh} style={s.retryBtn}>
              <Text style={s.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Empty state */}
        {!txnError && transactions.length === 0 && (
          <View style={s.emptyState}>
            <View style={s.emptyIconWrap}>
              <Ionicons name="receipt-outline" size={40} color="#9CA3AF" />
            </View>
            <Text style={s.emptyTitle}>No transactions yet</Text>
            <Text style={s.emptyBody}>
              Your ride payments and wallet activity will appear here.
            </Text>
          </View>
        )}

        {/* Grouped transaction list */}
        {Object.entries(grouped).map(([date, txns]) => (
          <View key={date}>
            <Text style={s.dateGroupLabel}>{date}</Text>

            {txns.map((txn) => {
              const meta = getCategoryMeta(txn);
              const statusMeta =
                STATUS_META[txn.status] || STATUS_META.completed;
              const isCredit =
                txn.type === "credit" ||
                txn.type === "deposit" ||
                txn.type === "referral_reward";

              // ✅ Amount: backend /wallet/transactions already divides by 100
              // so txn.amount is already in naira — display directly
              const amountDisplay =
                typeof txn.amount === "number"
                  ? txn.amount.toLocaleString("en-NG", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  : "0.00";

              return (
                <View key={txn.id || txn._id} style={s.txnCard}>
                  {/* Icon */}
                  <View style={[s.txnIconWrap, { backgroundColor: meta.bg }]}>
                    <Ionicons name={meta.icon} size={20} color={meta.color} />
                  </View>

                  {/* Details */}
                  <View style={s.txnDetails}>
                    <Text style={s.txnDesc} numberOfLines={1}>
                      {txn.description}
                    </Text>

                    <View style={s.txnMetaRow}>
                      <Text style={s.txnCategory}>{meta.label}</Text>
                      <View
                        style={[
                          s.statusPill,
                          { backgroundColor: statusMeta.bg },
                        ]}
                      >
                        <Text
                          style={[
                            s.statusPillText,
                            { color: statusMeta.color },
                          ]}
                        >
                          {statusMeta.label}
                        </Text>
                      </View>
                    </View>

                    <Text style={s.txnDate}>{formatDate(txn.createdAt)}</Text>

                    {/* Balance trail — show if available */}
                    {txn.balanceBefore !== null &&
                      txn.balanceAfter !== null &&
                      txn.status === "completed" && (
                        <Text style={s.txnBalance}>
                          Balance: ₦
                          {Number(txn.balanceBefore).toLocaleString("en-NG", {
                            minimumFractionDigits: 2,
                          })}
                          {" → "}₦
                          {Number(txn.balanceAfter).toLocaleString("en-NG", {
                            minimumFractionDigits: 2,
                          })}
                        </Text>
                      )}
                  </View>

                  {/* Amount */}
                  <View style={s.txnAmountCol}>
                    <Text
                      style={[
                        s.txnAmount,
                        { color: isCredit ? "#10B981" : "#EF4444" },
                      ]}
                    >
                      {isCredit ? "+" : "-"}₦{amountDisplay}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F0" },
  scrollContent: { paddingBottom: 40 },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F5F0",
  },
  loadingText: {
    marginTop: 14,
    fontSize: 15,
    color: "#666",
    fontWeight: "600",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1A1A1A",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 60 : 48,
    paddingBottom: 20,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#fff" },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.12)",
    justifyContent: "center",
    alignItems: "center",
  },

  // Balance card
  balanceCard: {
    backgroundColor: "#1A1A1A",
    marginHorizontal: 16,
    marginTop: -1,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 28,
    marginBottom: 24,
  },
  balanceTop: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  balanceIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  balanceLabel: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "600",
  },
  balanceAmount: {
    fontSize: 40,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: -1,
    marginBottom: 10,
  },
  balanceMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
  balanceMetaText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
    fontWeight: "500",
  },

  // Section
  section: { paddingHorizontal: 16 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: "#1A1A1A" },
  sectionCount: { fontSize: 13, color: "#888", fontWeight: "600" },

  // Date group
  dateGroupLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#BABABA",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 8,
    marginTop: 8,
  },

  // Transaction card
  txnCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  txnIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    flexShrink: 0,
  },
  txnDetails: { flex: 1, marginRight: 8 },
  txnDesc: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 4,
  },
  txnMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  txnCategory: { fontSize: 11, fontWeight: "600", color: "#888" },
  txnDate: {
    fontSize: 11,
    color: "#BABABA",
    fontWeight: "500",
    marginBottom: 2,
  },
  txnBalance: { fontSize: 10, color: "#BABABA", fontWeight: "500" },

  statusPill: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  statusPillText: { fontSize: 10, fontWeight: "700" },

  txnAmountCol: { alignItems: "flex-end", flexShrink: 0 },
  txnAmount: { fontSize: 15, fontWeight: "800" },

  // Empty
  emptyState: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 40,
    alignItems: "center",
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#F5F5F0",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1A1A1A",
    marginBottom: 8,
  },
  emptyBody: {
    fontSize: 14,
    color: "#888",
    textAlign: "center",
    lineHeight: 20,
  },

  // Error
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginBottom: 12,
  },
  errorText: { flex: 1, fontSize: 13, color: "#EF4444", fontWeight: "500" },
  retryBtn: {
    backgroundColor: "#EF4444",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  retryText: { fontSize: 12, fontWeight: "700", color: "#fff" },
});
