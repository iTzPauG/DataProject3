import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../utils/theme';

type Variant = 'default' | 'hero';

export default function Atmosphere({ variant = 'default' }: { variant?: Variant }) {
  const { colors } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    blob: {
      position: 'absolute',
      borderRadius: 240,
      opacity: 0.28,
    },
    blobTop: {
      width: 320,
      height: 320,
      backgroundColor: '#7FD8D1',
      top: -140,
      left: -80,
    },
    blobMid: {
      width: 260,
      height: 260,
      backgroundColor: '#AEE9E1',
      top: 120,
      right: -80,
    },
    blobBottom: {
      width: 360,
      height: 360,
      backgroundColor: '#FBD5C4',
      bottom: -200,
      left: -140,
    },
    haze: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.shell,
      opacity: 0.85,
    },
    heroTop: {
      opacity: 0.36,
    },
    heroMid: {
      opacity: 0.34,
    },
    heroBottom: {
      opacity: 0.3,
    },
  }), [colors]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.blob, styles.blobTop, variant === 'hero' && styles.heroTop]} />
      <View style={[styles.blob, styles.blobMid, variant === 'hero' && styles.heroMid]} />
      <View style={[styles.blob, styles.blobBottom, variant === 'hero' && styles.heroBottom]} />
      <View style={styles.haze} />
    </View>
  );
}

