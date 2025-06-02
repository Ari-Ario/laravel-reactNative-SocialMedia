import { Stack } from 'expo-router';
const Layout = () => {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: 'Settings',
          headerLargeTitle: true,
          headerShadowVisible: false,
          headerShown: false,
          headerStyle: { backgroundColor: 'grey' },

          headerSearchBarOptions: {
            placeholder: 'Search',
          },
        }}
      />
    </Stack>
  );
};
export default Layout;