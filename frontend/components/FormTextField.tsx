import React, { memo } from "react";
import { View, Text, TextInput, StyleSheet, TextInputProps } from "react-native"
import { useAppTheme } from "@/hooks/useAppTheme";
import { useTranslation } from "@/constants/i18n";

interface FormTextFieldProps extends TextInputProps {
    label?: string;
    errors?: string[];
}

const FormTextField = memo(({ label, errors = [], ...rest }: FormTextFieldProps) => {
    const { colors, activeScheme } = useAppTheme();
    const { isRTL } = useTranslation();
    
    return (
        <View style={styles.container}>
            {label && <Text style={[styles.label, { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' }]}>{label}</Text>}
            <TextInput 
                style={[
                    styles.textInput, 
                    { 
                        backgroundColor: colors.surface, 
                        borderColor: colors.border,
                        color: colors.text,
                        textAlign: isRTL ? 'right' : 'left'
                    }
                ]} 
                autoCapitalize='none' 
                placeholderTextColor={activeScheme === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
                keyboardAppearance={activeScheme}
                {...rest} 
            />
            {Array.isArray(errors) && errors.map((err) => {
                return <Text key={err} style={[styles.error, { color: colors.error, textAlign: isRTL ? 'right' : 'left' }]}>{err}</Text>
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
