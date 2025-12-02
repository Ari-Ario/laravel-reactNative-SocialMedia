import React, { useState, useContext } from "react";
import { SafeAreaView ,View, Text, StyleSheet, Button, TouchableOpacity, Platform } from 'react-native';
// import axios from "../../services/axios";
import axios from "@/services/axios";
import FormTextField from "@/components/FormTextField";
import { register, loadUser } from "@/services/AuthService";
// import { Platform } from "react-native";
import { Link, router } from 'expo-router';
import AuthContext from "@/context/AuthContext";


interface User {
    name: string;
    email: string;
    password: string;
}

const RegisterUser: React.FC = () => {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const { setUser } = useContext(AuthContext);

    const [password, setPassword] = useState("");
    const [passwordConfirmation, setPasswordConfirmation] = useState("");

    const [errors, setErrors] = useState("");

    async function handleRegister( ) {
        // setErrors({});
        try {
            await register({
                name,
                email,
                password,
                password_confirmation: passwordConfirmation,
                device_name: `${Platform.OS} ${Platform.Version}`,
            });

            const user = await loadUser();
            setUser(user);
            
            console.log(user);
            router.push('/(tabs)');

        } catch (e) {
            if (e.response?.status === 422) {
                setErrors(e.response.data.errors)
            }
        }
    }

    return (
        <SafeAreaView style={styles.wrapper}>
            <View style={styles.container}>
                <Link href={'/'} asChild>
                    <TouchableOpacity style={styles.button}>
                        <Text style={styles.buttonText}>◀ Back to Homescreen</Text>
                    </TouchableOpacity>
                </Link>

                <FormTextField label="Name:" 
                value={name} 
                onChangeText={(text) => setName(text)} 
                errors={errors.name}
                />
                                
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

                <FormTextField label="Confirm Password:" 
                secureTextEntry={true} 
                value={passwordConfirmation} 
                onChangeText={(text) => setPasswordConfirmation(text)} 
                keyboardType="password" 
                errors={errors.password_confirmation}
                />
                <Button title="register" onPress={handleRegister} />
            </View>
        </ SafeAreaView>
    )
}

const styles = StyleSheet.create({
    wrapper: {
        backgroundColor: "#fff",
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
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
        alignItems: 'center',
        marginBottom: 20,
      },
      buttonText: {
        color: "blue",
        fontSize: 22,
        fontWeight: '500',
      },
  });

  export default RegisterUser;