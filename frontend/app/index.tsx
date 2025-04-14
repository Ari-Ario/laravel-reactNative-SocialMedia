import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Link, useRouter } from 'expo-router';
import WelcomeAlphabet from '@/components/StartPageAlphabet.js';
import 'expo-router/entry';
import AuthContext from '@/context/AuthContext';
import { loadUser } from '@/services/AuthService';
import { getToken } from '@/services/TokenService';
import { useState, useEffect } from 'react';

const WelcomeScreen = () => {
  const router = useRouter();
  const openLink = () => {
    Linking.openURL('https://mostafanejad.ch/');
  };
  
   const [user, setUser] = useState(null);
 
   const [isReady, setIsReady] = useState(false);
 
   useEffect(() => {
     async function prepare() {
       try {
         // 1. Check if token exists first (fast check)
         const token = await getToken();
         
         // 2. Only try to load user if token exists
         if (token) {
           const userData = await loadUser();
           console.log("User in Rootlayout", userData);
           setUser(userData);
         }
       } catch (error) {
         console.log("Auth check error:", error);
       } finally {
         setIsReady(true);
       }
     }
     prepare();
   }, []);
 
   if (!isReady) {
     return (
       <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
         {/* <ActivityIndicator size="large" /> */}
         <Text>Loading</Text>
       </View>
     );
   }

  return (
    <View style={styles.container}>
      {/* <WelcomeAlphabet style={styles.welcome} /> */}
      {/* <Image source={{ uri: welcome_image }} style={styles.welcome} /> */}
      <Text style={styles.headline}>Welcome to Grafo</Text>
      <Text style={styles.description}>
        Read our{' '}
        <Text style={styles.link} onPress={openLink}>
          Privacy Policy
        </Text>
        . {'Tap "Agree & Continue" to accept the '}
        <Text style={styles.link} onPress={openLink}>
          Terms of Service
        </Text>
        .
      </Text>
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
  welcome: {
    width: '100%',
    height: 300,
    borderRadius: 60,
    marginBottom: 80,
    maxWidth: 500,
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
  }
});

export default WelcomeScreen;