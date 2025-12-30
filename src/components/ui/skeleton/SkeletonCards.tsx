import React from 'react';
import { View, StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import { Skeleton } from 'moti/skeleton';
import { colors } from '../../../theme/colors';

const SkeletonBase = ({ children }: { children: React.ReactNode }) => (
  <View style={styles.card}>
    {children}
  </View>
);

export const SkeletonPersonCard = () => (
  <SkeletonBase>
    <View style={styles.header}>
      <Skeleton colorMode="light" radius="round" height={64} width={64} />
      <View style={styles.headerInfo}>
        <Skeleton colorMode="light" width="60%" height={20} />
        <View style={{ height: 8 }} />
        <Skeleton colorMode="light" width="80%" height={16} />
        <View style={{ height: 8 }} />
        <Skeleton colorMode="light" width="40%" height={14} />
      </View>
    </View>
    <View style={styles.stats}>
      <Skeleton colorMode="light" width={80} height={48} radius={12} />
      <Skeleton colorMode="light" width={80} height={48} radius={12} />
      <Skeleton colorMode="light" width={80} height={48} radius={12} />
    </View>
    <View style={styles.highlights}>
      <Skeleton colorMode="light" width={100} height={24} radius={12} />
      <Skeleton colorMode="light" width={80} height={24} radius={12} />
      <Skeleton colorMode="light" width={90} height={24} radius={12} />
    </View>
  </SkeletonBase>
);

export const SkeletonCompanyCard = () => (
  <SkeletonBase>
    <View style={styles.header}>
      <Skeleton colorMode="light" radius={12} height={56} width={56} />
      <View style={styles.headerInfo}>
        <Skeleton colorMode="light" width="50%" height={20} />
        <View style={{ height: 8 }} />
        <Skeleton colorMode="light" width="70%" height={16} />
      </View>
    </View>
    <View style={styles.stats}>
      <Skeleton colorMode="light" width="100%" height={60} radius={16} />
    </View>
  </SkeletonBase>
);

export const SkeletonSignalCard = () => (
  <SkeletonBase>
    <View style={styles.header}>
      <Skeleton colorMode="light" radius={8} height={40} width={40} />
      <View style={styles.headerInfo}>
        <Skeleton colorMode="light" width="40%" height={16} />
        <View style={{ height: 4 }} />
        <Skeleton colorMode="light" width="60%" height={12} />
      </View>
      <Skeleton colorMode="light" width={60} height={20} radius={10} />
    </View>
    <View style={{ marginTop: 12 }}>
      <Skeleton colorMode="light" width="100%" height={60} radius={8} />
    </View>
  </SkeletonBase>
);

const styles = StyleSheet.create({
  card: {
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  header: {
    flexDirection: 'row',
    gap: 16,
  },
  headerInfo: {
    flex: 1,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  highlights: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  }
});
