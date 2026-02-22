// src/screens/passenger/PromotionsScreen.js
import React, { useState, useEffect, useCallback } from 'react';
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
  Clipboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { getAuthToken } from '../../utils/auth';

const BASE_URL = 'https://wheels-backend-7ydc.onrender.com';

export default function PromotionsScreen() {
  const navigation = useNavigation();

  // ── Promo code state ──
  const [promoCode, setPromoCode] = useState('');

  // ── Referral state ──
  const [referralCode, setReferralCode] = useState(null);
  const [referralStats, setReferralStats] = useState(null);
  const [referralHistory, setReferralHistory] = useState([]);
  const [loadingReferral, setLoadingReferral] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  useEffect(() => {
    loadAllReferralData();
  }, []);

  const loadAllReferralData = async () => {
    await Promise.all([fetchReferralCode(), fetchReferralHistory()]);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAllReferralData();
    setRefreshing(false);
  }, []);

  // ── Fetch user's referral code + stats ───────────────────────────────────

  const fetchReferralCode = async () => {
    try {
      setLoadingReferral(true);
      const token = await getAuthToken();
      if (!token) return;

      const res = await fetch(`${BASE_URL}/referrals/my-code`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setReferralCode(data.referralCode);
        setReferralStats(data.rewards);
      }
    } catch (err) {
      console.warn('Failed to fetch referral code:', err);
    } finally {
      setLoadingReferral(false);
    }
  };

  // ── Fetch history of people this user referred ───────────────────────────

  const fetchReferralHistory = async () => {
    try {
      setLoadingHistory(true);
      const token = await getAuthToken();
      if (!token) return;

      // Also fetch stats at the same time
      const [historyRes, statsRes] = await Promise.all([
        fetch(`${BASE_URL}/referrals/history?limit=20`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${BASE_URL}/referrals/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (historyRes.ok) {
        const data = await historyRes.json();
        setReferralHistory(data.referrals || []);
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        // Merge into referralStats
        setReferralStats(prev => ({
          ...prev,
          totalReferrals: data.stats?.totalReferrals ?? 0,
          rewardedReferrals: data.stats?.rewardedReferrals ?? 0,
          pendingReferrals: data.stats?.pendingReferrals ?? 0,
          totalEarnedNaira: data.stats?.totalEarnedNaira ?? '0.00',
        }));
      }
    } catch (err) {
      console.warn('Failed to fetch referral history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // ── Copy code to clipboard ────────────────────────────────────────────────

  const handleCopyCode = () => {
    if (!referralCode) return;
    Clipboard.setString(referralCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2500);
  };

  // ── Share code via native share sheet ────────────────────────────────────

  const handleShare = async () => {
    if (!referralCode) return;
    try {
      await Share.share({
        message:
          `Join me on Wheela! Use my referral code ${referralCode} when you sign up ` +
          `and get ₦300 off your first ride. I'll get ₦500 too! 🚗\n\n` +
          `Download Wheela: https://wheela.ng`,
        title: 'Join Wheela with my referral code',
      });
    } catch (err) {
      console.warn('Share error:', err);
    }
  };

  // ── Promo code apply (placeholder — no backend yet) ───────────────────────

  const handleApplyCode = () => {
    if (!promoCode.trim()) {
      Alert.alert('Error', 'Please enter a promo code');
      return;
    }
    Alert.alert(
      'Success! 🎉',
      `Promo code "${promoCode}" applied! You'll get a discount on your next ride.`,
      [{ text: 'OK' }]
    );
    setPromoCode('');
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const statusColor = (status) => {
    if (status === 'rewarded') return '#15803D';
    if (status === 'expired')  return '#EF4444';
    return '#F59E0B'; // pending
  };

  const statusBg = (status) => {
    if (status === 'rewarded') return '#DCFCE7';
    if (status === 'expired')  return '#FEE2E2';
    return '#FEF3C7';
  };

  const statusLabel = (status) => {
    if (status === 'rewarded') return '✓ Rewarded';
    if (status === 'expired')  return '✕ Expired';
    return '⏳ Pending';
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={28} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Promotions & Referrals</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00B0F3" />
        }
      >

        {/* ══════════════════════════════════════════
            YOUR REFERRAL CODE CARD
        ══════════════════════════════════════════ */}
        <View style={styles.referralCard}>
          {/* Top gradient strip */}
          <View style={styles.referralCardTop}>
            <View style={styles.referralCardTopLeft}>
              <View style={styles.giftIconCircle}>
                <Ionicons name="gift" size={26} color="#FFFFFF" />
              </View>
              <View>
                <Text style={styles.referralCardTopTitle}>Your Referral Code</Text>
                <Text style={styles.referralCardTopSubtitle}>
                  Share and earn ₦500 per friend
                </Text>
              </View>
            </View>
          </View>

          {/* Code display */}
          <View style={styles.referralCodeSection}>
            {loadingReferral ? (
              <ActivityIndicator color="#00B0F3" size="small" style={{ marginVertical: 16 }} />
            ) : (
              <>
                <TouchableOpacity
                  style={styles.codeBox}
                  onPress={handleCopyCode}
                  activeOpacity={0.7}
                >
                  <Text style={styles.codeText}>{referralCode || '—'}</Text>
                  <View style={styles.copyBadge}>
                    <Ionicons
                      name={codeCopied ? 'checkmark' : 'copy-outline'}
                      size={16}
                      color={codeCopied ? '#15803D' : '#00B0F3'}
                    />
                    <Text style={[styles.copyText, codeCopied && styles.copiedText]}>
                      {codeCopied ? 'Copied!' : 'Copy'}
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.shareButton}
                  onPress={handleShare}
                  activeOpacity={0.8}
                >
                  <Ionicons name="share-social" size={18} color="#FFFFFF" />
                  <Text style={styles.shareButtonText}>Share Your Code</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* How it works */}
          <View style={styles.howItWorks}>
            <Text style={styles.howTitle}>How it works</Text>
            <View style={styles.stepRow}>
              <View style={styles.stepCircle}><Text style={styles.stepNum}>1</Text></View>
              <Text style={styles.stepText}>
                Share your code with friends who haven't used Wheela yet
              </Text>
            </View>
            <View style={styles.stepRow}>
              <View style={styles.stepCircle}><Text style={styles.stepNum}>2</Text></View>
              <Text style={styles.stepText}>
                They enter your code when signing up
              </Text>
            </View>
            <View style={styles.stepRow}>
              <View style={styles.stepCircle}><Text style={styles.stepNum}>3</Text></View>
              <Text style={styles.stepText}>
                When they complete their first ride — you get{' '}
                <Text style={styles.boldBlue}>₦500</Text>, they get{' '}
                <Text style={styles.boldBlue}>₦300</Text> in their wallets
              </Text>
            </View>
          </View>
        </View>

        {/* ══════════════════════════════════════════
            REFERRAL STATS ROW
        ══════════════════════════════════════════ */}
        {!loadingReferral && referralStats && (
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>
                {referralStats.totalReferrals ?? 0}
              </Text>
              <Text style={styles.statLabel}>Total{'\n'}Referred</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statValue}>
                {referralStats.rewardedReferrals ?? 0}
              </Text>
              <Text style={styles.statLabel}>Rewards{'\n'}Earned</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={[styles.statValue, styles.statValueGreen]}>
                ₦{referralStats.totalEarnedNaira ?? '0.00'}
              </Text>
              <Text style={styles.statLabel}>Total{'\n'}Earned</Text>
            </View>
          </View>
        )}

        {/* ══════════════════════════════════════════
            REFERRAL HISTORY
        ══════════════════════════════════════════ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>People You've Referred</Text>

          {loadingHistory ? (
            <View style={styles.historyLoading}>
              <ActivityIndicator color="#00B0F3" />
              <Text style={styles.historyLoadingText}>Loading history…</Text>
            </View>
          ) : referralHistory.length === 0 ? (
            <View style={styles.emptyHistory}>
              <Ionicons name="people-outline" size={48} color="#CBD5E1" />
              <Text style={styles.emptyHistoryTitle}>No referrals yet</Text>
              <Text style={styles.emptyHistoryText}>
                Share your code above and your friends will appear here once they sign up
              </Text>
            </View>
          ) : (
            referralHistory.map((item, index) => (
              <View key={item.id || index} style={styles.historyItem}>
                {/* Avatar */}
                <View style={styles.historyAvatar}>
                  <Text style={styles.historyAvatarText}>
                    {(item.referee?.name || 'U').charAt(0).toUpperCase()}
                  </Text>
                </View>

                {/* Info */}
                <View style={styles.historyInfo}>
                  <Text style={styles.historyName}>
                    {item.referee?.name || 'Wheela User'}
                  </Text>
                  {item.referee?.phone && (
                    <Text style={styles.historyPhone}>{item.referee.phone}</Text>
                  )}
                  <Text style={styles.historyDate}>
                    Joined {formatDate(item.createdAt)}
                  </Text>
                </View>

                {/* Status + reward */}
                <View style={styles.historyRight}>
                  <View style={[
                    styles.statusPill,
                    { backgroundColor: statusBg(item.status) }
                  ]}>
                    <Text style={[
                      styles.statusPillText,
                      { color: statusColor(item.status) }
                    ]}>
                      {statusLabel(item.status)}
                    </Text>
                  </View>
                  {item.status === 'rewarded' && (
                    <Text style={styles.historyRewardAmount}>
                      +₦{item.rewardEarned
                        ? (item.rewardEarned / 100).toFixed(0)
                        : '500'}
                    </Text>
                  )}
                  {item.status === 'pending' && (
                    <Text style={styles.historyPendingNote}>
                      Awaiting first ride
                    </Text>
                  )}
                </View>
              </View>
            ))
          )}
        </View>

        {/* ══════════════════════════════════════════
            PROMO CODE SECTION (existing)
        ══════════════════════════════════════════ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Enter a Promo Code</Text>
          <View style={styles.promoCard}>
            <Text style={styles.promoHint}>
              Have a special discount code from Wheela? Enter it below.
            </Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={promoCode}
                onChangeText={setPromoCode}
                placeholder="e.g., WHEELA20OFF"
                placeholderTextColor="#AAA"
                autoCapitalize="characters"
              />
              <TouchableOpacity style={styles.applyButton} onPress={handleApplyCode} activeOpacity={0.8}>
                <Text style={styles.applyButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ══════════════════════════════════════════
            TERMS NOTE
        ══════════════════════════════════════════ */}
        <Text style={styles.termsNote}>
          Referral rewards are credited to your Wheela wallet after your friend completes their first ride.
          Rewards expire 90 days after sign-up. One referral reward per new user.
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0A2540',
  },
  content: {
    padding: 16,
  },

  // ── Referral Card ──
  referralCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  referralCardTop: {
    backgroundColor: '#0A2540',
    paddingHorizontal: 20,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  referralCardTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  giftIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#00B0F3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  referralCardTopTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  referralCardTopSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
  },

  referralCodeSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0F9FF',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#BAE6FD',
    borderStyle: 'dashed',
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 14,
  },
  codeText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0A2540',
    letterSpacing: 4,
  },
  copyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  copyText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#00B0F3',
  },
  copiedText: {
    color: '#15803D',
  },
  shareButton: {
    backgroundColor: '#00B0F3',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#00B0F3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  shareButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  howItWorks: {
    padding: 20,
  },
  howTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
    gap: 12,
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  stepNum: {
    fontSize: 13,
    fontWeight: '700',
    color: '#00B0F3',
  },
  stepText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    flex: 1,
  },
  boldBlue: {
    fontWeight: '700',
    color: '#00B0F3',
  },

  // ── Stats Row ──
  statsRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E2E8F0',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0A2540',
    marginBottom: 4,
  },
  statValueGreen: {
    color: '#15803D',
    fontSize: 20,
  },
  statLabel: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 16,
  },

  // ── Sections ──
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0A2540',
    marginBottom: 12,
    paddingHorizontal: 2,
  },

  // ── History ──
  historyLoading: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    gap: 12,
  },
  historyLoadingText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  emptyHistory: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  emptyHistoryTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0A2540',
    marginTop: 14,
    marginBottom: 8,
  },
  emptyHistoryText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
  },
  historyItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  historyAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#0A2540',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  historyAvatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  historyInfo: {
    flex: 1,
  },
  historyName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0A2540',
    marginBottom: 2,
  },
  historyPhone: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 2,
  },
  historyDate: {
    fontSize: 12,
    color: '#94A3B8',
  },
  historyRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  statusPill: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  historyRewardAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: '#15803D',
  },
  historyPendingNote: {
    fontSize: 11,
    color: '#F59E0B',
    fontWeight: '500',
  },

  // ── Promo Code Card ──
  promoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  promoHint: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 16,
    lineHeight: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    color: '#0A2540',
  },
  applyButton: {
    backgroundColor: '#00B0F3',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  applyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // ── Terms ──
  termsNote: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 8,
    marginBottom: 8,
  },
});