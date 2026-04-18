// app/spaces/_layout.tsx
import { Stack } from 'expo-router';

export default function SpaceLayout() {
  return (
    <Stack>
      <Stack.Screen 
        name="[id]" 
        options={{ 
          headerShown: false,
          title: 'Space',
          headerBackTitle: 'Back'
        }} 
      />
    </Stack>
  );
}