// src/screens/auth/PhoneOTPScreen.tsx
import React, { useState, useRef, useEffect } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, Alert, Modal, KeyboardAvoidingView, Platform,
  StatusBar, Dimensions,
} from 'react-native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { AuthStackParams } from '../../navigation/AuthNavigator'
import { Fonts } from '../../constants/fonts'
import { supabase } from '../../services/supabase'
import { Video, ResizeMode } from 'expo-av'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'

const { height } = Dimensions.get('window')

const COUNTRY_CODES = [
  { name: 'India', code: '+91', flag: '🇮🇳' },
  { name: 'United States', code: '+1', flag: '🇺🇸' },
  { name: 'United Kingdom', code: '+44', flag: '🇬🇧' },
  { name: 'Australia', code: '+61', flag: '🇦🇺' },
  { name: 'Canada', code: '+1', flag: '🇨🇦' },
  { name: 'Germany', code: '+49', flag: '🇩🇪' },
  { name: 'France', code: '+33', flag: '🇫🇷' },
  { name: 'Japan', code: '+81', flag: '🇯🇵' },
  { name: 'Singapore', code: '+65', flag: '🇸🇬' },
  { name: 'UAE', code: '+971', flag: '🇦🇪' },
  { name: 'South Africa', code: '+27', flag: '🇿🇦' },
  { name: 'Brazil', code: '+55', flag: '🇧🇷' },
  { name: 'Pakistan', code: '+92', flag: '🇵🇰' },
  { name: 'Bangladesh', code: '+880', flag: '🇧🇩' },
  { name: 'Nigeria', code: '+234', flag: '🇳🇬' },
  { name: 'South Korea', code: '+82', flag: '🇰🇷' },
  { name: 'Indonesia', code: '+62', flag: '🇮🇩' },
  { name: 'Mexico', code: '+52', flag: '🇲🇽' },
  { name: 'Turkey', code: '+90', flag: '🇹🇷' },
  { name: 'Saudi Arabia', code: '+966', flag: '🇸🇦' },
]

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParams, 'PhoneOTP'>
}

