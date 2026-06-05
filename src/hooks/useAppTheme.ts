import { useColorScheme } from 'react-native';
import { Colors } from '../theme/colors';
import { useAppStore } from '../store/useAppStore';

export function useAppTheme() {
  const colorScheme = useColorScheme();
  const themeMode = useAppStore(s => s.themeMode);
  
  const isDark = themeMode === 'system' ? colorScheme === 'dark' : themeMode === 'dark';
  
  return {
    isDark,
    colors: isDark ? Colors.dark : Colors.light,
  };
}
