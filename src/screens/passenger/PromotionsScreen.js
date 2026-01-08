// src/screens/passenger/PromotionsScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

export default function PromotionsScreen() {
  const navigation = useNavigation();
  const [promoCode, setPromoCode] = useState('');

  const handleApplyCode = () => {
    if (!promoCode.trim()) {
      Alert.alert('Error', 'Please enter a promo code');
      return;
    }

    // Dummy validation/success (replace with real API later)
    Alert.alert(
      'Success! 🎉',
      `Promo code "${promoCode}" applied! You'll get a discount on your next ride.`,
      [{ text: 'OK' }]
    );
    setPromoCode('');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={28} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Promotions</Text>
        <View style={{ width: 28 }} /> {/* Spacer */}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Promo Explanation */}
        <View style={styles.explanationSection}>
          <Text style={styles.explanationTitle}>Unlock Savings with Wheela Promotions</Text>
          <Text style={styles.explanationText}>
            At Wheela, we're committed to making your rides more affordable and rewarding. Our promotions are designed to give you the best value for every trip you take. Whether you're commuting daily or planning a special outing, enter a valid promo code to enjoy discounts on your fares.
          </Text>
          <Text style={styles.explanationText}>
            How it works:
          </Text>
          <View style={styles.bulletList}>
            <View style={styles.bulletItem}>
              <Ionicons name="checkmark" size={18} color="#00B0F3" style={styles.bulletIcon} />
              <Text style={styles.bulletText}>Enter your promo code in the field below and tap "Apply".</Text>
            </View>
            <View style={styles.bulletItem}>
              <Ionicons name="checkmark" size={18} color="#00B0F3" style={styles.bulletIcon} />
              <Text style={styles.bulletText}>If valid, the discount will automatically apply to your next eligible ride.</Text>
            </View>
            <View style={styles.bulletItem}>
              <Ionicons name="checkmark" size={18} color="#00B0F3" style={styles.bulletIcon} />
              <Text style={styles.bulletText}>Discounts may vary based on the promo (e.g., 20% off, ₦500 flat discount) and are subject to terms like minimum fare or specific ride types.</Text>
            </View>
            <View style={styles.bulletItem}>
              <Ionicons name="checkmark" size={18} color="#00B0F3" style={styles.bulletIcon} />
              <Text style={styles.bulletText}>Keep an eye on your notifications for exclusive Wheela promo codes and limited-time offers.</Text>
            </View>
          </View>
          <Text style={styles.explanationText}>
            Remember, promotions are our way of saying thank you for choosing Wheela. Ride more, save more, and enjoy seamless transportation across the city!
          </Text>
        </View>

        {/* Promo Code Input */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Enter Promo Code</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={promoCode}
              onChangeText={setPromoCode}
              placeholder="e.g., WHEELA20OFF"
              placeholderTextColor="#AAA"
              autoCapitalize="characters"
            />
            <TouchableOpacity style={styles.applyButton} onPress={handleApplyCode}>
              <Text style={styles.applyButtonText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Active Promos Placeholder */}
        <View style={styles.activePromosSection}>
          <Text style={styles.activePromosTitle}>Active Promotions</Text>
          <Text style={styles.activePromosText}>
            You have no active promotions yet. Apply a code above to get started!
          </Text>
        </View>
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
  explanationSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  explanationTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0A2540',
    marginBottom: 12,
  },
  explanationText: {
    fontSize: 15,
    color: '#64748B',
    lineHeight: 22,
    marginBottom: 16,
  },
  bulletList: {
    marginBottom: 16,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  bulletIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  bulletText: {
    fontSize: 15,
    color: '#64748B',
    flex: 1,
    lineHeight: 22,
  },
  inputSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0A2540',
    marginBottom: 12,
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
  activePromosSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  activePromosTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0A2540',
    marginBottom: 12,
  },
  activePromosText: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
  },
});