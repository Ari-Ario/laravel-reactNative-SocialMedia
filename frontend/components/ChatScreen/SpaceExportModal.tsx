import React, { useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    Platform,
    Alert,
    ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createShadow } from '@/utils/styles';

interface SpaceExportModalProps {
    visible: boolean;
    onClose: () => void;
    space: any;
    participants: any[];
    polls: any[];
}

const ExportFormatBtn = ({ icon, title, description, onPress, color }: any) => (
    <TouchableOpacity style={styles.formatBtn} onPress={onPress}>
        <View style={[styles.iconWrapper, { backgroundColor: `${color}15` }]}>
            <Ionicons name={icon} size={28} color={color} />
        </View>
        <View style={styles.formatInfo}>
            <Text style={styles.formatTitle}>{title}</Text>
            <Text style={styles.formatDescription}>{description}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#ccc" />
    </TouchableOpacity>
);

const SpaceExportModal = ({ visible, onClose, space, participants, polls }: SpaceExportModalProps) => {

    const pollsMap = useMemo(() => {
        const map = new Map();
        if (polls && Array.isArray(polls)) {
            polls.forEach(p => map.set(p.id, p));
        }
        return map;
    }, [polls]);

    const generateHTML = () => {
        let htmlStr = '<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8">\n<title>';
        htmlStr += (space?.title || 'Space Export');
        htmlStr += '</title>\n<style>\nbody { font-family: -apple-system, sans-serif; padding: 40px; color: #333; line-height: 1.6; max-width: 900px; margin: 0 auto; background: #fff; }\n';
        htmlStr += 'h1 { color: #007AFF; border-bottom: 2px solid #eee; padding-bottom: 10px; margin-bottom: 20px; }\n';
        htmlStr += '.meta { background: #f8f9fa; padding: 25px; border-radius: 12px; margin-bottom: 40px; border: 1px solid #eaeaea; }\n';
        htmlStr += '.message { margin-bottom: 20px; padding: 18px; background: #fff; border: 1px solid #e0e0e0; border-radius: 10px; page-break-inside: avoid; }\n';
        htmlStr += '.message-header { display: flex; align-items: baseline; margin-bottom: 8px; }\n';
        htmlStr += '.author { font-weight: 700; color: #111; font-size: 15px; }\n';
        htmlStr += '.time { color: #888; font-size: 12px; margin-left: 12px; }\n';
        htmlStr += '.content { color: #333; white-space: pre-wrap; font-size: 15px; }\n';
        htmlStr += '.media-attachment { margin-top: 12px; padding: 10px 15px; background: #f0f7ff; border-radius: 6px; color: #0066cc; font-size: 14px; border-left: 3px solid #007AFF; }\n';
        htmlStr += '.poll-container { margin-top: 16px; border: 1px solid #d1d5db; border-radius: 8px; padding: 16px; background: #fafafa; }\n';
        htmlStr += '.poll-question { font-weight: 700; font-size: 16px; color: #1f2937; margin-bottom: 12px; }\n';
        htmlStr += '.poll-option { background: #fff; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 14px; margin-bottom: 8px; display: flex; justify-content: space-between; }\n';
        htmlStr += '.poll-opt-text { font-weight: 500; color: #374151; }\n';
        htmlStr += '.poll-opt-votes { color: #6b7280; font-size: 13px; font-weight: 600; }\n';
        htmlStr += '</style>\n</head>\n<body>\n';
        htmlStr += '<h1>' + (space?.title || 'Space Export') + '</h1>\n';
        htmlStr += '<div class="meta">\n';
        htmlStr += '<p><strong>Description:</strong> ' + (space?.description || 'N/A') + '</p>\n';
        htmlStr += '<p><strong>Type:</strong> ' + (space?.space_type?.toUpperCase() || '') + '</p>\n';
        htmlStr += '<p><strong>Participants:</strong> ' + (participants?.length || 0) + '</p>\n';
        htmlStr += '<p><strong>Export Date:</strong> ' + new Date().toLocaleString() + '</p>\n';
        htmlStr += '</div>\n<h2>Space History</h2>\n<div class="messages">\n';

        if (space?.content_state?.messages?.length > 0) {
            space.content_state.messages.forEach((m: any) => {
                htmlStr += '<div class="message">\n<div class="message-header">\n';
                htmlStr += '<span class="author">' + (m.user?.name || 'Unknown') + '</span>\n';
                htmlStr += '<span class="time">' + new Date(m.created_at).toLocaleString() + '</span>\n';
                htmlStr += '</div>\n';
                htmlStr += '<div class="content">' + (m.message_type === 'poll' ? '' : (m.content || '')) + '</div>\n';

                if (m.media_url) {
                    htmlStr += '<div class="media-attachment">📎 Attached Media File</div>\n';
                }

                if (m.message_type === 'poll') {
                    try {
                        const parsedContent = JSON.parse(m.content);
                        const pollData = pollsMap.get(parsedContent.poll_id);
                        if (pollData) {
                            htmlStr += '<div class="poll-container">\n';
                            htmlStr += '<div class="poll-question">📊 ' + pollData.question + '</div>\n';
                            if (pollData.options) {
                                pollData.options.forEach((opt: any) => {
                                    htmlStr += '<div class="poll-option">\n';
                                    htmlStr += '<span class="poll-opt-text">' + opt.text + '</span>\n';
                                    htmlStr += '<span class="poll-opt-votes">' + (opt.votes_count || 0) + ' votes</span>\n';
                                    htmlStr += '</div>\n';
                                });
                            }
                            htmlStr += '</div>\n';
                        } else {
                            htmlStr += '<div class="media-attachment">📊 [Poll Data Not Available]</div>\n';
                        }
                    } catch (e) {
                        htmlStr += '<div class="media-attachment">📊 [Interactive Poll]</div>\n';
                    }
                }
                htmlStr += '</div>\n';
            });
        } else {
            htmlStr += '<p>No messages found in this space.</p>\n';
        }

        htmlStr += '</div>\n</body>\n</html>';
        return htmlStr;
    };

    const downloadBlob = (content: string, mimeType: string, extension: string) => {
        if (Platform.OS !== 'web') {
            Alert.alert('Web Only', 'Exports are currently designed for Web platforms.');
            return;
        }
        try {
            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const downloadNode = document.createElement('a');
            downloadNode.href = url;
            downloadNode.download = `${space?.title?.replace(/\\s+/g, '_') || 'space'}_export.${extension}`;
            document.body.appendChild(downloadNode);
            downloadNode.click();
            document.body.removeChild(downloadNode);
            URL.revokeObjectURL(url);
        } catch (e) {
            Alert.alert('Export Error', 'Failed to generate download.');
        }
    };


    const handleJSON = () => {
        const enrichedSpaceData = {
            ...space,
            _exported_polls: Array.from(pollsMap.values())
        };
        downloadBlob(JSON.stringify(enrichedSpaceData, null, 2), 'application/json', 'json');
        onClose();
    };

    const handleCSV = () => {
        let csv = "Date,Author,Type,Content\n";

        space?.content_state?.messages?.forEach((m: any) => {
            const date = new Date(m.created_at).toLocaleString().replace(/,/g, '');
            const author = (m.user?.name || 'Unknown').replace(/,/g, '');
            const type = m.message_type || 'text';

            let content = m.content || '';
            if (type === 'poll') {
                try {
                    const parsedContent = JSON.parse(m.content);
                    const pollData = pollsMap.get(parsedContent.poll_id);
                    if (pollData) content = 'Poll: ' + pollData.question;
                } catch (e) {
                    content = "Poll";
                }
            }

            // Escape quotes
            content = '"' + content.replace(/"/g, '""') + '"';

            csv += date + ',' + author + ',' + type + ',' + content + '\n';
        });

        downloadBlob(csv, 'text/csv', 'csv');
        onClose();
    };

    const handleHTML = () => {
        downloadBlob(generateHTML(), 'text/html', 'html');
        onClose();
    };

    const handleWord = () => {
        const html = generateHTML();
        let wordContent = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>\n";
        wordContent += "<head>\n<meta charset='utf-8'>\n<title>Export</title>\n";
        wordContent += "<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom><w:DoNotOptimizeForBrowser/></w:WordDocument></xml><![endif]-->\n";
        wordContent += "</head>\n<body>\n" + html + "\n</body>\n</html>";

        downloadBlob(wordContent, 'application/msword', 'doc');
        onClose();
    };

    const handlePDF = () => {
        if (Platform.OS !== 'web') {
            Alert.alert('Web Only', 'PDF printing is currently designed for Web platforms.');
            return;
        }
        const html = generateHTML();
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(html);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
            }, 250);
        } else {
            Alert.alert('Popup Blocked', 'Please allow popups to generate the PDF print view.');
        }
        onClose();
    };


    return (
        <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <View style={styles.header}>
                        <View>
                            <Text style={styles.title}>Export Space Content</Text>
                            <Text style={styles.subtitle}>Select a format to download "{space?.title}"</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <Ionicons name="close" size={24} color="#666" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                        <ExportFormatBtn
                            icon="document-text"
                            color="#007AFF"
                            title="Word Document (.doc)"
                            description="Rich text format, ideal for Microsoft Word editing."
                            onPress={handleWord}
                        />

                        <ExportFormatBtn
                            icon="print"
                            color="#FF3B30"
                            title="PDF / Print"
                            description="A read-only document ready for sharing or printing."
                            onPress={handlePDF}
                        />

                        <ExportFormatBtn
                            icon="list"
                            color="#34C759"
                            title="Spreadsheet (.csv)"
                            description="Tabular chat logs, great for Excel and data analysis."
                            onPress={handleCSV}
                        />

                        <ExportFormatBtn
                            icon="globe-outline"
                            color="#5856D6"
                            title="Web Page (.html)"
                            description="Interactive standalone web package with styles."
                            onPress={handleHTML}
                        />

                        <ExportFormatBtn
                            icon="code-slash"
                            color="#FF9500"
                            title="JSON Payload"
                            description="Raw developer data including all space state."
                            onPress={handleJSON}
                        />
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
        alignItems: 'center',
        padding: Platform.OS === 'web' ? 20 : 0,
    },
    container: {
        backgroundColor: '#fff',
        width: '100%',
        maxWidth: 500,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderRadius: Platform.OS === 'web' ? 24 : undefined,
        maxHeight: '85%',
        ...createShadow({ width: 0, height: -5, radius: 15, opacity: 0.1 }),
    },
    header: {
        padding: 24,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        color: '#1f2937',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 14,
        color: '#6b7280',
        maxWidth: '90%',
    },
    closeBtn: {
        padding: 4,
        backgroundColor: '#f3f4f6',
        borderRadius: 20,
    },
    content: {
        padding: 20,
    },
    formatBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 16,
        marginBottom: 12,
    },
    iconWrapper: {
        width: 50,
        height: 50,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    formatInfo: {
        flex: 1,
    },
    formatTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1f2937',
        marginBottom: 4,
    },
    formatDescription: {
        fontSize: 13,
        color: '#6b7280',
        lineHeight: 18,
    }
});

export default SpaceExportModal;
