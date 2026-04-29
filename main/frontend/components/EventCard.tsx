import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { formatTimeAgo } from '../utils/format';
import { useTheme } from '../utils/theme';

interface EventCardProps {
  event: {
    id: string;
    title: string;
    description: string;
    date: string;
    location: string;
    category: string;
    image?: string;
  };
  onPress: () => void;
}

export const EventCard: React.FC<EventCardProps> = ({ event, onPress }) => {
  const { colors, radii, shadows, typography } = useTheme();
  const formattedDate = formatTimeAgo(event.date);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      backgroundColor: colors.surface,
      borderRadius: radii.md,
      padding: 16,
      marginVertical: 8,
      marginHorizontal: 16,
      ...shadows.soft,
    },
    content: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    title: {
      fontSize: 18,
      fontWeight: 'bold',
      fontFamily: typography.heading,
      color: colors.ink,
    },
    category: {
      fontSize: 12,
      fontFamily: typography.body,
      color: colors.inkMuted,
      backgroundColor: colors.chip,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radii.sm,
    },
    description: {
      fontSize: 14,
      fontFamily: typography.body,
      color: colors.inkMuted,
      marginBottom: 8,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    date: {
      fontSize: 12,
      fontFamily: typography.body,
      color: colors.inkMuted,
    },
    location: {
      fontSize: 12,
      fontFamily: typography.body,
      color: colors.inkMuted,
    },
  }), [colors, radii, shadows, typography]);

  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>{event.title}</Text>
          <Text style={styles.category}>{event.category}</Text>
        </View>
        <Text style={styles.description} numberOfLines={2}>
          {event.description}
        </Text>
        <View style={styles.footer}>
          <Text style={styles.date}>{formattedDate}</Text>
          <Text style={styles.location}>{event.location}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};