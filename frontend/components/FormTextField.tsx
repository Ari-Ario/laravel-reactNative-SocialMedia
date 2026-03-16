import React, { memo } from "react";
import { View, Text, TextInput, StyleSheet, TextInputProps } from "react-native"

interface FormTextFieldProps extends TextInputProps {
    label?: string;
    errors?: string[];
}

const FormTextField = memo(({ label, errors = [], ...rest }: FormTextFieldProps) => {
    return (
        <View style={styles.container}>
            {label && <Text style={styles.label}>{label}</Text>}
            <TextInput 
                style={styles.textInput} 
                autoCapitalize='none' 
                placeholderTextColor="#94a3b8"
                {...rest} 
            />
            {Array.isArray(errors) && errors.map((err) => {
                return <Text key={err} style={styles.error}>{err}</Text>
            })}
        </View>
    );
});

export default FormTextField;
const styles = StyleSheet.create({
  container: {
    marginBottom: 4,
  },
  label: {
    color: '#334155',
    fontWeight: '500',
  },
  textInput: {
    backgroundColor: '#fff',
    height: 40,
    borderWidth: 1,
    borderRadius: 4,
    borderColor: "#cbd5e1",
    padding: 10,
    marginTop: 10,
  },
  error: {
    color: "red",
    marginTop: 2,
  }
});
