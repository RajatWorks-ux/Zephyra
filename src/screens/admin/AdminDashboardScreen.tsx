// src/screens/admin/AdminDashboardScreen.tsx
import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native'
import { Video, ResizeMode } from 'expo-av'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { supabase } from '../../services/supabase'
import { useAdminStore } from '../../store/adminStore'
import { AdminStatCard } from '../../components/admin/AdminStatCard'
import { RetentionGraph } from '../../components/admin/RetentionGraph'
import { Videos } from '../../constants/videos'
import { Colors } from '../../constants/colors'
import { Fonts } from '../../constants/fonts'

export function AdminDashboardScreen() {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<any>()
  const { clearAdminMode } = useAdminStore()
  const [stats, setStats] = useState({ total:0, today:0, week:0, month:0, readings:0, messages:0 })

  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    try {
      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      const weekStart = new Date(now.getTime() - 7*24*60*60*1000).toISOString()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

      const [{ count: total }, { count: today }, { count: week }, { count: month }, { count: readings }, { count: msgs }] = await Promise.all([
        supabase.from('profiles').select('*', {count:'exact',head:true}),
        supabase.from('profiles').select('*', {count:'exact',head:true}).gte('updated_at', todayStart),
        supabase.from('profiles').select('*', {count:'exact',head:true}).gte('updated_at', weekStart),
        supabase.from('profiles').select('*', {count:'exact',head:true}).gte('updated_at', monthStart),
        supabase.from('reading_history_log').select('*', {count:'exact',head:true}),
        supabase.from('chat_messages').select('*', {count:'exact',head:true}),
      ])

      setStats({ total: total||0, today: today||0, week: week||0, month: month||0, readings: readings||0, messages: msgs||0 })
    } catch (e) { console.warn('Admin stats error:', e) }
  }

  function handleExit() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    Alert.alert('Exit Admin', 'Leave the admin panel?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Exit', onPress: () => { clearAdminMode(); navigation.goBack() } },
    ])
  }

  return (
    <View style={st.root}>
      <Video source={Videos.splashBg} style={StyleSheet.absoluteFillObject}
        resizeMode={ResizeMode.COVER} isLooping shouldPlay isMuted />
      <LinearGradient colors={['rgba(5,5,15,0.3)','rgba(30,5,60,0.9)']} style={StyleSheet.absoluteFillObject} />

      {/* Header */}
      <View style={[st.header, {paddingTop: insets.top + 12}]}>
        <View>
          <Text style={st.headerTitle}>Admin</Text>
          <Text style={st.headerSub}>Zephyra Control Panel</Text>
        </View>
        <TouchableOpacity onPress={handleExit} style={st.exitBtn}>
          <BlurView intensity={20} tint="dark" style={st.exitBlur}>
            <Text style={st.exitText}>Exit</Text>
          </BlurView>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[st.scroll, {paddingBottom: insets.bottom + 32}]}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats grid */}
        <Text style={st.sectionTitle}>User Activity</Text>
        <View style={st.statsGrid}>
          <AdminStatCard icon="◉" value={stats.total} label="Total Users" color="#C9A84C" />
          <AdminStatCard icon="◐" value={stats.today} label="Active Today" color="#44FF88" />
          <AdminStatCard icon="◎" value={stats.week} label="This Week" color="#2FBEBE" />
          <AdminStatCard icon="◈" value={stats.month} label="This Month" color="#7B2FBE" />
        </View>

        {/* Feature usage */}
        <Text style={st.sectionTitle}>Feature Usage</Text>
        <BlurView intensity={15} tint="dark" style={st.usageCard}>
          <LinearGradient colors={['rgba(123,47,190,0.12)','rgba(0,0,0,0)']} style={StyleSheet.absoluteFillObject} />
          {[
            { label:'Readings Generated', val: stats.readings, icon:'✦', color:'#C9A84C' },
            { label:'Chat Messages', val: stats.messages, icon:'◈', color:'#2FBEBE' },
          ].map(item => (
            <View key={item.label} style={st.usageRow}>
              <Text style={st.usageIcon}>{item.icon}</Text>
              <View style={st.usageInfo}>
                <Text style={st.usageLabel}>{item.label}</Text>
                <View style={st.usageBarWrap}>
                  <View style={[st.usageBarFill, {width:`${Math.min(100,(item.val/Math.max(stats.total,1))*100)}%`, backgroundColor:item.color}]} />
                </View>
              </View>
              <Text style={[st.usageVal, {color:item.color}]}>{item.val}</Text>
            </View>
          ))}
        </BlurView>

        {/* Retention graph */}
        <Text style={st.sectionTitle}>Retention</Text>
        <RetentionGraph />

        {/* Navigation */}
        <Text style={st.sectionTitle}>Tools</Text>
        <BlurView intensity={15} tint="dark" style={st.toolsCard}>
          {[
            { label:'Messages & Polls', icon:'◎', onPress: () => navigation.navigate('AdminMessages') },
          ].map(item => (
            <TouchableOpacity
              key={item.label}
              style={st.toolRow}
              onPress={() => { Haptics.selectionAsync(); item.onPress() }}
              activeOpacity={0.8}
            >
              <LinearGradient colors={['rgba(123,47,190,0.15)','rgba(0,0,0,0)']} style={StyleSheet.absoluteFillObject} />
              <Text style={st.toolIcon}>{item.icon}</Text>
              <Text style={st.toolLabel}>{item.label}</Text>
              <Text style={st.toolChevron}>›</Text>
            </TouchableOpacity>
          ))}
        </BlurView>
      </ScrollView>
    </View>
  )
}

