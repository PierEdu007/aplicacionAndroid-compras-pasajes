import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { THEME } from './src/constants/theme';
import { LoginScreen } from './src/screens/LoginScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { SalesScreen } from './src/screens/SalesScreen';
import { TripsScreen } from './src/screens/TripsScreen';
import { AccountingScreen } from './src/screens/AccountingScreen';
import { DirectSaleModal } from './src/components/DirectSaleModal';
import { CreateTripModal } from './src/components/CreateTripModal';
import { supabase } from './src/lib/supabase';
import * as Haptics from 'expo-haptics';
import {
  LayoutDashboard,
  CreditCard,
  Armchair,
  FileSpreadsheet,
  Plus,
  ShoppingBag,
} from 'lucide-react-native';

type TabType = 'DASHBOARD' | 'SALES' | 'TRIPS' | 'ACCOUNTING';

const MainNavigator: React.FC = () => {
  const { user, loading, isContador, isVendedor, isAdmin } = useAuth();
  const [currentTab, setCurrentTab] = useState<TabType>('DASHBOARD');
  const [isDirectSaleOpen, setIsDirectSaleOpen] = useState(false);
  const [isCreateTripOpen, setIsCreateTripOpen] = useState(false);
  const [pendingBadgeCount, setPendingBadgeCount] = useState(0);

  // Supabase Realtime Listener for new incoming sales from Web
  useEffect(() => {
    if (!user) return;

    // Load initial pending count
    const loadInitialPending = async () => {
      const { data } = await supabase
        .from('ventas')
        .select('id')
        .eq('comprobante_emitido', false);

      if (data) setPendingBadgeCount(data.length);
    };

    loadInitialPending();

    // Subscribe to new sales in realtime
    const channel = supabase
      .channel('android-admin-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ventas' },
        (payload) => {
          console.log('⚡ Nueva venta recibida en tiempo real:', payload);
          setPendingBadgeCount((prev) => prev + 1);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={THEME.colors.primary} />
        <Text style={styles.loadingText}>Iniciando Tunky Chasky Móvil...</Text>
      </View>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.colors.primary} />

      {/* Screen Content */}
      <View style={styles.contentContainer}>
        {currentTab === 'DASHBOARD' && (
          <DashboardScreen
            onNavigateToSales={() => setCurrentTab('SALES')}
            onNavigateToTrips={() => setCurrentTab('TRIPS')}
            onOpenDirectSale={() => setIsDirectSaleOpen(true)}
            onOpenCreateTrip={() => setIsCreateTripOpen(true)}
          />
        )}
        {currentTab === 'SALES' && (
          <SalesScreen onOpenDirectSale={() => setIsDirectSaleOpen(true)} />
        )}
        {currentTab === 'TRIPS' && <TripsScreen />}
        {currentTab === 'ACCOUNTING' && <AccountingScreen />}
      </View>

      {/* Bottom Tab Navigation Bar */}
      <View style={styles.bottomBar}>
        {/* Tab 1: Dashboard */}
        <TouchableOpacity
          style={styles.tabButton}
          onPress={() => {
            setCurrentTab('DASHBOARD');
            Haptics.selectionAsync();
          }}
        >
          <LayoutDashboard
            size={22}
            color={currentTab === 'DASHBOARD' ? THEME.colors.primary : THEME.colors.textMuted}
          />
          <Text
            style={[
              styles.tabLabel,
              currentTab === 'DASHBOARD' && styles.tabLabelActive,
            ]}
          >
            Inicio
          </Text>
        </TouchableOpacity>

        {/* Tab 2: Ventas */}
        <TouchableOpacity
          style={styles.tabButton}
          onPress={() => {
            setCurrentTab('SALES');
            Haptics.selectionAsync();
          }}
        >
          <View>
            <CreditCard
              size={22}
              color={currentTab === 'SALES' ? THEME.colors.primary : THEME.colors.textMuted}
            />
            {pendingBadgeCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendingBadgeCount}</Text>
              </View>
            )}
          </View>
          <Text
            style={[
              styles.tabLabel,
              currentTab === 'SALES' && styles.tabLabelActive,
            ]}
          >
            Ventas
          </Text>
        </TouchableOpacity>

        {/* Floating Center Button: Vender en Agencia */}
        <TouchableOpacity
          style={styles.centerFab}
          onPress={() => {
            setIsDirectSaleOpen(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }}
        >
          <ShoppingBag size={24} color="#FFF" />
          <Text style={styles.centerFabLabel}>Vender</Text>
        </TouchableOpacity>

        {/* Tab 3: Salidas / Viajes */}
        <TouchableOpacity
          style={styles.tabButton}
          onPress={() => {
            setCurrentTab('TRIPS');
            Haptics.selectionAsync();
          }}
        >
          <Armchair
            size={22}
            color={currentTab === 'TRIPS' ? THEME.colors.primary : THEME.colors.textMuted}
          />
          <Text
            style={[
              styles.tabLabel,
              currentTab === 'TRIPS' && styles.tabLabelActive,
            ]}
          >
            Salidas
          </Text>
        </TouchableOpacity>

        {/* Tab 4: Contabilidad */}
        <TouchableOpacity
          style={styles.tabButton}
          onPress={() => {
            setCurrentTab('ACCOUNTING');
            Haptics.selectionAsync();
          }}
        >
          <FileSpreadsheet
            size={22}
            color={currentTab === 'ACCOUNTING' ? THEME.colors.primary : THEME.colors.textMuted}
          />
          <Text
            style={[
              styles.tabLabel,
              currentTab === 'ACCOUNTING' && styles.tabLabelActive,
            ]}
          >
            Contable
          </Text>
        </TouchableOpacity>
      </View>

      {/* Global Modals */}
      <DirectSaleModal
        visible={isDirectSaleOpen}
        onClose={() => setIsDirectSaleOpen(false)}
        onSaleComplete={() => {
          // Refresh trigger
        }}
      />

      <CreateTripModal
        visible={isCreateTripOpen}
        onClose={() => setIsCreateTripOpen(false)}
        onTripCreated={() => {
          // Refresh trigger
        }}
      />
    </SafeAreaView>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainNavigator />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.colors.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.colors.background,
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
  },
  contentContainer: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: THEME.colors.surface,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
    height: 64,
    ...THEME.shadows.lg,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
  tabLabelActive: {
    color: THEME.colors.primary,
    fontWeight: '800',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: THEME.colors.danger,
    borderRadius: 9,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '800',
  },
  centerFab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: THEME.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -22,
    borderWidth: 3,
    borderColor: THEME.colors.surface,
    ...THEME.shadows.md,
  },
  centerFabLabel: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '800',
    marginTop: 1,
  },
});
