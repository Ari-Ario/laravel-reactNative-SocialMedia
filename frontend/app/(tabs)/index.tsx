// app/(tabs)/index.tsx
import { View, Text, Pressable, StyleSheet, Button, ActivityIndicator } from "react-native";
import { Link, router, Stack } from 'expo-router';
import { loadUser, login } from "@/services/AuthService";
import { useState, useEffect } from "react";
import AuthContext from "@/context/AuthContext";
import { logout } from "@/services/AuthService";
import { useContext } from "react";
import LoginScreen from "../LoginScreen";

const HomePage = () => {
    const { user, setUser } = useContext(AuthContext);

    const handleLogout = async () => {
      try {
          await logout();
          setUser(null); // This will trigger the redirect in the effect below
          if (!user || (user === null)) {
            router.replace('/LoginScreen');
          }
      } catch (error) {
          console.error("Logout failed:", error);
          setUser(null); // Ensure logout even if API fails
      }
    };

    // Redirect effect - handles both initial load and logout cases
    useEffect(() => {
        if (!user || (user === null)) {
          router.replace('/LoginScreen');
        }
    }, [user]);

    return (
          <AuthContext.Provider value={{ user, setUser }}>
            {user ? (
              <>
              <View style={styles.container}>
                  <Text>Welcom user: {user.name} </Text>
                  <Link href="/tab1">Go to tab - Screen 1</Link>

                  <Pressable onPress={() => router.push('/tab3')}>
                      <Text>Go to tab 3</Text>
                  </Pressable>
                  <Button title="logout" onPress={handleLogout} />
                  <Stack.Screen name="(tabs)" />
              </View>
              </>
            ) : (
              <>
              <Stack.Screen name="Login" component={LoginScreen} />
              </>
            )}

          </AuthContext.Provider>
    )
}


const styles = StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });

export default HomePage;