import { Stack } from 'expo-router';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  Image,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useState } from 'react';
import { SegmentedControl } from '@/components/SegmentedControl';
import calls from '@/assets/data/calls.json';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  CurvedTransition,
  FadeInUp,
  FadeOutUp,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import SwipeableRow from '@/components/SwipeableRow';
import * as Haptics from 'expo-haptics';

const transition = CurvedTransition.delay(100);
const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

const Page = () => {
  const [selectedOption, setSelectedOption] = useState('All');
  const [items, setItems] = useState(calls);
  const [isEditing, setIsEditing] = useState(false);
  const editing = useSharedValue(-30);

  const onSegmentChange = (option: string) => {
    setSelectedOption(option);
    setItems(option === 'All' ? calls : calls.filter((call) => call.missed));
  };

  const removeCall = (toDelete: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setItems(items.filter((item) => item.id !== toDelete.id));
  };

  const onEdit = () => {
    const editingNew = !isEditing;
    editing.value = editingNew ? 0 : -30;
    setIsEditing(editingNew);
  };

  const animatedRowStyles = useAnimatedStyle(() => ({
    transform: [{ translateX: withTiming(editing.value) }],
  }));

  const animatedPosition = useAnimatedStyle(() => ({
    transform: [{ translateX: withTiming(editing.value) }],
  }));

  return (
    <View style={styles.container}>
        <Stack.Screen
          options={{
            headerTitle: () => (
              <SegmentedControl
                options={['All', 'Missed']}
                selectedOption={selectedOption}
                onOptionPress={onSegmentChange}
              />
            ),
            headerLeft: () => (
              <TouchableOpacity onPress={onEdit}>
                <Text style={styles.editButton}>{isEditing ? 'Done' : 'Edit'}</Text>
              </TouchableOpacity>
            ),
          }}
        />

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.scrollContainer}>
        <Animated.View style={styles.block} layout={transition}>
          <Animated.FlatList
            skipEnteringExitingAnimations
            data={items}
            scrollEnabled={false}
            itemLayoutAnimation={transition}
            keyExtractor={(item) => item.id.toString()}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={({ item, index }) => (
              <SwipeableRow onDelete={() => removeCall(item)}>
                <Animated.View
                  entering={FadeInUp.delay(index * 20)}
                  exiting={FadeOutUp}
                  style={styles.row}>
                  <AnimatedTouchableOpacity
                    style={[animatedPosition, styles.deleteButton]}
                    onPress={() => removeCall(item)}>
                    <Ionicons name="remove-circle" size={24} color="#FF3B30" />
                  </AnimatedTouchableOpacity>

                  <Animated.View style={[styles.item, animatedRowStyles]}>
                    <Image source={{ uri: item.img }} style={styles.avatar} />

                    <View style={styles.itemContent}>
                      <Text style={[styles.name, item.missed && styles.missed]}>
                        {item.name}
                      </Text>

                      <View style={styles.callType}>
                        <Ionicons
                          name={item.video ? 'videocam' : 'call'}
                          size={16}
                          color="#888"
                        />
                        <Text style={styles.callText}>
                          {item.incoming ? 'Incoming' : 'Outgoing'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.dateInfo}>
                      <Text style={styles.dateText}>
                        {new Intl.DateTimeFormat('en-US', {
                          year: '2-digit',
                          month: '2-digit',
                          day: '2-digit',
                        }).format(new Date(item.date))}
                      </Text>

                      <Ionicons
                        name="information-circle-outline"
                        size={24}
                        color="#25D366"
                      />
                    </View>
                  </Animated.View>
                </Animated.View>
              </SwipeableRow>
            )}
          />
        </Animated.View>
      </ScrollView>
    </View>
  );
};


const styles = StyleSheet.create({
  container: {
      flex: 1,
      justifyContent: 'center',
      alignSelf: 'center',
      backgroundColor: '#FFF',
      width: 500
  },
  header: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    maxWidth: 350,
  },
  scrollContainer: {
    paddingBottom: 40,
    paddingTop: 60,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  block: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    width: '100%'
  },
  separator: {
    height: 1,
    backgroundColor: '#EEE',
    marginVertical: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteButton: {
    paddingLeft: 8,
  },
  item: {
    flex: 1,
    paddingLeft: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  itemContent: {
    flex: 1,
    gap: 2,
    justifyContent: 'space-between',
    width: '100%',
  },
  name: {
    fontSize: 18,
    color: '#000',
  },
  missed: {
    color: '#FF3B30',
  },
  callType: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  callText: {
    color: '#888',
    flex: 1,
  },
  dateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    color: '#888',
  },
  editButton: {
    color: '#25D366',
    fontSize: 18,
    marginLeft: 16,
  },
});

export default Page;
