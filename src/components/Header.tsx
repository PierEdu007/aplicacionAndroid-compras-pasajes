import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { THEME } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { LogOut, Shield, User, RefreshCw } from 'lucide-react-native';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  onRefresh,
  isRefreshing,
}) => {
  const { user, role, logout } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.brandRow}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>TC</Text>
          </View>
          <View>
            <Text style={styles.brandName}>TUNKY CHASKY</Text>
            <Text style={styles.brandTag}>Panel Administrativo</Text>
          </View>
        </View>

        <View style={styles.actionsRow}>
          {onRefresh && (
            <TouchableOpacity
              style={styles.iconButton}
              onPress={onRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw size={18} color={THEME.colors.surface} />
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.logoutButton} onPress={logout}>
            <LogOut size={18} color="#FCA5A5" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.titleSection}>
        <View>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>

        <View style={styles.roleBadge}>
          <Shield size={12} color={THEME.colors.accent} />
          <Text style={styles.roleText}>{role || 'ADMIN'}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: THEME.colors.primary,
    paddingTop: 45,
    paddingBottom: 16,
    paddingHorizontal: 18,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    ...THEME.shadows.md,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: THEME.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    color: THEME.colors.surface,
    fontWeight: '900',
    fontSize: 16,
  },
  brandName: {
    color: THEME.colors.surface,
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.8,
  },
  brandTag: {
    color: THEME.colors.accentLight,
    fontSize: 11,
    fontWeight: '500',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  title: {
    color: THEME.colors.surface,
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginTop: 2,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 174, 239, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 174, 239, 0.4)',
  },
  roleText: {
    color: THEME.colors.accentLight,
    fontSize: 10,
    fontWeight: '700',
  },
});
