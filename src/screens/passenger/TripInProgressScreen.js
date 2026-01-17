// src/screens/passenger/TripInProgressScreen.js - Update to redirect
import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';

export default function TripInProgressScreen() {
  const route = useRoute();
  const navigation = useNavigation();

  // This screen is now deprecated - redirect to TripTrackingScreen
  React.useEffect(() => {
    if (route.params) {
      navigation.replace('TripTracking', route.params);
    } else {
      navigation.goBack();
    }
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#00B0F3" />
      <Text style={{ marginTop: 16 }}>Redirecting to trip tracking...</Text>
    </View>
  );
}