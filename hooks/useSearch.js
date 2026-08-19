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
          // Also covers tasks where the person is one of several assignees or the responsible
          // one — previously those were invisible to their own search.
          queryBuilder = queryBuilder.or(
            `created_by.eq.${userId},assigned_to.eq.${userId},responsible_id.eq.${userId},assignees.cs.{${userId}}`
          );
        }

        // "12" or "№12" looks up the task number; anything else searches the text.
        const raw = query.trim();
        const digits = raw.replace(/^[№#]\s*/, '');
        const isNumberLookup = /^\d+$/.test(digits);

        queryBuilder = isNumberLookup
          ? queryBuilder.or(`task_number.eq.${digits},title.ilike.%${raw}%,description.ilike.%${raw}%`)
          : queryBuilder.or(`title.ilike.%${raw}%,description.ilike.%${raw}%,tags.cs.{${raw}}`);

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
