import React, { useMemo } from 'react';
import { StyleSheet, Text, View, Image, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../utils/theme';

interface UniversalHeaderProps {
  showBack?: boolean;
  title?: string;
  transparent?: boolean;
}

export const UniversalHeader: React.FC<UniversalHeaderProps> = ({
  showBack = false,
  title,
  transparent = false,
}) => {
  const { colors, radii, shadows, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const styles = useMemo(() => StyleSheet.create({
    header: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.stroke,
      paddingBottom: 12,
      zIndex: 100,
    },
    transparent: {
      backgroundColor: 'transparent',
      borderBottomWidth: 0,
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
    },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.shell,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backText: {
      fontSize: 24,
      color: colors.ink,
      fontWeight: '300',
    },
    placeholder: {
      width: 40,
    },
    centerContainer: {
      flex: 1,
      alignItems: 'center',
    },
    titleText: {
      fontSize: 18,
      fontWeight: '700',
      fontFamily: typography.heading,
      color: colors.ink,
    },
    logoContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      paddingHorizontal: 16,
      paddingVertical: 6,
      borderRadius: radii.pill,
      ...shadows.soft,
    },
    logo: {
      width: 24,
      height: 24,
      marginRight: 8,
    },
    logoText: {
      fontSize: 18,
      fontWeight: '900',
      fontFamily: typography.heading,
      color: colors.ink,
      letterSpacing: 2,
    },
  }), [colors, radii, shadows, typography]);

  return (
    <View
      style={[
        styles.header,
        { paddingTop: insets.top + 8 },
        transparent && styles.transparent,
      ]}
    >
      <View style={styles.content}>
        {showBack ? (
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.placeholder} />
        )}

        <View style={styles.centerContainer}>
          {title ? (
            <Text style={styles.titleText}>{title}</Text>
          ) : (
            <View style={styles.logoContainer}>
              <Image
                source={require('../assets/LOGO.png')}
                style={styles.logo}
                resizeMode="contain"
              />
              <Text style={styles.logoText}>GADO</Text>
            </View>
          )}
        </View>

        <View style={styles.placeholder} />
      </View>
    </View>
  );
};

