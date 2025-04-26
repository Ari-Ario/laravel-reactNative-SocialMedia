import React, { useState, useEffect, useContext } from 'react';
import { View, Text, FlatList, TextInput, Button, StyleSheet, Switch, Alert } from 'react-native';
import AuthContext from '@/context/AuthContext';
import axios from '@/services/axios';
import getApiBase from '@/services/getApiBase';
import { getToken, setToken } from '@/services/TokenService';

const ChatbotTrainingScreen = () => {
    const { user } = useContext(AuthContext);
    const [trainings, setTrainings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newTraining, setNewTraining] = useState({
        trigger: '',
        response: '',
        category: '',
        keywords: []
    });
    const [editingItems, setEditingItems] = useState({});
    const [needsReviewCount, setNeedsReviewCount] = useState(0);
    const [categories, setCategories] = useState([]);
    const API_BASE = getApiBase();
    
    useEffect(() => {
        fetchTrainings();
        fetchNeedsReview();
        fetchCategories();

        // Set up interval for auto-refresh every 2 minutes
        const intervalId = setInterval(() => {
            fetchTrainings();
            fetchNeedsReview();
            fetchCategories();
        }, 2 * 60 * 1000); // 2 minutes in milliseconds

        // Clean up interval when component unmounts
        return () => clearInterval(intervalId);
    }, []);
    
    const fetchTrainings = async () => {
        try {
            const token = await getToken();
            const { data } = await axios.get(`${API_BASE}/chatbot-training`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                }
            });
            setTrainings(data.data);
            // Initialize editing state
            const initialEditingState = {};
            data.data.forEach(item => {
                initialEditingState[item.id] = {
                    response: item.response,
                    category: item.category,
                    is_active: item.is_active
                };
            });
            setEditingItems(initialEditingState);
        } catch (error) {
            Alert.alert('Error', 'Failed to load trainings');
        } finally {
            setLoading(false);
        }
    };

    const fetchNeedsReview = async () => {
        try {
            const token = await getToken();
            const { data } = await axios.get(`${API_BASE}/chatbot-training/needs-review`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                }
            });
            setNeedsReviewCount(data);
        } catch (error) {
            console.error('Needs review error:', error);
        }
    };
    
    const fetchCategories = async () => {
        try {
            const token = await getToken();
            const { data } = await axios.get(`${API_BASE}/chatbot-training/categories`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                }
            });
            setCategories(data);
        } catch (error) {
            console.error('Categories error:', error);
        }
    };

    const handleAddTraining = async () => {
        try {
            const token = await getToken();
            await axios.post(`${API_BASE}/chatbot-training`, newTraining, {
                headers: {
                    Authorization: `Bearer ${token}`,
                }
            });
            setNewTraining({ trigger: '', response: '', category: '', keywords: [] });
            fetchTrainings();
            Alert.alert('Success', 'Training added successfully');
        } catch (error) {
            Alert.alert('Error', 'Failed to add training');
        }
    };
 // ... keep all your other existing functions (fetchNeedsReview, fetchCategories, handleAddTraining, handleBulkApprove) ...

 const handleUpdateTraining = async (id) => {
    try {
        const token = await getToken();
        const updates = editingItems[id];
        
        console.log('Sending updates:', updates);
        
        const { data } = await axios.put(`${API_BASE}/chatbot-training/${id}`, updates, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        console.log('Update response:', data);
        
        if (data.success) {
            // Update both trainings and editingItems states
            setTrainings(prev => prev.map(item => 
                item.id === id ? { ...item, ...data.data } : item
            ));
            setEditingItems(prev => ({
                ...prev,
                [id]: {
                    ...prev[id],
                    ...data.data
                }
            }));
            
            Alert.alert('Success', 'Training updated');
        } else {
            throw new Error(data.message || 'Update failed');
        }
    } catch (error) {
        console.error('Full error:', error.response?.data || error.message);
        Alert.alert('Error', error.response?.data?.message || 'Failed to update training');
        // Refresh from server to ensure consistency
        fetchTrainings();
    }
};

const handleEditChange = (id, field, value) => {
    setEditingItems(prev => ({
        ...prev,
        [id]: {
            ...(prev[id] || {}),
            [field]: field === 'is_active' ? Boolean(value) : value
        }
    }));
};

return (
    <View style={styles.container}>
        <Text style={styles.title}>Chatbot Training</Text>
        <Text>Pending Review: {needsReviewCount}</Text>

        {/* Add New Training Form - unchanged */}
        <View style={styles.form}>
            <TextInput
                placeholder="User message (trigger)"
                value={newTraining.trigger}
                onChangeText={text => setNewTraining({...newTraining, trigger: text})}
                style={styles.input}
            />
            <TextInput
                placeholder="Bot response"
                value={newTraining.response}
                onChangeText={text => setNewTraining({...newTraining, response: text})}
                style={styles.input}
                multiline
            />
            <TextInput
                placeholder="Category (account/payment/etc)"
                value={newTraining.category}
                onChangeText={text => setNewTraining({...newTraining, category: text})}
                style={styles.input}
            />
            <Button title="Add Training" onPress={handleAddTraining} />
        </View>

        {/* Training List - now with save buttons */}
        <FlatList
            data={trainings}
            keyExtractor={item => item.id.toString()}
            renderItem={({ item }) => (
                <View style={styles.form}>
                    <Text style={styles.trigger}>Trigger Message:</Text>
                    <Text style={styles.input}>{item.trigger}</Text>
                    
                    <Text style={styles.label}>Bot Response:</Text>
                    <TextInput
                        placeholder="Bot response"
                        value={editingItems[item.id]?.response || ''}
                        onChangeText={text => handleEditChange(item.id, 'response', text)}
                        style={styles.input}
                        multiline
                    />
                    
                    <Text style={styles.label}>Category:</Text>
                    <TextInput
                        placeholder="Category"
                        value={editingItems[item.id]?.category || ''}
                        onChangeText={text => handleEditChange(item.id, 'category', text)}
                        style={styles.input}
                    />
                    
                    <View style={styles.switchContainer}>
                        <Text style={styles.label}>Active:</Text>
                        <Switch
                            value={editingItems[item.id]?.is_active || false}
                            onValueChange={value => handleEditChange(item.id, 'is_active', value)}
                        />
                    </View>
                    
                    {!item.needs_review && (
                        <Button 
                            title="Save Changes" 
                            onPress={() => handleUpdateTraining(item.id)}
                        />
                    )}
                    
                    {item.needs_review && (
                        <Button
                        title="Approve" 
                        onPress={() => handleUpdateTraining(item.id, { needs_review: false })}
                        style={styles.approve}
                        />
                    )}
                </View>
            )}
        />
    </View>
);
};

// Keep your existing styles
const styles = StyleSheet.create({
container: {
    flex: 1,
    padding: 20,
},
title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
},
form: {
    marginBottom: 20,
    padding: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
},
input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 10,
    borderRadius: 5,
},
label: {
    marginBottom: 5,
    fontWeight: 'bold',
},
trigger: {
    fontWeight: 'bold',
    marginBottom: 5,
},
switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
},
approve: {
    backgroundColor: '#000',
},
});

export default ChatbotTrainingScreen;