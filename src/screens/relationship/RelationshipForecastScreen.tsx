// src/screens/relationship/RelationshipForecastScreen.tsx
import React, { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native'
import { Video, ResizeMode } from 'expo-av'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import * as Haptics from 'expo-haptics'
import { useRelationshipStore } from '../../store/relationshipStore'
import { Videos } from '../../constants/videos'
import { Colors } from '../../constants/colors'
import { Fonts } from '../../constants/fonts'

const { width } = Dimensions.get('window')
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function getDayScore(dayOffset: number, seed: number): number {
  // Deterministic pseudo-random based on date + relationship seed
  const val = Math.sin(dayOffset * 2.618 + seed * 1.414) * 0.5 + 0.5
  return Math.round(30 + val * 60)
}

function getDayColor(score: number): string {
  if (score >= 70) return '#44FF88'
  if (score >= 50) return '#C9A84C'
  return '#FF6644'
}

export function RelationshipForecastScreen() {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<any>()
  const { activeProfile, activeResult } = useRelationshipStore()
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  const seed = activeResult?.overall_score || 60
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const dayGuidance: Record<number, string> = {
    0: 'Ideal for heart-to-heart conversation. Emotional tides are aligned.',
    1: 'Focus on shared goals today. Practical collaboration flows easily.',
    2: 'A quiet day — give space to allow individual energy to recharge.',
    3: 'Mercury favours clear communication. Resolve any pending discussions.',
    4: 'Social energy peaks. A shared activity or outing strengthens the bond.',
    5: 'Venus transit brings warmth. Appreciation and affection expressed openly.',
    6: 'Reflective energy — review the week together and set shared intentions.',
  }

  return (
    <View style={st.root}>
      <Video source={Videos.splashBg} style={StyleSheet.absoluteFillObject}
        resizeMode={ResizeMode.COVER} isLooping shouldPlay isMuted />
      <LinearGradient colors={['rgba(5,5,15,0.4)','rgba(5,5,15,0.92)']} style={StyleSheet.absoluteFillObject} />

      {/* Header */}
      <View style={[st.header, {paddingTop: insets.top + 12}]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={st.backBtn}>
          <Text style={st.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={st.headerTitle} numberOfLines={1}>
          {activeProfile?.person_name || 'Relationship'} Forecast
        </Text>
        <View style={{width:40}} />
      </View>

      <ScrollView contentContainerStyle={[st.scroll, {paddingBottom: insets.bottom + 100}]} showsVerticalScrollIndicator={false}>
        <Text style={st.monthLabel}>{MONTHS[month]} {year}</Text>

        {/* Calendar grid */}
        <BlurView intensity={12} tint="dark" style={st.calCard}>
          {/* Day labels */}
          <View style={st.dayLabels}>
            {DAYS.map(d => (
              <Text key={d} style={st.dayLabel}>{d}</Text>
            ))}
          </View>
          {/* Calendar cells */}
          <View style={st.grid}>
            {Array(firstDay).fill(null).map((_, i) => (
              <View key={`empty-${i}`} style={st.emptyCell} />
            ))}
            {Array(daysInMonth).fill(null).map((_, i) => {
              const day = i + 1
              const isToday = day === today.getDate()
              const score = getDayScore(i, seed)
              const color = getDayColor(score)
              const isSelected = selectedDay === day
              return (
                <TouchableOpacity
                  key={day}
                  style={[st.dayCell, isSelected && st.dayCellSelected]}
                  onPress={() => { Haptics.selectionAsync(); setSelectedDay(isSelected ? null : day) }}
                >
                  {isToday && <View style={st.todayRing} />}
                  <Text style={[st.dayNum, isToday && st.dayNumToday]}>{day}</Text>
                  <View style={[st.scoreDot, {backgroundColor: color}]} />
                </TouchableOpacity>
              )
            })}
          </View>

          {/* Legend */}
          <View style={st.legend}>
            {[{color:'#44FF88',label:'Favorable'},{color:'#C9A84C',label:'Neutral'},{color:'#FF6644',label:'Challenging'}].map(l => (
              <View key={l.label} style={st.legendItem}>
                <View style={[st.legendDot, {backgroundColor:l.color}]} />
                <Text style={st.legendText}>{l.label}</Text>
              </View>
            ))}
          </View>
        </BlurView>

        {/* Day detail bottom sheet */}
        {selectedDay !== null && (
          <BlurView intensity={20} tint="dark" style={st.detailCard}>
            <LinearGradient colors={['rgba(123,47,190,0.12)','rgba(0,0,0,0)']} style={StyleSheet.absoluteFillObject} />
            <Text style={st.detailDate}>{MONTHS[month]} {selectedDay}</Text>
            <Text style={st.detailScore}>
              Combined Score: <Text style={{color:getDayColor(getDayScore(selectedDay-1, seed))}}>{getDayScore(selectedDay-1, seed)}</Text>
            </Text>
            <Text style={st.detailGuidance}>{dayGuidance[selectedDay % 7]}</Text>
            <TouchableOpacity
              style={st.chatDayBtn}
              onPress={() => navigation.navigate('RelationshipChat')}
              activeOpacity={0.85}
            >
              <Text style={st.chatDayBtnText}>◈ Chat About This Day</Text>
            </TouchableOpacity>
          </BlurView>
        )}

        {/* Period forecast from reading */}
        {activeResult?.full_reading_json?.period_forecast && (
          <BlurView intensity={12} tint="dark" style={st.periodCard}>
            <Text style={st.periodTitle}>12-Month Period Forecast</Text>
            <Text style={st.periodText}>{activeResult.full_reading_json.period_forecast}</Text>
          </BlurView>
        )}
      </ScrollView>
    </View>
  )
}

const CELL_W = (width - 64) / 7
const st = StyleSheet.create({
  root:{flex:1,backgroundColor:Colors.background},
  header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:20,paddingBottom:16},
  backBtn:{width:40,height:40,alignItems:'center',justifyContent:'center'},
  backArrow:{fontSize:22,color:'#C9A84C'},
  headerTitle:{fontFamily:Fonts.heading,fontSize:16,color:'#C9A84C',flex:1,textAlign:'center'},
  scroll:{padding:16,gap:16},
  monthLabel:{fontFamily:Fonts.heading,fontSize:14,color:'#C9A84C',textAlign:'center'},
  calCard:{borderRadius:18,padding:16,overflow:'hidden',borderWidth:1,borderColor:'rgba(255,255,255,0.06)'},
  dayLabels:{flexDirection:'row',marginBottom:8},
  dayLabel:{width:CELL_W,textAlign:'center',fontFamily:Fonts.body,fontSize:10,color:Colors.textMuted},
  grid:{flexDirection:'row',flexWrap:'wrap'},
  emptyCell:{width:CELL_W,height:46},
  dayCell:{width:CELL_W,height:46,alignItems:'center',justifyContent:'center',gap:3,borderRadius:8},
  dayCellSelected:{backgroundColor:'rgba(201,168,76,0.12)',borderWidth:1,borderColor:'rgba(201,168,76,0.3)'},
  todayRing:{position:'absolute',top:4,right:4,width:6,height:6,borderRadius:3,backgroundColor:'#C9A84C'},
  dayNum:{fontFamily:Fonts.body,fontSize:12,color:'#E8E8FF'},
  dayNumToday:{color:'#C9A84C',fontFamily:Fonts.bodySemiBold},
  scoreDot:{width:5,height:5,borderRadius:3},
  legend:{flexDirection:'row',justifyContent:'center',gap:20,marginTop:16},
  legendItem:{flexDirection:'row',alignItems:'center',gap:6},
  legendDot:{width:8,height:8,borderRadius:4},
  legendText:{fontFamily:Fonts.body,fontSize:10,color:Colors.textMuted},
  detailCard:{borderRadius:18,padding:18,overflow:'hidden',borderWidth:1,borderColor:'rgba(201,168,76,0.2)',gap:8},
  detailDate:{fontFamily:Fonts.heading,fontSize:14,color:'#C9A84C'},
  detailScore:{fontFamily:Fonts.body,fontSize:13,color:Colors.textSecondary},
  detailGuidance:{fontFamily:Fonts.mystical,fontSize:15,color:Colors.textSecondary,lineHeight:24},
  chatDayBtn:{marginTop:8,backgroundColor:'rgba(123,47,190,0.25)',borderRadius:10,padding:12,alignItems:'center',borderWidth:1,borderColor:'rgba(123,47,190,0.4)'},
  chatDayBtnText:{fontFamily:Fonts.heading,fontSize:12,color:'#fff'},
  periodCard:{borderRadius:18,padding:18,overflow:'hidden',borderWidth:1,borderColor:'rgba(255,255,255,0.06)',gap:10},
  periodTitle:{fontFamily:Fonts.heading,fontSize:13,color:'#C9A84C'},
  periodText:{fontFamily:Fonts.body,fontSize:13,color:Colors.textSecondary,lineHeight:22},
})
