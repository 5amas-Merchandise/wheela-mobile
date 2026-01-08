// src/screens/passenger/HelpScreen.js
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

export default function HelpScreen() {
  const navigation = useNavigation();

  const contactSupport = () => {
    // Replace with your actual support phone/email
    Alert.alert(
      'Contact Support',
      'Call: +234 700 000 0000\nEmail: support@wheela.com\nWe\'re here 24/7 to help!',
      [{ text: 'OK' }]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={28} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Contact Support Card */}
        <TouchableOpacity style={styles.contactCard} onPress={contactSupport}>
          <View style={styles.contactIcon}>
            <Ionicons name="headset-outline" size={32} color="#00B0F3" />
          </View>
          <View style={styles.contactInfo}>
            <Text style={styles.contactTitle}>Talk to Support</Text>
            <Text style={styles.contactDesc}>Get help from our team anytime</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#64748B" />
        </TouchableOpacity>

        {/* FAQ Section */}
        <View style={styles.faqSection}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>

          <TouchableOpacity style={styles.faqItem}>
            <Text style={styles.faqQuestion}>How do I book a ride?</Text>
            <Ionicons name="chevron-down" size={20} color="#64748B" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.faqItem}>
            <Text style={styles.faqQuestion}>What payment methods are accepted?</Text>
            <Ionicons name="chevron-down" size={20} color="#64748B" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.faqItem}>
            <Text style={styles.faqQuestion}>How does pricing work?</Text>
            <Ionicons name="chevron-down" size={20} color="#64748B" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.faqItem}>
            <Text style={styles.faqQuestion}>Is my trip safe?</Text>
            <Ionicons name="chevron-down" size={20} color="#64748B" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.faqItem}>
            <Text style={styles.faqQuestion}>What if I left something in the vehicle?</Text>
            <Ionicons name="chevron-down" size={20} color="#64748B" />
          </TouchableOpacity>
        </View>

        {/* Safety Info */}
        <View style={styles.safetySection}>
          <Text style={styles.sectionTitle}>Your Safety Matters</Text>
          <Text style={styles.safetyText}>
            All Wheela drivers go through background checks and vehicle inspections. 
            You can share your trip with trusted contacts, and our 24/7 support team is always ready to assist.
          </Text>
        </View>

        {/* Emergency */}
        <TouchableOpacity style={styles.emergencyButton}>
          <Ionicons name="alert-circle-outline" size={24} color="#EF4444" />
          <Text style={styles.emergencyText}>Emergency Assistance</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
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
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#0A2540' },
  content: { padding: 16 },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  contactIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F0F9FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  contactInfo: { flex: 1 },
  contactTitle: { fontSize: 18, fontWeight: '700', color: '#0A2540' },
  contactDesc: { fontSize: 14, color: '#64748B', marginTop: 4 },
  faqSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#0A2540', marginBottom: 16 },
  faqItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  faqQuestion: { fontSize: 16, color: '#0A2540' },
  safetySection: {
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  safetyText: { fontSize: 15, color: '#166534', lineHeight: 22 },
  emergencyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF1F1',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  emergencyText: { fontSize: 16, fontWeight: '600', color: '#EF4444', marginLeft: 12 },
});