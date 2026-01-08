// src/screens/driver/RideRequestScreen.js
import React, { useState } from 'react';
import {
View,
Text,
StyleSheet,
TouchableOpacity,
Alert,
Modal,
ActivityIndicator,
Dimensions,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import axios from 'axios';
import Constants from 'expo-constants';
import { useNavigation, useRoute } from '@react-navigation/native';
const { width, height } = Dimensions.get('window');
const baseUrl = 'https://wheels-backend.vercel.app'
export default function RideRequestScreen() {
const navigation = useNavigation();
const route = useRoute();
const { offer } = route.params || {}; // { pickup, destination, fare, passengerName, distance, duration, ... }
const [loading, setLoading] = useState(false);
const [modalVisible, setModalVisible] = useState(false);
if (!offer) {
return (
<View style={styles.container}>
<Text style={styles.errorText}>No ride request data</Text>
</View>
    );
  }
const acceptRide = async () => {
setLoading(true);
try {
await axios.post(`${baseUrl}/driver/accept/${offer.tripId}`);
navigation.replace('TripFlow', { tripId: offer.tripId });
    } catch (err) {
Alert.alert('Error', 'Could not accept ride. Try again.');
setLoading(false);
    }
  };
const declineRide = () => {
Alert.alert(
'Decline Ride',
'Are you sure you want to decline this ride?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
text: 'Decline',
style: 'destructive',
onPress: () => navigation.goBack(), // Or back to online map
        },
      ]
    );
  };
return (
<View style={styles.container}>
{/* Mini Map at Top */}
<View style={styles.mapContainer}>
<MapView
provider={PROVIDER_GOOGLE}
style={styles.map}
initialRegion={{
latitude: (offer.pickup.lat + offer.destination.lat) / 2,
longitude: (offer.pickup.lng + offer.destination.lng) / 2,
latitudeDelta: 0.05,
longitudeDelta: 0.05,
          }}
>
<Marker coordinate={{ latitude: offer.pickup.lat, longitude: offer.pickup.lng }} title="Pickup" pinColor="#00B0F3" />
<Marker coordinate={{ latitude: offer.destination.lat, longitude: offer.destination.lng }} title="Drop-off" pinColor="#FFFFFF" />
</MapView>
</View>
{/* Bottom Sheet Card */}
<View style={styles.card}>
<Text style={styles.header}>New Ride Request</Text>
<View style={styles.detailRow}>
<Text style={styles.label}>Passenger</Text>
<Text style={styles.value}>{offer.passengerName || 'Anonymous'}</Text>
</View>
<View style={styles.detailRow}>
<Text style={styles.label}>Pickup</Text>
<Text style={styles.value}>{offer.pickup.address}</Text>
</View>
<View style={styles.detailRow}>
<Text style={styles.label}>Drop-off</Text>
<Text style={styles.value}>{offer.destination.address}</Text>
</View>
<View style={styles.detailRow}>
<Text style={styles.label}>Distance</Text>
<Text style={styles.value}>{offer.distance || 'N/A'}</Text>
</View>
<View style={styles.detailRow}>
<Text style={styles.label}>Estimated Time</Text>
<Text style={styles.value}>{offer.duration || 'N/A'}</Text>
</View>
<View style={styles.fareRow}>
<Text style={styles.fareLabel}>Fare</Text>
<Text style={styles.fareAmount}>₦{(offer.fare / 100).toFixed(2)}</Text>
</View>
{/* Action Buttons */}
<View style={styles.actions}>
<TouchableOpacity style={styles.declineBtn} onPress={declineRide} disabled={loading}>
<Text style={styles.declineText}>Decline</Text>
</TouchableOpacity>
<TouchableOpacity style={[styles.acceptBtn, loading && styles.disabled]} onPress={acceptRide} disabled={loading}>
{loading ? (
<ActivityIndicator color="#010C44" />
            ) : (
<Text style={styles.acceptText}>Accept</Text>
            )}
</TouchableOpacity>
</View>
<Text style={styles.timerNote}>Request expires in 30 seconds</Text>
</View>
</View>
  );
}
const styles = StyleSheet.create({
container: {
flex: 1,
backgroundColor: '#010C44',
  },
mapContainer: {
height: height * 0.45,
  },
map: {
flex: 1,
  },
card: {
backgroundColor: '#FFFFFF',
borderTopLeftRadius: 24,
borderTopRightRadius: 24,
paddingHorizontal: 32,
paddingTop: 32,
paddingBottom: 40,
flex: 1,
  },
header: {
fontSize: 26,
fontWeight: '800',
color: '#010C44',
textAlign: 'center',
marginBottom: 24,
  },
detailRow: {
flexDirection: 'row',
justifyContent: 'space-between',
marginBottom: 16,
  },
label: {
color: '#516880',
fontSize: 16,
fontWeight: '600',
  },
value: {
color: '#010C44',
fontSize: 16,
fontWeight: '700',
flex: 1,
textAlign: 'right',
marginLeft: 16,
  },
fareRow: {
flexDirection: 'row',
justifyContent: 'space-between',
marginTop: 24,
marginBottom: 32,
paddingVertical: 16,
borderTopWidth: 1,
borderBottomWidth: 1,
borderColor: '#E6EEF6',
  },
fareLabel: {
color: '#010C44',
fontSize: 20,
fontWeight: '600',
  },
fareAmount: {
color: '#00B0F3',
fontSize: 32,
fontWeight: '800',
  },
actions: {
flexDirection: 'row',
justifyContent: 'space-between',
  },
declineBtn: {
backgroundColor: '#FFFFFF',
borderWidth: 2,
borderColor: '#010C44',
paddingVertical: 18,
borderRadius: 16,
flex: 0.45,
alignItems: 'center',
  },
declineText: {
color: '#010C44',
fontSize: 18,
fontWeight: '800',
  },
acceptBtn: {
backgroundColor: '#00B0F3',
paddingVertical: 18,
borderRadius: 16,
flex: 0.45,
alignItems: 'center',
shadowColor: '#00B0F3',
shadowOffset: { width: 0, height: 10 },
shadowOpacity: 0.4,
shadowRadius: 20,
elevation: 15,
  },
disabled: {
opacity: 0.7,
  },
acceptText: {
color: '#010C44',
fontSize: 18,
fontWeight: '800',
  },
timerNote: {
color: '#516880',
fontSize: 14,
textAlign: 'center',
marginTop: 20,
  },
errorText: {
color: '#FFFFFF',
fontSize: 18,
textAlign: 'center',
marginTop: 50,
  },
});