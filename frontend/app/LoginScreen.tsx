import { useState, useContext } from "react";
import { SafeAreaView ,View, Text, StyleSheet, Button, TouchableOpacity, Platform } from 'react-native';
import axios from "@/services/axios";
import FormTextField from "@/components/FormTextField";
import { login, loadUser } from "@/services/AuthService";
import { Link, router } from 'expo-router';
import AuthContext from "@/context/AuthContext";

export default function () {
    const { setUser } = useContext(AuthContext);

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [errors, setErrors] = useState("");

    async function handleLogin() {

        try {
            await login({
                    email,
                    password,
                    device_name: `${Platform.OS} ${Platform.Version}`,
                });
            console.log('here at Login')

            const user = await loadUser();
            console.log('user:', user);
            setUser(user);
            console.log("send it to TABS");
            
            router.push('/(tabs)');
        } catch (e) {
            if (e.response?.status === 422) {
                setErrors(e.response.data.errors)
            }
        }
    }

    return (
        <SafeAreaView style={styles.wrapper}>
            <View>
                <Link href={'/'} asChild>
                    <TouchableOpacity style={styles.button}>
                        <Text style={styles.buttonText}>◀ Back to Homescreen</Text>
                    </TouchableOpacity>
                </Link>
            </View>
            
            <View style={styles.container}>

                <FormTextField label="Email address:" 
                value={email} 
                onChangeText={(text) => setEmail(text)} 
                keyboardType="email-address" 
                errors={errors.email}
                />

                <FormTextField label="Password:" 
                secureTextEntry={true} 
                value={password} 
                onChangeText={(text) => setPassword(text)} 
                keyboardType="default" 
                errors={errors.password}
                />

                <Button title="login" onPress={handleLogin} />

                <Link href={'/ForgotPasswordScreen'} >
                    <Text style={styles.buttonText}>Forgot Password</Text>
                </Link>

            </View>
        </ SafeAreaView>
    )
}

const styles = StyleSheet.create({
    wrapper: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#fff',
    },
    container: {
        padding: 20,
        rowGap: 16,
        width: 300,
    },
    button: {
        top: 0,
        left: 0,
        width: '100%',
        textAlign: 'left',
        marginBottom: 20,
      },
      buttonText: {
        textAlign: "center",
        color: "blue",
        fontSize: 22,
        fontWeight: '500',
      },

  });