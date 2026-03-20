// services/ReportService.ts
import axios from 'axios';
import getApiBase from './getApiBase';
import { getToken } from './TokenService';

export interface ReportData {
    type: 'post' | 'user' | 'comment' | 'space' | 'story';
    targetId: number | string;
    categoryId: string;
    subcategoryId: string;
    description?: string;
    evidence?: string[];
    isAnonymous: boolean;
    isUrgent: boolean;
    metadata: any;
}

export const reportPost = async (reportData: ReportData) => {
    try {
        const token = await getToken();
        const response = await axios.post(`${getApiBase()}/reports`, reportData, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            withCredentials: true
        });
        return response.data;
    } catch (error) {
        console.error('Report Service error:', error);
        throw error;
    }
};

export const getReportCategories = async (params: any) => {
    try {
        const response = await axios.get(`${getApiBase()}/api/report-categories`, { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching report categories:', error);
        throw error;
    }
};

export const checkReportStatus = async (reportId: string) => {
    try {
        const token = await getToken();
        const response = await axios.get(`${getApiBase()}/reports/${reportId}/status`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        return response.data;
    } catch (error) {
        console.error('Error checking report status:', error);
        throw error;
    }
};