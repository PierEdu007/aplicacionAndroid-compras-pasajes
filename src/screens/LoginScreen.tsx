import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { THEME } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { Shield, Lock, Mail, ArrowRight } from 'lucide-react-native';

export const LoginScreen: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Campos requeridos', 'Por favor ingresa tu correo y contraseña.');
      return;
    }

    setLoading(true);
    const result = await login(email, password);
    setLoading(false);

    if (!result.success) {
      Alert.alert('Error de acceso', result.error || 'Credenciales incorrectas o usuario sin acceso.');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Brand Header */}
        <View style={styles.brandBox}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoLetter}>TC</Text>
          </View>
          <Text style={styles.brandTitle}>TUNKY CHASKY</Text>
          <Text style={styles.brandTagline}>SISTEMA ADMINISTRATIVO MÓVIL</Text>
          <View style={styles.securityBadge}>
            <Shield size={12} color={THEME.colors.accent} />
            <Text style={styles.securityText}>Acceso exclusivo para personal autorizado</Text>
          </View>
        </View>

        {/* Login Form */}
        <View style={styles.card}>
          <Text style={styles.formTitle}>Iniciar Sesión</Text>
          <Text style={styles.formSubtitle}>Ingresa con tu cuenta de administrador o vendedor</Text>

          {/* Email Input */}
          <Text style={styles.inputLabel}>Correo Corporativo:</Text>
          <View style={styles.inputRow}>
            <Mail size={18} color={THEME.colors.textMuted} />
            <TextInput
              style={styles.textInput}
              value={email}
              onChangeText={setEmail}
              placeholder="admin@turismotunkychasky.com.pe"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          {/* Password Input */}
          <Text style={styles.inputLabel}>Contraseña:</Text>
          <View style={styles.inputRow}>
            <Lock size={18} color={THEME.colors.textMuted} />
            <TextInput
              style={styles.textInput}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
            />
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={styles.submitBtn}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Text style={styles.submitBtnText}>Ingresar al Panel</Text>
                <ArrowRight size={18} color="#FFF" />
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Footer info */}
        <Text style={styles.footerText}>
          Inversiones Tunky Chasky S.R.L. • Versión 1.0.0 Android
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  brandBox: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoCircle: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: THEME.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    ...THEME.shadows.md,
  },
  logoLetter: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '900',
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: THEME.colors.primary,
    letterSpacing: 1,
  },
  brandTagline: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    letterSpacing: 1.5,
    marginTop: 3,
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.colors.accentLight,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginTop: 10,
  },
  securityText: {
    fontSize: 11,
    color: THEME.colors.accentDark,
    fontWeight: '700',
  },
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.xl,
    padding: 22,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadows.md,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  formSubtitle: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginBottom: 18,
    marginTop: 3,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginBottom: 6,
    marginTop: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: THEME.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  textInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: THEME.colors.textPrimary,
  },
  submitBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 18,
    ...THEME.shadows.md,
  },
  submitBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  footerText: {
    textAlign: 'center',
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 24,
  },
});
