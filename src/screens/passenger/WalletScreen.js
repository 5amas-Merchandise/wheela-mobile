import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, Modal, TextInput } from 'react-native'
import axios from 'axios'
import Constants from 'expo-constants'
import { useNavigation } from '@react-navigation/native'

const baseUrl = (
  (Constants.manifest && Constants.manifest.extra && Constants.manifest.extra.baseUrl) ||
  (Constants.expoConfig && Constants.expoConfig.extra && Constants.expoConfig.extra.baseUrl) ||
  process.env.BASE_URL ||
  ''
)


function WalletScreen() {
  const navigation = useNavigation()
  const [balance, setBalance] = useState(0)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalVisible, setModalVisible] = useState(false)
  const [fundAmount, setFundAmount] = useState('')
  const [fundLoading, setFundLoading] = useState(false)
  const [txModalVisible, setTxModalVisible] = useState(false)
  const [selectedTx, setSelectedTx] = useState(null)

  useEffect(() => {
    async function fetchWallet() {
      try {
        // Updated to match backend: GET /users/wallet returns { balance, transactions }
        const res = await axios.get(baseUrl + '/users/wallet')
        setBalance(res.data.balance)
        setTransactions(res.data.transactions)
      } catch (err) {
        Alert.alert('Error', 'Could not load wallet')
      } finally {
        setLoading(false)
      }
    }
    fetchWallet()
  }, [])

  const addFunds = () => {
    setModalVisible(true)
  }

  const handleFundConfirm = async () => {
    if (!fundAmount || isNaN(fundAmount) || Number(fundAmount) <= 0) {
      Alert.alert('Invalid', 'Enter a valid amount')
      return
    }
    setFundLoading(true)
    try {
      // Updated to match backend: POST /users/wallet/fund { amount }
      const res = await axios.post(baseUrl + '/users/wallet/fund', {
        amount: Number(fundAmount) * 100,
      })
      // Assume backend returns updated { balance, transactions }
      setBalance(res.data.balance)
      setTransactions(res.data.transactions)
      setModalVisible(false)
      setFundAmount('')
      Alert.alert('Success', `₦${fundAmount} added to wallet.`)
    } catch (err) {
      Alert.alert('Error', 'Could not add funds')
    } finally {
      setFundLoading(false)
    }
  }

  if (loading) {
    return <View style={styles.container}><Text>Loading...</Text></View>
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Wallet</Text>
      <Text style={styles.balance}>₦{(balance / 100).toFixed(2)}</Text>
      <TouchableOpacity style={styles.addBtn} onPress={addFunds}>
        <Text style={styles.addText}>Add Funds</Text>
      </TouchableOpacity>
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalWrap}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Funds (Mock)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter amount (₦)"
              keyboardType="numeric"
              value={fundAmount}
              onChangeText={setFundAmount}
            />
            <TouchableOpacity style={styles.modalBtn} onPress={handleFundConfirm} disabled={fundLoading}>
              <Text style={styles.modalBtnText}>{fundLoading ? 'Adding...' : 'Confirm'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setModalVisible(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Text style={styles.txHeader}>Transactions</Text>
      <FlatList
        data={transactions}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.txRow} onPress={() => { setSelectedTx(item); setTxModalVisible(true); }}>
            <Text style={styles.txType}>{item.type}</Text>
            <Text style={styles.txAmount}>{item.amount > 0 ? '+' : ''}₦{(item.amount / 100).toFixed(2)}</Text>
            <Text style={styles.txDate}>{new Date(item.date).toLocaleDateString()}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No transactions yet.</Text>}
      />
      <Modal
        visible={txModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setTxModalVisible(false)}
      >
        <View style={styles.modalWrap}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Transaction Details</Text>
            {selectedTx ? (
              <>
                <Text style={styles.modalInput}>Type: {selectedTx.type}</Text>
                <Text style={styles.modalInput}>Amount: {(selectedTx.amount > 0 ? '+' : '')}₦{(selectedTx.amount / 100).toFixed(2)}</Text>
                <Text style={styles.modalInput}>Date: {new Date(selectedTx.date).toLocaleString()}</Text>
                <Text style={styles.modalInput}>Status: {selectedTx.status || 'N/A'}</Text>
                <Text style={styles.modalInput}>Reference: {selectedTx.reference || 'N/A'}</Text>
              </>
            ) : null}
            <TouchableOpacity style={styles.modalBtn} onPress={() => setTxModalVisible(false)}>
              <Text style={styles.modalBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}

export default WalletScreen;

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
  balance: {
    fontSize: 32,
    fontWeight: '700',
    color: '#00C896',
    marginBottom: 12,
    textAlign: 'center',
  },
  addBtn: {
    backgroundColor: '#0A2540',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  addText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  txHeader: {
    fontWeight: '600',
    marginBottom: 8,
    color: '#0A2540',
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: '#E6EEF6',
  },
  txType: {
    color: '#516880',
    fontWeight: '600',
  },
  txAmount: {
    color: '#0A2540',
    fontWeight: '700',
  },
  txDate: {
    color: '#516880',
    fontSize: 12,
  },
  empty: {
    color: '#516880',
    textAlign: 'center',
    marginTop: 24,
  },
  modalWrap: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0A2540',
    marginBottom: 12,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E6EEF6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    width: '100%',
    textAlign: 'center',
    fontSize: 16,
  },
  modalBtn: {
    backgroundColor: '#0A2540',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
    marginBottom: 8,
  },
  modalBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  modalCancelBtn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#0A2540',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
  },
  modalCancelText: {
    color: '#0A2540',
    fontWeight: '700',
    fontSize: 15,
  },
})
