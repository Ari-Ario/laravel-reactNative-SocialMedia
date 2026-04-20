import { useState, useEffect } from 'react';
import axios from '@/services/axios';

export interface Post {
  id: number;
  caption: string;
  media: any[];
  user: {
    id: number;
    name: string;
    profile_photo: string | null;
  };
  comments_count: number;
  reactions_count: number;
  created_at: string;
  [key: string]: any;
}

interface QueryResult<T> {
  data: T | undefined;
  isLoading: boolean;
  error: any;
  refetch: () => Promise<void>;
}

export const usePosts = (): QueryResult<Post[]> => {
  const [data, setData] = useState<Post[]>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const fetchPosts = async () => {
    setIsLoading(true);
    try {
      console.log('📡 [Manual Fetch] Fetching posts...');
      const response = await axios.get('/posts');
      setData(response.data.data || response.data);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  return { data, isLoading, error, refetch: fetchPosts };
};

export const useStories = (): QueryResult<any[]> => {
  const [data, setData] = useState<any[]>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const fetchStories = async () => {
    setIsLoading(true);
    try {
      console.log('📡 [Manual Fetch] Fetching stories...');
      const response = await axios.get('/stories');
      setData(response.data.data || response.data);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStories();
  }, []);

  return { data, isLoading, error, refetch: fetchStories };
};

export const useSpaces = (): QueryResult<any[]> => {
  const [data, setData] = useState<any[]>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const fetchSpaces = async () => {
    setIsLoading(true);
    try {
      console.log('📡 [Manual Fetch] Fetching spaces...');
      const response = await axios.get('/spaces');
      setData(response.data.spaces || response.data.data || response.data);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSpaces();
  }, []);

  return { data, isLoading, error, refetch: fetchSpaces };
};

export const useSpaceDetails = (spaceId: string | number): QueryResult<any> => {
  const [data, setData] = useState<any>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const fetchDetails = async () => {
    if (!spaceId) return;
    setIsLoading(true);
    try {
      console.log(`📡 [Manual Fetch] Fetching space details: ${spaceId}`);
      const response = await axios.get(`/spaces/${spaceId}`);
      setData(response.data.data || response.data);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [spaceId]);

  return { data, isLoading, error, refetch: fetchDetails };
};
