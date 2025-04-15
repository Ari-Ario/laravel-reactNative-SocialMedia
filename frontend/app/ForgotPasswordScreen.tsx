import { useState, useContext } from "react";
import { SafeAreaView ,View, Text, StyleSheet, Button, TouchableOpacity, Platform } from 'react-native';
import axios from "@/services/axios";
import FormTextField from "@/components/FormTextField";
import { login, loadUser } from "@/services/AuthService";
import { Link, router } from 'expo-router';
import AuthContext from "@/context/AuthContext";
import { sendPasswordResetLink } from "@/services/AuthService";

export default function () {

    const [email, setEmail] = useState("");
    const [errors, setErrors] = useState("");
    const [resetStatus, setResetStatus] = useState("");

    async function handleForgotPassword() {
        setErrors({});
        setResetStatus("");
        try {
            const status = await sendPasswordResetLink(email);
            setResetStatus(status);
            console.log('here at ResetPage: ', status)

        } catch (e) {
            if (e.response?.status === 422) {
                setErrors(e.response.data.errors)
            }
        }
    }

    return (
        <SafeAreaView style={styles.wrapper}>
            <View>
                <Link href={'/LoginScreen'} >
                    <TouchableOpacity style={styles.button}>
                        <Text style={styles.buttonText}>◀ Back to Login</Text>
                    </TouchableOpacity>
                </Link>
            </View>
            
            <View style={styles.container}>
                { resetStatus && <Text style={styles.resetStatus}> {resetStatus} </Text>}
                <FormTextField label="Email address:" 
                value={email} 
                onChangeText={(text) => setEmail(text)} 
                keyboardType="email-address" 
                errors={errors.email}
                />

                <Button title="Setpassword" onPress={handleForgotPassword} />
                        
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
        // alignItems: 'left',
        marginBottom: 0,
      },
      buttonText: {
        color: "blue",
        fontSize: 22,
        fontWeight: '500',
      },
      resetStatus: {
        color: "green",
        marginBottom: 10,
      }
  });