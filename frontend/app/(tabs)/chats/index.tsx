// app/(tabs)/index.tsx
import { View, Text, Pressable, StyleSheet, Button, ActivityIndicator, ScrollView, FlatList } from "react-native";
import { Link, router, Stack } from 'expo-router';
import { loadUser, login } from "@/services/AuthService";
import { useState, useEffect } from "react";
import AuthContext from "@/context/AuthContext";
import { useContext } from "react";
import LoginScreen from "@/app/LoginScreen";
import chats from '@/assets/data/chats.json';
import ChatRow from '@/components/ChatRow';
// import { defaultStyles } from '@/constants/Styles';

const HomePage = () => {
    const { user, setUser } = useContext(AuthContext);

    // Redirect effect - handles both initial load and logout cases
    useEffect(() => {
        if (!user || (user === null)) {
          router.replace('/LoginScreen');
        } else { console.log("asking Authentication from Index")}
    }, [user]);

    return (
          <AuthContext.Provider value={{ user, setUser }}>
            {user ? (
              <View style={styles.container}>
                <ScrollView
                  contentInsetAdjustmentBehavior="automatic"
                  contentContainerStyle={{ paddingBottom: 40, flex: 1, backgroundColor: '#fff' }}>
                  <FlatList
                    data={chats}
                    renderItem={({ item }) => <ChatRow {...item} />}
                    keyExtractor={(item) => item.id.toString()}
                    ItemSeparatorComponent={() => (
                      <View style={[styles.separator, { marginLeft: 90 }]} />
                    )}
                    scrollEnabled={true}
                  />
                </ScrollView>
              </View>
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
    separator: {
    // height: StyleSheet.hairlineWidth,
    backgroundColor: 'grey',
    marginLeft: 50,
  },
  });

export default HomePage;