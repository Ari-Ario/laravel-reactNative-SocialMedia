import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { useAuth } from '../providers/AuthProvider';

export default function CommentItem({ comment, postId }) {
  const [isReplying, setIsReplying] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const { user } = useAuth();

  const handleReply = async () => {
    try {
      const response = await fetch(`http://your-api/posts/${postId}/comment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.token}`,
        },
        body: JSON.stringify({
          content: replyContent,
          parent_id: comment.id
        })
      });
      
      if (!response.ok) throw new Error('Reply failed');
      
      setReplyContent('');
      setIsReplying(false);
    } catch (error) {
      console.error('Error replying:', error);
    }
  };

  return (
    <View style={[
      styles.container,
      comment.parent_id && styles.replyContainer
    ]}>
      <Text style={styles.username}>{comment.user.username}</Text>
      <Text style={styles.content}>{comment.content}</Text>
      
      {comment.parent && (
        <Text style={styles.replyTo}>Replying to @{comment.parent.user.username}</Text>
      )}
      
      <TouchableOpacity onPress={() => setIsReplying(!isReplying)}>
        <Text style={styles.replyButton}>Reply</Text>
      </TouchableOpacity>
      
      {isReplying && (
        <View style={styles.replyForm}>
          <TextInput
            style={styles.input}
            placeholder="Write a reply..."
            value={replyContent}
            onChangeText={setReplyContent}
            multiline
          />
          <TouchableOpacity 
            style={styles.submitButton}
            onPress={handleReply}
          >
            <Text style={styles.submitText}>Post Reply</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {/* Nested replies */}
      {comment.replies?.length > 0 && (
        <View style={styles.repliesContainer}>
          {comment.replies.map(reply => (
            <CommentItem 
              key={reply.id} 
              comment={reply} 
              postId={postId} 
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  replyContainer: {
    marginLeft: 20,
    backgroundColor: '#f9f9f9',
    borderRadius: 5,
  },
  username: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  content: {
    fontSize: 14,
  },
  replyTo: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 2,
  },
  replyButton: {
    color: '#3498db',
    fontSize: 12,
    marginTop: 5,
  },
  replyForm: {
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 8,
    marginBottom: 5,
  },
  submitButton: {
    backgroundColor: '#3498db',
    padding: 8,
    borderRadius: 5,
    alignItems: 'center',
  },
  submitText: {
    color: 'white',
    fontWeight: 'bold',
  },
  repliesContainer: {
    marginTop: 10,
  },
});