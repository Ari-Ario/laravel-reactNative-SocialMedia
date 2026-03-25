// app/chatbotTraining/index.tsx
import React, { useState, useEffect, useContext, useMemo, useCallback, memo } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  StyleSheet,
  Switch,
  Alert,
  TouchableOpacity,
  Dimensions,
  Platform,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView, AnimatePresence } from 'moti';
import { router, useLocalSearchParams } from 'expo-router';
import AuthContext from '@/context/AuthContext';
import axios from '@/services/axios';
import getApiBase from '@/services/getApiBase';
import { getToken } from '@/services/TokenService';
import { useResponsiveLayout } from "@/hooks/ResponsiveLayout";
import { useNotificationStore } from '@/stores/notificationStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Toast } from '@/components/Shared/Toast';
import { useToastStore } from '@/stores/toastStore';

const { width } = Dimensions.get('window');
const isMobile = width < 768;

// Memoized Training Item to prevent re-renders on every keystroke
const TrainingItem = memo(({ item, editingItem, onEditChange, onUpdate, onDelete, index }: any) => {
    return (
        <MotiView 
            from={{ opacity: 0, translateY: 10 }} 
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 300, delay: index < 10 ? index * 50 : 0 }}
            style={styles.itemCard}
        >
            <View style={styles.itemHeader}>
                <View style={[styles.categoryPill, { backgroundColor: '#0084ff15' }]}>
                    <Text style={styles.categoryPillText}>{item.category || 'General'}</Text>
                </View>
                <View style={styles.switchContainer}>
                    <Text style={styles.activeLabel}>Active</Text>
                    <Switch
                        value={editingItem?.is_active || false}
                        onValueChange={value => onEditChange(item.id, 'is_active', value)}
                        trackColor={{ false: '#eee', true: '#0084ff' }}
                        thumbColor={Platform.OS === 'ios' ? '#fff' : (editingItem?.is_active ? '#0084ff' : '#f4f3f4')}
                    />
                </View>
            </View>

            <Text style={styles.itemLabel}>Trigger</Text>
            <TextInput
                value={editingItem?.trigger || ''}
                onChangeText={text => onEditChange(item.id, 'trigger', text)}
                style={styles.itemInput}
                multiline
            />

            <Text style={styles.itemLabel}>AI Response</Text>
            <TextInput
                value={editingItem?.response || ''}
                onChangeText={text => onEditChange(item.id, 'response', text)}
                style={[styles.itemInput, styles.itemTextArea]}
                multiline
            />

            <View style={styles.actionRow}>
                <TouchableOpacity 
                    onPress={() => onUpdate(item.id)}
                    style={[styles.actionBtn, item.needs_review ? styles.approveBtn : styles.saveBtn]}
                >
                    <Ionicons 
                        name={item.needs_review ? 'checkmark-circle' : 'save'} 
                        size={18} 
                        color="#fff" 
                    />
                    <Text style={styles.actionBtnText}>{item.needs_review ? 'Approve' : 'Save'}</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                    onPress={() => onDelete(item.id)}
                    style={[styles.actionBtn, styles.deleteBtn]}
                >
                    <Ionicons name="trash-outline" size={18} color="#F44336" />
                    <Text style={[styles.actionBtnText, { color: '#F44336' }]}>Delete</Text>
                </TouchableOpacity>
            </View>
        </MotiView>
    );
});

