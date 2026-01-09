// src/screens/passenger/SearchDestinationScreen.js
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';

// ✅ USING YOUR GOOGLE KEY
const GOOGLE_API_KEY = 'AIzaSyAbOQwCqiWYfyKe-t1SmzUcfgNVFYaXTFo';

export default function SearchDestinationScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { onSelect } = route.params;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const timeoutRef = useRef(null);

  // 1. SEARCH PREDICTIONS (AUTOCOMPLETE)
  const search = async (text) => {
    if (text.trim().length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(async () => {
      try {
        const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
          text
        )}&key=${GOOGLE_API_KEY}&components=country:ng`;
        
        const res = await fetch(url);
        const data = await res.json();
        
        if (data.status === 'OK') {
          setResults(data.predictions);
        } else {
          setResults([]);
        }
      } catch (err) {
        console.error('Google Autocomplete Error:', err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 500);
  };

  // 2. GET DETAILS (LAT/LNG) FOR SELECTED PREDICTION
  const selectPlace = async (item) => {
    try {
      setLoading(true);
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${item.place_id}&fields=geometry,name,formatted_address&key=${GOOGLE_API_KEY}`;
      
      const res = await fetch(url);
      const data = await res.json();

      if (data.status === 'OK') {
        const { lat, lng } = data.result.geometry.location;
        const address = data.result.formatted_address || item.description;
        
        const coords = {
          latitude: lat,
          longitude: lng,
        };

        onSelect(coords, address);
        navigation.goBack();
      } else {
        console.error('Place Details Error:', data.status);
      }
    } catch (err) {
      console.error('Error fetching details:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={28} color="#000" />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder="Search destination..."
          value={query}
          onChangeText={(t) => {
            setQuery(t);
            search(t);
          }}
          autoFocus
          placeholderTextColor="#999"
        />
      </View>

      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#00B0F3" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      )}

      <FlatList
        data={results}
        keyExtractor={(item) => item.place_id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.item} onPress={() => selectPlace(item)}>
            <Ionicons name="location-outline" size={22} color="#666" />
            <View style={styles.itemTextContainer}>
              <Text style={styles.itemMain} numberOfLines={1}>{item.structured_formatting?.main_text || item.description}</Text>
              <Text style={styles.itemSub} numberOfLines={1}>{item.structured_formatting?.secondary_text || ''}</Text>
            </View>
          </TouchableOpacity>
        )}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 10,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  backBtn: { padding: 8 },
  input: { flex: 1, fontSize: 18, marginLeft: 8 },
  loadingRow: { flexDirection: 'row', padding: 16, alignItems: 'center' },
  loadingText: { marginLeft: 12, color: '#666' },
  item: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderColor: '#f0f0f0',
    alignItems: 'center',
  },
  itemTextContainer: { marginLeft: 12, flex: 1 },
  itemMain: { fontSize: 16, fontWeight: '600', color: '#000' },
  itemSub: { fontSize: 14, color: '#666', marginTop: 2 },
});