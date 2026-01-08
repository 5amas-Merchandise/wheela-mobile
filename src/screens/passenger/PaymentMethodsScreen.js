// src/screens/passenger/PaymentMethodsScreen.js
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

export default function PaymentMethodsScreen() {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={28} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment Methods</Text>
        <View style={{ width: 28 }} /> {/* Spacer for symmetry */}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Cash Payment Card */}
        <View style={styles.methodCard}>
          <View style={styles.methodIconContainer}>
            <Ionicons name="cash-outline" size={32} color="#00B0F3" />
          </View>
          <View style={styles.methodInfo}>
            <Text style={styles.methodTitle}>Cash</Text>
            <Text style={styles.methodDescription}>Default payment method</Text>
          </View>
          <Ionicons name="checkmark-circle" size={24} color="#10B981" />
        </View>

        {/* Explanation Section */}
        <View style={styles.explanationSection}>
          <Text style={styles.explanationTitle}>Why Cash Only on Wheela?</Text>
          <Text style={styles.explanationText}>
            At Wheela, we prioritize transparency and simplicity in every ride. That's why we exclusively support cash payments directly to your driver upon completion of the trip. This approach ensures:
          </Text>
          <View style={styles.bulletList}>
            <View style={styles.bulletItem}>
              <Ionicons name="checkmark" size={18} color="#00B0F3" style={styles.bulletIcon} />
              <Text style={styles.bulletText}>No hidden fees or surprises – you pay exactly what you see in the app estimate.</Text>
            </View>
            <View style={styles.bulletItem}>
              <Ionicons name="checkmark" size={18} color="#00B0F3" style={styles.bulletIcon} />
              <Text style={styles.bulletText}>Full control over your transactions, promoting trust between riders and drivers.</Text>
            </View>
            <View style={styles.bulletItem}>
              <Ionicons name="checkmark" size={18} color="#00B0F3" style={styles.bulletIcon} />
              <Text style={styles.bulletText}>Accessibility for everyone, regardless of banking status or digital payment preferences.</Text>
            </View>
            <View style={styles.bulletItem}>
              <Ionicons name="checkmark" size={18} color="#00B0F3" style={styles.bulletIcon} />
              <Text style={styles.bulletText}>Enhanced security – no need to store sensitive card information in the app.</Text>
            </View>
          </View>
          <Text style={styles.explanationText}>
            We believe this cash-only model fosters a more transparent and reliable experience for all Wheela users. If you have any questions about payments or need assistance during a ride, our support team is always here to help.
          </Text>
        </View>

        {/* Support CTA */}
        <TouchableOpacity style={styles.supportButton}>
          <Ionicons name="help-circle-outline" size={24} color="#00B0F3" />
          <Text style={styles.supportText}>Need help with payments?</Text>
        </TouchableOpacity>
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
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  methodIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F0F9FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  methodInfo: {
    flex: 1,
  },
  methodTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0A2540',
    marginBottom: 4,
  },
  methodDescription: {
    fontSize: 14,
    color: '#64748B',
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
  supportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  supportText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00B0F3',
    marginLeft: 12,
  },
});