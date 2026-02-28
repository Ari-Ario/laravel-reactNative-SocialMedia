import { Redirect, Stack } from 'expo-router'
import AuthContext from '@/context/AuthContext'
import { useContext } from 'react'

// add if the user is not admin redirect to home
const StackLayout = () => {
    const { user } = useContext(AuthContext)
    if (!user?.ai_admin) {
        return <Redirect href="/" />
    }
    return <Stack screenOptions={{ headerShown: false }} />
}

export default StackLayout