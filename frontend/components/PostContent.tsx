import React from 'react';
import { View, Image, StyleSheet, Video } from 'react-native';

interface PostContentProps {
  post: {
    media: Array<{
      id: number;
      file_path: string;
      type: string;
    }>;
  };
}

export default function PostContent({ post }: PostContentProps) {
  return (
    <View style={styles.container}>
      {post.media.map((mediaItem) => {
        if (mediaItem.type === 'video') {
          return (
            <Video
              key={mediaItem.id}
              source={{ uri: `http://your-laravel-api/storage/${mediaItem.file_path}` }}
              style={styles.media}
              controls
              resizeMode="contain"
            />
          );
        }
        
        return (
          <Image
            key={mediaItem.id}
            source={{ uri: `http://your-laravel-api/storage/${mediaItem.file_path}` }}
            style={styles.media}
            resizeMode="contain"
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 1,
  },
  media: {
    width: '100%',
    height: '100%',
  },
});