// src/screens/passenger/SearchDestinationScreen.js
import React, { useState, useRef, useEffect } from 'react';
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
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';

const GOOGLE_API_KEY = 'AIzaSyAbOQwCqiWYfyKe-t1SmzUcfgNVFYaXTFo';

// Quick-pick recent/popular destinations (can be replaced with stored history)
const QUICK_PICKS = [
  { id: 'q1', icon: 'home-outline',   label: 'Home',   sub: 'Set home address' },
  { id: 'q2', icon: 'briefcase-outline', label: 'Work', sub: 'Set work address' },
];

export default function SearchDestinationScreen() {
  const navigation = useNavigation();
  const route      = useRoute();
  const { onSelect } = route.params;

  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const timeoutRef = useRef(null);
  const inputRef   = useRef(null);

  // Entrance animation
  const slideAnim = useRef(new Animated.Value(30)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
      Animated.timing(fadeAnim,  { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
  }, []);

  // ── Autocomplete ────────────────────────────────────────────────────────────
  const search = (text) => {
    setQuery(text);
    if (text.trim().length < 2) { setResults([]); return; }
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setLoading(true);
    timeoutRef.current = setTimeout(async () => {
      try {
        const res  = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&key=${GOOGLE_API_KEY}&components=country:ng`);
        const data = await res.json();
        setResults(data.status === 'OK' ? data.predictions : []);
      } catch { setResults([]); }
      finally  { setLoading(false); }
    }, 420);
  };

  // ── Place detail ────────────────────────────────────────────────────────────
  const selectPlace = async (item) => {
    try {
      setLoading(true);
      const res  = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${item.place_id}&fields=geometry,formatted_address&key=${GOOGLE_API_KEY}`);
      const data = await res.json();
      if (data.status === 'OK') {
        const { lat, lng } = data.result.geometry.location;
        onSelect({ latitude: lat, longitude: lng }, data.result.formatted_address || item.description);
        navigation.goBack();
      }
    } catch {}
    finally { setLoading(false); }
  };

  const clearQuery = () => { setQuery(''); setResults([]); inputRef.current?.focus(); };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* ── Header ── */}
      <Animated.View style={[s.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color="#1A1A1A" />
        </TouchableOpacity>

        <View style={s.inputWrap}>
          {/* Destination dot */}
          <View style={s.destDot} />

          <TextInput
            ref={inputRef}
            style={s.input}
            placeholder="Where are you going?"
            placeholderTextColor="#BABABA"
            value={query}
            onChangeText={search}
            autoFocus
            returnKeyType="search"
            clearButtonMode="never"
          />

          {query.length > 0 ? (
            <TouchableOpacity onPress={clearQuery} style={s.clearBtn}>
              <View style={s.clearCircle}>
                <Ionicons name="close" size={12} color="#fff" />
              </View>
            </TouchableOpacity>
          ) : (
            <Ionicons name="search" size={18} color="#BABABA" style={{ marginRight: 12 }} />
          )}
        </View>
      </Animated.View>

      {/* ── Loading bar ── */}
      {loading && <View style={s.loadingBar}><ActivityIndicator size="small" color="#1A1A1A" /><Text style={s.loadingText}>Searching…</Text></View>}

      {/* ── Results / Quick picks ── */}
      <FlatList
        data={results.length > 0 ? results : query.length === 0 ? QUICK_PICKS : []}
        keyExtractor={item => item.place_id || item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 40 }}
        ListHeaderComponent={
          query.length === 0 && results.length === 0 ? (
            <Text style={s.sectionLabel}>SUGGESTIONS</Text>
          ) : results.length > 0 ? (
            <Text style={s.sectionLabel}>RESULTS</Text>
          ) : null
        }
        ItemSeparatorComponent={() => <View style={s.separator} />}
        renderItem={({ item }) => {
          const isQuick = !!item.id;
          return (
            <TouchableOpacity
              style={s.resultItem}
              activeOpacity={0.75}
              onPress={() => isQuick ? null : selectPlace(item)}
            >
              <View style={[s.resultIcon, isQuick && s.resultIconQuick]}>
                <Ionicons
                  name={isQuick ? item.icon : 'location'}
                  size={isQuick ? 18 : 16}
                  color={isQuick ? '#1A1A1A' : '#666'}
                />
              </View>
              <View style={s.resultText}>
                <Text style={s.resultMain} numberOfLines={1}>
                  {isQuick ? item.label : (item.structured_formatting?.main_text || item.description)}
                </Text>
                <Text style={s.resultSub} numberOfLines={1}>
                  {isQuick ? item.sub : (item.structured_formatting?.secondary_text || '')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#DDD" />
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          query.length >= 2 && !loading ? (
            <View style={s.emptyState}>
              <View style={s.emptyIcon}>
                <Ionicons name="search-outline" size={32} color="#CCC" />
              </View>
              <Text style={s.emptyTitle}>No results found</Text>
              <Text style={s.emptySub}>Try a different search term or area</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 8 : 8,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    backgroundColor: '#fff',
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F5F5F0',
    justifyContent: 'center', alignItems: 'center',
    marginRight: 12,
  },
  inputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F5F5F0', borderRadius: 14,
    height: 48, paddingLeft: 12,
  },
  destDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#1A1A1A', marginRight: 10,
  },
  input: {
    flex: 1, fontSize: 16, fontWeight: '500',
    color: '#1A1A1A', height: '100%',
  },
  clearBtn: { padding: 10 },
  clearCircle: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#C0C0C0',
    justifyContent: 'center', alignItems: 'center',
  },

  // Loading
  loadingBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 12,
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  loadingText: { marginLeft: 10, fontSize: 13, color: '#888', fontWeight: '500' },

  // Section label
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: '#BABABA',
    letterSpacing: 0.8, marginTop: 20,
    marginBottom: 4, marginHorizontal: 20,
  },

  // Result items
  separator: { height: 1, backgroundColor: '#F8F8F8', marginLeft: 72 },
  resultItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 20,
  },
  resultIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F5F5F0',
    justifyContent: 'center', alignItems: 'center',
    marginRight: 14,
  },
  resultIconQuick: { backgroundColor: '#F0F0F0' },
  resultText: { flex: 1, marginRight: 6 },
  resultMain: { fontSize: 15, fontWeight: '600', color: '#1A1A1A', marginBottom: 2 },
  resultSub:  { fontSize: 13, color: '#BABABA' },

  // Empty state
  emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#F5F5F0',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A1A', marginBottom: 6 },
  emptySub:   { fontSize: 14, color: '#BABABA', textAlign: 'center', lineHeight: 20 },
});