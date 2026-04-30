import React from 'react';
import { View } from 'react-native';
import AnimatedTabScene from '../../components/AnimatedTabScene';
import { useTheme } from '../../utils/theme';

export default function HolaTab() {
  const { colors } = useTheme();

  return (
    <AnimatedTabScene>
      <View style={{ flex: 1, backgroundColor: colors.shell }} />
    </AnimatedTabScene>
  );
}
