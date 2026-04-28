import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { BASE_URL, getCurrentLocation } from '../services/api';
import { useTheme } from '../utils/theme';
import GADOIcon from './GADOIcon';
import Icon from './Icon';

function distKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtDist(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

function matchScore(name: string, q: string): number {
  const n = name.toLowerCase();
  const query = q.toLowerCase().trim();
  if (n === query) return 0;
  if (n.startsWith(query)) return 1;
  if (n.includes(query)) return 2;
  return 3;
}

interface SearchResult {
  id: string;
  name: string;
  address?: string;
  category_id?: string;
  item_type: string;
  lat: number;
  lng: number;
  metadata?: { photo_url?: string; rating?: number };
  _dist?: number;
}

export const FloatingSearch = () => {
  const { t } = useTranslation();
  const { colors, typography, shadows, radii } = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const userPos = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    getCurrentLocation()
      .then((pos) => { userPos.current = pos; })
      .catch(() => {});
  }, []);

  const showResults = focused && (results.length > 0 || loading);
  useEffect(() => {
    Animated.spring(overlayAnim, {
      toValue: showResults ? 1 : 0,
      useNativeDriver: false,
      damping: 24,
      stiffness: 240,
    }).start();
  }, [showResults, overlayAnim]);

  const search = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) { setResults([]); return; }

    setLoading(true);
    try {
      const pos = userPos.current ?? await getCurrentLocation();
      userPos.current = pos;

      const url =
        `${BASE_URL}/search/universal` +
        `?q=${encodeURIComponent(trimmed)}` +
        `&lat=${pos.lat}&lng=${pos.lng}` +
        `&radius_m=8000&use_brain=false`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const withDist: SearchResult[] = (data.results ?? []).map((r: SearchResult) => ({
        ...r,
        _dist: distKm(pos.lat, pos.lng, r.lat ?? pos.lat, r.lng ?? pos.lng),
      }));
      withDist.sort((a, b) => {
        const ms = matchScore(a.name, trimmed) - matchScore(b.name, trimmed);
        if (ms !== 0) return ms;
        return (a._dist ?? 99) - (b._dist ?? 99);
      });

      setResults(withDist);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(() => search(text), 350);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
  };

  const handleSelect = (item: SearchResult) => {
    handleClear();
    setFocused(false);
    if (item.item_type === 'event') {
      router.push({ pathname: '/(modals)/event-details', params: { id: item.id } });
    } else {
      router.push({ pathname: '/(flow)/details', params: { id: item.id } });
    }
  };

  const translateY = overlayAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0],
  });
  const opacity = overlayAnim;

  return (
    <View style={styles.root}>
      {focused && (
        <Animated.View
          style={[
            styles.overlay,
            { backgroundColor: colors.surface, ...shadows.lift, borderColor: colors.stroke, borderWidth: 1 },
            { opacity, transform: [{ translateY }] },
          ]}
          pointerEvents={showResults ? 'box-none' : 'none'}
        >
          {loading && (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.brand} />
              <Text style={[styles.loadingText, { color: colors.inkMuted, fontFamily: typography.body }]}>
                {t('common.loading')}
              </Text>
            </View>
          )}
          <FlatList
            data={results}
            keyExtractor={(item, i) => item.id ?? String(i)}
            keyboardShouldPersistTaps="always"
            showsVerticalScrollIndicator={false}
            style={{ maxHeight: 340 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.resultRow, { borderBottomColor: colors.stroke }]}
                onPress={() => handleSelect(item)}
                activeOpacity={0.72}
              >
                <View style={[styles.iconBox, { backgroundColor: colors.bg, borderColor: colors.stroke, borderWidth: 1 }]}>
                  <GADOIcon name={item.category_id ?? 'explore'} category={item.item_type as any} size={18} color={colors.brand} />
                </View>
                <View style={styles.resultInfo}>
                  <Text style={[styles.resultName, { color: colors.ink, fontFamily: typography.heading }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.address ? (
                    <Text style={[styles.resultAddress, { color: colors.inkMuted, fontFamily: typography.body }]} numberOfLines={1}>
                      {item.address}
                    </Text>
                  ) : null}
                </View>
                {item._dist != null && (
                  <Text style={[styles.dist, { color: colors.inkMuted, fontFamily: typography.mono }]}>
                    {fmtDist(item._dist)}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          />
        </Animated.View>
      )}

      <View style={[styles.bar, { backgroundColor: colors.surface, borderTopColor: colors.stroke }]}>
        <View style={[styles.inputWrap, { backgroundColor: colors.bg, borderColor: colors.strokeStrong }]}>
          <Icon name="search" size={16} color={colors.inkMuted} strokeWidth={2} />
          <TextInput
            placeholder={t('home.searchPlaceholder')}
            placeholderTextColor={colors.inkFaint}
            value={query}
            onChangeText={handleChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 200)}
            onSubmitEditing={() => {
              if (debounceRef.current) clearTimeout(debounceRef.current);
              search(query);
            }}
            returnKeyType="search"
            style={[styles.input, { color: colors.ink, fontFamily: typography.body }]}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={handleClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
               <Icon name="close" size={14} color={colors.inkMuted} strokeWidth={2.5} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const TAB_H = Platform.OS === 'ios' ? 90 : Platform.OS === 'web' ? 65 : 70;

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: TAB_H,
    zIndex: 150,
  },
  overlay: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: '100%',
    marginBottom: 12,
    borderRadius: 24,
    overflow: 'hidden',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  loadingText: { fontSize: 14, fontWeight: '600' },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultInfo: { flex: 1 },
  resultName: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  resultAddress: { fontSize: 12 },
  dist: { fontSize: 11, fontWeight: '700' },
  bar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    gap: 10,
  },
  input: { flex: 1, fontSize: 15, fontWeight: '500' },
});
