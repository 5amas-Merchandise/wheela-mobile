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

const LOCATIONIQ_KEY = 'pk.b84a833d23e60c83f10a0b59524191b6';

export default function SearchDestinationScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { onSelect } = route.params;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const timeoutRef = useRef(null);

  const search = async (text) => {
    if (text.trim().length < 3) {
      setResults([]);
      return;
    }

    setLoading(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(async () => {
      try {
        const url = `https://api.locationiq.com/v1/autocomplete?key=${LOCATIONIQ_KEY}&q=${encodeURIComponent(
          text
        )}&countrycodes=ng&limit=10&format=json`;
        const res = await fetch(url);
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 600);
  };

  const selectPlace = (item) => {
    const coords = {
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
    };
    const address = item.display_name;
    onSelect(coords, address);
    navigation.goBack();
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
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      )}

      <FlatList
        data={results}
        keyExtractor={(item) => item.place_id?.toString() || Math.random().toString()}
        renderItem={({ item }) => {
          const parts = item.display_name.split(',');
          const main = parts[0].trim();
          const sub = parts.slice(1).join(',').trim();

          return (
            <TouchableOpacity style={styles.item} onPress={() => selectPlace(item)}>
              <Ionicons name="location-outline" size={22} color="#666" />
              <View style={styles.itemTextContainer}>
                <Text style={styles.itemMain} numberOfLines={1}>{main}</Text>
                <Text style={styles.itemSub} numberOfLines={1}>{sub || item.display_name}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
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
  itemMain: { fontSize: 16, fontWeight: '600' },
  itemSub: { fontSize: 14, color: '#666', marginTop: 2 },
});