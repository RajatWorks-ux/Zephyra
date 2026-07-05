// src/screens/relationship/CompatibilityResultScreen.tsx
import React, { useState, useRef } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, Dimensions, ActivityIndicator,
} from 'react-native'
import { Video, ResizeMode } from 'expo-av'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { useRelationshipStore } from '../../store/relationshipStore'
import { useAuthStore } from '../../store/authStore'
import { CompatibilityScoreRing } from './CompatibilityScoreRing'
import { KootaScoreBar } from './KootaScoreBar'
import { DualChartView } from './DualChartView'
import { Videos } from '../../constants/videos'
import { Colors } from '../../constants/colors'
import { Fonts } from '../../constants/fonts'
import { TAB_BAR_CONTENT_HEIGHT } from '../../components/ui/BottomTabBar'
import { speakText } from '../../services/audioService'
import { useAudioStore } from '../../store/audioStore'

const { width } = Dimensions.get('window')

const TABS = ['Overview', 'Charts', 'Reading', 'Forecast']

const DIM_ICONS: Record<string, string> = {
  emotional:'♡', intellectual:'◈', physical:'◉',
  spiritual:'✦', financial:'◎', career:'◬',
}

export function CompatibilityResultScreen() {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<any>()
  const [activeTab, setActiveTab] = useState(0)
  const { activeProfile, activeResult } = useRelationshipStore()
  const { profile } = useAuthStore()
  const { selectedVoice, setIsPlaying } = useAudioStore()

  if (!activeProfile || !activeResult) {
    return (
      <View style={{flex:1,backgroundColor:Colors.background,alignItems:'center',justifyContent:'center'}}>
        <ActivityIndicator color={Colors.agedGold} size="large" />
      </View>
    )
  }

  const koota = activeResult.koota_score
  const yogas = activeResult.yogas || []
  const reading = activeResult.full_reading_json

  const kootaColor = koota.total >= 31 ? '#44FF88' : koota.total >= 25 ? '#C9A84C' : koota.total >= 18 ? '#FF9944' : '#FF4444'

  async function handleSpeak(text: string, source: string) {
    if (!text) return
    setIsPlaying(true)
    await speakText(text, 'en-US', selectedVoice)
    setIsPlaying(false)
  }

  function SectionCard({ title, content, icon }: { title: string; content: string; icon?: string }) {
    const [expanded, setExpanded] = useState(false)
    return (
      <TouchableOpacity
        onPress={() => { Haptics.selectionAsync(); setExpanded(e => !e) }}
        activeOpacity={0.9} style={sc.wrap}
      >
        <BlurView intensity={15} tint="dark" style={sc.card}>
          <View style={sc.header}>
            <View style={sc.headerLeft}>
              {icon && <Text style={sc.icon}>{icon}</Text>}
              <Text style={sc.title}>{title}</Text>
            </View>
            <View style={sc.headerRight}>
              <TouchableOpacity
                onPress={() => handleSpeak(content, title)}
                style={sc.speakBtn}
                onLongPress={() => handleSpeak(content, title)}
              >
                <Text style={sc.speakIcon}>◎</Text>
              </TouchableOpacity>
              <Text style={sc.chevron}>{expanded ? '▲' : '▼'}</Text>
            </View>
          </View>
          {expanded && <Text style={sc.body}>{content}</Text>}
          {!expanded && (
            <Text style={sc.preview} numberOfLines={2}>{content}</Text>
          )}
        </BlurView>
      </TouchableOpacity>
    )
  }

  const renderOverview = () => (
    <ScrollView contentContainerStyle={{gap:16, paddingBottom:120}} showsVerticalScrollIndicator={false}>
      {/* Persons + score */}
      <BlurView intensity={15} tint="dark" style={[ov.card, {alignItems:'center', gap:16}]}>
        <View style={ov.personsRow}>
          {/* Person 1 avatar */}
          <View style={ov.avatarWrap}>
            <LinearGradient colors={['#7B2FBE','#C9A84C']} style={StyleSheet.absoluteFillObject} />
            <Text style={ov.avatarLetter}>{(profile?.display_name||'Y')[0].toUpperCase()}</Text>
          </View>
          <Text style={ov.connector}>{'<'}✦{'>'}</Text>
          {/* Person 2 avatar */}
          <View style={ov.avatarWrap}>
            <LinearGradient colors={['#2FBEBE','#7B2FBE']} style={StyleSheet.absoluteFillObject} />
            <Text style={ov.avatarLetter}>{activeProfile.person_name[0].toUpperCase()}</Text>
          </View>
        </View>
        <CompatibilityScoreRing score={activeResult.overall_score} size={110} />
        <Text style={ov.scoreLabel}>Cosmic Compatibility</Text>
        {/* Koota total */}
        <View style={[ov.kootaBar]}>
          <Text style={ov.kootaLabel}>Ashta Koota Score</Text>
          <View style={ov.kootaTrack}>
            <View style={[ov.kootaFill, {width:`${(koota.total/36)*100}%`, backgroundColor:kootaColor}]} />
          </View>
          <Text style={[ov.kootaVal, {color:kootaColor}]}>{koota.total}/36 — {koota.tier.charAt(0).toUpperCase()+koota.tier.slice(1)}</Text>
        </View>
      </BlurView>

      {/* Dimension scores */}
      <BlurView intensity={12} tint="dark" style={[ov.card]}>
        <Text style={ov.sectionTitle}>Compatibility Dimensions</Text>
        <View style={ov.dimGrid}>
          {[
            {key:'emotional', val:activeResult.emotional_score},
            {key:'intellectual', val:activeResult.intellectual_score},
            {key:'physical', val:activeResult.physical_score},
            {key:'spiritual', val:activeResult.spiritual_score},
            {key:'financial', val:activeResult.financial_score},
            {key:'career', val:activeResult.career_score},
          ].map(({key,val}) => {
            const c = val>=75?'#44FF88':val>=50?'#C9A84C':val>=30?'#FF9944':'#FF4444'
            return (
              <View key={key} style={ov.dimCard}>
                <BlurView intensity={10} tint="dark" style={ov.dimBlur}>
                  <Text style={ov.dimIcon}>{DIM_ICONS[key]||'◉'}</Text>
                  <Text style={[ov.dimVal, {color:c}]}>{val}</Text>
                  <View style={ov.dimTrack}>
                    <View style={[ov.dimFill, {width:`${val}%`, backgroundColor:c}]} />
                  </View>
                  <Text style={ov.dimKey}>{key.charAt(0).toUpperCase()+key.slice(1)}</Text>
                </BlurView>
              </View>
            )
          })}
        </View>
      </BlurView>

      {/* Yogas */}
      {yogas.filter(y=>y.type==='strength').length > 0 && (
        <BlurView intensity={12} tint="dark" style={ov.card}>
          <Text style={ov.sectionTitle}>✦ Cosmic Strengths</Text>
          {yogas.filter(y=>y.type==='strength').map((y,i) => (
            <View key={i} style={ov.yogaCard}>
              <LinearGradient colors={['rgba(68,255,136,0.08)','rgba(0,0,0,0)']} style={StyleSheet.absoluteFillObject} />
              <Text style={ov.yogaHeadline}>{y.headline}</Text>
              <Text style={ov.yogaDesc}>{y.description}</Text>
            </View>
          ))}
        </BlurView>
      )}

      {yogas.filter(y=>y.type==='warning').length > 0 && (
        <BlurView intensity={12} tint="dark" style={ov.card}>
          <Text style={ov.sectionTitle}>⚠ Areas of Awareness</Text>
          {yogas.filter(y=>y.type==='warning').map((y,i) => (
            <View key={i} style={ov.yogaCard}>
              <LinearGradient colors={['rgba(255,153,68,0.08)','rgba(0,0,0,0)']} style={StyleSheet.absoluteFillObject} />
              <Text style={[ov.yogaHeadline,{color:'#FF9944'}]}>{y.headline}</Text>
              <Text style={ov.yogaDesc}>{y.description}</Text>
            </View>
          ))}
        </BlurView>
      )}

      {/* Chat CTA */}
      <TouchableOpacity
        onPress={() => navigation.navigate('RelationshipChat')}
        style={ov.chatBtn} activeOpacity={0.85}
      >
        <LinearGradient colors={['#7B2FBE','#2FBEBE']} style={ov.chatGrad} start={{x:0,y:0}} end={{x:1,y:0}}>
          <Text style={ov.chatBtnText}>◈ Chat About This Connection</Text>
        </LinearGradient>
      </TouchableOpacity>
    </ScrollView>
  )

  const renderCharts = () => {
    const chart1 = useReadingStore.getState().chartData?.vedic
    const chart2Cache = activeProfile.chart_data_cache
    let chart2 = null
    try { chart2 = typeof chart2Cache === 'string' ? JSON.parse(chart2Cache) : chart2Cache } catch {}
    return (
      <ScrollView contentContainerStyle={{gap:16, paddingBottom:120}} showsVerticalScrollIndicator={false}>
        {chart1 && chart2 ? (
          <DualChartView
            chart1={chart1} chart2={chart2}
            name1={profile?.display_name || 'You'}
            name2={activeProfile.person_name}
          />
        ) : (
          <Text style={{color:Colors.textMuted, textAlign:'center', padding:20}}>Chart data loading...</Text>
        )}
        <View style={{paddingHorizontal:16}}>
          <KootaScoreBar koota={koota} />
        </View>
      </ScrollView>
    )
  }

  const renderReading = () => (
    <ScrollView contentContainerStyle={{gap:14, paddingHorizontal:16, paddingBottom:120}} showsVerticalScrollIndicator={false}>
      <SectionCard title="The Bond Identity" content={reading.bond_identity} icon="✦" />
      <SectionCard title="Cosmic Strengths" content={reading.bond_strengths} icon="◎" />
      <SectionCard title="Honest Challenges" content={reading.bond_challenges} icon="⚠" />
      <SectionCard title="Next 12 Months" content={reading.period_forecast} icon="◐" />
      <SectionCard title="For This Relationship Type" content={reading.relationship_type_specific} icon="◈" />
      <SectionCard title="Practical Guidance" content={reading.practical_guidance} icon="◬" />
      <TouchableOpacity
        onPress={() => navigation.navigate('RelationshipChat')}
        style={{borderRadius:16,overflow:'hidden',marginTop:8}} activeOpacity={0.85}
      >
        <LinearGradient colors={['#7B2FBE','#2FBEBE']} style={{height:52,alignItems:'center',justifyContent:'center'}} start={{x:0,y:0}} end={{x:1,y:0}}>
          <Text style={{fontFamily:Fonts.heading,fontSize:13,color:'#fff'}}>◈ Chat About This Reading</Text>
        </LinearGradient>
      </TouchableOpacity>
    </ScrollView>
  )

  const renderForecast = () => (
    <ScrollView contentContainerStyle={{padding:16,gap:12,paddingBottom:120}} showsVerticalScrollIndicator={false}>
      <BlurView intensity={15} tint="dark" style={{borderRadius:16,padding:18,overflow:'hidden',borderWidth:1,borderColor:'rgba(255,255,255,0.06)'}}>
        <Text style={{fontFamily:Fonts.heading,fontSize:14,color:'#C9A84C',marginBottom:8}}>Relationship Forecast</Text>
        <Text style={{fontFamily:Fonts.mystical,fontSize:15,color:Colors.textSecondary,lineHeight:26}}>
          {reading.period_forecast || 'Based on your combined Dasha timing and current transits, your relationship forecast is being prepared. Navigate to the Relationship Forecast screen for daily and monthly views.'}
        </Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('RelationshipForecast')}
          style={{marginTop:14,borderRadius:12,overflow:'hidden'}} activeOpacity={0.85}
        >
          <LinearGradient colors={['rgba(123,47,190,0.4)','rgba(47,190,190,0.4)']} style={{height:44,alignItems:'center',justifyContent:'center'}} start={{x:0,y:0}} end={{x:1,y:0}}>
            <Text style={{fontFamily:Fonts.heading,fontSize:12,color:'#fff'}}>Open Full Forecast →</Text>
          </LinearGradient>
        </TouchableOpacity>
      </BlurView>
    </ScrollView>
  )

  const TAB_CONTENT = [renderOverview, renderCharts, renderReading, renderForecast]

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
        <View style={st.headerCenter}>
          <Text style={st.headerTitle} numberOfLines={1}>
            {profile?.display_name?.split(' ')[0]} {'<'}✦{'>'} {activeProfile.person_name.split(' ')[0]}
          </Text>
          <Text style={st.headerSub}>{activeProfile.relationship_types[0]}</Text>
        </View>
        <View style={{width:40}} />
      </View>

      {/* Tab pills */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={st.tabBar} contentContainerStyle={st.tabBarContent}
      >
        {TABS.map((tab, i) => (
          <TouchableOpacity
            key={tab}
            onPress={() => { Haptics.selectionAsync(); setActiveTab(i) }}
            style={[st.tabPill, activeTab === i && st.tabPillActive]}
          >
            <Text style={[st.tabText, activeTab === i && st.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      <View style={{flex:1}}>
        {TAB_CONTENT[activeTab]()}
      </View>
    </View>
  )
}

// inline imports for renderCharts
import { useReadingStore } from '../../store/readingStore'

const st = StyleSheet.create({
  root:{flex:1,backgroundColor:Colors.background},
  header:{flexDirection:'row',alignItems:'center',paddingHorizontal:20,paddingBottom:12},
  backBtn:{width:40,height:40,alignItems:'center',justifyContent:'center'},
  backArrow:{fontSize:22,color:'#C9A84C'},
  headerCenter:{flex:1,alignItems:'center'},
  headerTitle:{fontFamily:Fonts.heading,fontSize:15,color:'#C9A84C'},
  headerSub:{fontFamily:Fonts.body,fontSize:10,color:Colors.textMuted,marginTop:2},
  tabBar:{flexGrow:0},
  tabBarContent:{paddingHorizontal:16,gap:10,paddingBottom:12},
  tabPill:{paddingHorizontal:18,paddingVertical:8,borderRadius:20,borderWidth:1,borderColor:'rgba(255,255,255,0.1)'},
  tabPillActive:{backgroundColor:'rgba(201,168,76,0.15)',borderColor:'#C9A84C'},
  tabText:{fontFamily:Fonts.body,fontSize:13,color:Colors.textMuted},
  tabTextActive:{color:'#C9A84C',fontFamily:Fonts.bodySemiBold},
})
const ov = StyleSheet.create({
  card:{borderRadius:18,padding:18,overflow:'hidden',borderWidth:1,borderColor:'rgba(255,255,255,0.06)',marginHorizontal:16},
  personsRow:{flexDirection:'row',alignItems:'center',gap:16},
  avatarWrap:{width:56,height:56,borderRadius:28,overflow:'hidden',alignItems:'center',justifyContent:'center'},
  avatarLetter:{fontFamily:Fonts.heading,fontSize:20,color:'#fff',zIndex:1},
  connector:{fontSize:18,color:'rgba(201,168,76,0.5)'},
  scoreLabel:{fontFamily:Fonts.mystical,fontSize:13,color:Colors.textMuted},
  kootaBar:{width:'100%',gap:8},
  kootaLabel:{fontFamily:Fonts.body,fontSize:11,color:Colors.textMuted},
  kootaTrack:{width:'100%',height:5,backgroundColor:'rgba(255,255,255,0.07)',borderRadius:3,overflow:'hidden'},
  kootaFill:{height:'100%',borderRadius:3},
  kootaVal:{fontFamily:Fonts.bodySemiBold,fontSize:12},
  sectionTitle:{fontFamily:Fonts.heading,fontSize:13,color:'#C9A84C',marginBottom:14},
  dimGrid:{flexDirection:'row',flexWrap:'wrap',gap:10},
  dimCard:{width:'30%'},
  dimBlur:{borderRadius:12,padding:10,overflow:'hidden',borderWidth:1,borderColor:'rgba(255,255,255,0.06)',alignItems:'center',gap:4},
  dimIcon:{fontSize:16,color:Colors.textMuted},
  dimVal:{fontFamily:Fonts.heading,fontSize:16},
  dimTrack:{width:'100%',height:3,backgroundColor:'rgba(255,255,255,0.07)',borderRadius:2,overflow:'hidden'},
  dimFill:{height:'100%',borderRadius:2},
  dimKey:{fontFamily:Fonts.body,fontSize:9,color:Colors.textMuted,textAlign:'center'},
  yogaCard:{borderRadius:12,padding:12,overflow:'hidden',borderWidth:1,borderColor:'rgba(255,255,255,0.06)',marginBottom:8},
  yogaHeadline:{fontFamily:Fonts.bodySemiBold,fontSize:13,color:'#44FF88',marginBottom:6},
  yogaDesc:{fontFamily:Fonts.body,fontSize:12,color:Colors.textSecondary,lineHeight:20},
  chatBtn:{borderRadius:16,overflow:'hidden',marginHorizontal:16},
  chatGrad:{height:52,alignItems:'center',justifyContent:'center',borderRadius:16},
  chatBtnText:{fontFamily:Fonts.heading,fontSize:13,color:'#fff'},
})
const sc = StyleSheet.create({
  wrap:{borderRadius:16,overflow:'hidden'},
  card:{borderRadius:16,padding:16,overflow:'hidden',borderWidth:1,borderColor:'rgba(255,255,255,0.06)'},
  header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  headerLeft:{flexDirection:'row',alignItems:'center',gap:10,flex:1},
  headerRight:{flexDirection:'row',alignItems:'center',gap:10},
  icon:{fontSize:16,color:'#C9A84C'},
  title:{fontFamily:Fonts.heading,fontSize:13,color:'#C9A84C',flex:1},
  speakBtn:{padding:4},
  speakIcon:{fontSize:14,color:Colors.textMuted},
  chevron:{fontSize:10,color:Colors.textMuted},
  body:{fontFamily:Fonts.body,fontSize:14,color:Colors.textSecondary,lineHeight:24,marginTop:12},
  preview:{fontFamily:Fonts.body,fontSize:13,color:Colors.textMuted,lineHeight:22,marginTop:10},
})
