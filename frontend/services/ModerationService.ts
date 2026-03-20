// services/ModerationService.ts
import axios from 'axios';
import getApiBase from './getApiBase';
import { getToken } from './TokenService';

export interface ModerationAnalysis {
    is_safe: boolean;
    recommended_action: 'none' | 'flag' | 'hide' | 'restrict';
    scores: {
        fact: number;
        morality: number;
        malicious: number;
    };
    flags: string[];
}

export const quickCheckContent = async (text: string, context?: string): Promise<ModerationAnalysis> => {
    try {
        const token = await getToken();
        const response = await axios.post(`${getApiBase()}/moderation/check`, {
            text,
            context
        }, {
            headers: {
                'Authorization': `Bearer ${token}`
            },
            withCredentials: true
        });
        return response.data;
    } catch (error) {
        console.error('Moderation QuickCheck error:', error);
        throw error;
    }
};

export const getMyCompliance = async () => {
    try {
        const token = await getToken();
        const response = await axios.get(`${getApiBase()}/moderation/compliance`, {
            headers: {
                'Authorization': `Bearer ${token}`
            },
            withCredentials: true
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching compliance:', error);
        throw error;
    }
};

/**
 * Admin: Get pending reports for review
 */
export const getAdminReports = async (params?: { status?: string, severity?: string, page?: number }) => {
    try {
        const token = await getToken();
        const response = await axios.get(`${getApiBase()}/admin/moderation/reports`, {
            params,
            headers: {
                'Authorization': `Bearer ${token}`
            },
            withCredentials: true
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching admin reports:', error);
        throw error;
    }
};

/**
 * Admin: Resolve a report
 */
export const resolveReport = async (reportId: string, data: { action: 'dismiss' | 'warn' | 'suspend' | 'ban', notes?: string, duration_hours?: number }) => {
    try {
        const token = await getToken();
        const response = await axios.post(`${getApiBase()}/admin/moderation/reports/${reportId}/resolve`, data, {
            headers: {
                'Authorization': `Bearer ${token}`
            },
            withCredentials: true
        });
        return response.data;
    } catch (error) {
        console.error('Error resolving report:', error);
        throw error;
    }
};
