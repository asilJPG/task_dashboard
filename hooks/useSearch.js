'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useSearch(userId) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!userId || !query.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setSearching(true);
      try {
        const { data, error } = await supabase
          .from('tb_tasks')
          .select('*')
          .or(`created_by.eq.${userId},assigned_to.eq.${userId}`)
          .or(`title.ilike.%${query}%,description.ilike.%${query}%,tags.cs.{${query}}`);

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
  }, [query, userId]);

  return { query, setQuery, results, searching };
}
