import { Ionicons } from '@expo/vector-icons';
import { View, ScrollView, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import BoxedIcon from '@/components/BoxedIcon';
import Colors from '@/constants/Colors';
import AuthContext from "@/context/AuthContext";
import { logout } from "@/services/AuthService";
import { useContext } from "react";
import LoginScreen from "../../LoginScreen";

const Page = () => {
const devices = [
  { name: 'Broadcast Lists', icon: 'megaphone', backgroundColor: '#25D366' }, // WhatsApp Green
  { name: 'Starred Messages', icon: 'star', backgroundColor: '#FFD700' },     // Gold
  { name: 'Linked Devices', icon: 'laptop-outline', backgroundColor: '#25D366' },
];

const items = [
  { name: 'Account', icon: 'key', backgroundColor: '#075E54' },               // WhatsApp Dark Green
  { name: 'Privacy', icon: 'lock-closed', backgroundColor: '#33A5D1' },
  { name: 'Chats', icon: 'logo-whatsapp', backgroundColor: '#25D366' },
  { name: 'Notifications', icon: 'notifications', backgroundColor: '#FF3B30' }, // iOS red
  { name: 'Storage and Data', icon: 'repeat', backgroundColor: '#25D366' },
];

const support = [
  { name: 'Help', icon: 'information', backgroundColor: '#075E54' },
  { name: 'Tell a Friend', icon: 'heart', backgroundColor: '#FF3B30' },
];


    const { user, setUser } = useContext(AuthContext);

    const handleLogout = async () => {
      try {
          await logout();
          setUser(null); // This will trigger the redirect in the effect below
          if (!user || (user === null)) {
            router.replace('/LoginScreen');
          }
      } catch (error) {
          console.error("Logout failed:", error);
          setUser(null); // Ensure logout even if API fails
      }
    };

  const renderListItem = ({ item }: any) => (
    <View style={styles.item}>
      <BoxedIcon name={item.icon} backgroundColor={item.backgroundColor} />
      <Text style={styles.itemText}>{item.name}</Text>
      <Ionicons name="chevron-forward" size={20} color={'grey'} />
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.scrollContainer}>
        <View style={styles.block}>
          <FlatList
            data={devices}
            keyExtractor={(item) => item.name}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={renderListItem}
          />
        </View>

        <View style={styles.block}>
          <FlatList
            data={items}
            keyExtractor={(item) => item.name}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={renderListItem}
          />
        </View>

        <View style={styles.block}>
          <FlatList
            data={support}
            keyExtractor={(item) => item.name}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={renderListItem}
          />
        </View>

        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logout}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',    
      width: '100%'
      // backgroundColor: Colors.background,
  },
  scrollContainer: {
    // paddingVertical: 20,
    minWidth: 350,
    width: 500
  },
  block: {
    backgroundColor: '#fff',
    marginBottom: 30,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  separator: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  itemText: {
    fontSize: 17,
    flex: 1,
    marginLeft: 12,
  },
  logout: {
    color: Colors.primary,
    fontSize: 18,
    textAlign: 'center',
    paddingVertical: 14,
  },
});

export default Page;
