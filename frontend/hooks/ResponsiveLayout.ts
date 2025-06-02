// hooks/useResponsiveLayout.ts
import { Platform, useWindowDimensions } from 'react-native';

// TODO in BACKEND end Destroy here
//  const handleDeleteTraining = async (id) => {
//     try {
//         const token = await getToken();
//         const updates = editingItems[id];
        
//         console.log('Deleting the Item:', updates);
        
//         const { data } = await axios.delete(`${API_BASE}/chatbot-training/delete/${id}`, {
//             headers: {
//                 'Authorization': `Bearer ${token}`,
//                 'Content-Type': 'application/json',
//                 'Accept': 'application/json'
//             }
//         });

//         console.log('Delete response:', data);
        
//         if (data.success) {
//             // Update both trainings and editingItems states
//             setTrainings(prev => prev.map(item => 
//                 item.id === id ? { ...item, ...data.data } : item
//             ));
//             setEditingItems(prev => ({
//                 ...prev,
//                 [id]: {
//                     ...prev[id],
//                     ...data.data
//                 }
//             }));
            
//             Alert.alert('Success', 'Training Deleted');
//         } else {
//             throw new Error(data.message || 'Delete failed');
//         }
//     } catch (error) {
//         console.error('Full error:', error.response?.data || error.message);
//         Alert.alert('Error', error.response?.data?.message || 'Failed to delete training');
//         // Refresh from server to ensure consistency
//         fetchTrainings();
//     }
// };

export const useResponsiveLayout = () => {
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const isWide = width > 768;

  const layoutStyle = isWeb && isWide ? 'row' : 'column';

  return {
    isWeb,
    isWide,
    layoutStyle,
  };
};
