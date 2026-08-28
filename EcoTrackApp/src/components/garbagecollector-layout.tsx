import { Link, Slot, useRouter, useSegments } from 'expo-router';
import { Animated, Pressable, SafeAreaView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { Spacing } from '@/constants/theme';

const menuItems = [
  { label: 'Main', href: '/garbagecollector', segment: 'garbagecollector' },
  { label: 'Quick Scan', href: '/garbagecollector/quick-scan', segment: 'quick-scan' },
  { label: 'Activity Logs', href: '/garbagecollector/activity-logs', segment: 'activity-logs' },
  { label: 'Reports', href: '/garbagecollector/reports', segment: 'reports' },
];

export default function GarbageCollectorLayout() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuAnim = useRef(new Animated.Value(-260)).current;
  const segments = useSegments();
  const activeSegment = segments[segments.length - 1] ?? 'garbagecollector';

  useEffect(() => {
    Animated.timing(menuAnim, {
      toValue: isMenuOpen ? 0 : -260,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [isMenuOpen, menuAnim]);

  const isActive = (segment: string) =>
    segment === 'garbagecollector'
      ? segments.length === 1 || activeSegment === 'garbagecollector'
      : activeSegment === segment;

  const handleNavigate = (href: string) => {
    setIsMenuOpen(false);
    router.push(href as any);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <Pressable style={styles.menuButton} onPress={() => setIsMenuOpen((value) => !value)}>
          <MaterialIcons name={isMenuOpen ? 'close' : 'menu'} size={22} color="#FFFFFF" />
        </Pressable>
        <View style={styles.brandBlock}>
          <Text style={styles.headerTitle}>EcoTrack</Text>
          <Text style={styles.headerSubtitle}>Garbage Collector Portal</Text>
        </View>
      </View>

      {isMobile && isMenuOpen ? (
        <>
          <Pressable style={styles.menuOverlay} onPress={() => setIsMenuOpen(false)} />
          <Animated.View style={[styles.mobileMenuContainer, { transform: [{ translateX: menuAnim }] }]}> 
            <View style={styles.mobileMenuContent}>
              <View style={styles.mobileMenuHeader}>
                <Text style={styles.menuTitle}>EcoTrack</Text>
                <Text style={styles.menuSubtitle}>Garbage Collector Portal</Text>
              </View>

              {menuItems.map((item) => (
                <Pressable
                  key={item.href}
                  style={({ pressed }) => [
                    styles.navItem,
                    isActive(item.segment) && styles.navItemActive,
                    pressed && styles.pressedItem,
                  ]}
                  onPress={() => handleNavigate(item.href)}
                >
                  <Text style={styles.navItemText}>{item.label}</Text>
                </Pressable>
              ))}

              <Pressable
                style={styles.logoutButton}
                onPress={() => {
                  setIsMenuOpen(false);
                  router.push('/garbagecollector/logout');
                }}
              >
                <Text style={styles.logoutText}>Logout</Text>
              </Pressable>
            </View>
          </Animated.View>
        </>
      ) : null}

      <View style={[styles.container, isMobile && styles.containerMobile]}>
        {!isMobile ? (
          <View style={styles.navPane}>
            <View style={styles.brandBlock}>
              <Text style={styles.headerTitle}>EcoTrack</Text>
              <Text style={styles.headerSubtitle}>Garbage Collector Portal</Text>
            </View>

            <View style={styles.menuList}>
              {menuItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href as any}
                  style={[
                    styles.navItem,
                    isActive(item.segment) && styles.navItemActive,
                  ]}
                >
                  {item.label}
                </Link>
              ))}
            </View>

            <Pressable style={styles.logoutButton} onPress={() => router.push('/garbagecollector/logout')}>
              <Text style={styles.logoutText}>Logout</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={[styles.contentPane, isMobile && styles.contentPaneMobile]}>
          <View style={styles.contentCard}>
            <Slot />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F2F2F2',
  },
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  containerMobile: {
    flexDirection: 'column',
  },
  navPane: {
    width: 220,
    backgroundColor: '#1F7A37',
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.four,
    justifyContent: 'space-between',
    borderTopRightRadius: 32,
    borderBottomRightRadius: 32,
  },
  navPaneMobile: {
    width: '100%',
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.four,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomLeftRadius: 0,
  },
  topBar: {
    backgroundColor: '#1F7A37',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  brandBlock: {
    gap: Spacing.two,
  },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
  },
  headerSubtitle: {
    color: '#D6F3D1',
    marginTop: 8,
    fontSize: 14,
  },
  menuList: {
    marginTop: Spacing.four,
    gap: Spacing.three,
  },
  navItem: {
    color: '#D6F3D1',
    fontWeight: '700',
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginTop: Spacing.two,
  },
  navItemText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  navItemActive: {
    color: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  pressedItem: {
    opacity: 0.8,
  },
  mobileMenuContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 260,
    backgroundColor: '#1F7A37',
    zIndex: 11,
    paddingTop: 24,
  },
  mobileMenuContent: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  menuOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.24)',
    zIndex: 10,
  },
  mobileMenuHeader: {
    marginBottom: 14,
  },
  menuTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 4,
  },
  menuSubtitle: {
    color: '#D6F3D1',
    fontSize: 14,
  },
  navItemMobile: {
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: 14,
  },
  logoutButton: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: Spacing.two,
    backgroundColor: '#0F2A12',
    borderRadius: 14,
    alignItems: 'center',
  },
  logoutButtonMobile: {
    width: '100%',
    marginTop: Spacing.three,
  },
  logoutText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  contentPane: {
    flex: 1,
    backgroundColor: '#F2F2F2',
    padding: Spacing.four,
  },
  contentPaneMobile: {
    width: '100%',
    padding: Spacing.four,
  },
  contentCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    padding: Spacing.four,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
});
