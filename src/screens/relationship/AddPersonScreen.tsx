// src/screens/relationship/AddPersonScreen.tsx
import React, { useState, useRef, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, Animated, Dimensions, Modal,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import { Video, ResizeMode } from 'expo-av'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { useAuthStore } from '../../store/authStore'
import { useRelationshipStore } from '../../store/relationshipStore'
import { RelationshipTypeGrid } from './RelationshipTypeGrid'
import { Videos } from '../../constants/videos'
import { Colors } from '../../constants/colors'
import { Fonts } from '../../constants/fonts'
import type { RelationshipType } from '../../types'

const { width } = Dimensions.get('window')

type Gender = 'male' | 'female'

export function AddPersonScreen() {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<any>()
  const { session } = useAuthStore()
  const { addProfile, setActiveProfile } = useRelationshipStore()

  const [name, setName] = useState('')
  const [gender, setGender] = useState<Gender>('male')
  const [birthDate, setBirthDate] = useState('')
  const [birthTime, setBirthTime] = useState('')
  const [birthTimeKnown, setBirthTimeKnown] = useState(true)
  const [birthCity, setBirthCity] = useState('')
  const [birthLat, setBirthLat] = useState(0)
  const [birthLng, setBirthLng] = useState(0)
  const [timezone, setTimezone] = useState('UTC')
  const [birthCountry, setBirthCountry] = useState('')
  const [types, setTypes] = useState<RelationshipType[]>([])
  const [cityResults, setCityResults] = useState<any[]>([])
  const [citySearching, setCitySearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const shakeAnim = useRef(new Animated.Value(0)).current
  const citySearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  function shake() {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start()
  }

  async function searchCity(query: string) {
    setBirthCity(query)
    if (citySearchTimeout.current) clearTimeout(citySearchTimeout.current)
    if (query.length < 3) { setCityResults([]); return }
    citySearchTimeout.current = setTimeout(async () => {
      setCitySearching(true)
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`,
          { headers: { 'User-Agent': 'ZephyraApp/1.0' } }
        )
        const data = await res.json()
        setCityResults(data)
      } catch { setCityResults([]) }
      finally { setCitySearching(false) }
    }, 400)
  }

  function selectCity(item: any) {
    Haptics.selectionAsync()
    const addr = item.address || {}
    const cityName = addr.city || addr.town || addr.village || item.display_name.split(',')[0]
    const country = addr.country || ''
    setBirthCity(cityName)
    setBirthCountry(country)
    setBirthLat(parseFloat(item.lat))
    setBirthLng(parseFloat(item.lon))
    setTimezone('UTC') // will be refined later via astrologyEngine
    setCityResults([])
  }

  function toggleType(t: RelationshipType) {
    setTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
    setErrorMsg('')
  }

  async function handleCalculate() {
    if (!name.trim()) { shake(); setErrorMsg('Please enter their name'); return }
    if (!birthDate.match(/^\d{4}-\d{2}-\d{2}$/)) { shake(); setErrorMsg('Enter birth date as YYYY-MM-DD'); return }
    if (!birthCity || birthLat === 0) { shake(); setErrorMsg('Select a city from the dropdown'); return }
    if (types.length === 0) { shake(); setErrorMsg('Select at least one relationship type'); return }

    // Same-sex romantic guard
    const userGender = 'male' // TODO: get from profile
    if (gender === userGender && (types.includes('romantic') || types.includes('marriage'))) {
      Alert.alert(
        'A Note on This Reading',
        'Zephyra\'s relationship readings are built on classical Vedic Jyotish tradition which structures compatibility around complementary masculine and feminine principles. For this pairing, I can offer your personal reading in full depth instead.\n\nWould you like to explore your personal reading?',
        [
          { text: 'Read My Personal Chart', onPress: () => navigation.navigate('HomeTab') },
          { text: 'Change Selection', style: 'cancel' },
        ]
      )
      return
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setSaving(true)
    setErrorMsg('')

    const profileData = {
      person_name: name.trim(),
      person_gender: gender,
      birth_date: birthDate,
      birth_time: birthTimeKnown ? birthTime : '06:00:00',
      birth_time_known: birthTimeKnown,
      birth_city: birthCity,
      birth_country: birthCountry,
      birth_lat: birthLat,
      birth_lng: birthLng,
      timezone,
      relationship_types: types,
    }

    const saved = await addProfile(session!.user.id, profileData)
    setSaving(false)

    if (saved) {
      setActiveProfile(saved)
      navigation.navigate('CompatibilityLoading')
    } else {
      Alert.alert('Error', 'Could not save profile. Please try again.')
    }
  }

  return (
    <View style={st.root}>
      <Video source={Videos.splashBg} style={StyleSheet.absoluteFillObject}
        resizeMode={ResizeMode.COVER} isLooping shouldPlay isMuted />
      <LinearGradient colors={['rgba(5,5,15,0.4)','rgba(5,5,15,0.92)']} style={StyleSheet.absoluteFillObject} />

      <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
        {/* Header */}
        <View style={[st.header, {paddingTop: insets.top + 12}]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={st.backBtn}>
            <Text style={st.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={st.headerTitle}>New Connection</Text>
          <View style={{width:40}} />
        </View>

        <ScrollView
          contentContainerStyle={[st.scroll, {paddingBottom: insets.bottom + 120}]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Section: About */}
          <Text style={st.sectionHeader}>ABOUT THIS PERSON</Text>
          <BlurView intensity={12} tint="dark" style={st.section}>
            <Text style={st.fieldLabel}>Full Name</Text>
            <TextInput
              value={name} onChangeText={setName}
              placeholder="Their name..." placeholderTextColor={Colors.textMuted}
              style={st.input} autoCapitalize="words"
            />

            <Text style={st.fieldLabel}>Gender</Text>
            <View style={st.genderRow}>
              {(['male','female'] as Gender[]).map(g => (
                <TouchableOpacity
                  key={g} style={[st.genderBtn, gender===g && st.genderActive]}
                  onPress={() => { Haptics.selectionAsync(); setGender(g) }}
                  activeOpacity={0.8}
                >
                  {gender === g && (
                    <LinearGradient colors={['rgba(201,168,76,0.15)','rgba(123,47,190,0.1)']} style={StyleSheet.absoluteFillObject} />
                  )}
                  <Text style={[st.genderIcon]}>{g === 'male' ? '♂' : '♀'}</Text>
                  <Text style={[st.genderText, gender===g && st.genderTextActive]}>
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </BlurView>

          {/* Section: Birth Details */}
          <Text style={st.sectionHeader}>THEIR BIRTH DETAILS</Text>
          <BlurView intensity={12} tint="dark" style={st.section}>
            <Text style={st.fieldLabel}>Date of Birth (YYYY-MM-DD)</Text>
            <TextInput
              value={birthDate} onChangeText={setBirthDate}
              placeholder="1990-06-15" placeholderTextColor={Colors.textMuted}
              style={st.input} keyboardType="numeric" maxLength={10}
            />

            <Text style={st.fieldLabel}>Birth Time</Text>
            <View style={st.timeToggleRow}>
              {(['Known','Unknown'] as const).map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={[st.timeToggle, birthTimeKnown===(opt==='Known') && st.timeToggleActive]}
                  onPress={() => { Haptics.selectionAsync(); setBirthTimeKnown(opt==='Known') }}
                >
                  <Text style={[st.timeToggleText, birthTimeKnown===(opt==='Known') && st.timeToggleTextActive]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {birthTimeKnown ? (
              <TextInput
                value={birthTime} onChangeText={setBirthTime}
                placeholder="HH:MM (e.g. 14:30)" placeholderTextColor={Colors.textMuted}
                style={[st.input, {marginTop:10}]} keyboardType="numbers-and-punctuation"
              />
            ) : (
              <View style={st.timeNote}>
                <Text style={st.timeNoteText}>⟡ Sunrise time will be used — reduces accuracy slightly</Text>
              </View>
            )}

            <Text style={[st.fieldLabel, {marginTop:14}]}>Birth City</Text>
            <TextInput
              value={birthCity} onChangeText={searchCity}
              placeholder="Search city..." placeholderTextColor={Colors.textMuted}
              style={st.input}
            />
            {citySearching && <ActivityIndicator color={Colors.agedGold} style={{marginTop:8}} />}
            {cityResults.length > 0 && (
              <BlurView intensity={20} tint="dark" style={st.dropdown}>
                {cityResults.map((item, idx) => (
                  <TouchableOpacity
                    key={idx} onPress={() => selectCity(item)}
                    style={[st.dropItem, idx < cityResults.length-1 && st.dropItemBorder]}
                  >
                    <Text style={st.dropItemText} numberOfLines={2}>{item.display_name}</Text>
                  </TouchableOpacity>
                ))}
              </BlurView>
            )}
          </BlurView>

          {/* Section: Relationship Types */}
          <Text style={st.sectionHeader}>HOW DO YOU KNOW THEM?</Text>
          <BlurView intensity={12} tint="dark" style={st.section}>
            <RelationshipTypeGrid selected={types} onToggle={toggleType} />
          </BlurView>

          {/* Error */}
          {errorMsg ? (
            <Animated.View style={[st.errorWrap, {transform:[{translateX:shakeAnim}]}]}>
              <Text style={st.errorText}>{errorMsg}</Text>
            </Animated.View>
          ) : null}

          {/* CTA */}
          <TouchableOpacity
            onPress={handleCalculate}
            disabled={saving}
            style={st.ctaWrap}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#7B2FBE','#C9A84C']}
              style={st.cta} start={{x:0,y:0}} end={{x:1,y:0}}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={st.ctaText}>Calculate Compatibility ✦</Text>
              }
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const st = StyleSheet.create({
  root:{flex:1,backgroundColor:Colors.background},
  header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:20,paddingBottom:16},
  backBtn:{width:40,height:40,alignItems:'center',justifyContent:'center'},
  backArrow:{fontSize:22,color:'#C9A84C'},
  headerTitle:{fontFamily:Fonts.heading,fontSize:18,color:'#C9A84C'},
  scroll:{padding:20,gap:0},
  sectionHeader:{fontFamily:Fonts.bodySemiBold,fontSize:11,color:Colors.textMuted,letterSpacing:2,marginBottom:10,marginTop:20},
  section:{borderRadius:18,padding:18,overflow:'hidden',borderWidth:1,borderColor:'rgba(255,255,255,0.06)',marginBottom:4},
  fieldLabel:{fontFamily:Fonts.body,fontSize:12,color:Colors.textMuted,marginBottom:8,marginTop:4},
  input:{backgroundColor:'rgba(255,255,255,0.04)',borderWidth:1,borderColor:'rgba(255,255,255,0.1)',borderRadius:12,paddingHorizontal:14,paddingVertical:13,fontFamily:Fonts.body,fontSize:14,color:'#E8E8FF'},
  genderRow:{flexDirection:'row',gap:12,marginTop:4},
  genderBtn:{flex:1,height:56,borderRadius:14,overflow:'hidden',borderWidth:1,borderColor:'rgba(255,255,255,0.08)',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},
  genderActive:{borderColor:'#C9A84C'},
  genderIcon:{fontSize:20,color:'rgba(255,255,255,0.5)'},
  genderText:{fontFamily:Fonts.body,fontSize:14,color:Colors.textMuted},
  genderTextActive:{color:'#C9A84C',fontFamily:Fonts.bodySemiBold},
  timeToggleRow:{flexDirection:'row',gap:10},
  timeToggle:{flex:1,height:40,borderRadius:10,borderWidth:1,borderColor:'rgba(255,255,255,0.08)',alignItems:'center',justifyContent:'center'},
  timeToggleActive:{borderColor:'#C9A84C',backgroundColor:'rgba(201,168,76,0.1)'},
  timeToggleText:{fontFamily:Fonts.body,fontSize:13,color:Colors.textMuted},
  timeToggleTextActive:{color:'#C9A84C'},
  timeNote:{backgroundColor:'rgba(201,168,76,0.06)',borderRadius:10,padding:12,marginTop:10},
  timeNoteText:{fontFamily:Fonts.body,fontSize:12,color:Colors.textMuted},
  dropdown:{borderRadius:12,overflow:'hidden',marginTop:4,borderWidth:1,borderColor:'rgba(255,255,255,0.08)'},
  dropItem:{padding:14},
  dropItemBorder:{borderBottomWidth:1,borderBottomColor:'rgba(255,255,255,0.06)'},
  dropItemText:{fontFamily:Fonts.body,fontSize:13,color:'#E8E8FF'},
  errorWrap:{backgroundColor:'rgba(255,68,68,0.1)',borderRadius:12,padding:12,borderWidth:1,borderColor:'rgba(255,68,68,0.25)',marginTop:12},
  errorText:{fontFamily:Fonts.body,fontSize:13,color:'#FF6666',textAlign:'center'},
  ctaWrap:{borderRadius:18,overflow:'hidden',marginTop:24},
  cta:{height:60,alignItems:'center',justifyContent:'center',borderRadius:18},
  ctaText:{fontFamily:Fonts.heading,fontSize:15,color:'#fff'},
})
