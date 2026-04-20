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

export interface QueryOptions {
  lite?: boolean;
  page?: number;
}

export const usePosts = (options: QueryOptions = {}): QueryResult<Post[]> => {
  const [data, setData] = useState<Post[]>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const fetchPosts = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (options.lite) params.append('lite', '1');
      if (options.page) params.append('page', options.page.toString());
      
      const queryStr = params.toString() ? `?${params.toString()}` : '';
      console.log(`📡 [Hydration] Fetching posts (lite: ${!!options.lite})...`);
      const response = await axios.get(`/posts${queryStr}`);
      setData(response.data.data || response.data);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [options.lite, options.page]);

  return { data, isLoading, error, refetch: fetchPosts };
};

export const useStories = (options: QueryOptions = {}): QueryResult<any[]> => {
  const [data, setData] = useState<any[]>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const fetchStories = async () => {
    setIsLoading(true);
    try {
      const queryStr = options.lite ? '?lite=1' : '';
      console.log(`📡 [Hydration] Fetching stories (lite: ${!!options.lite})...`);
      const response = await axios.get(`/stories${queryStr}`);
      setData(response.data.data || response.data);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStories();
  }, [options.lite]);

  return { data, isLoading, error, refetch: fetchStories };
};

export const useSpaces = (options: QueryOptions = {}): QueryResult<any[]> => {
  const [data, setData] = useState<any[]>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const fetchSpaces = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (options.lite) params.append('lite', '1');
      if (options.page) params.append('page', options.page.toString());
      
      const queryStr = params.toString() ? `?${params.toString()}` : '';
      console.log(`📡 [Hydration] Fetching spaces (lite: ${!!options.lite})...`);
      const response = await axios.get(`/spaces${queryStr}`);
      setData(response.data.spaces || response.data.data || response.data);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSpaces();
  }, [options.lite, options.page]);

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
