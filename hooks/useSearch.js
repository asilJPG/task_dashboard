'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useSearch(userId, profile) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const isManagerOrAdmin = profile?.role === 'manager' || profile?.role === 'admin' || profile?.is_admin === true;

  useEffect(() => {
    if (!userId || !query.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setSearching(true);
      try {
        let queryBuilder = supabase.from('tb_tasks').select('*');
        if (!isManagerOrAdmin) {
          queryBuilder = queryBuilder.or(`created_by.eq.${userId},assigned_to.eq.${userId}`);
        }
        queryBuilder = queryBuilder.or(`title.ilike.%${query}%,description.ilike.%${query}%,tags.cs.{${query}}`);

        const { data, error } = await queryBuilder;

        if (data) {
          setResults(data);
        }
        if (error) {
          console.error('Search error:', error);
        }
      } catch (error) {
        console.error('Search exception:', error);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query, userId, isManagerOrAdmin]);

  return { query, setQuery, results, searching };
}
