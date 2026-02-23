// src/screens/passenger/PromotionsScreen.js
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Share,
  RefreshControl,
  Platform,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { getAuthToken } from "../../utils/auth";

const BASE_URL = "https://wheels-backend-7ydc.onrender.com";

// ─── pure helpers ────────────────────────────────────────────────────────────

const statusColor = (s) =>
  s === "rewarded" ? "#10B981" : s === "expired" ? "#EF4444" : "#F59E0B";

const statusBg = (s) =>
  s === "rewarded" ? "#ECFDF5" : s === "expired" ? "#FEF2F2" : "#FFFBEB";

const statusLabel = (s) =>
  s === "rewarded" ? "Rewarded" : s === "expired" ? "Expired" : "Pending";

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

const HOW_IT_WORKS = [
  {
    num: "1",
    text: "Share your code with friends who haven't joined Wheela yet.",
  },
  { num: "2", text: "They enter your code when signing up." },
  { num: "3", text: "After their first ride — you earn ₦500, they get ₦300." },
];

// ─────────────────────────────────────────────────────────────────────────────

export default function PromotionsScreen() {
  const navigation = useNavigation();

  const [promoCode, setPromoCode] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]); // people I referred (I am referrer)
  const [myBonus, setMyBonus] = useState(null); // my sign-up bonus (I am referee)
  const [loadingCode, setLoadingCode] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingBonus, setLoadingBonus] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  // ── data loading ────────────────────────────────────────────────────────────

  const loadAll = async () => {
    await Promise.all([loadCode(), loadHistoryAndStats(), loadMyBonus()]);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, []);

  const loadCode = async () => {
    try {
      setLoadingCode(true);
      const token = await getAuthToken();
      if (!token) return;
      const res = await fetch(`${BASE_URL}/referrals/my-code`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.referralCode) setReferralCode(data.referralCode);
    } catch (err) {
      console.warn("loadCode error:", err.message);
    } finally {
      setLoadingCode(false);
    }
  };

  const loadHistoryAndStats = async () => {
    try {
      setLoadingHistory(true);
      const token = await getAuthToken();
      if (!token) return;

      const [histRes, statRes] = await Promise.all([
        fetch(`${BASE_URL}/referrals/history?limit=20`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${BASE_URL}/referrals/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (histRes.ok) {
        const d = await histRes.json();
        setHistory(d.referrals || []);
      }
      if (statRes.ok) {
        const d = await statRes.json();
        setStats({
          totalReferrals: d.stats?.totalReferrals ?? 0,
          rewardedReferrals: d.stats?.rewardedReferrals ?? 0,
          pendingReferrals: d.stats?.pendingReferrals ?? 0,
          totalEarnedNaira: d.stats?.totalEarnedNaira ?? "0.00",
        });
      }
    } catch (err) {
      console.warn("loadHistoryAndStats error:", err.message);
    } finally {
      setLoadingHistory(false);
    }
  };

  /**
   * GET /referrals/my-bonus
   * Returns the referral where the current user is the REFEREE —
   * i.e. they signed up using someone else's code.
   *
   * Expected response shape:
   * {
   *   found: true,
   *   bonus: {
   *     status: 'pending' | 'rewarded' | 'expired',
   *     refereeReward: 30000,        // kobo
   *     code: 'ABC12345',
   *     referrerName: 'Adaeze',
   *     rewardedAt: ISO string | null,
   *     expiresAt: ISO string
   *   }
   * }
   *
   * Add the backend route below (see comment at bottom of file).
   */
  const loadMyBonus = async () => {
    try {
      setLoadingBonus(true);
      const token = await getAuthToken();
      if (!token) return;
      const res = await fetch(`${BASE_URL}/referrals/my-bonus`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setMyBonus(data.found && data.bonus ? data.bonus : null);
    } catch (err) {
      console.warn("loadMyBonus error:", err.message);
    } finally {
      setLoadingBonus(false);
    }
  };

  // ── copy ─────────────────────────────────────────────────────────────────────

  const handleCopy = async () => {
    if (!referralCode) return;
    try {
      await Clipboard.setStringAsync(referralCode);
    } catch {
      try {
        Clipboard.setString?.(referralCode);
      } catch {}
    }
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2500);
  };

  // ── share ─────────────────────────────────────────────────────────────────────

  const handleShare = async () => {
    if (!referralCode || shareLoading) return;
    setShareLoading(true);
    try {
      const message =
        `🚗 Join me on Wheela!\n\n` +
        `Use my referral code when you sign up:\n\n` +
        `👉 ${referralCode}\n\n` +
        `You'll get ₦300 off your first ride and I'll earn ₦500. ` +
        `Download here: https://wheela.ng`;
      const result = await Share.share({ message });
      if (result.action === Share.sharedAction)
        console.log("Shared successfully");
    } catch (err) {
      console.warn("Share dismissed:", err.message);
    } finally {
      setShareLoading(false);
    }
  };

  // ── promo code ─────────────────────────────────────────────────────────────

  const handleApplyPromo = () => {
    if (!promoCode.trim()) {
      Alert.alert("Error", "Please enter a promo code.");
      return;
    }
    Alert.alert(
      "Applied! 🎉",
      `Code "${promoCode}" will be applied to your next ride.`,
      [{ text: "OK" }],
    );
    setPromoCode("");
  };

  // ── render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.container}>
      {/* TOP BAR */}
      <View style={s.topBar}>
        <TouchableOpacity
          style={s.topBarBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={20} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={s.topBarTitle}>Promotions</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#1A1A1A"
            colors={["#1A1A1A"]}
          />
        }
      >
        {/* ══ HERO CARD ══ */}
        <View style={s.heroCard}>
          <View style={s.heroHeader}>
            <View style={s.heroIconWrap}>
              <Ionicons name="gift" size={26} color="#fff" />
            </View>
            <View>
              <Text style={s.heroTitle}>Refer & Earn</Text>
              <Text style={s.heroSub}>Get ₦500 for every friend you bring</Text>
            </View>
          </View>

          {/* Code box */}
          <View style={s.codeSection}>
            {loadingCode ? (
              <ActivityIndicator
                color="#1A1A1A"
                size="small"
                style={{ marginVertical: 24 }}
              />
            ) : (
              <>
                <Text style={s.codeLabel}>YOUR REFERRAL CODE</Text>

                <TouchableOpacity
                  style={s.codeBox}
                  onPress={handleCopy}
                  activeOpacity={0.75}
                >
                  <Text style={s.codeText} numberOfLines={1}>
                    {referralCode || "No code yet"}
                  </Text>
                  <View style={[s.copyPill, codeCopied && s.copyPillDone]}>
                    <Ionicons
                      name={codeCopied ? "checkmark" : "copy-outline"}
                      size={14}
                      color={codeCopied ? "#fff" : "#1A1A1A"}
                    />
                    <Text
                      style={[s.copyPillText, codeCopied && s.copyPillTextDone]}
                    >
                      {codeCopied ? "Copied!" : "Copy"}
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.shareBtn, shareLoading && s.shareBtnLoading]}
                  onPress={handleShare}
                  activeOpacity={0.75}
                  disabled={shareLoading || !referralCode}
                >
                  {shareLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="share-social" size={18} color="#fff" />
                      <Text style={s.shareBtnText}>Share Your Code</Text>
                    </>
                  )}
                </TouchableOpacity>

                <Text style={s.tapHint}>
                  Tap the code box to copy to clipboard
                </Text>
              </>
            )}
          </View>

          {/* How it works */}
          <View style={s.howSection}>
            <Text style={s.howLabel}>HOW IT WORKS</Text>
            {HOW_IT_WORKS.map((step) => (
              <View key={step.num} style={s.stepRow}>
                <View style={s.stepNumBox}>
                  <Text style={s.stepNumText}>{step.num}</Text>
                </View>
                <Text style={s.stepText}>{step.text}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ══ STATS BAR ══ */}
        {stats && (
          <View style={s.statsBar}>
            <StatItem value={stats.totalReferrals} label="Referred" />
            <View style={s.statsDivider} />
            <StatItem value={stats.rewardedReferrals} label="Rewarded" />
            <View style={s.statsDivider} />
            <StatItem
              value={`₦${stats.totalEarnedNaira}`}
              label="Earned"
              highlight
            />
          </View>
        )}

        {/* ══ MY SIGN-UP BONUS — shown when user signed up with someone's code ══ */}
        {!loadingBonus && myBonus && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>YOUR SIGN-UP BONUS</Text>
            <View style={s.card}>
              <View style={s.bonusRow}>
                {/* Icon */}
                <View style={s.bonusIconWrap}>
                  <Ionicons name="star" size={20} color="#fff" />
                </View>

                {/* Info */}
                <View style={s.bonusInfo}>
                  <Text style={s.bonusTitle}>
                    Welcome bonus
                    {myBonus.referrerName
                      ? ` · via ${myBonus.referrerName}`
                      : ""}
                  </Text>
                  {myBonus.code ? (
                    <Text style={s.bonusSub}>
                      Code used: <Text style={s.bonusCode}>{myBonus.code}</Text>
                    </Text>
                  ) : null}
                  {myBonus.status === "rewarded" && myBonus.rewardedAt ? (
                    <Text style={s.bonusSub}>
                      Credited {fmtDate(myBonus.rewardedAt)}
                    </Text>
                  ) : myBonus.status === "pending" ? (
                    <Text style={s.bonusSub}>
                      Credited after your first ride
                    </Text>
                  ) : myBonus.expiresAt ? (
                    <Text style={s.bonusSub}>
                      Expired {fmtDate(myBonus.expiresAt)}
                    </Text>
                  ) : null}
                </View>

                {/* Right: status pill + amount */}
                <View style={s.bonusRight}>
                  <View
                    style={[
                      s.statusPill,
                      { backgroundColor: statusBg(myBonus.status) },
                    ]}
                  >
                    <Text
                      style={[
                        s.statusPillText,
                        { color: statusColor(myBonus.status) },
                      ]}
                    >
                      {statusLabel(myBonus.status)}
                    </Text>
                  </View>
                  {myBonus.status !== "expired" ? (
                    <Text
                      style={[
                        s.bonusAmt,
                        myBonus.status === "rewarded"
                          ? s.bonusAmtGreen
                          : s.bonusAmtPending,
                      ]}
                    >
                      +₦
                      {myBonus.refereeReward
                        ? (myBonus.refereeReward / 100).toFixed(0)
                        : "300"}
                    </Text>
                  ) : (
                    <Text style={[s.bonusAmt, s.bonusAmtExpired]}>—</Text>
                  )}
                  {myBonus.status === "pending" && (
                    <Text style={s.pendingNote}>Awaiting first ride</Text>
                  )}
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ══ REFERRAL HISTORY — people I referred ══ */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>PEOPLE YOU'VE REFERRED</Text>

          {loadingHistory ? (
            <View style={s.card}>
              <ActivityIndicator
                color="#1A1A1A"
                style={{ marginVertical: 28 }}
              />
            </View>
          ) : history.length === 0 ? (
            <View style={s.emptyCard}>
              <View style={s.emptyIconWrap}>
                <Ionicons name="people-outline" size={34} color="#1A1A1A" />
              </View>
              <Text style={s.emptyTitle}>No referrals yet</Text>
              <Text style={s.emptySub}>
                Share your code — your friends will appear here once they join.
              </Text>
            </View>
          ) : (
            <View style={s.card}>
              {history.map((item, i) => (
                <View
                  key={item.id || i}
                  style={[
                    s.histRow,
                    i === history.length - 1 && { borderBottomWidth: 0 },
                  ]}
                >
                  <View style={s.histAvatar}>
                    <Text style={s.histAvatarText}>
                      {(item.referee?.name || "U").charAt(0).toUpperCase()}
                    </Text>
                  </View>

                  <View style={s.histInfo}>
                    <Text style={s.histName}>
                      {item.referee?.name || "Wheela User"}
                    </Text>
                    {item.referee?.phone ? (
                      <Text style={s.histSub}>{item.referee.phone}</Text>
                    ) : null}
                    <Text style={s.histSub}>
                      Joined {fmtDate(item.createdAt)}
                    </Text>
                  </View>

                  <View style={s.histRight}>
                    <View
                      style={[
                        s.statusPill,
                        { backgroundColor: statusBg(item.status) },
                      ]}
                    >
                      <Text
                        style={[
                          s.statusPillText,
                          { color: statusColor(item.status) },
                        ]}
                      >
                        {statusLabel(item.status)}
                      </Text>
                    </View>
                    {item.status === "rewarded" && (
                      <Text style={s.rewardAmt}>
                        +₦
                        {item.rewardEarned
                          ? (item.rewardEarned / 100).toFixed(0)
                          : "500"}
                      </Text>
                    )}
                    {item.status === "pending" && (
                      <Text style={s.pendingNote}>Awaiting first ride</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ══ PROMO CODE ══ */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>PROMO CODE</Text>
          <View style={s.card}>
            <Text style={s.promoHint}>
              Have a special discount code from Wheela? Apply it below.
            </Text>
            <View style={s.promoRow}>
              <TextInput
                style={s.promoInput}
                value={promoCode}
                onChangeText={setPromoCode}
                placeholder="e.g. WHEELA20OFF"
                placeholderTextColor="#bbb"
                autoCapitalize="characters"
                returnKeyType="done"
                onSubmitEditing={handleApplyPromo}
              />
              <TouchableOpacity
                style={s.applyBtn}
                onPress={handleApplyPromo}
                activeOpacity={0.8}
              >
                <Text style={s.applyBtnText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ══ TERMS ══ */}
        <Text style={s.terms}>
          Referral rewards are credited to your Wheela wallet after your friend
          completes their first ride. Rewards expire 90 days after sign-up. One
          reward per new user.
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Sub-component ────────────────────────────────────────────────────────────

function StatItem({ value, label, highlight }) {
  return (
    <View style={s.statItem}>
      <Text style={[s.statValue, highlight && s.statValueGreen]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F0" },

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

  heroCard: {
    backgroundColor: "#fff",
    borderRadius: 22,
    marginBottom: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.09,
    shadowRadius: 16,
    elevation: 8,
  },
  heroHeader: {
    backgroundColor: "#1A1A1A",
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  heroIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 3,
  },
  heroSub: { fontSize: 12, color: "rgba(255,255,255,0.45)" },

  codeSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F0",
  },
  codeLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#aaa",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  codeBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F5F5F0",
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "#E0E0E0",
    borderStyle: "dashed",
  },
  codeText: {
    fontSize: 26,
    fontWeight: "900",
    color: "#1A1A1A",
    letterSpacing: 5,
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
    flexShrink: 1,
    marginRight: 8,
  },
  copyPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    flexShrink: 0,
  },
  copyPillDone: { backgroundColor: "#10B981", borderColor: "#10B981" },
  copyPillText: { fontSize: 12, fontWeight: "700", color: "#1A1A1A" },
  copyPillTextDone: { color: "#fff" },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    paddingVertical: 15,
  },
  shareBtnLoading: { opacity: 0.6 },
  shareBtnText: { fontSize: 15, fontWeight: "800", color: "#fff" },
  tapHint: { fontSize: 11, color: "#bbb", textAlign: "center", marginTop: 10 },

  howSection: { padding: 20 },
  howLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#aaa",
    letterSpacing: 0.8,
    marginBottom: 14,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    marginBottom: 12,
  },
  stepNumBox: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: "#F5F5F0",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  stepNumText: { fontSize: 13, fontWeight: "800", color: "#1A1A1A" },
  stepText: {
    flex: 1,
    fontSize: 13,
    color: "#666",
    lineHeight: 20,
    paddingTop: 4,
  },

  statsBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1A1A",
    borderRadius: 18,
    paddingVertical: 18,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  statItem: { flex: 1, alignItems: "center" },
  statValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 3,
    letterSpacing: -0.3,
  },
  statValueGreen: { color: "#10B981" },
  statLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "rgba(255,255,255,0.4)",
    letterSpacing: 0.5,
  },
  statsDivider: {
    width: 1,
    height: 28,
    backgroundColor: "rgba(255,255,255,0.12)",
  },

  section: { marginBottom: 12 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#aaa",
    letterSpacing: 0.8,
    marginBottom: 10,
    marginLeft: 2,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 5,
  },

  // ── sign-up bonus ──
  bonusRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  bonusIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "#F59E0B",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    flexShrink: 0,
  },
  bonusInfo: { flex: 1 },
  bonusTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 3,
  },
  bonusSub: { fontSize: 11, color: "#aaa", marginBottom: 1 },
  bonusCode: { fontWeight: "800", color: "#1A1A1A", letterSpacing: 1 },
  bonusRight: { alignItems: "flex-end", gap: 4, flexShrink: 0, marginLeft: 8 },
  bonusAmt: { fontSize: 16, fontWeight: "800", marginTop: 4 },
  bonusAmtGreen: { color: "#10B981" },
  bonusAmtPending: { color: "#F59E0B" },
  bonusAmtExpired: { color: "#ccc" },

  // ── history rows ──
  histRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F0",
  },
  histAvatar: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "#1A1A1A",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    flexShrink: 0,
  },
  histAvatarText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  histInfo: { flex: 1 },
  histName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 2,
  },
  histSub: { fontSize: 11, color: "#aaa", marginBottom: 1 },
  histRight: { alignItems: "flex-end", gap: 4, flexShrink: 0, marginLeft: 8 },
  statusPill: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  statusPillText: { fontSize: 10, fontWeight: "800" },
  rewardAmt: { fontSize: 14, fontWeight: "800", color: "#10B981" },
  pendingNote: { fontSize: 10, color: "#F59E0B", fontWeight: "600" },

  // ── empty state ──
  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 36,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 5,
  },
  emptyIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: "#F5F5F0",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
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

  // ── promo code ──
  promoHint: {
    fontSize: 13,
    color: "#888",
    lineHeight: 19,
    padding: 18,
    paddingBottom: 10,
  },
  promoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 18,
    marginBottom: 18,
    backgroundColor: "#F5F5F0",
    borderRadius: 14,
    overflow: "hidden",
  },
  promoInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  applyBtn: {
    backgroundColor: "#1A1A1A",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  applyBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },

  terms: {
    fontSize: 11,
    color: "#bbb",
    textAlign: "center",
    lineHeight: 17,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
});
