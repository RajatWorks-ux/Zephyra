// src/screens/setup/BirthDetailsScreen.tsx
import React, { useState, useCallback, useRef } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, TextInput, Modal, FlatList,
  KeyboardAvoidingView, Platform, Dimensions, StatusBar,
} from 'react-native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { SetupStackParams } from '../../navigation/SetupNavigator'
import { Button } from '../../components/ui/Button'
import { WheelPicker } from '../../components/ui/WheelPicker'
import { Fonts } from '../../constants/fonts'
import { saveBirthProfile } from '../../services/supabase'
import { useAuthStore } from '../../store/authStore'
import type { BirthFormData, CityResult } from '../../types'
import { Video, ResizeMode } from 'expo-av'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'

const { height, width } = Dimensions.get('window')

type Props = {
  navigation: NativeStackNavigationProp<SetupStackParams, 'BirthDetails'>
}

const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'))
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const currentYear = new Date().getFullYear()
const YEARS = Array.from({ length: currentYear - 1923 }, (_, i) => String(currentYear - i))
const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'))
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))

export function BirthDetailsScreen({ navigation }: Props) {
  const { user, refreshBirthProfile } = useAuthStore()

  const [dayIndex, setDayIndex] = useState(0)
  const [monthIndex, setMonthIndex] = useState(0)
  const [yearIndex, setYearIndex] = useState(0)
  const [hourIndex, setHourIndex] = useState(0)
  const [minuteIndex, setMinuteIndex] = useState(0)
  const [isPM, setIsPM] = useState(false)
  const [timeKnown, setTimeKnown] = useState(true)

  // City search — now uses Modal to avoid keyboard issues
  const [showCityModal, setShowCityModal] = useState(false)
  const [cityQuery, setCityQuery] = useState('')
  const [cityResults, setCityResults] = useState<CityResult[]>([])
  const [selectedCity, setSelectedCity] = useState<CityResult | null>(null)
  const [citySearching, setCitySearching] = useState(false)
  const [loading, setLoading] = useState(false)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const searchCities = useCallback(async (query: string) => {
    if (query.length < 2) { setCityResults([]); return }
    setCitySearching(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=8&addressdetails=1`,
        { headers: { 'Accept-Language': 'en', 'User-Agent': 'ZephyraApp/1.0' } }
      )
      const data = await res.json()
      const results: CityResult[] = data
        .filter((item: any) => item.type !== 'country')
        .map((item: any) => ({
          display_name: item.display_name,
          city:
            item.address?.city || item.address?.town ||
            item.address?.village || item.address?.county || item.name,
          country: item.address?.country || '',
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
        }))
      setCityResults(results)
    } catch { /* silent */ }
    finally { setCitySearching(false) }
  }, [])

  function handleCityInput(text: string) {
    setCityQuery(text)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => searchCities(text), 500)
  }

  async function getTimezone(lat: number, lng: number): Promise<string> {
    try {
      const res = await fetch(`https://timeapi.io/api/TimeZone/coordinate?latitude=${lat}&longitude=${lng}`)
      const data = await res.json()
      return data.timeZone || 'UTC'
    } catch { return 'UTC' }
  }

  async function handleSubmit() {
    if (!selectedCity) { Alert.alert('Missing', 'Please select your birth city'); return }
    if (!user) { Alert.alert('Error', 'Not logged in'); return }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setLoading(true)
    try {
      const timezone = await getTimezone(selectedCity.lat, selectedCity.lng)
      const day = parseInt(DAYS[dayIndex])
      const month = monthIndex + 1
      const year = parseInt(YEARS[yearIndex])
      const hour = parseInt(HOURS[hourIndex])
      const birthDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      let birthTime: string | null = null
      if (timeKnown) {
        let h = hour
        if (isPM && h !== 12) h += 12
        if (!isPM && h === 12) h = 0
        birthTime = `${String(h).padStart(2, '0')}:${MINUTES[minuteIndex]}:00`
      }
      const birthData: BirthFormData = {
        day, month, year, hour, minute: parseInt(MINUTES[minuteIndex]),
        isPM, timeKnown, city: selectedCity.city, country: selectedCity.country,
        lat: selectedCity.lat, lng: selectedCity.lng, timezone,
      }
      navigation.navigate('GrandReadingLoading', { birthData })
      const { error } = await saveBirthProfile(user.id, {
        birth_date: birthDate, birth_time: birthTime,
        birth_time_known: timeKnown, birth_city: selectedCity.city,
        birth_country: selectedCity.country, birth_lat: selectedCity.lat,
        birth_lng: selectedCity.lng, timezone,
      })
      if (error) throw error
      await refreshBirthProfile()
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not save your birth details')
      setLoading(false)
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <Video
        source={require('../../../assets/videos/birth-bg.mp4')}
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

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerArea}>
          <View style={styles.glowDot} />
          <Text style={styles.step}>SETUP · STEP 1 OF 1</Text>
          <Text style={styles.heading}>The Sacred{'\n'}Coordinates</Text>
          <Text style={styles.subheading}>
            Tell us the exact moment your soul arrived.
            The more precise, the deeper we can read.
          </Text>
        </View>

        {/* Date Section */}
        <BlurView intensity={20} tint="dark" style={styles.section}>
          <Text style={styles.sectionLabel}>Date of Birth</Text>
          <View style={styles.wheelRow}>
            <View style={styles.wheelCol}>
              <Text style={styles.wheelLabel}>Day</Text>
              <WheelPicker data={DAYS} selectedIndex={dayIndex} onSelect={setDayIndex} width={70} />
            </View>
            <View style={[styles.wheelCol, { flex: 2 }]}>
              <Text style={styles.wheelLabel}>Month</Text>
              <WheelPicker data={MONTHS} selectedIndex={monthIndex} onSelect={setMonthIndex} width={140} />
            </View>
            <View style={styles.wheelCol}>
              <Text style={styles.wheelLabel}>Year</Text>
              <WheelPicker data={YEARS} selectedIndex={yearIndex} onSelect={setYearIndex} width={80} />
            </View>
          </View>
        </BlurView>

        {/* Time Section */}
        <BlurView intensity={20} tint="dark" style={styles.section}>
          <Text style={styles.sectionLabel}>Time of Birth</Text>
          <TouchableOpacity
            style={styles.checkRow}
            onPress={() => {
              setTimeKnown(!timeKnown)
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            }}
          >
            <View style={[styles.checkbox, timeKnown && styles.checkboxActive]}>
              {timeKnown && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.checkLabel}>I know my exact birth time</Text>
          </TouchableOpacity>

          {timeKnown ? (
            <>
              <View style={styles.wheelRow}>
                <View style={styles.wheelCol}>
                  <Text style={styles.wheelLabel}>Hour</Text>
                  <WheelPicker data={HOURS} selectedIndex={hourIndex} onSelect={setHourIndex} width={70} />
                </View>
                <View style={styles.wheelCol}>
                  <Text style={styles.wheelLabel}>Minute</Text>
                  <WheelPicker data={MINUTES} selectedIndex={minuteIndex} onSelect={setMinuteIndex} width={70} />
                </View>
                <View style={styles.wheelCol}>
                  <Text style={styles.wheelLabel}>AM / PM</Text>
                  <View style={styles.ampmToggle}>
                    <TouchableOpacity
                      style={[styles.ampmTab, !isPM && styles.ampmActive]}
                      onPress={() => setIsPM(false)}
                    >
                      <Text style={[styles.ampmText, !isPM && styles.ampmTextActive]}>AM</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.ampmTab, isPM && styles.ampmActive]}
                      onPress={() => setIsPM(true)}
                    >
                      <Text style={[styles.ampmText, isPM && styles.ampmTextActive]}>PM</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
              <Text style={styles.timeNote}>
                Your Rising Sign — the most personal part of your chart — requires exact birth time.
              </Text>
            </>
          ) : (
            <View style={styles.unknownTimeCard}>
              <Text style={styles.unknownTimeText}>
                We will use 6:00 AM as your default. Sun and Moon signs remain perfectly accurate. Rising sign may vary slightly.
              </Text>
            </View>
          )}
        </BlurView>

        {/* Place of Birth — Opens City Modal (no keyboard issue!) */}
        <BlurView intensity={20} tint="dark" style={styles.section}>
          <Text style={styles.sectionLabel}>Place of Birth</Text>

          <TouchableOpacity
            style={styles.cityPickerBtn}
            onPress={() => setShowCityModal(true)}
          >
            {selectedCity ? (
              <View>
                <Text style={styles.citySelected}>
                  {selectedCity.city}, {selectedCity.country}
                </Text>
                <Text style={styles.cityCoords}>
                  {selectedCity.lat.toFixed(4)}°, {selectedCity.lng.toFixed(4)}°
                </Text>
              </View>
            ) : (
              <Text style={styles.cityPlaceholder}>Tap to search your birth city...</Text>
            )}
            <Text style={styles.cityChevron}>{selectedCity ? '✓' : '→'}</Text>
          </TouchableOpacity>
        </BlurView>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.revealBtn, loading && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <LinearGradient
            colors={['#C9A84C', '#7C3AED']}
            style={styles.revealBtnGrad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.revealBtnText}>
              {loading ? 'Calculating Your Chart...' : 'Reveal My Cosmos ✦'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>

      {/* CITY SEARCH MODAL — fixes keyboard hiding issue completely */}
      <Modal visible={showCityModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalOverlay}>
            <BlurView intensity={40} tint="dark" style={styles.modalCard}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Search Birth City</Text>

              <TextInput
                style={styles.citySearchInput}
                value={cityQuery}
                onChangeText={handleCityInput}
                placeholder="Type city name..."
                placeholderTextColor="rgba(255,255,255,0.3)"
                autoFocus
                returnKeyType="search"
              />

              {citySearching && (
                <ActivityIndicator color="#C9A84C" style={{ marginVertical: 16 }} />
              )}

              <FlatList
                data={cityResults}
                keyExtractor={(_, i) => String(i)}
                showsVerticalScrollIndicator={false}
                style={{ maxHeight: height * 0.45 }}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.cityResultRow}
                    onPress={() => {
                      setSelectedCity(item)
                      setCityQuery(`${item.city}, ${item.country}`)
                      setCityResults([])
                      setShowCityModal(false)
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    }}
                  >
                    <View style={styles.cityResultPin}>
                      <Text style={{ fontSize: 18 }}>📍</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cityResultMain}>{item.city}</Text>
                      <Text style={styles.cityResultSub}>{item.country}</Text>
                    </View>
                  </TouchableOpacity>
                )}
              />

              <TouchableOpacity
                style={styles.closeModal}
                onPress={() => { setShowCityModal(false); setCityResults([]) }}
              >
                <Text style={styles.closeModalText}>Cancel</Text>
              </TouchableOpacity>
            </BlurView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05050F' },
  scroll: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 48 },
  headerArea: { alignItems: 'center', marginBottom: 28 },
  glowDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#C9A84C',
    shadowColor: '#C9A84C', shadowRadius: 12, shadowOpacity: 1,
    shadowOffset: { width: 0, height: 0 },
    marginBottom: 12,
  },
  step: {
    fontFamily: Fonts.accent,
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 2,
    marginBottom: 8,
  },
  heading: {
    fontFamily: Fonts.heading,
    fontSize: 38,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 46,
    marginBottom: 12,
  },
  subheading: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 22,
  },
  section: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    padding: 20,
    marginBottom: 16,
  },
  sectionLabel: {
    fontFamily: Fonts.accent,
    fontSize: 10,
    color: '#C9A84C',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  wheelRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  wheelCol: { alignItems: 'center', gap: 8 },
  wheelLabel: {
    fontFamily: Fonts.accent,
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  checkbox: {
    width: 24, height: 24, borderRadius: 7,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: '#C9A84C',
    borderColor: '#C9A84C',
  },
  checkmark: { color: '#0A0600', fontSize: 14, fontFamily: Fonts.bodySemiBold },
  checkLabel: {
    fontFamily: Fonts.body,
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
  },
  ampmToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
    height: 52,
  },
  ampmTab: { width: 44, alignItems: 'center', justifyContent: 'center' },
  ampmActive: { backgroundColor: '#7C3AED' },
  ampmText: { fontFamily: Fonts.accent, fontSize: 12, color: 'rgba(255,255,255,0.4)' },
  ampmTextActive: { color: '#FFFFFF' },
  timeNote: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    marginTop: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  unknownTimeCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  unknownTimeText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    lineHeight: 20,
  },
  cityPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  citySelected: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 16,
    color: '#C9A84C',
  },
  cityCoords: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 4,
  },
  cityPlaceholder: {
    fontFamily: Fonts.body,
    fontSize: 15,
    color: 'rgba(255,255,255,0.25)',
  },
  cityChevron: {
    fontSize: 18,
    color: selectedCity => selectedCity ? '#C9A84C' : 'rgba(255,255,255,0.3)',
  },
  revealBtn: { marginTop: 8, borderRadius: 20, overflow: 'hidden' },
  revealBtnGrad: { paddingVertical: 22, alignItems: 'center' },
  revealBtnText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 18,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
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
  citySearchInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: Fonts.body,
    fontSize: 15,
    color: '#FFFFFF',
    marginBottom: 12,
  },
  cityResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    gap: 12,
  },
  cityResultPin: { width: 32, alignItems: 'center' },
  cityResultMain: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  cityResultSub: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
  },
