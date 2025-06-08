import * as SecureStore from "expo-secure-store";

let token = null;

export async function setToken(newToken) {
    token = newToken;
    console.log("Token ready:", token);
  
    try {
      if (token !== null) {
        await SecureStore.setItemAsync("token", token);
        console.log('Token saved successfully - going back to Login');
      } else {
        await SecureStore.deleteItemAsync("token");
      }
    } catch (error) {
      console.error('SecureStore error:', error);
    }
}

export async function getToken() {
    try {
        if (token !== null) {
            console.log("Token exists already: ", token);
            return token;
        } else {
            token = await SecureStore.getItemAsync("token");
            return token;
        }
    } catch (error) {
        console.error('SecureStore error:', error);
    }
}
