// src/screens/passenger/SettingsScreen.js
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

export default function SettingsScreen() {
  const navigation = useNavigation();
  const [notifications, setNotifications] = React.useState(true);
  const [locationAlways, setLocationAlways] = React.useState(false);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={28} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <TouchableOpacity style={styles.settingItem} onPress={() => navigation.navigate('Profile')}>
            <Ionicons name="person-outline" size={24} color="#64748B" />
            <Text style={styles.settingText}>Personal Information</Text>
            <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingItem}>
            <Ionicons name="lock-closed-outline" size={24} color="#64748B" />
            <Text style={styles.settingText}>Change Password</Text>
            <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
          </TouchableOpacity>
        </View>

        {/* Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <View style={styles.settingItem}>
            <Ionicons name="notifications-outline" size={24} color="#64748B" />
            <View style={styles.settingLabel}>
              <Text style={styles.settingText}>Push Notifications</Text>
              <Text style={styles.settingSub}>Ride updates, promotions, and alerts</Text>
            </View>
            <Switch value={notifications} onValueChange={setNotifications} />
          </View>
          <View style={styles.settingItem}>
            <Ionicons name="location-outline" size={24} color="#64748B" />
            <View style={styles.settingLabel}>
              <Text style={styles.settingText}>Location Access</Text>
              <Text style={styles.settingSub}>Allow always for better pickup</Text>
            </View>
            <Switch value={locationAlways} onValueChange={setLocationAlways} />
          </View>
        </View>

        {/* Support & Legal */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support & Legal</Text>
          <TouchableOpacity style={styles.settingItem} onPress={() => navigation.navigate('Help')}>
            <Ionicons name="help-circle-outline" size={24} color="#64748B" />
            <Text style={styles.settingText}>Help & Support</Text>
            <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingItem}>
            <Ionicons name="document-text-outline" size={24} color="#64748B" />
            <Text style={styles.settingText}>Terms of Service</Text>
            <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingItem}>
            <Ionicons name="shield-checkmark-outline" size={24} color="#64748B" />
            <Text style={styles.settingText}>Privacy Policy</Text>
            <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
          </TouchableOpacity>
        </View>

        {/* App Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.settingItem}>
            <Ionicons name="information-circle-outline" size={24} color="#64748B" />
            <Text style={styles.settingText}>App Version</Text>
            <Text style={styles.versionText}>Wheela v1.2.0</Text>
          </View>
        </View>
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
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
    paddingHorizontal: 20,
    paddingTop: 16,
    marginBottom: 8,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  settingLabel: { flex: 1, marginLeft: 16 },
  settingText: { fontSize: 16, color: '#0A2540' },
  settingSub: { fontSize: 13, color: '#64748B', marginTop: 4 },
  versionText: { fontSize: 16, color: '#64748B' },
});