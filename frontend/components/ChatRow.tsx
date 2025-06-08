import { Swipeable } from 'react-native-gesture-handler';
import Colors from '@/constants/Colors';
// Replaced `date-fns` format with standard JS
import { Link } from 'expo-router';
import { FC } from 'react';
import { View, Text, Image, TouchableHighlight } from 'react-native';

export interface ChatRowProps {
  id: string;
  from: string;
  date: string;
  img: string;
  msg: string;
  read: boolean;
  unreadCount: number;
}

const ChatRow: FC<ChatRowProps> = ({ id, from, date, img, msg, read, unreadCount }) => {
  return (
    <Swipeable>
      <Link href={`/(tabs)/chats/${id}`} asChild>
        <TouchableHighlight activeOpacity={0.8} underlayColor={'grey'}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              paddingLeft: 20,
              paddingVertical: 10,
            }}>
            <Image source={{ uri: img }} style={{ width: 50, height: 50, borderRadius: 50 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold' }}>{from}</Text>
              <Text style={{ fontSize: 16, color: Colors.gray }}>
                {msg.length > 40 ? `${msg.substring(0, 40)}...` : msg}
              </Text>
            </View>
            <Text style={{ color: Colors.gray, paddingRight: 20, alignSelf: 'flex-start' }}>
              {new Date(date).toLocaleDateString()}
            </Text>
          </View>
        </TouchableHighlight>
      </Link>
    </Swipeable>
  );
};

export default ChatRow;
