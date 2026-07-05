// src/screens/relationship/RelationshipListScreen.tsx
import React, { useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, ActivityIndicator, Dimensions, RefreshControl,
} from 'react-native'
import { Video, ResizeMode } from 'expo-av'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { useAuthStore } from '../../store/authStore'
import { useRelationshipStore } from '../../store/relationshipStore'
import { CompatibilityScoreRing } from './CompatibilityScoreRing'
import { Videos } from '../../constants/videos'
import { Colors } from '../../constants/colors'
import { Fonts } from '../../constants/fonts'
import { TAB_BAR_CONTENT_HEIGHT } from '../../components/ui/BottomTabBar'
import type { RelationshipProfile } from '../../types'

const { width } = Dimensions.get('window')

const TYPE_LABELS: Record<string, string> = {
  romantic:'Romantic', marriage:'Marriage', business:'Business',
  friendship:'Friendship', family_parent:'Parent', family_child:'Child',
  family_sibling:'Sibling', teacher_student:'Mentor', rivalry:'Rival',
  colleague:'Colleague', healer:'Healer', creative_partner:'Creative',
}

export function RelationshipListScreen() {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<any>()
  const { session, profile } = useAuthStore()
  const { profiles, isLoadingProfiles, activeResult, loadProfiles, setActiveProfile, deleteProfile, loadExistingResult } = useRelationshipStore()

  useEffect(() => {
    if (session?.user?.id) loadProfiles(session.user.id)
  }, [session?.user?.id])

  const handleSelect = useCallback(async (p: RelationshipProfile) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setActiveProfile(p)
    if (session?.user?.id) await loadExistingResult(session.user.id, p.id)
    navigation.navigate('CompatibilityResult')
  }, [session?.user?.id])

  const handleLongPress = useCallback((p: RelationshipProfile) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    Alert.alert(p.person_name, 'What would you like to do?', [
      { text: 'Regenerate Reading', onPress: () => {
        setActiveProfile(p)
        navigation.navigate('CompatibilityLoading')
      }},
      { text: 'Delete', style: 'destructive', onPress: () => {
        Alert.alert('Delete', `Remove ${p.person_name}?`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
            deleteProfile(p.id)
          }},
        ])
      }},
      { text: 'Cancel', style: 'cancel' },
    ])
  }, [])

  function renderItem({ item }: { item: RelationshipProfile }) {
    const types = item.relationship_types || []
    const initials = item.person_name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()
    const today = new Date()
    const isAnniversary = item.relationship_start_date && (() => {
      const d = new Date(item.relationship_start_date!)
      return d.getDate() === today.getDate() && d.getMonth() === today.getMonth()
    })()

    return (
      <TouchableOpacity
        onPress={() => handleSelect(item)}
        onLongPress={() => handleLongPress(item)}
        activeOpacity={0.85}
        style={st.cardWrap}
      >
        <BlurView intensity={15} tint="dark" style={st.card}>
          <LinearGradient
            colors={['rgba(123,47,190,0.08)','rgba(5,5,15,0.0)']}
            style={StyleSheet.absoluteFillObject}
          />
          {isAnniversary && (
            <View style={st.anniversaryBanner}>
              <Text style={st.anniversaryText}>✦ Anniversary Today</Text>
            </View>
          )}
          <View style={st.row}>
            {/* Avatar */}
            <View style={st.avatarWrap}>
              <LinearGradient colors={['#2FBEBE','#7B2FBE']} style={st.avatar} />
              <Text style={st.avatarText}>{initials}</Text>
            </View>
            {/* Info */}
            <View style={st.info}>
              <Text style={st.name}>{item.person_name}</Text>
              <View style={st.pills}>
                {types.slice(0,2).map(t => (
                  <View key={t} style={st.pill}>
                    <Text style={st.pillText}>{TYPE_LABELS[t] || t}</Text>
                  </View>
                ))}
              </View>
              <Text style={st.sub}>
                {(item as any).chart_data_cache
                  ? (() => { try { const c = JSON.parse((item as any).chart_data_cache); return `${c.lagna} · ${c.nakshatra}` } catch { return item.birth_city } })()
                  : item.birth_city
                }
              </Text>
            </View>
            {/* Score ring placeholder */}
            <CompatibilityScoreRing score={0} size={48} showLabel={false} />
          </View>
        </BlurView>
      </TouchableOpacity>
    )
  }

  const EmptyState = () => (
    <View style={st.empty}>
      <Text style={st.emptyIcon}>◎</Text>
      <Text style={st.emptyTitle}>Your Cosmic Connections</Text>
      <Text style={st.emptySub}>Add your first person to discover your compatibility through the Vedic lens</Text>
      <TouchableOpacity
        style={st.addBtn}
        onPress={() => navigation.navigate('AddPerson')}
        activeOpacity={0.85}
      >
        <LinearGradient colors={['#7B2FBE','#C9A84C']} style={st.addGrad} start={{x:0,y:0}} end={{x:1,y:0}}>
          <Text style={st.addText}>Add Someone</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  )

  return (
    <View style={st.root}>
      <Video source={Videos.splashBg} style={StyleSheet.absoluteFillObject}
        resizeMode={ResizeMode.COVER} isLooping shouldPlay isMuted />
      <LinearGradient colors={['rgba(5,5,15,0.4)','rgba(5,5,15,0.92)']} style={StyleSheet.absoluteFillObject} />

      {/* Header */}
      <View style={[st.header, { paddingTop: insets.top + 12 }]}>
        <Text style={st.headerTitle}>Your Connections</Text>
        <TouchableOpacity
          onPress={() => { Haptics.selectionAsync(); navigation.navigate('AddPerson') }}
          style={st.addIconBtn}
        >
          <BlurView intensity={20} tint="dark" style={st.addIconBlur}>
            <Text style={st.addIcon}>+</Text>
          </BlurView>
        </TouchableOpacity>
      </View>

      {isLoadingProfiles ? (
        <View style={st.loader}><ActivityIndicator color={Colors.agedGold} size="large" /></View>
      ) : (
        <FlatList
          data={profiles}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          ListEmptyComponent={EmptyState}
          contentContainerStyle={[
            st.list,
            { paddingBottom: insets.bottom + TAB_BAR_CONTENT_HEIGHT + 80 }
          ]}
          refreshControl={
            <RefreshControl
              refreshing={isLoadingProfiles}
              onRefresh={() => session?.user?.id && loadProfiles(session.user.id)}
              tintColor={Colors.agedGold}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  )
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection:'row', alignItems:'center', justifyContent:'space-between',
    paddingHorizontal:20, paddingBottom:16,
    borderBottomWidth:1, borderBottomColor:'rgba(201,168,76,0.1)',
  },
  headerTitle: { fontFamily:Fonts.heading, fontSize:18, color:'#C9A84C' },
  addIconBtn: { borderRadius:20, overflow:'hidden' },
  addIconBlur: {
    width:36, height:36, alignItems:'center', justifyContent:'center',
    borderRadius:18, borderWidth:1, borderColor:'rgba(201,168,76,0.3)', overflow:'hidden',
  },
  addIcon: { fontSize:20, color:'#C9A84C', lineHeight:22 },
  loader: { flex:1, alignItems:'center', justifyContent:'center' },
  list: { padding:16, gap:12 },
  cardWrap: { borderRadius:18, overflow:'hidden' },
  card: {
    borderRadius:18, padding:16, overflow:'hidden',
    borderWidth:1, borderColor:'rgba(255,255,255,0.06)',
  },
  anniversaryBanner: {
    backgroundColor:'rgba(201,168,76,0.15)', borderRadius:8,
    paddingHorizontal:10, paddingVertical:4, alignSelf:'flex-start', marginBottom:10,
  },
  anniversaryText: { fontFamily:Fonts.body, fontSize:10, color:'#C9A84C' },
  row: { flexDirection:'row', alignItems:'center', gap:14 },
  avatarWrap: { width:52, height:52, borderRadius:26, overflow:'hidden', alignItems:'center', justifyContent:'center' },
  avatar: { ...StyleSheet.absoluteFillObject },
  avatarText: { fontFamily:Fonts.heading, fontSize:18, color:'#fff', zIndex:1 },
  info: { flex:1, gap:5 },
  name: { fontFamily:Fonts.heading, fontSize:14, color:'#C9A84C' },
  pills: { flexDirection:'row', gap:6, flexWrap:'wrap' },
  pill: {
    backgroundColor:'rgba(123,47,190,0.25)', borderRadius:8,
    paddingHorizontal:8, paddingVertical:2,
    borderWidth:1, borderColor:'rgba(123,47,190,0.4)',
  },
  pillText: { fontFamily:Fonts.body, fontSize:9, color:'rgba(255,255,255,0.7)' },
  sub: { fontFamily:Fonts.body, fontSize:10, color:Colors.textMuted },
  empty: { alignItems:'center', paddingTop:80, paddingHorizontal:32, gap:16 },
  emptyIcon: { fontSize:48, color:'rgba(201,168,76,0.3)' },
  emptyTitle: { fontFamily:Fonts.heading, fontSize:18, color:'#C9A84C', textAlign:'center' },
  emptySub: { fontFamily:Fonts.mystical, fontSize:15, color:Colors.textMuted, textAlign:'center', lineHeight:24 },
  addBtn: { borderRadius:16, overflow:'hidden', marginTop:8, width:'80%' },
  addGrad: { height:52, alignItems:'center', justifyContent:'center', borderRadius:16 },
  addText: { fontFamily:Fonts.heading, fontSize:14, color:'#fff' },
})
