import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { styles } from './NavBar.styles';

export type NavItem = {
  label: string;
  route: string;
  icon: keyof typeof MaterialIcons.glyphMap;
};

export type NavBarProps = {
  navItems: NavItem[];
  onNavigate?: (route: string) => void;
  onClose?: () => void;
  title?: string;
  defaultVisible?: boolean;
};

const COLLAPSED_HEIGHT = 0;
const OPEN_HEIGHT = 220;

export function NavBar({ navItems, onNavigate, title = 'Menu', defaultVisible = true }: NavBarProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [isNavVisible, setIsNavVisible] = useState(defaultVisible);
  const animation = useRef(new Animated.Value(defaultVisible ? OPEN_HEIGHT : COLLAPSED_HEIGHT)).current;

  useEffect(() => {
    Animated.timing(animation, {
      toValue: isNavVisible ? OPEN_HEIGHT : COLLAPSED_HEIGHT,
      duration: 240,
      useNativeDriver: false,
    }).start();
  }, [animation, isNavVisible]);

  const handleToggle = () => setIsNavVisible((value) => !value);

  return (
    <View style={{ paddingTop: Platform.OS === 'android' ? insets.top : insets.top, width }}>
      <View style={styles.navContainer}>
        <View style={styles.navHeader}>
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={handleToggle} style={styles.toggleButton} accessibilityRole="button" accessibilityLabel={isNavVisible ? 'Close navigation' : 'Open navigation'}>
            <MaterialIcons
              name={isNavVisible ? 'close' : 'menu'}
              size={26}
              color="#FFFFFF"
            />
          </Pressable>
        </View>

        <Animated.View style={[styles.contentWrapper, { height: animation }]}> 
          <View style={styles.menuList}>
            {navItems.map((item) => (
              <Pressable
                key={item.route}
                style={({ pressed }) => [
                  styles.menuItem,
                  pressed && { opacity: 0.75 },
                ]}
                onPress={() => onNavigate?.(item.route)}
                accessibilityRole="button"
              >
                <MaterialIcons name={item.icon} size={22} color="#FFFFFF" style={styles.icon} />
                <Text style={styles.menuItemText}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      </View>
    </View>
  );
}
