// src/screens/relationship/CompatibilityLoadingScreen.tsx
import React, { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Animated, Dimensions, Alert } from 'react-native'
import { Video, ResizeMode } from 'expo-av'
import { LinearGradient } from 'expo-linear-gradient'
import { useNavigation } from '@react-navigation/native'
import { useAuthStore } from '../../store/authStore'
import { useReadingStore } from '../../store/readingStore'
import { useRelationshipStore } from '../../store/relationshipStore'
import { Videos } from '../../constants/videos'
import { Colors } from '../../constants/colors'
import { Fonts } from '../../constants/fonts'

const { width } = Dimensions.get('window')

const MESSAGES = [
  'Mapping both birth charts...',
  'Calculating all 8 Kootas...',
  'Detecting relationship yogas...',
  'Reading your combined karma...',
  'Decoding your shared Dashas...',
  'Revealing the cosmic bond...',
]

export function CompatibilityLoadingScreen() {
  const navigation = useNavigation<any>()
  const { session, birthProfile } = useAuthStore()
  const { chartData } = useReadingStore()
  const { activeProfile, generatingStatus, isGenerating, error, generateCompatibility } = useRelationshipStore()

  const orbitAnim1 = useRef(new Animated.Value(0)).current
  const orbitAnim2 = useRef(new Animated.Value(0)).current
  const progressAnim = useRef(new Animated.Value(0)).current
  const msgIndex = useRef(new Animated.Value(0)).current
  const [msgIdx, setMsgIdx] = React.useState(0)
  const msgTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    // Orbit animations
    Animated.loop(
      Animated.timing(orbitAnim1, { toValue: 1, duration: 4000, useNativeDriver: true })
    ).start()
    Animated.loop(
      Animated.timing(orbitAnim2, { toValue: -1, duration: 5000, useNativeDriver: true })
    ).start()

    // Cycle messages
    msgTimer.current = setInterval(() => {
      setMsgIdx(i => (i + 1) % MESSAGES.length)
    }, 2200)

    // Progress bar
    Animated.timing(progressAnim, { toValue: 0.85, duration: 18000, useNativeDriver: false }).start()

    // Start generation
    if (session?.user?.id && birthProfile && chartData?.vedic && activeProfile) {
      const lang = null
      generateCompatibility(session.user.id, birthProfile, activeProfile, lang).then(result => {
        if (msgTimer.current) clearInterval(msgTimer.current)
        if (result) {
          Animated.timing(progressAnim, { toValue: 1, duration: 400, useNativeDriver: false }).start()
          setTimeout(() => navigation.replace('CompatibilityResult'), 400)
        }
      })
    }

    return () => { if (msgTimer.current) clearInterval(msgTimer.current) }
  }, [])

  useEffect(() => {
    if (error) {
      Alert.alert('Error', error, [{ text: 'Go Back', onPress: () => navigation.goBack() }])
    }
  }, [error])

  const spin1 = orbitAnim1.interpolate({ inputRange:[0,1], outputRange:['0deg','360deg'] })
  const spin2 = orbitAnim2.interpolate({ inputRange:[-1,0], outputRange:['-360deg','0deg'] })

  const currentMsg = generatingStatus || MESSAGES[msgIdx]

  return (
    <View style={st.root}>
      <Video source={Videos.splashBg} style={StyleSheet.absoluteFillObject}
        resizeMode={ResizeMode.COVER} isLooping shouldPlay isMuted />
      <LinearGradient colors={['rgba(5,5,15,0.5)','rgba(5,5,15,0.95)']} style={StyleSheet.absoluteFillObject} />

      <View style={st.content}>
        {/* Dual orbit animation */}
        <View style={st.orbitWrap}>
          {/* Center star */}
          <View style={st.centerStar}>
            <LinearGradient colors={['#C9A84C','#7B2FBE']} style={st.centerGrad} />
            <Text style={st.centerText}>✦</Text>
          </View>
          {/* Orbit 1 — Person 1 */}
          <Animated.View style={[st.orbit1Container, {transform:[{rotate:spin1}]}]}>
            <View style={[st.orbitDot, {backgroundColor:'#C9A84C'}]}>
              <Text style={st.orbitLetter}>
                {(activeProfile?.person_name || 'Y')[0]}
              </Text>
            </View>
          </Animated.View>
          {/* Orbit 2 — Person 2 */}
          <Animated.View style={[st.orbit2Container, {transform:[{rotate:spin2}]}]}>
            <View style={[st.orbitDot, {backgroundColor:'#2FBEBE'}]}>
              <Text style={st.orbitLetter}>
                {(useAuthStore.getState().profile?.display_name || 'Me')[0]}
              </Text>
            </View>
          </Animated.View>
        </View>

        <Text style={st.title}>Reading the Cosmic Bond</Text>
        {activeProfile && (
          <Text style={st.names}>
            You {'<'}{'>'} {activeProfile.person_name}
          </Text>
        )}

        {/* Status message */}
        <Text style={st.statusMsg}>{currentMsg}</Text>

        {/* Progress bar */}
        <View style={st.progressTrack}>
          <Animated.View
            style={[st.progressFill, {
              width: progressAnim.interpolate({ inputRange:[0,1], outputRange:['0%','100%'] })
            }]}
          />
        </View>
        <Text style={st.progressNote}>3 parallel GROQ calls • Full Vedic analysis</Text>
      </View>
    </View>
  )
}

const ORBIT_R = 80
const st = StyleSheet.create({
  root:{flex:1,backgroundColor:Colors.background},
  content:{flex:1,alignItems:'center',justifyContent:'center',padding:32,gap:20},
  orbitWrap:{width:ORBIT_R*2+60,height:ORBIT_R*2+60,alignItems:'center',justifyContent:'center',marginBottom:16},
  centerStar:{width:52,height:52,borderRadius:26,overflow:'hidden',alignItems:'center',justifyContent:'center',zIndex:2},
  centerGrad:{...StyleSheet.absoluteFillObject},
  centerText:{fontSize:22,color:'#fff',zIndex:1},
  orbit1Container:{position:'absolute',width:ORBIT_R*2+60,height:ORBIT_R*2+60,alignItems:'center',justifyContent:'flex-start'},
  orbit2Container:{position:'absolute',width:ORBIT_R*2+60,height:ORBIT_R*2+60,alignItems:'flex-end',justifyContent:'center'},
  orbitDot:{width:36,height:36,borderRadius:18,alignItems:'center',justifyContent:'center'},
  orbitLetter:{fontFamily:Fonts.heading,fontSize:14,color:'#fff'},
  title:{fontFamily:Fonts.heading,fontSize:20,color:'#C9A84C',textAlign:'center'},
  names:{fontFamily:Fonts.mystical,fontSize:16,color:Colors.textSecondary,textAlign:'center'},
  statusMsg:{fontFamily:Fonts.body,fontSize:13,color:Colors.textMuted,textAlign:'center',minHeight:20},
  progressTrack:{width:'100%',height:3,backgroundColor:'rgba(255,255,255,0.07)',borderRadius:2,overflow:'hidden'},
  progressFill:{height:'100%',backgroundColor:'#C9A84C',borderRadius:2},
  progressNote:{fontFamily:Fonts.body,fontSize:10,color:Colors.textMuted,letterSpacing:0.5},
})
