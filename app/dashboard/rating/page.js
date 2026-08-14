'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTasks } from '@/hooks/useTasks';
import { supabase } from '@/lib/supabase';
import { calcMonthlyRating, MONTH_NAMES, RATING_CONFIG } from '@/lib/rating';
import EmployeeRatingModal from '@/components/RatingModal/EmployeeRatingModal';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function RatingPage() {
  const { user, profile } = useAuth();
  const { tasks, loading } = useTasks(user?.id, profile);
  const router = useRouter();

  const [profiles, setProfiles] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const now = new Date();
  const [period, setPeriod] = useState({ year: now.getFullYear(), month: now.getMonth() });

  const isAdmin = profile?.is_admin || profile?.role === 'admin';

  useEffect(() => {
    if (profile && !isAdmin) router.push('/dashboard');
  }, [profile, isAdmin, router]);

  useEffect(() => {
    const fetchProfiles = async () => {
      const { data } = await supabase.from('tb_profiles').select('*');
      if (data) setProfiles(data);
    };
    fetchProfiles();
  }, []);

  const rating = useMemo(
    () => calcMonthlyRating(profiles, tasks, period.year, period.month),
    [profiles, tasks, period.year, period.month]
  );

  // Tasks closed this month that nobody has rated yet — they score nothing until a manager does.
  const unratedThisMonth = useMemo(() => {
    const start = new Date(period.year, period.month, 1).getTime();
    const end = new Date(period.year, period.month + 1, 1).getTime();
    return tasks.filter(t => {
      if (t.status !== 'done' || !t.completed_at || t.difficulty) return false;
      const closed = new Date(t.completed_at).getTime();
      return closed >= start && closed < end;
    });
  }, [tasks, period.year, period.month]);

  const shiftMonth = (delta) => {
    setPeriod(prev => {
      const d = new Date(prev.year, prev.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const isCurrentMonth = period.year === now.getFullYear() && period.month === now.getMonth();

  // Derived from the freshly computed rating, so the open modal follows live task edits
  // and month switches instead of holding a stale copy.
  const selectedRow = rating.find(r => r.profile.id === selectedId) || null;

  if (!isAdmin) return null;

  return (
    <div className="analytics-view">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>🏆 Рейтинг сотрудников</h2>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => shiftMonth(-1)}>← Назад</button>
          <span style={{ minWidth: '150px', textAlign: 'center', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
            {MONTH_NAMES[period.month]} {period.year}
          </span>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => shiftMonth(1)}
            disabled={isCurrentMonth}
            style={{ opacity: isCurrentMonth ? 0.4 : 1 }}
          >
            Вперёд →
          </button>
        </div>
      </div>

      {unratedThisMonth.length > 0 && (
        <div style={{ background: 'rgba(219, 109, 40, 0.1)', border: '1px solid rgba(219, 109, 40, 0.25)', color: '#db6d28', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', marginBottom: '16px' }}>
          ⚠️ Задач без оценки сложности за этот месяц: <strong>{unratedThisMonth.length}</strong>. Они не приносят баллов, пока руководитель не выставит сложность.
        </div>
      )}

      <div className="analytics-card">
        {loading && <div style={{ color: 'var(--text-secondary)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Загрузка...</div>}

        {!loading && rating.length === 0 && (
          <div style={{ color: 'var(--text-secondary)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Нет сотрудников для рейтинга.</div>
        )}

        {!loading && rating.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {rating.map(row => {
              const medal = row.score > 0 && row.rank <= 3 ? MEDALS[row.rank - 1] : null;
              return (
                <div
                  key={row.profile.id}
                  onClick={() => setSelectedId(row.profile.id)}
                  title="Открыть подробный разбор баллов"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 14px',
                    background: '#0d1117',
                    border: `1px solid ${medal ? 'rgba(245, 158, 11, 0.35)' : 'var(--border-color)'}`,
                    borderRadius: '10px',
                    flexWrap: 'wrap',
                    cursor: 'pointer'
                  }}
                >
                  <span style={{ fontSize: '18px', minWidth: '28px', textAlign: 'center' }}>
                    {medal || <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{row.rank}</span>}
                  </span>

                  <div className="avatar-circle" style={{ backgroundColor: row.profile.color || 'var(--accent)', width: '34px', height: '34px', fontSize: '17px', flexShrink: 0 }}>
                    {row.profile.avatar || '👤'}
                  </div>

                  <div style={{ flex: 1, minWidth: '160px' }}>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>{row.profile.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <span>✅ Закрыто: <strong style={{ color: '#34d399' }}>{row.closedCount}</strong> из {row.totalTasks} ({row.closedPercent}%)</span>
                      <span>⚡ Сложность: <strong style={{ color: '#f59e0b' }}>{row.difficultySum}</strong></span>
                      <span>⏱ Сроки: <strong style={{ color: row.timeBonusSum > 0 ? '#34d399' : row.timeBonusSum < 0 ? '#f85149' : '#8d96a0' }}>
                        {row.timeBonusSum > 0 ? `+${row.timeBonusSum}` : row.timeBonusSum}
                      </strong></span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <span>🎯 В срок: <strong style={{ color: '#34d399' }}>{row.inTimeCount}</strong></span>
                      <span>⏳ До 10 дней: <strong style={{ color: '#8d96a0' }}>{row.graceCount}</strong></span>
                      <span>🔴 Позже: <strong style={{ color: '#f85149' }}>{row.lateCount}</strong></span>
                      {row.unratedCount > 0 && <span style={{ color: '#db6d28' }}>⚠️ Без оценки: {row.unratedCount}</span>}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', minWidth: '80px' }}>
                    <div style={{ fontSize: '22px', fontWeight: 700, color: '#38bdf8', lineHeight: 1.1 }}>{row.score}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>баллов</div>
                    <div style={{ fontSize: '10px', color: '#38bdf8', marginTop: '2px' }}>подробнее →</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="analytics-card" style={{ marginTop: '16px' }}>
        <h3>Как считается</h3>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.7' }}>
          <div>Задача учитывается в том месяце, в котором была <strong>закрыта</strong>. Рейтинг обнуляется каждый месяц.</div>
          <div style={{ marginTop: '8px' }}>Баллы за задачу = <strong>сложность + балл за срок</strong>:</div>
          <div style={{ marginLeft: '12px' }}>
            <div>🎯 Уложился в дедлайн — <strong style={{ color: '#34d399' }}>+{RATING_CONFIG.IN_TIME_BONUS}</strong></div>
            <div>⏳ Просрочка до {RATING_CONFIG.GRACE_DAYS} дней — <strong>{RATING_CONFIG.GRACE_BONUS}</strong> (без плюса и минуса)</div>
            <div>🔴 Просрочка больше {RATING_CONFIG.GRACE_DAYS} дней — <strong style={{ color: '#f85149' }}>{RATING_CONFIG.LATE_PENALTY}</strong></div>
          </div>
          <div style={{ marginTop: '8px' }}>
            Например: задача оценена на <strong>6</strong> и закрыта в срок → <strong>6 + 1 = 7 баллов</strong>.
          </div>
          <div style={{ marginTop: '8px' }}>
            Итог за месяц = сумма баллов по всем закрытым задачам. Задачи без выставленной сложности не приносят баллов.
          </div>
        </div>
      </div>

      <EmployeeRatingModal
        isOpen={!!selectedRow}
        row={selectedRow}
        monthLabel={`${MONTH_NAMES[period.month]} ${period.year}`}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}
