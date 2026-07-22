import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const isMockMode = !supabaseUrl || 
                   supabaseUrl.includes('your-project-id') || 
                   supabaseUrl === '' || 
                   supabaseUrl === 'https://your-project-id.supabase.co';

let supabaseClient;

if (!isMockMode) {
  supabaseClient = createClient(supabaseUrl, supabaseAnonKey)
} else {
  // --- MOCK SUPABASE CLIENT IN LOCAL STORAGE ---
  console.log('🔌 Running TaskBoard in MOCK mode (LocalStorage database)');

  // Seed default data if empty
  const initializeLocalStorage = () => {
    // Automatically wipe old test tasks if they exist in LocalStorage
    const existingTasks = localStorage.getItem('mock_tasks');
    if (existingTasks && existingTasks.includes('task_1')) {
      localStorage.removeItem('mock_tasks');
      localStorage.removeItem('mock_comments');
      localStorage.removeItem('mock_task_history');
      localStorage.removeItem('mock_notifications');
    }

    // Automatically wipe old test profiles if they exist in LocalStorage
    const existingProfiles = localStorage.getItem('mock_profiles');
    if (existingProfiles && JSON.parse(existingProfiles).length === 4) {
      localStorage.removeItem('mock_profiles');
    }

    if (!localStorage.getItem('mock_profiles')) {
      const defaultProfiles = [
        { id: 'user_admin', name: 'Администратор', avatar: '👑', color: '#f59e0b', email: 'admin@taskboard.local', password: '123456', role: 'admin', is_admin: true }
      ];
      localStorage.setItem('mock_profiles', JSON.stringify(defaultProfiles));
    }

    if (!localStorage.getItem('mock_tasks')) {
      localStorage.setItem('mock_tasks', JSON.stringify([]));
    }

    if (!localStorage.getItem('mock_comments')) {
      localStorage.setItem('mock_comments', JSON.stringify([]));
    }

    if (!localStorage.getItem('mock_task_history')) {
      localStorage.setItem('mock_task_history', JSON.stringify([]));
    }

    if (!localStorage.getItem('mock_notifications')) {
      localStorage.setItem('mock_notifications', JSON.stringify([]));
    }
  };

  // Run initialization if in browser
  if (typeof window !== 'undefined') {
    initializeLocalStorage();
  }

  // Realtime listeners registry
  const listeners = [];

  const notifyListeners = (table, eventType, newRecord, oldRecord) => {
    listeners.forEach(listener => {
      if (listener.table === table) {
        listener.callback({
          eventType,
          new: newRecord,
          old: oldRecord
        });
      }
    });
  };

  supabaseClient = {
    auth: {
      getSession: async () => {
        if (typeof window === 'undefined') return { data: { session: null }, error: null };
        const sessionData = localStorage.getItem('mock_session');
        const session = sessionData ? JSON.parse(sessionData) : null;
        return { data: { session }, error: null };
      },
      onAuthStateChange: (callback) => {
        const handler = () => {
          const sessionData = localStorage.getItem('mock_session');
          const session = sessionData ? JSON.parse(sessionData) : null;
          callback('SIGNED_IN', session);
        };
        
        if (typeof window !== 'undefined') {
          window.addEventListener('mock_auth_change', handler);
        }
        
        return {
          data: {
            subscription: {
              unsubscribe: () => {
                if (typeof window !== 'undefined') {
                  window.removeEventListener('mock_auth_change', handler);
                }
              }
            }
          }
        };
      },
      signInWithPassword: async ({ email, password }) => {
        const profiles = JSON.parse(localStorage.getItem('mock_profiles') || '[]');
        const userProfile = profiles.find(p => p.email === email);
        
        if (!userProfile) {
          return { data: { user: null }, error: { message: 'Пользователь не найден. Пожалуйста, зарегистрируйтесь.' } };
        }

        const session = {
          user: { id: userProfile.id, email: userProfile.email },
          access_token: 'mock_token'
        };
        localStorage.setItem('mock_session', JSON.stringify(session));
        window.dispatchEvent(new Event('mock_auth_change'));

        return { data: { user: session.user }, error: null };
      },
      signUp: async ({ email, password, options }) => {
        const profiles = JSON.parse(localStorage.getItem('mock_profiles') || '[]');
        if (profiles.some(p => p.email === email)) {
          return { data: { user: null }, error: { message: 'Пользователь с таким email уже существует.' } };
        }

        const userId = 'user_' + Date.now();
        const user = { id: userId, email };
        const session = { user, access_token: 'mock_token' };
        
        localStorage.setItem('mock_session', JSON.stringify(session));
        
        // Profiles list will be updated in the context, but let's make sure it will be dispatched
        setTimeout(() => {
          window.dispatchEvent(new Event('mock_auth_change'));
        }, 50);

        return { data: { user }, error: null };
      },
      signOut: async () => {
        localStorage.removeItem('mock_session');
        window.dispatchEvent(new Event('mock_auth_change'));
        return { error: null };
      }
    },
    
    from: (table) => {
      const getData = () => JSON.parse(localStorage.getItem(`mock_${table}`) || '[]');
      const saveData = (data) => localStorage.setItem(`mock_${table}`, JSON.stringify(data));

      let currentData = getData();
      let isSingle = false;

      const builder = {
        select: (fields) => {
          // returns current data
          return builder;
        },
        eq: (field, value) => {
          currentData = currentData.filter(item => item[field] === value);
          return builder;
        },
        or: (orExpression) => {
          // Supports: 
          // 1. created_by.eq.user_id,assigned_to.eq.user_id
          // 2. title.ilike.%query%,description.ilike.%query%,tags.cs.{query}
          if (orExpression.includes('created_by.eq.')) {
            const parts = orExpression.split(',');
            const createdById = parts[0].split('.eq.')[1];
            const assignedToId = parts[1].split('.eq.')[1];
            currentData = currentData.filter(item => 
              item.created_by === createdById || item.assigned_to === assignedToId
            );
          } else if (orExpression.includes('title.ilike.')) {
            const parts = orExpression.split(',');
            const query = parts[0].split('.ilike.%')[1].replace('%', '').toLowerCase();
            currentData = currentData.filter(item => {
              const titleMatch = item.title?.toLowerCase().includes(query);
              const descMatch = item.description?.toLowerCase().includes(query);
              const tagMatch = item.tags?.some(tag => tag.toLowerCase().includes(query));
              return titleMatch || descMatch || tagMatch;
            });
          }
          return builder;
        },
        order: (field, { ascending = true } = {}) => {
          currentData.sort((a, b) => {
            let valA = a[field];
            let valB = b[field];
            if (valA === null || valA === undefined) return ascending ? 1 : -1;
            if (valB === null || valB === undefined) return ascending ? -1 : 1;
            if (valA < valB) return ascending ? -1 : 1;
            if (valA > valB) return ascending ? 1 : -1;
            return 0;
          });
          return builder;
        },
        single: () => {
          isSingle = true;
          return builder;
        },
        insert: async (rows) => {
          const allData = getData();
          const newRows = rows.map(row => ({
            id: row.id || `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            created_at: new Date().toISOString(),
            ...row
          }));

          const updatedData = [...newRows, ...allData];
          saveData(updatedData);

          newRows.forEach(row => {
            notifyListeners(table, 'INSERT', row, null);
          });

          currentData = newRows;
          return builder;
        },
        update: async (updates) => {
          // Requires filters to be applied before update!
          // We look at currentData matching filters, and update them in allData
          const allData = getData();
          const updatedRecordIds = currentData.map(item => item.id);
          
          let lastUpdated = null;
          const finalData = allData.map(item => {
            if (updatedRecordIds.includes(item.id)) {
              const updatedItem = { ...item, ...updates, updated_at: new Date().toISOString() };
              lastUpdated = updatedItem;
              notifyListeners(table, 'UPDATE', updatedItem, item);
              return updatedItem;
            }
            return item;
          });
          
          saveData(finalData);
          currentData = lastUpdated ? [lastUpdated] : [];
          return builder;
        },
        delete: async () => {
          // Deletes records matching currentData filter
          const allData = getData();
          const deletedRecordIds = currentData.map(item => item.id);
          
          const finalData = allData.filter(item => {
            if (deletedRecordIds.includes(item.id)) {
              notifyListeners(table, 'DELETE', null, item);
              return false;
            }
            return true;
          });
          
          saveData(finalData);
          currentData = [];
          return builder;
        },
        // Chaining resolvers
        then: (onfulfilled) => {
          const result = isSingle 
            ? { data: currentData[0] || null, error: null } 
            : { data: currentData, error: null };
          return Promise.resolve(onfulfilled(result));
        }
      };
      
      return builder;
    },

    channel: (name) => {
      const channelObj = {
        on: (event, filterObj, callback) => {
          listeners.push({
            channelName: name,
            table: filterObj.table,
            callback
          });
          return channelObj;
        },
        subscribe: () => {
          return channelObj;
        }
      };
      return channelObj;
    },

    removeChannel: (channel) => {
      // Clean up listeners for this channel
      const index = listeners.findIndex(l => l.channelName === channel.channelName);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  };
}

export const supabase = supabaseClient
