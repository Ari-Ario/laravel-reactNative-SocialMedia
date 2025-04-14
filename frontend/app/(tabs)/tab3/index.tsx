// import { Dimensions, StyleSheet, Text, View } from 'react-native'

// const screenWidth = Dimensions.get('screen').width

// export default function MyComponent() {
//   return (
//     <View style={styles.container}>
//       <Text>MyComponent</Text>
//     </View>
//   )
// }

// const styles = StyleSheet.create({
//   container: {
//     padding: screenWidth < 350 ? 24 : 48, 
//   },
// })


import React, { useEffect, useState } from 'react';
import { SafeAreaView ,View, Text, StyleSheet, FlatList } from 'react-native';
import axios from 'axios';

const API_URL = 'http://127.0.0.1:8000/api/users'; // Replace with your machine's IP address

const App = () => {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await axios.get(API_URL);
        setUsers(response.data);
        console.log('Here is data: ',response.data)
      } catch (error) {
        console.error(error);
      }
    };

    fetchUsers();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>User List</Text>

      <FlatList
        data={users}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <Text style={styles.item}>{item.id}{item.name}</Text>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  item: {
    fontSize: 18,
    marginVertical: 5,
  },
});

export default App;
