import React, { useState, useContext } from 'react';
import { View, TouchableOpacity, StyleSheet, Platform, Text } from 'react-native';
import EmojiPicker from 'rn-emoji-keyboard';
import AuthContext from '@/context/AuthContext';

const emojis = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export default function PostReactions({ post, postId }: { post: any, postId: number }) {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useContext(AuthContext);

  const handleReact = async (emoji) => {
    try {
      const response = await fetch(`http://your-api/posts/${postId}/react`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.token}`,
        },
        body: JSON.stringify({ emoji })
      });

      if (!response.ok) throw new Error('Reaction failed');
    } catch (error) {
      console.error('Error reacting:', error);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => setIsOpen(true)}>
        <Text style={styles.reactionButton}>😊 Add Reaction</Text>
      </TouchableOpacity>

      <EmojiPicker
        open={isOpen}
        onClose={() => setIsOpen(false)}
        onEmojiSelected={(emoji) => {
          handleReact(emoji.emoji);
          setIsOpen(false);
        }}
        emojiSize={28}
      // containerStyle={styles.emojiPicker} // 🚩 Potentially problematic prop
      />

      {/* Display existing reactions */}
      <View style={styles.reactionsContainer}>
        {post?.reaction_counts?.map((reaction) => (
          <TouchableOpacity
            key={reaction.emoji}
            onPress={() => handleReact(reaction.emoji)}
            style={styles.reaction}
          >
            <Text style={styles.emoji}>{reaction.emoji}</Text>
            <Text style={styles.count}>{reaction.count}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  reactionButton: {
    fontSize: 14,
    color: '#555',
    marginBottom: 10,
  },
  reactionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reaction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 15,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  emoji: {
    fontSize: 16,
  },
  count: {
    fontSize: 12,
    marginLeft: 4,
  },
  emojiPicker: {
    borderRadius: 10,
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 3.84px rgba(0, 0, 0, 0.25)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
      }
    }),
  },
});