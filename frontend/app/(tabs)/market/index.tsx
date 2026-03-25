// app/(tabs)/market/index.tsx
import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Dimensions,
    Platform,
    StatusBar,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToastStore } from '@/stores/toastStore';

const { width } = Dimensions.get('window');
const isMobile = width < 768;

const MarketScreen = () => {
    const insets = useSafeAreaInsets();
    const { showToast } = useToastStore();

    const upcomingFeatures = [
        { icon: 'storefront-outline', title: 'Curated Marketplace', desc: 'Securely buy and sell physical & digital goods.' },
        { icon: 'hammer-outline', title: 'Live Auctions', desc: 'Real-time bidding on exclusive, one-of-a-kind items.' },
        { icon: 'diamond-outline', title: 'NFT Collections', desc: 'Showcase and trade your unique digital assets.' },
        { icon: 'swap-horizontal-outline', title: 'P2P Trade Center', desc: 'Direct bartering and exchange with other users.' },
        { icon: 'wallet-outline', title: 'Integrated Wallet', desc: 'Manage your earnings and payments in one place.' },
    ];

    const handleNotifyMe = () => {
        showToast('Notification alert set for Version 2 release!', 'success');
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />
            
            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
                <Text style={styles.headerTitle}>Nexus Market</Text>
                <View style={styles.versionBadge}>
                    <Text style={styles.versionText}>v2.0 Beta Coming</Text>
                </View>
            </View>

            <ScrollView 
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Main Hero Card */}
                <MotiView 
                    from={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'timing', duration: 800 }}
                    style={styles.heroCard}
                >
                    <LinearGradient
                        colors={['#1a1a1a', '#333']}
                        style={styles.heroGradient}
                    >
                        <MaterialCommunityIcons name="shopping-outline" size={80} color="rgba(255,255,255,0.1)" style={styles.heroIcon} />
                        <View style={styles.heroBadge}>
                            <Text style={styles.heroBadgeText}>COMING SOON</Text>
                        </View>
                        <Text style={styles.heroTitle}>The Future of Social Commerce</Text>
                        <Text style={styles.heroSubtitle}>We're building a revolutionary marketplace experience. Stay tuned for Version 2.</Text>
                        
                        <TouchableOpacity style={styles.notifyBtn} onPress={handleNotifyMe} activeOpacity={0.8}>
                            <Text style={styles.notifyBtnText}>Notify Me on Launch</Text>
                            <Ionicons name="notifications-outline" size={18} color="#1a1a1a" />
                        </TouchableOpacity>
                    </LinearGradient>
                </MotiView>

                {/* Upcoming Features Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Upcoming Features</Text>
                    {upcomingFeatures.map((feature, index) => (
                        <MotiView 
                            key={index}
                            from={{ opacity: 0, translateX: -20 }}
                            animate={{ opacity: 1, translateX: 0 }}
                            transition={{ type: 'timing', duration: 500, delay: 200 + (index * 100) }}
                            style={styles.featureCard}
                        >
                            <View style={styles.iconContainer}>
                                <Ionicons name={feature.icon as any} size={24} color="#0084ff" />
                            </View>
                            <View style={styles.featureText}>
                                <Text style={styles.featureTitle}>{feature.title}</Text>
                                <Text style={styles.featureDesc}>{feature.desc}</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={16} color="rgba(0,0,0,0.2)" />
                        </MotiView>
                    ))}
                </View>

                {/* Bottom Footer Info */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>Powered by Nexus Design Systems</Text>
                    <Text style={styles.copyright}>© 2026 Nexus Social Media Corp.</Text>
                </View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingBottom: 20 },
    headerTitle: { fontSize: 24, fontWeight: '800', color: '#1a1a1a', letterSpacing: -0.5 },
    versionBadge: { backgroundColor: 'rgba(0,132,255,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    versionText: { color: '#0084ff', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 100 },
    heroCard: { borderRadius: 28, overflow: 'hidden', marginBottom: 32, ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20 }, android: { elevation: 8 } }) },
    heroGradient: { padding: 32, minHeight: 220, justifyContent: 'center' },
    heroIcon: { position: 'absolute', right: -20, top: -20 },
    heroBadge: { alignSelf: 'flex-start', backgroundColor: '#4ADE80', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginBottom: 16 },
    heroBadgeText: { color: '#1a1a1a', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
    heroTitle: { fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 12, letterSpacing: -0.5, lineHeight: 34 },
    heroSubtitle: { fontSize: 16, color: 'rgba(255,255,255,0.7)', lineHeight: 24, marginBottom: 24 },
    notifyBtn: { backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, gap: 8 },
    notifyBtnText: { color: '#1a1a1a', fontSize: 15, fontWeight: '700' },
    section: { marginTop: 8 },
    sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1a1a1a', marginBottom: 16, paddingLeft: 4 },
    featureCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 20, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)', width: isMobile ? '98%' : '100%', alignSelf: 'center', ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10 }, android: { elevation: 2 } }) },
    iconContainer: { width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(0,132,255,0.05)', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    featureText: { flex: 1 },
    featureTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 2 },
    featureDesc: { fontSize: 13, color: 'rgba(0,0,0,0.4)', lineHeight: 18 },
    footer: { marginTop: 40, alignItems: 'center', paddingBottom: 20 },
    footerText: { fontSize: 12, fontWeight: '600', color: 'rgba(0,0,0,0.2)', marginBottom: 4 },
    copyright: { fontSize: 11, fontWeight: '500', color: 'rgba(0,0,0,0.15)' },
});

export default MarketScreen;
