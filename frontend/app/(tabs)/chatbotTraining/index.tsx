import React, { useState, useEffect, useContext } from 'react';
import { View, Text, FlatList, TextInput, Button, StyleSheet, Switch, Alert } from 'react-native';
import AuthContext from '@/context/AuthContext';
import axios from '@/services/axios';
import getApiBase from '@/services/getApiBase';
import { getToken } from '@/services/TokenService';
import { useResponsiveLayout } from "@/hooks/ResponsiveLayout";
import { useNotificationStore } from '@/stores/notificationStore'; // ← ONLY THIS

const ChatbotTrainingScreen = () => {
    const { user } = useContext(AuthContext);
    const { notifications } = useNotificationStore(); // ← LISTEN TO STORE
    const [trainings, setTrainings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newTraining, setNewTraining] = useState({ trigger: '', response: '', category: '', keywords: [] });
    const [editingItems, setEditingItems] = useState({});
    const [needsReviewCount, setNeedsReviewCount] = useState(0);
    const API_BASE = getApiBase();
    const { layoutStyle } = useResponsiveLayout();

    // ========================================================================
    // REAL-TIME: React when new training notification arrives in store
    // ========================================================================
    useEffect(() => {
        const hasNewTraining = notifications.some(n => 
            n.type === 'chatbot_training' && !n.isRead
        );

        if (hasNewTraining) {
            console.log('New training notification → refreshing list');
            setNeedsReviewCount(prev => prev + 1);
            fetchTrainings();
        }
    }, [notifications]);

    // ========================================================================
    // INITIAL LOAD
    // ========================================================================
    useEffect(() => {
        fetchTrainings();
        fetchNeedsReview();
        fetchCategories();
    }, []);

    // ========================================================================
    // 3. Fetch functions (unchanged)
    // ========================================================================
    const fetchTrainings = async () => {
        try {
            const token = await getToken();
            const { data } = await axios.get(`${API_BASE}/chatbot-training`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setTrainings(data.data);

            const initialEditingState = {};
            data.data.forEach(item => {
                initialEditingState[item.id] = {
                    trigger: item.trigger,
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
                headers: { Authorization: `Bearer ${token}` }
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
                headers: { Authorization: `Bearer ${token}` }
            });
            setCategories(data);
        } catch (error) {
            console.error('Categories error:', error);
        }
    };

    // ========================================================================
    // 4. Add / Update / Delete (unchanged logic)
    // ========================================================================
    const handleAddTraining = async () => {
        try {
            const token = await getToken();
            await axios.post(`${API_BASE}/chatbot-training`, newTraining, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setNewTraining({ trigger: '', response: '', category: '', keywords: [] });
            fetchTrainings();
            Alert.alert('Success', 'Training added successfully');
        } catch (error) {
            Alert.alert('Error', 'Failed to add training');
        }
    };

    const handleUpdateTraining = async (id) => {
        try {
            const token = await getToken();
            const updates = editingItems[id];

            const { data } = await axios.put(`${API_BASE}/chatbot-training/${id}`, updates, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (data.success) {
                setTrainings(prev => prev.map(item =>
                    item.id === id ? { ...item, ...data.data } : item
                ));
                setEditingItems(prev => ({
                    ...prev,
                    [id]: { ...prev[id], ...data.data }
                }));

                // If approving, update count
                if (updates.needs_review === false) {
                    setNeedsReviewCount(prev => Math.max(0, prev - 1));
                }

                Alert.alert('Success', 'Training updated');
            }
        } catch (error) {
            console.error('Update error:', error.response?.data || error);
            Alert.alert('Error', error.response?.data?.message || 'Update failed');
            fetchTrainings();
        }
    };

    // BACKEND end Destroy here
    const handleDeleteTraining = async (id) => {
        try {
            const token = await getToken();
            const updates = editingItems[id];
            
            console.log('Deleting the Item:', updates);
            
            const { data } = await axios.delete(`${API_BASE}/chatbot-training/delete/${id}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });

            console.log('Delete response:', data);
            
            fetchTrainings();
        } catch (error) {
            console.error('Full error:', error.response?.data || error.message);
            Alert.alert('Error', error.response?.data?.message || 'Failed to delete training');
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

    // ========================================================================
    // 5. Render (unchanged structure, just better UX)
    // ========================================================================
    return (
        <View style={[styles.container, layoutStyle === 'row' ? styles.webRow : styles.mobileColumn]}>
            <View style={styles.head}>
                <Text style={styles.title}>Chatbot Training</Text>
                <TextInput
                    placeholder="User message (trigger)"
                    value={newTraining.trigger}
                    onChangeText={text => setNewTraining({ ...newTraining, trigger: text })}
                    style={styles.input}
                />
                <TextInput
                    placeholder="Bot response"
                    value={newTraining.response}
                    onChangeText={text => setNewTraining({ ...newTraining, response: text })}
                    style={styles.input}
                    multiline
                />
                <TextInput
                    placeholder="Category (account/payment/etc)"
                    value={newTraining.category}
                    onChangeText={text => setNewTraining({ ...newTraining, category: text })}
                    style={styles.input}
                />
                <Button title="Add Training" color={'#075E54'} onPress={handleAddTraining} />
                {needsReviewCount > 0 && (
                    <Text style={styles.review}>Pending Review: {needsReviewCount}</Text>
                )}
            </View>

            <FlatList
                data={trainings}
                keyExtractor={item => item.id.toString()}
                renderItem={({ item }) => (
                    <View style={styles.form}>
                        <Text style={styles.trigger}>Trigger:</Text>
                        <TextInput
                            value={editingItems[item.id]?.trigger || ''}
                            onChangeText={text => handleEditChange(item.id, 'trigger', text)}
                            style={styles.input}
                            multiline
                        />
                        <Text style={styles.label}>Response:</Text>
                        <TextInput
                            value={editingItems[item.id]?.response || ''}
                            onChangeText={text => handleEditChange(item.id, 'response', text)}
                            style={styles.input}
                            multiline
                        />
                        <Text style={styles.label}>Category:</Text>
                        <TextInput
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

                        <View style={styles.buttonContsainer}>
                            {!item.needs_review && (
                                <Button title="Save" onPress={() => handleUpdateTraining(item.id)} />
                            )}
                            {item.needs_review && (
                                <Button
                                    title="Approve"
                                    onPress={() => handleUpdateTraining(item.id)}
                                    color={'#2B2D42'}
                                />
                            )}
                            <Button
                                title="Delete"
                                onPress={() => handleDeleteTraining(item.id)}
                                color={'#FF5733'}
                            />
                        </View>
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
    width: '100%',
    // maxWidth: 500,
    // backgroundColor: "#fff",
    justifyContent: 'center',
    alignSelf: 'center',  
    // textAlign: 'center',
},
// webRow: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
// },
// mobileColumn: {
//     flexDirection: 'column',
// },
title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    alignSelf: 'center',
},
head: {
    marginBottom: 20,
    padding: 15,
    borderWidth: 2,
    borderColor: 'black',
    borderRadius: 5,
    width: "100%",
},
review: {
    marginTop: 20,
    textAlign: 'center',
    color: 'red'
},
form: {
    marginBottom: 20,
    padding: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    backgroundColor: '#FAF9F6',
    boxShadow: '0px 2px 4px rgba(0,0,0,0.1)',
},
input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 10,
    borderRadius: 5,
    backgroundColor: '#fff',
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
buttonContsainer: {
    gap: '10px'
},
deleteBut: {
    // backgroundColor: '#B03A2E',
    backgroundColor: 'red',
    color: '#B03A2E',
},
});

export default ChatbotTrainingScreen;