const st = StyleSheet.create({
  root:{flex:1,backgroundColor:Colors.background},
  header:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',paddingHorizontal:20,paddingBottom:16},
  headerTitle:{fontFamily:Fonts.heading,fontSize:22,color:'#C9A84C'},
  headerSub:{fontFamily:Fonts.body,fontSize:12,color:Colors.textMuted,marginTop:4},
  exitBtn:{borderRadius:16,overflow:'hidden'},
  exitBlur:{paddingHorizontal:16,paddingVertical:10,borderRadius:16,borderWidth:1,borderColor:'rgba(255,68,68,0.3)',overflow:'hidden'},
  exitText:{fontFamily:Fonts.body,fontSize:13,color:'#FF6666'},
  scroll:{padding:20,gap:12},
  sectionTitle:{fontFamily:Fonts.heading,fontSize:13,color:'#C9A84C',marginTop:8},
  statsGrid:{flexDirection:'row',flexWrap:'wrap',gap:12},
  usageCard:{borderRadius:18,padding:18,overflow:'hidden',borderWidth:1,borderColor:'rgba(123,47,190,0.3)',gap:14},
  usageRow:{flexDirection:'row',alignItems:'center',gap:12},
  usageIcon:{fontSize:18,color:Colors.textMuted,width:24},
  usageInfo:{flex:1,gap:6},
  usageLabel:{fontFamily:Fonts.body,fontSize:12,color:Colors.textSecondary},
  usageBarWrap:{height:4,backgroundColor:'rgba(255,255,255,0.06)',borderRadius:2,overflow:'hidden'},
  usageBarFill:{height:'100%',borderRadius:2},
  usageVal:{fontFamily:Fonts.heading,fontSize:16,width:60,textAlign:'right'},
  toolsCard:{borderRadius:18,overflow:'hidden',borderWidth:1,borderColor:'rgba(123,47,190,0.3)'},
  toolRow:{flexDirection:'row',alignItems:'center',padding:18,gap:14,overflow:'hidden',borderBottomWidth:1,borderBottomColor:'rgba(255,255,255,0.05)'},
  toolIcon:{fontSize:20,color:'#C9A84C',width:28},
  toolLabel:{flex:1,fontFamily:Fonts.body,fontSize:15,color:'#E8E8FF'},
  toolChevron:{fontSize:20,color:Colors.textMuted},
})
