import Colors from '@/constants/Colors';
import { Stack } from 'expo-router';

const Layout = () => {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="index"
        options={{
          title: 'Market',
        }}
      />
    </Stack>
  );
};

export default Layout;