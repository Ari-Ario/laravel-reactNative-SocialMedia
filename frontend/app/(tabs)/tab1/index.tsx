// app/(tabs)/tab_1/index.tsx
// import { Link } from 'expo-router'
import { Text, View, StyleSheet } from 'react-native'

// const index = () => {
//     return (
//         <View style={styles.container}>
//             <Text>Tab 1</Text>
//             <Link href="tab1">Enter tab 1's stack</Link>
//         </View>
//     )
// }
// const styles = StyleSheet.create({
//     container: {
//       flex: 1,
//       justifyContent: 'center',
//       alignItems: 'center',
//     },
//   });
// export default index


import { useWindowDimensions } from 'react-native';

const index = () => {
  const { width, height } = useWindowDimensions();

  return (
    <View style={styles.container}>
      <Text>Width: {width}</Text>
      <Text>Height: {height}</Text>
    </View>
  );
};
const styles = StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });
export default index