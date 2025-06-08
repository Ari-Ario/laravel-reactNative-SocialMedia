// components/ReportPost.tsx
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { reportPost } from '@/services/PostService';

interface ReportPostProps {
    visible: boolean;
    postId: number;
    onClose: () => void;
    onReportSubmitted: () => void;
}

const reportReasons = [
    "It's spam",
    "Nudity or sexual activity",
    "Hate speech or symbols",
    "Violence or dangerous organizations",
    "Bullying or harassment",
    "Intellectual property violation",
    "False information",
    "Something else"
];

export default function ReportPost({ 
    visible, 
    postId, 
    onClose, 
    onReportSubmitted 
}: ReportPostProps) {
    const handleReport = async (reason: string) => {
        try {
            await reportPost(postId, reason);
            onReportSubmitted();
            onClose();
        } catch (error) {
            console.error('Error reporting post:', error);
        }
    };

    return (
        <Modal
            transparent
            visible={visible}
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <Text style={styles.title}>Why are you reporting this post?</Text>
                    
                    <ScrollView style={styles.reasonsContainer}>
                        {reportReasons.map((reason, index) => (
                            <TouchableOpacity
                                key={index}
                                style={styles.reasonItem}
                                onPress={() => handleReport(reason)}
                            >
                                <Text style={styles.reasonText}>{reason}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                    
                    <TouchableOpacity 
                        style={styles.cancelButton}
                        onPress={onClose}
                    >
                        <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: 'white',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        maxHeight: '80%',
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
    },
    reasonsContainer: {
        marginBottom: 20,
    },
    reasonItem: {
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    reasonText: {
        fontSize: 16,
    },
    cancelButton: {
        padding: 15,
        alignItems: 'center',
        backgroundColor: '#f0f0f0',
        borderRadius: 10,
    },
    cancelText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
    },
});