export function PhoneOTPScreen({ navigation }: Props) {
  const [selectedCountry, setSelectedCountry] = useState(COUNTRY_CODES[0])
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [stage, setStage] = useState<'phone' | 'otp'>('phone')
  const [loading, setLoading] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)
  const [showPicker, setShowPicker] = useState(false)
  const [countrySearch, setCountrySearch] = useState('')
  const inputRefs = useRef<(TextInput | null)[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  function startTimer() {
    setResendTimer(60)
    timerRef.current = setInterval(() => {
      setResendTimer(prev => {
        if (prev <= 1) { clearInterval(timerRef.current!); return 0 }
        return prev - 1
      })
    }, 1000)
  }

  async function handleSendOTP() {
    if (phone.length < 6) { Alert.alert('Invalid', 'Enter a valid phone number'); return }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setLoading(true)
    const fullPhone = `${selectedCountry.code}${phone}`
    const { error } = await supabase.auth.signInWithOtp({ phone: fullPhone })
    setLoading(false)
    if (error) Alert.alert('Error', error.message)
    else { setStage('otp'); startTimer() }
  }

  async function handleVerifyOTP() {
    const code = otp.join('')
    if (code.length !== 6) { Alert.alert('Incomplete', 'Enter the 6-digit code'); return }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setLoading(true)
    const fullPhone = `${selectedCountry.code}${phone}`
    const { error } = await supabase.auth.verifyOtp({
      phone: fullPhone, token: code, type: 'sms',
    })
    setLoading(false)
    if (error) Alert.alert('Verification Failed', error.message)
  }

  function handleOTPChange(text: string, index: number) {
    const digit = text.replace(/[^0-9]/g, '').slice(-1)
    const newOtp = [...otp]
    newOtp[index] = digit
    setOtp(newOtp)
    if (digit && index < 5) inputRefs.current[index + 1]?.focus()
    if (digit) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }

  function handleKeyPress(key: string, index: number) {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
      const newOtp = [...otp]
      newOtp[index - 1] = ''
      setOtp(newOtp)
    }
  }

  const filtered = COUNTRY_CODES.filter(
    c => c.name.toLowerCase().includes(countrySearch.toLowerCase()) || c.code.includes(countrySearch)
  )

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <View style={styles.root}>
        <Video
          source={require('../../../assets/videos/phone-bg.mp4')}
          style={StyleSheet.absoluteFillObject}
          resizeMode={ResizeMode.COVER}
          isLooping
          shouldPlay
          isMuted
        />
        <LinearGradient
          colors={['rgba(5,5,15,0.5)', 'rgba(5,5,15,0.9)']}
          style={StyleSheet.absoluteFillObject}
        />

        <View style={styles.container}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <Text style={styles.heading}>
            {stage === 'phone' ? 'Enter your\nnumber' : 'Enter the\ncode'}
          </Text>
          <Text style={styles.sub}>
            {stage === 'phone'
              ? 'We will send a one-time verification code via SMS'
              : `Code sent to ${selectedCountry.flag} ${selectedCountry.code} ${phone}`}
          </Text>

          {stage === 'phone' ? (
            <View style={styles.phoneArea}>
              {/* Country picker button */}
              <TouchableOpacity
                style={styles.countryBtn}
                onPress={() => setShowPicker(true)}
              >
                <Text style={styles.flag}>{selectedCountry.flag}</Text>
                <Text style={styles.countryCode}>{selectedCountry.code}</Text>
                <Text style={styles.chevron}>▾</Text>
              </TouchableOpacity>

              {/* Phone input */}
              <TextInput
                style={styles.phoneInput}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="Phone number"
                placeholderTextColor="rgba(255,255,255,0.2)"
                maxLength={15}
              />
            </View>
          ) : (
            <View style={styles.otpArea}>
              {otp.map((digit, i) => (
                <TextInput
                  key={i}
                  ref={r => (inputRefs.current[i] = r)}
                  style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
                  value={digit}
                  onChangeText={t => handleOTPChange(t, i)}
                  onKeyPress={({ nativeEvent: { key } }) => handleKeyPress(key, i)}
                  keyboardType="number-pad"
                  maxLength={1}
                  selectTextOnFocus
                />
              ))}
            </View>
          )}

          <TouchableOpacity
            style={[styles.actionBtn, loading && { opacity: 0.6 }]}
            onPress={stage === 'phone' ? handleSendOTP : handleVerifyOTP}
            disabled={loading}
          >
            <LinearGradient
              colors={['#00D4FF', '#0066FF']}
              style={styles.actionBtnGrad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.actionBtnText}>
                {loading
                  ? 'Please wait...'
                  : stage === 'phone'
                  ? 'Send Verification Code'
                  : 'Verify Code'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {stage === 'otp' && (
            <TouchableOpacity
              onPress={handleSendOTP}
              disabled={resendTimer > 0}
              style={styles.resendBtn}
            >
              <Text style={[styles.resendText, resendTimer > 0 && { color: 'rgba(255,255,255,0.3)' }]}>
                {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend code'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Country Picker Modal */}
      <Modal visible={showPicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <BlurView intensity={40} tint="dark" style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Select Country</Text>
            <TextInput
              style={styles.searchInput}
              value={countrySearch}
              onChangeText={setCountrySearch}
              placeholder="Search country or code..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              autoFocus
            />
            <FlatList
              data={filtered}
              keyExtractor={item => item.code + item.name}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.countryRow}
                  onPress={() => {
                    setSelectedCountry(item)
                    setShowPicker(false)
                    setCountrySearch('')
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  }}
                >
                  <Text style={styles.rowFlag}>{item.flag}</Text>
                  <Text style={styles.rowName}>{item.name}</Text>
                  <Text style={styles.rowCode}>{item.code}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              style={styles.closeModal}
              onPress={() => { setShowPicker(false); setCountrySearch('') }}
            >
              <Text style={styles.closeModalText}>Cancel</Text>
            </TouchableOpacity>
          </BlurView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05050F' },
  container: { flex: 1, paddingHorizontal: 28, paddingTop: 60 },
  backBtn: { marginBottom: 32, alignSelf: 'flex-start' },
  backText: { fontFamily: Fonts.body, fontSize: 15, color: 'rgba(255,255,255,0.5)' },
  heading: {
    fontFamily: Fonts.heading,
    fontSize: 38,
    color: '#FFFFFF',
    lineHeight: 46,
    marginBottom: 12,
  },
  sub: {
    fontFamily: Fonts.body,
    fontSize: 15,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 24,
    marginBottom: 36,
  },
  phoneArea: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  countryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 60,
  },
  flag: { fontSize: 22 },
  countryCode: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  chevron: { fontSize: 12, color: 'rgba(255,255,255,0.4)' },
  phoneInput: {
    flex: 1,
    height: 60,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    paddingHorizontal: 18,
    fontFamily: Fonts.body,
    fontSize: 18,
    color: '#FFFFFF',
  },
  otpArea: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  otpBox: {
    flex: 1,
    height: 64,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    textAlign: 'center',
    fontFamily: Fonts.heading,
    fontSize: 24,
    color: '#00D4FF',
  },
  otpBoxFilled: {
    borderColor: '#00D4FF',
    backgroundColor: 'rgba(0,212,255,0.08)',
  },
  actionBtn: { borderRadius: 18, overflow: 'hidden' },
  actionBtnGrad: { paddingVertical: 20, alignItems: 'center' },
  actionBtnText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 17,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  resendBtn: { marginTop: 16, alignItems: 'center', paddingVertical: 8 },
  resendText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: '#00D4FF',
    textDecorationLine: 'underline',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    maxHeight: height * 0.75,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: Fonts.heading,
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: Fonts.body,
    fontSize: 15,
    color: '#FFFFFF',
    marginBottom: 12,
  },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    gap: 12,
  },
  rowFlag: { fontSize: 24, width: 32 },
  rowName: {
    fontFamily: Fonts.body,
    fontSize: 15,
    color: '#FFFFFF',
    flex: 1,
  },
  rowCode: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
  },
  closeModal: {
    marginTop: 12,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
  },
  closeModalText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
  },
})
