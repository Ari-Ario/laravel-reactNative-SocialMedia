import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BackButton } from '@/components/ui/IconButton';
import { createShadow, createPointerEvents } from '../utils/styles';

const { width, height } = Dimensions.get('window');

// Performance optimized creative background elements (static)
const DecorativeSymbols = () => (
  <View style={[StyleSheet.absoluteFill, ...createPointerEvents('none')]}>
    <Text style={[styles.bgSymbol, { top: '15%', right: '5%', opacity: 0.03, fontSize: 130 }]}>𒀀</Text>
    <Text style={[styles.bgSymbol, { top: '50%', left: '-10%', opacity: 0.04, fontSize: 200 }]}>𐌰</Text>
    <Text style={[styles.bgSymbol, { bottom: '20%', right: '15%', opacity: 0.03, fontSize: 140 }]}>ᚠ</Text>
    <Text style={[styles.bgSymbol, { bottom: '8%', left: '8%', opacity: 0.02, fontSize: 110 }]}>あ</Text>
  </View>
);

const TermsOfService = () => {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <DecorativeSymbols />

      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
        <Text style={styles.headerTitle}>Terms of Service</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.contentCard}>
          <Text style={styles.lastUpdated}>Last Updated: April 2026</Text>

          <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
          <Text style={styles.paragraph}>
            By entering the zmzir universe, you agree to these terms. zmzir is a platform dedicated to creative exploration, real-time collaboration, and artistic social interaction.
          </Text>

          <Text style={styles.sectionTitle}>2. Creative Ownership & Collaboration</Text>
          <Text style={styles.paragraph}>
            You retain all rights to the content you create. In shared Collaboration Spaces (such as shared project whiteboards), contributions from multiple users are recognized. By collaborating, you grant your partners the right to work on shared assets within that specific space.
          </Text>

          <Text style={styles.sectionTitle}>3. Marketplace Commerce</Text>
          <Text style={styles.paragraph}>
            The zmzir Marketplace is a peer-to-peer venue for the purchase and sale of items. zmzir facilitates the discovery and communication but is not a party to the actual transactions. Users are responsible for the accuracy of their listings, the quality of items sold, and the fulfillment of agreements made within the platform. Prohibited items, including illegal goods or services, will be removed immediately.
          </Text>

          <Text style={styles.sectionTitle}>4. Social Discovery & External Links</Text>
          <Text style={styles.paragraph}>
            Linking your external social media handles is optional but recommended for friend discovery. You are responsible for the accuracy of the handles you link and for ensuring they comply with the external platforms' own terms.
          </Text>

          <Text style={styles.sectionTitle}>5. Conduct & Spaces Safety</Text>
          <Text style={styles.paragraph}>
            Respect is the foundation of our creative community. Harassment, harmful behavior, or misuse of real-time tools (whiteboards, meetings, calls) are strictly prohibited. We reserve the right to restrict access to spaces for users who violate these standards.
          </Text>

          <Text style={styles.sectionTitle}>6. Professional Communication (Broadcasts)</Text>
          <Text style={styles.paragraph}>
            Broadcast Lists are provided for streamlined group messaging. By joining a broadcast list, you agree to receive updates from the list creator. Misuse of broadcasts for spam or prohibited content will result in immediate termination of the service.
          </Text>

          <Text style={styles.sectionTitle}>7. Platform Evolution</Text>
          <Text style={styles.paragraph}>
            We are constantly refining our collaboration tools. We reserve the right to modify discovery algorithms, space types, and AI capabilities to better serve the creative community and maintain platform stability.
          </Text>

          <View style={styles.footerDecorative}>
            <Text style={styles.footerText}>Bound by Art</Text>
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

export default TermsOfService;
