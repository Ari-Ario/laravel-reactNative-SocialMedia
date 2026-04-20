import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/useAuthStore';

const WelcomeScreen = () => {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  const portfolioLink = () => {
    Linking.openURL('https://mostafanejad.ch/');
  };

  // RootLayout handles the redirect if authenticated.
  // This screen only shows if RootLayout decides to show it.

  return (
    <View style={styles.container}>
      <Text style={styles.headline}>Welcome to zmzir</Text>
      <Text style={styles.description}>
        Read our{' '}
        <Text style={styles.link} onPress={() => router.push('/PrivacyPolicy')}>
          Privacy Policy
        </Text>
        . {'Tap "Agree & Continue" to accept the '}
        <Text style={styles.link} onPress={() => router.push('/TermsOfService')}>
          Terms of Service
        </Text>
        .
      </Text>
      
      {!isAuthenticated ? (
        <>
          <Link href={'/LoginScreen'} asChild>
            <TouchableOpacity style={styles.button}>
              <Text style={styles.buttonText}>Agree & Continue Login</Text>
            </TouchableOpacity>
          </Link>

          <Link href={'/RegisterScreen'} asChild>
            <TouchableOpacity style={styles.button}>
              <Text style={styles.NotRegistered}>
                Not Registered!{' '}
              </Text>
              <Text style={styles.buttonText}>Create Account</Text>
            </TouchableOpacity>
          </Link>
        </>
      ) : (
        <TouchableOpacity style={styles.button} onPress={() => router.replace('/(tabs)')}>
          <Text style={styles.buttonText}>Continue to App</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.footer} onPress={portfolioLink}>
        <Text style={styles.developedBy}>
          developed by <Text style={styles.portfolioName}>Khusraw (Ari)</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  headline: {
    fontSize: 24,
    fontWeight: 'bold',
    marginVertical: 20,
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 80,
    color: "grey",
    width: 300,
  },
  link: {
    color: "blue",
  },
  button: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonText: {
    color: "blue",
    fontSize: 22,
    fontWeight: '500',
  },
  NotRegistered: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 20,
    color: "grey",
    width: 300,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#eee',
  },
  developedBy: {
    fontSize: 10,
    color: '#999',
    letterSpacing: 0.5,
  },
  portfolioName: {
    fontWeight: 'bold',
    color: '#333',
    textDecorationLine: 'underline',
  }
});

export default WelcomeScreen;