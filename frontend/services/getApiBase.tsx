import { Platform } from 'react-native';


const getApiBase = () => {
    const isWeb = Platform.OS === 'web';
  
    if (Platform.OS === 'android') {
      console.log("platform is Android");
  
      return 'http://10.0.2.2:8000/api'; // Android emulator
    }
    if (Platform.OS === 'ios') {
      return 'http://localhost:8000/api'; // iOS simulator
    } 
    if (Platform.OS === 'web') {
      console.log("platform is WEB");
  
      return 'http://127.0.0.1:8000/api';
    } else {
      console.log("Platform is unknown. Use Web, Android or IOS!")
    }
  };

export default getApiBase;
  
  // const API_BASE = "http://127.0.0.1:8000/api"; // for web or just use axios.post(/login or /register ,...) 
  // const API_BASE = "http://10.0.2.2:8000/api"; // For Android emulator only
  // const API_BASE = "http://localhost:8000/api"; // For iOS simulator