import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import BottomSheet, { 
  BottomSheetBackdrop, 
  BottomSheetScrollView, 
  BottomSheetProps as GorhomBottomSheetProps
} from '@gorhom/bottom-sheet';
import { useTheme } from '../../../utils/theme';

interface AppBottomSheetProps extends Omit<GorhomBottomSheetProps, 'children'> {
  header?: React.ReactNode;
  children: React.ReactNode;
}

export const AppBottomSheet = ({ header, children, ...props }: AppBottomSheetProps) => {
  const { colors } = useTheme();

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={1}
        disappearsOnIndex={0}
        opacity={0.5}
      />
    ),
    []
  );

  return (
    <BottomSheet
      {...props}
      backdropComponent={renderBackdrop}
      backgroundStyle={[styles.background, { backgroundColor: colors.surface }]}
      handleIndicatorStyle={{ backgroundColor: colors.stroke }}
      enableOverDrag={false}
      enablePanDownToClose={false}
    >
      {header && <View style={styles.header}>{header}</View>}
      <BottomSheetScrollView
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        activeOffsetY={[-5, 5]}
        failOffsetY={[-5, 5]}
      >
        {children}
      </BottomSheetScrollView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  background: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 16,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
});
