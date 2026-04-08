import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

// Performance optimized creative background elements (static)
const DecorativeSymbols = () => (
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
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
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 40 }} /> 
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.contentCard}>
          <Text style={styles.lastUpdated}>Last Updated: April 2026</Text>
          
          <Text style={styles.sectionTitle}>1. Data We Collect</Text>
          <Text style={styles.paragraph}>
            At zmzir, your creative expression is paramount. We collect information you provide directly, such as your profile details, the art you share, and the spaces you interact with.
          </Text>

          <Text style={styles.sectionTitle}>2. How We Use Information</Text>
          <Text style={styles.paragraph}>
            We use your data to personalize your creative feed, facilitate real-time collaborations in spaces, and improve the artistic tools we offer.
          </Text>

          <Text style={styles.sectionTitle}>3. Real-time Interactions</Text>
          <Text style={styles.paragraph}>
            Our collaboration features use secure real-time protocols. While we facilitate these connections, your private interactions remain your own.
          </Text>

          <Text style={styles.sectionTitle}>4. Data Security</Text>
          <Text style={styles.paragraph}>
            We implement state-of-the-art security measures to protect your digital footprint. Your art is yours, and we treat its metadata with the highest confidentiality.
          </Text>

          <Text style={styles.sectionTitle}>5. Your Rights</Text>
          <Text style={styles.paragraph}>
            You have full control over your content and data. You can export, modify, or delete your information at any time through your settings.
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
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
