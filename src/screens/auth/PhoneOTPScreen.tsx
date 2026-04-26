import React, { useState, useRef, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  Modal,
} from 'react-native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RouteProp } from '@react-navigation/native'
import { AuthStackParams } from '../../navigation/AuthNavigator'
import { ScreenWrapper } from '../../components/layout/ScreenWrapper'
import { Button } from '../../components/ui/Button'
import { Colors } from '../../constants/colors'
import { Fonts } from '../../constants/fonts'
import { supabase } from '../../services/supabase'

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParams, 'PhoneOTP'>
  route: RouteProp<AuthStackParams, 'PhoneOTP'>
}

const COUNTRY_CODES = [
  { name: 'India', code: '+91', flag: 'IN' },
  { name: 'United States', code: '+1', flag: 'US' },
  { name: 'United Kingdom', code: '+44', flag: 'GB' },
  { name: 'Australia', code: '+61', flag: 'AU' },
  { name: 'Canada', code: '+1', flag: 'CA' },
  { name: 'Germany', code: '+49', flag: 'DE' },
  { name: 'France', code: '+33', flag: 'FR' },
  { name: 'Japan', code: '+81', flag: 'JP' },
  { name: 'Singapore', code: '+65', flag: 'SG' },
  { name: 'UAE', code: '+971', flag: 'AE' },
  { name: 'South Africa', code: '+27', flag: 'ZA' },
  { name: 'Brazil', code: '+55', flag: 'BR' },
  { name: 'Pakistan', code: '+92', flag: 'PK' },
  { name: 'Bangladesh', code: '+880', flag: 'BD' },
  { name: 'Nigeria', code: '+234', flag: 'NG' },
]

export function PhoneOTPScreen({ navigation }: Props) {
  const [selectedCountry, setSelectedCountry] = useState(COUNTRY_CODES[0])
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [stage, setStage] = useState<'phone' | 'otp'>('phone')
  const [loading, setLoading] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)
  const [showCountryPicker, setShowCountryPicker] = useState(false)
  const [countrySearch, setCountrySearch] = useState('')
  const inputRefs = useRef<(TextInput | null)[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  function startResendTimer() {
    setResendTimer(60)
    timerRef.current = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  async function handleSendOTP() {
    if (phone.length < 6) {
      Alert.alert('Invalid Number', 'Enter a valid phone number')
      return
    }
    setLoading(true)
    const fullPhone = `${selectedCountry.code}${phone}`
    const { error } = await supabase.auth.signInWithOtp({ phone: fullPhone })
    setLoading(false)
    if (error) {
      Alert.alert('Error', error.message)
    } else {
      setStage('otp')
      startResendTimer()
    }
  }

  async function handleVerifyOTP() {
    const code = otp.join('')
    if (code.length !== 6) {
      Alert.alert('Incomplete', 'Enter the 6-digit code')
      return
    }
    setLoading(true)
    const fullPhone = `${selectedCountry.code}${phone}`
    const { error } = await supabase.auth.verifyOtp({
      phone: fullPhone,
      token: code,
      type: 'sms',
    })
    setLoading(false)
    if (error) {
      Alert.alert('Verification Failed', error.message)
    }
    // RootNavigator picks up the session change automatically
  }

  function handleOTPChange(text: string, index: number) {
    const digit = text.replace(/[^0-9]/g, '').slice(-1)
    const newOtp = [...otp]
    newOtp[index] = digit
    setOtp(newOtp)
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  function handleOTPKeyPress(key: string, index: number) {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
      const newOtp = [...otp]
      newOtp[index - 1] = ''
      setOtp(newOtp)
    }
  }

  const filteredCountries = COUNTRY_CODES.filter(
    (c) =>
      c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
      c.code.includes(countrySearch)
  )

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        {/* Back button */}
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.heading}>
          {stage === 'phone' ? 'Enter your number' : 'Enter the code'}
        </Text>
        <Text style={styles.sub}>
          {stage === 'phone'
            ? 'We will send you a one-time verification code'
            : `Code sent to ${selectedCountry.code} ${phone}`}
        </Text>

        {stage === 'phone' ? (
          <>
            {/* Country + Phone Row */}
            <View style={styles.phoneRow}>
              <TouchableOpacity
                style={styles.countryButton}
                onPress={() => setShowCountryPicker(true)}
              >
                <Text style={styles.countryCode}>{selectedCountry.code}</Text>
                <Text style={styles.dropIcon}>v</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.phoneInput}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="Phone number"
                placeholderTextColor={Colors.textMuted}
                maxLength={15}
              />
            </View>
            <Button
              label="Send Verification Code"
              onPress={handleSendOTP}
              loading={loading}
              style={styles.button}
            />
          </>
        ) : (
          <>
            {/* OTP Input Boxes */}
            <View style={styles.otpRow}>
              {otp.map((digit, i) => (
                <TextInput
                  key={i}
                  ref={(r) => (inputRefs.current[i] = r)}
                  style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
                  value={digit}
                  onChangeText={(t) => handleOTPChange(t, i)}
                  onKeyPress={({ nativeEvent: { key } }) => handleOTPKeyPress(key, i)}
                  keyboardType="number-pad"
                  maxLength={1}
                  selectTextOnFocus
                />
              ))}
            </View>

            <Button
              label="Verify Code"
              onPress={handleVerifyOTP}
              loading={loading}
              style={styles.button}
            />

            <TouchableOpacity
              onPress={handleSendOTP}
              disabled={resendTimer > 0}
              style={styles.resendButton}
            >
              <Text style={[styles.resendText, resendTimer > 0 && styles.resendDisabled]}>
                {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend code'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Country Picker Modal */}
      <Modal visible={showCountryPicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Country</Text>
            <TextInput
              style={styles.searchInput}
              value={countrySearch}
              onChangeText={setCountrySearch}
              placeholder="Search..."
              placeholderTextColor={Colors.textMuted}
            />
            <FlatList
              data={filteredCountries}
              keyExtractor={(item) => item.code + item.name}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.countryRow}
                  onPress={() => {
                    setSelectedCountry(item)
                    setShowCountryPicker(false)
                    setCountrySearch('')
                  }}
                >
                  <Text style={styles.countryName}>{item.name}</Text>
                  <Text style={styles.countryCodeText}>{item.code}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
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
    marginBottom: 32,
    lineHeight: 22,
  },
  phoneRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  countryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 50,
    gap: 6,
  },
  countryCode: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  dropIcon: {
    color: Colors.textMuted,
    fontSize: 10,
  },
  phoneInput: {
    flex: 1,
    height: 50,
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 10,
    paddingHorizontal: 16,
    fontFamily: Fonts.body,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 28,
    gap: 8,
  },
  otpBox: {
    flex: 1,
    height: 56,
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 10,
    textAlign: 'center',
    fontFamily: Fonts.accentBold,
    fontSize: 22,
    color: Colors.starGold,
  },
  otpBoxFilled: {
    borderColor: Colors.primaryViolet,
  },
  button: {
    width: '100%',
  },
  resendButton: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 8,
  },
  resendText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.nebulaCyan,
    textDecorationLine: 'underline',
  },
  resendDisabled: {
    color: Colors.textMuted,
    textDecorationLine: 'none',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.cardBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '70%',
  },
  modalTitle: {
    fontFamily: Fonts.heading,
    fontSize: 16,
    color: Colors.textPrimary,
    marginBottom: 16,
    textAlign: 'center',
  },
  searchInput: {
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  countryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  countryName: {
    fontFamily: Fonts.body,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  countryCodeText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 15,
    color: Colors.textMuted,
  },
})