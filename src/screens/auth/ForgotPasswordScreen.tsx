import React, { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { AuthStackParams } from '../../navigation/AuthNavigator'
import { ScreenWrapper } from '../../components/layout/ScreenWrapper'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Colors } from '../../constants/colors'
import { Fonts } from '../../constants/fonts'
import { supabase } from '../../services/supabase'

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParams, 'ForgotPassword'>
}

export function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleReset() {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter a valid email address')
      return
    }
    setError('')
    setLoading(true)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: 'zephyra://reset-password' }
    )
    setLoading(false)
    if (resetError) {
      Alert.alert('Error', resetError.message)
    } else {
      setSent(true)
    }
  }

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.heading}>Reset your password</Text>

        {!sent ? (
          <>
            <Text style={styles.sub}>
              Enter the email linked to your account. We will send you a reset link.
            </Text>
            <Input
              label="Email"
              placeholder="your@email.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              error={error}
            />
            <Button
              label="Send Reset Link"
              onPress={handleReset}
              loading={loading}
              style={styles.button}
            />
          </>
        ) : (
          <View style={styles.successCard}>
            <Text style={styles.successTitle}>Check your inbox</Text>
            <Text style={styles.successText}>
              We sent a password reset link to{' '}
              <Text style={styles.emailHighlight}>{email}</Text>. Check your spam
              folder if you do not see it within a few minutes.
            </Text>
            <Button
              label="Back to Sign In"
              onPress={() => navigation.navigate('SignIn')}
              variant="outline"
              style={styles.button}
            />
          </View>
        )}
      </View>
    </ScreenWrapper>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  backButton: {
    paddingVertical: 8,
    alignSelf: 'flex-start',
    marginBottom: 24,
  },
  backText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.nebulaCyan,
  },
  heading: {
    fontFamily: Fonts.heading,
    fontSize: 22,
    color: Colors.textPrimary,
    marginBottom: 10,
  },
  sub: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: 28,
    lineHeight: 22,
  },
  button: {
    marginTop: 8,
    width: '100%',
  },
  successCard: {
    marginTop: 12,
    backgroundColor: Colors.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.jupiterGreen + '40',
    padding: 24,
    gap: 16,
  },
  successTitle: {
    fontFamily: Fonts.heading,
    fontSize: 18,
    color: Colors.jupiterGreen,
  },
  successText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  emailHighlight: {
    color: Colors.starGold,
    fontFamily: Fonts.bodySemiBold,
  },
})