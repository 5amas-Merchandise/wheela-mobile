import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, FlatList, Alert, TouchableOpacity, TextInput } from 'react-native'
import axios from 'axios'
import Constants from 'expo-constants'

export default function LuxuryEarningsScreen() {
  const baseUrl = (Constants.manifest && Constants.manifest.extra && Constants.manifest.extra.baseUrl) || process.env.BASE_URL || ''
  const [earnings, setEarnings] = useState(0)
  const [trips, setTrips] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterDate, setFilterDate] = useState('')

  useEffect(() => {
    async function fetchEarnings() {
      try {
        // Updated to match backend: GET /drivers/luxury-earnings returns { total, trips }
        const res = await axios.get(baseUrl + '/drivers/luxury-earnings')
        setEarnings(res.data.total)
        setTrips(res.data.trips)
      } catch (err) {
        Alert.alert('Error', 'Could not load luxury earnings')
      } finally {
        setLoading(false)
      }
    }
    fetchEarnings()
  }, [])

  const requestPayout = async () => {
    try {
      // Updated to match backend: POST /drivers/luxury-payout
      await axios.post(baseUrl + '/drivers/luxury-payout')
      Alert.alert('Payout Requested', 'Your payout request has been submitted.')
    } catch (err) {
      Alert.alert('Error', 'Could not request payout')
    }
  }

  const filteredTrips = filterDate
    ? trips.filter((t) => t.date && t.date.startsWith(filterDate))
    : trips

  if (loading) {
    return <View style={styles.container}><Text>Loading...</Text></View>
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Luxury Earnings</Text>
      <Text style={styles.total}>₦{(earnings / 100).toFixed(2)}</Text>
      <TouchableOpacity style={styles.payoutBtn} onPress={requestPayout}>
        <Text style={styles.payoutBtnText}>Request Payout</Text>
      </TouchableOpacity>
      <TextInput
        style={styles.filterInput}
        placeholder="Filter by date (YYYY-MM-DD)"
        value={filterDate}
        onChangeText={setFilterDate}
      />
      <Text style={styles.txHeader}>Luxury Trips & Commission</Text>
      <FlatList
        data={filteredTrips}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.info}>
              <Text style={styles.date}>{new Date(item.date).toLocaleDateString()}</Text>
              <Text style={styles.route}>{item.pickup?.address || 'N/A'} → {item.destination?.address || 'N/A'}</Text>
            </View>
            <View style={styles.commissionWrap}>
              <Text style={styles.fare}>₦{(item.fare / 100).toFixed(2)}</Text>
              <Text style={styles.commission}>Commission: ₦{(item.commission / 100).toFixed(2)}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No luxury trips yet.</Text>}
      />
      <Text style={styles.note}>Luxury trips have a commission deducted per ride.</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 24,
  },
  header: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0A2540',
    marginBottom: 8,
    textAlign: 'center',
  },
  total: {
    fontSize: 32,
    fontWeight: '700',
    color: '#00C896',
    marginBottom: 12,
    textAlign: 'center',
  },
  txHeader: {
    fontWeight: '600',
    marginBottom: 8,
    color: '#0A2540',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: '#E6EEF6',
  },
  info: {
    flex: 1,
    marginRight: 12,
  },
  date: {
    color: '#516880',
    fontSize: 14,
    marginBottom: 2,
  },
  route: {
    color: '#0A2540',
    fontWeight: '600',
    fontSize: 15,
  },
  commissionWrap: {
    alignItems: 'flex-end',
  },
  fare: {
    color: '#00C896',
    fontWeight: '700',
    fontSize: 16,
  },
  commission: {
    color: '#FFD700',
    fontWeight: '600',
    fontSize: 14,
  },
  empty: {
    color: '#516880',
    textAlign: 'center',
    marginTop: 24,
  },
  note: {
    color: '#516880',
    textAlign: 'center',
    marginTop: 16,
  },
  payoutBtn: {
    backgroundColor: '#0A2540',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
    width: '100%',
  },
  payoutBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  filterInput: {
    borderWidth: 1,
    borderColor: '#E6EEF6',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    width: '100%',
    fontSize: 15,
  },
})