const ChatbotTrainingScreen = () => {
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const { from } = params;
    const { user } = useContext(AuthContext);
    const { notifications, markChatbotNotificationsAsRead } = useNotificationStore();
    const { showToast } = useToastStore();
    const [trainings, setTrainings] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [newTraining, setNewTraining] = useState<any>({ trigger: '', response: '', category: '', keywords: [] });
    const [editingItems, setEditingItems] = useState<any>({});
    const [needsReviewCount, setNeedsReviewCount] = useState(0);
    const API_BASE = getApiBase();

    const handleBack = useCallback(() => {
        if (from === 'settings') {
            router.back();
        } else if (from === 'notifications') {
            router.replace('/');
        } else {
            router.back();
        }
    }, [from]);

    useEffect(() => {
        const hasNewTraining = notifications.some(n =>
            n.type === 'chatbot_training' && !n.isRead
        );

        if (hasNewTraining) {
            setNeedsReviewCount(prev => prev + 1);
            fetchTrainings();
        }
    }, [notifications]);

    useEffect(() => {
        fetchTrainings();
        fetchNeedsReview();
        fetchCategories();
        markChatbotNotificationsAsRead();
    }, []);

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
            showToast('Failed to load trainings', 'error');
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

    const handleAddTraining = async () => {
        if (!newTraining.trigger.trim() || !newTraining.response.trim()) {
            showToast('Please provide both trigger and response.', 'error');
            return;
        }
        try {
            const token = await getToken();
            await axios.post(`${API_BASE}/chatbot-training`, newTraining, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setNewTraining({ trigger: '', response: '', category: '', keywords: [] });
            fetchTrainings();
            showToast('Rule added successfully!', 'success');
        } catch (error) {
            showToast('Failed to add rule', 'error');
        }
    };

    const handleUpdateTraining = useCallback(async (id: number) => {
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
                showToast('Wisdom updated successfully!', 'success');
            }
        } catch (error) {
            showToast(error.response?.data?.message || 'Update failed', 'error');
            fetchTrainings();
        }
    }, [editingItems, API_BASE, showToast]);

    const handleDeleteTraining = useCallback(async (id: number) => {
        const confirmDelete = async () => {
            try {
                const token = await getToken();
                await axios.delete(`${API_BASE}/chatbot-training/delete/${id}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    }
                });
                showToast('Rule deleted successfully', 'success');
                fetchTrainings();
            } catch (error) {
                showToast(error.response?.data?.message || 'Failed to delete rule', 'error');
                fetchTrainings();
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm("Are you sure you want to delete this rule?")) confirmDelete();
        } else {
            Alert.alert('Delete Rule', 'Are you sure?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: confirmDelete }
            ]);
        }
    }, [API_BASE, showToast]);

    const handleEditChange = useCallback((id: number, field: string, value: any) => {
        setEditingItems(prev => ({
            ...prev,
            [id]: {
                ...(prev[id] || {}),
                [field]: field === 'is_active' ? Boolean(value) : value
            }
        }));
    }, []);

    const renderHeader = () => (
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
            <TouchableOpacity onPress={handleBack} style={styles.headerButton}>
                <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>AI Model Training</Text>
            <View style={{ width: 40 }} />
        </View>
    );

    const renderAddForm = () => (
        <View style={styles.addCard}>
            <Text style={styles.sectionTitle}>Create New Wisdom</Text>
            <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Trigger (User Message)</Text>
                <TextInput
                    placeholder="e.g. hello, help, price"
                    value={newTraining.trigger}
                    onChangeText={text => setNewTraining({ ...newTraining, trigger: text })}
                    style={styles.input}
                    placeholderTextColor="rgba(0,0,0,0.3)"
                />
            </View>
            <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Bot Response</Text>
                <TextInput
                    placeholder="Enter the AI's answer..."
                    value={newTraining.response}
                    onChangeText={text => setNewTraining({ ...newTraining, response: text })}
                    style={[styles.input, styles.textArea]}
                    multiline
                    placeholderTextColor="rgba(0,0,0,0.3)"
                />
            </View>
            <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Category</Text>
                <TextInput
                    placeholder="e.g. Support, General, Technical"
                    value={newTraining.category}
                    onChangeText={text => setNewTraining({ ...newTraining, category: text })}
                    style={styles.input}
                    placeholderTextColor="rgba(0,0,0,0.3)"
                />
            </View>

            <TouchableOpacity onPress={handleAddTraining} activeOpacity={0.8}>
                <LinearGradient colors={['#0084ff', '#00c6ff']} style={styles.addButton}>
                    <Ionicons name="add-circle-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.addButtonText}>Integrate Wisdom</Text>
                </LinearGradient>
            </TouchableOpacity>

            {needsReviewCount > 0 && (
                <View style={styles.reviewBadge}>
                    <Ionicons name="alert-circle" size={16} color="#F44336" />
                    <Text style={styles.reviewText}>{needsReviewCount} rules awaiting approval</Text>
                </View>
            )}
        </View>
    );

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#0084ff" />
                <Text style={styles.loadingText}>Calibrating AI Core...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />
            {renderHeader()}
            
            <FlatList
                ListHeaderComponent={renderAddForm}
                data={trainings}
                keyExtractor={item => item.id.toString()}
                contentContainerStyle={styles.listContent}
                removeClippedSubviews={false}
                renderItem={({ item, index }) => (
                    <TrainingItem 
                        item={item}
                        editingItem={editingItems[item.id]}
                        onEditChange={handleEditChange}
                        onUpdate={handleUpdateTraining}
                        onDelete={handleDeleteTraining}
                        index={index}
                    />
                )}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#fff" },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
    loadingText: { marginTop: 12, color: 'rgba(0,0,0,0.4)', fontWeight: '600' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 20 },
    headerButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.05)', justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: 20, fontWeight: '800', color: '#1a1a1a', letterSpacing: -0.5 },
    listContent: { paddingHorizontal: '1%', paddingBottom: 100 },
    addCard: { backgroundColor: 'rgba(0,132,255,0.02)', borderRadius: 24, padding: 24, marginBottom: 24, borderWidth: 1, borderColor: 'rgba(0,132,255,0.1)', width: isMobile ? '98%' : '100%', alignSelf: 'center' },
    sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1a1a1a', marginBottom: 20, letterSpacing: -0.3 },
    inputGroup: { marginBottom: 16 },
    inputLabel: { fontSize: 13, fontWeight: '700', color: 'rgba(0,0,0,0.6)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
    input: { backgroundColor: '#fff', borderRadius: 12, padding: 14, fontSize: 16, color: '#1a1a1a', borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)', ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 }, android: { elevation: 2 } }) },
    textArea: { height: 100, textAlignVertical: 'top' },
    addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 16, marginTop: 8 },
    addButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    reviewBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16, gap: 6 },
    reviewText: { color: '#F44336', fontSize: 13, fontWeight: '600' },
    itemCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)', width: isMobile ? '98%' : '100%', alignSelf: 'center', ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10 }, android: { elevation: 4 } }) },
    itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    categoryPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    categoryPillText: { color: '#0084ff', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
    switchContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    activeLabel: { fontSize: 12, fontWeight: '600', color: 'rgba(0,0,0,0.4)' },
    itemLabel: { fontSize: 11, fontWeight: '800', color: 'rgba(0,0,0,0.3)', textTransform: 'uppercase', marginBottom: 4, letterSpacing: 1 },
    itemInput: { fontSize: 15, fontWeight: '500', color: '#1a1a1a', paddingBottom: 12, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.03)' },
    itemTextArea: { maxHeight: 80 },
    actionRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
    actionBtn: { flex: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, gap: 6 },
    saveBtn: { backgroundColor: '#0084ff' },
    approveBtn: { backgroundColor: '#1a1a1a' },
    deleteBtn: { flex: 1, backgroundColor: 'rgba(244,67,54,0.05)', borderWidth: 1, borderColor: 'rgba(244,67,54,0.1)' },
    actionBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});

export default ChatbotTrainingScreen;