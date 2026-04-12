import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BackButton } from '@/components/ui/IconButton';
import { createShadow } from '../utils/styles';
const { width, height } = Dimensions.get('window');

// Performance optimized creative background elements (static)
const DecorativeSymbols = () => (
  <View style={[StyleSheet.absoluteFill, ...createPointerEvents('none')]}>
    <Text style={[styles.bgSymbol, { top: '10%', left: '5%', opacity: 0.03, fontSize: 120 }]}>𒀀</Text>
    <Text style={[styles.bgSymbol, { top: '40%', right: '-10%', opacity: 0.04, fontSize: 180 }]}>𐎀</Text>
    <Text style={[styles.bgSymbol, { bottom: '15%', left: '10%', opacity: 0.03, fontSize: 150 }]}>𑀅</Text>
    <Text style={[styles.bgSymbol, { bottom: '5%', right: '5%', opacity: 0.02, fontSize: 100 }]}>字</Text>
  </View>
);

const PrivacyPolicy = () => {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <DecorativeSymbols />

      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.contentCard}>
          <Text style={styles.lastUpdated}>Last Updated: April 2026</Text>

          <Text style={styles.sectionTitle}>1. Data We Collect</Text>
          <Text style={styles.paragraph}>
            At zmzir, your creative expression is paramount. We collect information you provide directly:
            {'\n'}• Profile details and artistic content you share.
            {'\n'}• Social media handles and phone contacts (when linked via your Account Settings).
            {'\n'}• Approximate or precise location data, when you explicitly choose to share it for project collaboration.
          </Text>

          <Text style={styles.sectionTitle}>2. Social Discovery & Linking</Text>
          <Text style={styles.paragraph}>
            When you link external social platforms (such as WhatsApp, Instagram, or Telegram) to your zmzir identity, we use this information to help you discover friends who are also part of the zmzir universe. This matching is done using secure identifiers and can be controlled at any time in your Privacy Settings.
          </Text>

          <Text style={styles.sectionTitle}>3. Real-time Collaboration Spaces</Text>
          <Text style={styles.paragraph}>
            Our Collaboration Spaces (chat, whiteboards, and meetings) facilitate real-time creative work. While metadata about these interactions is used to optimize performance and sync state across participants, your session data remains private to the space members.
          </Text>

          <Text style={styles.sectionTitle}>4. AI & Personalization</Text>
          <Text style={styles.paragraph}>
            User interactions with our AI Assistant tools are used to personalize your experience and provide relevant creative suggestions. We prioritize anonymization and ensure that sensitive collaborative data is handled with the highest security standards.
          </Text>

          <Text style={styles.sectionTitle}>5. Data Security & Retention</Text>
          <Text style={styles.paragraph}>
            We implement state-of-the-art security measures to protect your digital footprint. Your art and settings are yours. If you choose to delete your account, we initiate an immediate data removal process, with a short retention window solely for recovery purposes before permanent deletion.
          </Text>

          <Text style={styles.sectionTitle}>6. Your Rights & Settings</Text>
          <Text style={styles.paragraph}>
            You have full control over your digital identity. You can manage Discovery preferences, update linked accounts, or export your creative history at any time through your Profile Settings.
          </Text>

          <View style={styles.footerDecorative}>
            <Text style={styles.footerText}>Crafted for Creative Souls</Text>
            <View style={styles.dot} />
            <Text style={styles.footerText}>zmzir</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    letterSpacing: 0.5,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  contentCard: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 24,
    padding: 24,
    // Shadow for premium feel
    ...createShadow({ color: '#000', width: 0, height: 4, opacity: 0.05, radius: 12, elevation: 3 }),
  },
  lastUpdated: {
    fontSize: 12,
    color: '#999',
    marginBottom: 24,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginTop: 20,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 24,
    color: '#444',
    marginBottom: 16,
  },
  bgSymbol: {
    position: 'absolute',
    color: '#000',
    fontWeight: 'bold',
  },
  footerDecorative: {
    marginTop: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.5,
  },
  footerText: {
    fontSize: 12,
    color: '#666',
    marginHorizontal: 8,
    fontStyle: 'italic',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#999',
  }
});

export default PrivacyPolicy;
