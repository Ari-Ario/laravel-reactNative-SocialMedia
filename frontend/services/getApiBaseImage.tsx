import { Platform } from 'react-native';


const getApiBaseImage = () => {
    const isWeb = Platform.OS === 'web';
  
    if (Platform.OS === 'android') {
      console.log("platform is Android");
  
      return 'http://10.0.2.2:8000'; // Android emulator
    }
    if (Platform.OS === 'ios') {
      return 'http://localhost:8000'; // iOS simulator
    } 
    if (Platform.OS === 'web') {
      console.log("platform is WEB");
  
      return 'http://127.0.0.1:8000';
    } else {
      console.log("Platform is unknown. Use Web, Android or IOS!")
    }
  };

export default getApiBaseImage;
  
