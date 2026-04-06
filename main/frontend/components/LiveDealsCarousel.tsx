import React, { useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, Easing } from 'react-native-reanimated';
import { useTheme } from '../utils/theme'; // Ajusta la ruta a tu theme
import { useLiveDeals, LiveDeal } from '../hooks/useLiveDeals';

const { width } = Dimensions.get('window');

export default function LiveDealsCarousel() {
  const { colors, typography } = useTheme();
  const { deals, loading } = useLiveDeals();
  const dotOpacity = useSharedValue(1);

  // Animación del puntito rojo "En vivo"
  useEffect(() => {
    dotOpacity.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration: 500, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const animatedDotStyle = useAnimatedStyle(() => ({
    opacity: dotOpacity.value,
  }));

  // Si no hay ofertas activas y ya cargó, devolvemos null para no ocupar espacio en la pantalla principal
  if (!loading && deals.length === 0) {
    return null;
  }

  const renderItem = ({ item }: { item: LiveDeal }) => {
    // Formatear hora (ej. 14:30)
    const timeString = new Date(item.available_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
      <TouchableOpacity style={[styles.card, { backgroundColor: colors.surface }]} activeOpacity={0.8}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cuisine, { color: colors.brand }]}>{item.cuisine}</Text>
          <Text style={[styles.price, { color: colors.ink }]}>{item.price}€</Text>
        </View>
        
        <Text style={[styles.description, { color: colors.inkMuted, fontFamily: typography.body }]} numberOfLines={2}>
          {item.description || 'Oferta de última hora disponible.'}
        </Text>

        <View style={styles.cardFooter}>
          <Text style={[styles.footerText, { color: colors.ink }]}>⏰ Hoy a las {timeString}</Text>
          <Text style={[styles.footerText, { color: '#EF4444', fontWeight: 'bold' }]}>🔥 {item.seats} plazas</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Animated.View style={[styles.liveDot, animatedDotStyle]} />
        <Text style={[styles.title, { color: colors.ink, fontFamily: typography.heading }]}>
          Ofertas Flash (En Vivo)
        </Text>
      </View>

      <FlatList
        data={deals}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        snapToInterval={width * 0.7 + 16} // Ancho tarjeta + gap
        decelerationRate="fast"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444', // Rojo alerta
    marginRight: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 16,
    gap: 16,
  },
  card: {
    width: width * 0.7, // 70% del ancho de la pantalla
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cuisine: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  price: {
    fontSize: 20,
    fontWeight: '800',
  },
  description: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto',
  },
  footerText: {
    fontSize: 13,
  },
});