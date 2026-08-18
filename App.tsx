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
  AppState,
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
import * as NavigationBar from 'expo-navigation-bar';
import * as Notifications from 'expo-notifications';
import {
  LayoutDashboard,
  CreditCard,
  Armchair,
  FileSpreadsheet,
  ShoppingBag,
  Bell,
  ArrowRight,
  X,
} from 'lucide-react-native';

// Safe notification handler initialization
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
} catch (err) {
  console.warn('NotificationHandler init skipped:', err);
}

type TabType = 'DASHBOARD' | 'SALES' | 'TRIPS' | 'ACCOUNTING';

interface NewSaleAlert {
  id: string;
  nombres: string;
  apellidos: string;
  asiento: number;
  monto: number;
  metodo: string;
}

const MainNavigator: React.FC = () => {
  const { user, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState<TabType>('DASHBOARD');
  const [isDirectSaleOpen, setIsDirectSaleOpen] = useState(false);
  const [isCreateTripOpen, setIsCreateTripOpen] = useState(false);
  const [pendingBadgeCount, setPendingBadgeCount] = useState(0);

  // In-app alert banner
  const [newSaleAlert, setNewSaleAlert] = useState<NewSaleAlert | null>(null);

  // Safe Android Navigation Bar Auto-Hide
  const hideAndroidNavBar = async () => {
    if (Platform.OS === 'android') {
      try {
        await NavigationBar.setVisibilityAsync('hidden').catch(() => {});
        await NavigationBar.setBehaviorAsync('overlay-swipe').catch(() => {});
      } catch (_e) {}
    }
  };

  // Setup Android Notification Channel and permissions safely
  useEffect(() => {
    const setupNotifications = async () => {
      try {
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('ventas-alertas', {
            name: 'Alertas de Ventas',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 300, 200, 300],
            lightColor: '#742284',
            sound: 'default',
            enableVibrate: true,
            showBadge: true,
          }).catch((err) => console.warn('setNotificationChannel error:', err));
        }
        await Notifications.requestPermissionsAsync().catch(() => {});
      } catch (e) {
        console.warn('Error configurando notificaciones:', e);
      }
    };

    setupNotifications();
    hideAndroidNavBar();

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        hideAndroidNavBar();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [user]);

  // Recalculate pending sales count accurately
  const refreshPendingCount = async () => {
    try {
      const { data, error } = await supabase
        .from('ventas')
        .select('id, culqi_charge_id, comprobante_emitido, estado');

      if (!error && data) {
        const pending = data.filter(
          (v: any) =>
            !v.comprobante_emitido &&
            v.estado !== 'CONFIRMADO' &&
            v.estado !== 'RECHAZADO' &&
            !v.culqi_charge_id?.startsWith('RECHAZADO_')
        );
        setPendingBadgeCount(pending.length);
      }
    } catch (e) {
      console.warn('Error actualizando contador de ventas:', e);
    }
  };

  // Supabase Realtime Listener for new incoming sales, confirmations, and rejections
  useEffect(() => {
    if (!user) return;

    refreshPendingCount();

    // Subscribe to all changes on ventas table in realtime
    const channel = supabase
      .channel('android-admin-ventas-sync')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ventas' },
        async (payload: any) => {
          const newVenta = payload.new;
          if (!newVenta) return;

          refreshPendingCount();

          // Trigger System Push Notification with Sound & Vibration
          try {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: '🔔 ¡Nueva Venta por Confirmar!',
                body: `${newVenta.nombres || 'Pasajero'} reservó Asiento #${newVenta.numero_asiento || ''} (S/ ${Number(
                  newVenta.monto_pagado || 50
                ).toFixed(2)}) vía ${newVenta.metodo_pago || 'YAPE'}`,
                sound: 'default',
                channelId: 'ventas-alertas',
                priority: Notifications.AndroidNotificationPriority.MAX,
              },
              trigger: null,
            }).catch((err) => console.warn('scheduleNotification error:', err));
          } catch (e) {
            console.warn('Error enviando notificación push:', e);
          }

          // Trigger Haptic Vibration
          try {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          } catch (_e) {}

          // Show floating in-app banner
          setNewSaleAlert({
            id: newVenta.id,
            nombres: newVenta.nombres || 'Cliente',
            apellidos: newVenta.apellidos || '',
            asiento: newVenta.numero_asiento || 1,
            monto: Number(newVenta.monto_pagado || 50),
            metodo: newVenta.metodo_pago || 'YAPE',
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'ventas' },
        () => {
          refreshPendingCount();
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'ventas' },
        () => {
          refreshPendingCount();
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

      {/* Floating Realtime Sale Alert Banner */}
      {newSaleAlert && (
        <View style={styles.floatingAlertBanner}>
          <View style={styles.alertIconCircle}>
            <Bell size={18} color="#FFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.alertTitle}>¡Nueva Venta Recibida!</Text>
            <Text style={styles.alertSubtitle}>
              {newSaleAlert.nombres} {newSaleAlert.apellidos} • Asiento #{newSaleAlert.asiento} (S/ {newSaleAlert.monto.toFixed(2)})
            </Text>
          </View>
          <TouchableOpacity
            style={styles.alertActionBtn}
            onPress={() => {
              setNewSaleAlert(null);
              setCurrentTab('SALES');
            }}
          >
            <Text style={styles.alertActionText}>Ver</Text>
            <ArrowRight size={14} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.alertCloseBtn}
            onPress={() => setNewSaleAlert(null)}
          >
            <X size={16} color="#FFF" />
          </TouchableOpacity>
        </View>
      )}

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
            Haptics.selectionAsync().catch(() => {});
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
            Haptics.selectionAsync().catch(() => {});
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
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
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
            Haptics.selectionAsync().catch(() => {});
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
            Haptics.selectionAsync().catch(() => {});
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
          refreshPendingCount();
        }}
      />

      <CreateTripModal
        visible={isCreateTripOpen}
        onClose={() => setIsCreateTripOpen(false)}
        onTripCreated={() => {}}
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
  floatingAlertBanner: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    zIndex: 9999,
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: THEME.colors.primary,
    ...THEME.shadows.lg,
  },
  alertIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertTitle: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
  alertSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  alertActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  alertActionText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  alertCloseBtn: {
    padding: 4,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: THEME.colors.surface,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'android' ? 12 : 8,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
    height: 68,
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
