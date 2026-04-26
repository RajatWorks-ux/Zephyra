import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { SetupStackParams } from '../../navigation/SetupNavigator'
import { ScreenWrapper } from '../../components/layout/ScreenWrapper'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { WheelPicker } from '../../components/ui/WheelPicker'
import { Colors } from '../../constants/colors'
import { Fonts } from '../../constants/fonts'
import { saveBirthProfile } from '../../services/supabase'
import { useAuthStore } from '../../store/authStore'
import type { BirthFormData, CityResult } from '../../types'

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

  const [cityQuery, setCityQuery] = useState('')
  const [cityResults, setCityResults] = useState<CityResult[]>([])
  const [selectedCity, setSelectedCity] = useState<CityResult | null>(null)
  const [citySearching, setCitySearching] = useState(false)

  const [loading, setLoading] = useState(false)
  const searchTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const searchCities = useCallback(async (query: string) => {
    if (query.length < 2) { setCityResults([]); return }
    setCitySearching(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=6&addressdetails=1`,
        { headers: { 'Accept-Language': 'en', 'User-Agent': 'ZephyraApp/1.0' } }
      )
      const data = await res.json()
      const results: CityResult[] = data
        .filter((item: any) => item.type !== 'country')
        .map((item: any) => ({
          display_name: item.display_name,
          city:
            item.address?.city ||
            item.address?.town ||
            item.address?.village ||
            item.address?.county ||
            item.name,
          country: item.address?.country || '',
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
        }))
      setCityResults(results)
    } catch {
      // silently fail
    } finally {
      setCitySearching(false)
    }
  }, [])

  function handleCityInput(text: string) {
    setCityQuery(text)
    setSelectedCity(null)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => searchCities(text), 500)
  }

  async function getTimezone(lat: number, lng: number): Promise<string> {
    try {
      const res = await fetch(
        `https://timeapi.io/api/TimeZone/coordinate?latitude=${lat}&longitude=${lng}`
      )
      const data = await res.json()
      return data.timeZone || 'UTC'
    } catch {
      return 'UTC'
    }
  }

  async function handleSubmit() {
    if (!selectedCity) {
      Alert.alert('Missing', 'Please select your birth city from the list')
      return
    }
    if (!user) {
      Alert.alert('Error', 'Not logged in')
      return
    }

    setLoading(true)
    try {
      const timezone = await getTimezone(selectedCity.lat, selectedCity.lng)

      const day = parseInt(DAYS[dayIndex])
      const month = monthIndex + 1
      const year = parseInt(YEARS[yearIndex])
      const hour = parseInt(HOURS[hourIndex])
      const minute = parseInt(MINUTES[minuteIndex])

      const birthDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

      let birthTime: string | null = null
      if (timeKnown) {
        let h = hour
        if (isPM && h !== 12) h += 12
        if (!isPM && h === 12) h = 0
        birthTime = `${String(h).padStart(2, '0')}:${MINUTES[minuteIndex]}:00`
      }

      const birthData: BirthFormData = {
        day,
        month,
        year,
        hour,
        minute,
        isPM,
        timeKnown,
        city: selectedCity.city,
        country: selectedCity.country,
        lat: selectedCity.lat,
        lng: selectedCity.lng,
        timezone,
      }

      // ✅ NAVIGATE FIRST — before any store updates that would unmount this navigator
      navigation.navigate('GrandReadingLoading', { birthData })

      // ✅ Save to DB and refresh store AFTER navigation (in background)
      const { error } = await saveBirthProfile(user.id, {
        birth_date: birthDate,
        birth_time: birthTime,
        birth_time_known: timeKnown,
        birth_city: selectedCity.city,
        birth_country: selectedCity.country,
        birth_lat: selectedCity.lat,
        birth_lng: selectedCity.lng,
        timezone,
      })

      if (error) throw error

      // This will trigger RootNavigator to switch to MainNavigator
      // but by then user is already on GrandReadingLoading
      await refreshBirthProfile()

    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not save your birth details')
      setLoading(false)
    }
  }

  return (
    <ScreenWrapper>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.heading}>The Sacred Coordinates</Text>
        <Text style={styles.subheading}>
          Tell us the exact moment your soul arrived. The more precise, the deeper we can read.
        </Text>

        {/* Date */}
        <View style={styles.section}>
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
        </View>

        {/* Time */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Time of Birth</Text>
          <TouchableOpacity style={styles.checkRow} onPress={() => setTimeKnown(!timeKnown)}>
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
                Time determines your Rising Sign — the most personal part of your chart.
              </Text>
            </>
          ) : (
            <Text style={styles.unknownTimeNote}>
              We will use 6:00 AM as your default birth time. Your Sun and Moon signs will still be accurate. Rising sign may vary slightly.
            </Text>
          )}
        </View>

        {/* Place */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Place of Birth</Text>
          <Input
            label="City"
            placeholder="Type your birth city..."
            value={cityQuery}
            onChangeText={handleCityInput}
            autoCapitalize="words"
          />

          {citySearching && (
            <ActivityIndicator color={Colors.starGold} style={{ marginTop: 8 }} />
          )}

          {selectedCity && (
            <View style={styles.selectedCity}>
              <Text style={styles.selectedCityText}>
                {selectedCity.city}, {selectedCity.country}
              </Text>
              <Text style={styles.selectedCityCoords}>
                {selectedCity.lat.toFixed(4)}, {selectedCity.lng.toFixed(4)}
              </Text>
            </View>
          )}

          {cityResults.length > 0 && !selectedCity && (
            <View style={styles.cityList}>
              {cityResults.map((item, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.cityItem}
                  onPress={() => {
                    setSelectedCity(item)
                    setCityQuery(`${item.city}, ${item.country}`)
                    setCityResults([])
                  }}
                >
                  <Text style={styles.cityItemMain}>{item.city}</Text>
                  <Text style={styles.cityItemSub}>{item.country}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <Button
          label="Reveal My Cosmos"
          onPress={handleSubmit}
          loading={loading}
          style={styles.submitButton}
        />
      </ScrollView>
    </ScreenWrapper>
  )
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 48,
  },
  heading: {
    fontFamily: Fonts.heading,
    fontSize: 22,
    color: Colors.starGold,
    marginBottom: 10,
    textAlign: 'center',
  },
  subheading: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  section: {
    marginBottom: 28,
  },
  sectionLabel: {
    fontFamily: Fonts.accent,
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  wheelRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: Colors.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 16,
  },
  wheelCol: {
    alignItems: 'center',
    gap: 8,
  },
  wheelLabel: {
    fontFamily: Fonts.accent,
    fontSize: 10,
    color: Colors.textMuted,
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
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: Colors.primaryViolet,
    borderColor: Colors.primaryViolet,
  },
  checkmark: {
    color: Colors.moonWhite,
    fontSize: 12,
    fontFamily: Fonts.bodySemiBold,
  },
  checkLabel: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  ampmToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.inputBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: 'hidden',
    height: 52,
  },
  ampmTab: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ampmActive: {
    backgroundColor: Colors.primaryViolet,
  },
  ampmText: {
    fontFamily: Fonts.accent,
    fontSize: 12,
    color: Colors.textMuted,
  },
  ampmTextActive: {
    color: Colors.moonWhite,
  },
  timeNote: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 12,
    lineHeight: 18,
  },
  unknownTimeNote: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 20,
    backgroundColor: Colors.cardBg,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  selectedCity: {
    backgroundColor: Colors.cardBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.jupiterGreen + '60',
    padding: 14,
    marginTop: -8,
    marginBottom: 4,
  },
  selectedCityText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 15,
    color: Colors.jupiterGreen,
  },
  selectedCityCoords: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 4,
  },
  cityList: {
    backgroundColor: Colors.cardBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: 'hidden',
    marginTop: -8,
  },
  cityItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  cityItemMain: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 14,
    color: Colors.textPrimary,
    flex: 1,
  },
  cityItemSub: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.textMuted,
  },
  submitButton: {
    width: '100%',
    marginTop: 8,
  },
})
