/**
 * Monthly employee rating.
 *
 * Everything is derived from tb_tasks on the fly — no stored snapshots. That is deliberate:
 * a manager may set or change a task's difficulty long after it was closed (even for a past
 * month), and the rating for that month has to reflect the change immediately.
 *
 * A task belongs to the month it was CLOSED in (completed_at), not the month it was created in.
 */

// Points for a task are ADDED, never multiplied:
//   task points = difficulty + deadline bonus
// A task rated 6 and closed on time is worth 6 + 1 = 7.
export const RATING_CONFIG = {
  IN_TIME_BONUS: 1,      // closed on or before the deadline
  GRACE_BONUS: 0,        // overdue, but within GRACE_DAYS — neither bonus nor penalty
  LATE_PENALTY: -1,      // overdue by more than GRACE_DAYS
  NO_DEADLINE_BONUS: 0,  // task had no deadline — nothing to be late for
  GRACE_DAYS: 10,

  // When true, a task's points are split across its assignees instead of each getting the full
  // amount. Pending a decision from the client — flip this single flag to switch behaviour.
  SPLIT_POINTS_BY_ASSIGNEES: false
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Rounds away accumulated float error (0.1 * 3 problems) before values are shown or compared. */
function roundTo(value, digits = 1) {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}

/** Everyone credited for a task: primary assignee plus the assignees array, de-duplicated. */
export function getTaskAssignees(task) {
  const ids = [];
  if (task?.assigned_to) ids.push(task.assigned_to);
  if (Array.isArray(task?.assignees)) {
    task.assignees.forEach(id => { if (id) ids.push(id); });
  }
  return Array.from(new Set(ids));
}

/**
 * Deadline bonus for a closed task: +1 on time, 0 within the grace window, -1 beyond it.
 * The deadline is a DATE, so a task closed at any time on the deadline day still counts as on time.
 */
export function getDeadlineBonus(task, completedAt) {
  if (!task?.deadline) {
    return { bonus: RATING_CONFIG.NO_DEADLINE_BONUS, bucket: 'no_deadline', daysLate: 0 };
  }

  // deadline is a calendar DATE ('2026-08-25'). Passing it to new Date() would parse it as UTC
  // midnight while setHours() applies the local zone, shifting the cut-off by the UTC offset and
  // marking same-day completions as late. Build the local end-of-day explicitly instead.
  const [year, month, day] = String(task.deadline).slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) {
    return { bonus: RATING_CONFIG.NO_DEADLINE_BONUS, bucket: 'no_deadline', daysLate: 0 };
  }
  const deadlineEnd = new Date(year, month - 1, day, 23, 59, 59, 999);

  const overdueMs = completedAt.getTime() - deadlineEnd.getTime();
  if (overdueMs <= 0) {
    return { bonus: RATING_CONFIG.IN_TIME_BONUS, bucket: 'in_time', daysLate: 0 };
  }

  const daysLate = Math.ceil(overdueMs / DAY_MS);
  if (daysLate <= RATING_CONFIG.GRACE_DAYS) {
    return { bonus: RATING_CONFIG.GRACE_BONUS, bucket: 'grace', daysLate };
  }
  return { bonus: RATING_CONFIG.LATE_PENALTY, bucket: 'late', daysLate };
}

/** Employees only — admins and managers are excluded from the ranking. */
function isRatedEmployee(profile) {
  return profile
    && profile.username !== 'admin'
    && !profile.is_admin
    && profile.role !== 'admin'
    && profile.role !== 'manager';
}

/**
 * Build the ranking for a single month.
 *
 * @param {Array} profiles - all tb_profiles rows
 * @param {Array} tasks    - all tb_tasks rows
 * @param {number} year    - full year, e.g. 2026
 * @param {number} month   - zero-based month, matching Date semantics (0 = January)
 * @returns {Array} rows sorted by score, each carrying the breakdown behind the number
 */
export function calcMonthlyRating(profiles = [], tasks = [], year, month) {
  const monthStart = new Date(year, month, 1).getTime();
  const monthEnd = new Date(year, month + 1, 1).getTime();

  const rows = profiles.filter(isRatedEmployee).map(profile => {
    const myTasks = tasks.filter(t => getTaskAssignees(t).includes(profile.id));

    const closedInMonth = [];
    const openTasks = [];

    myTasks.forEach(task => {
      const completedAt = task.completed_at ? new Date(task.completed_at) : null;
      const isClosed = task.status === 'done' && completedAt && !isNaN(completedAt);
      const createdAt = task.created_at ? new Date(task.created_at).getTime() : 0;

      if (isClosed) {
        const closedTime = completedAt.getTime();
        if (closedTime >= monthStart && closedTime < monthEnd) {
          closedInMonth.push({ task, completedAt });
          return;
        }
        // Closed after this month ended, but already existed back then — it was hanging open.
        if (closedTime >= monthEnd && createdAt < monthEnd) openTasks.push(task);
        return;
      }

      // Never closed: counts against the month as long as it existed by then.
      if (createdAt < monthEnd) openTasks.push(task);
    });

    let points = 0;
    let difficultySum = 0;
    let timeBonusSum = 0;
    let ratedCount = 0;
    let unratedCount = 0;
    const buckets = { in_time: 0, grace: 0, late: 0, no_deadline: 0 };
    // Per-task detail so the UI can show exactly what each point came from.
    const breakdown = [];

    closedInMonth.forEach(({ task, completedAt }) => {
      const { bonus, bucket, daysLate } = getDeadlineBonus(task, completedAt);
      buckets[bucket]++;

      // No difficulty set yet — the task scores nothing until a manager rates it,
      // deadline bonus included.
      if (!task.difficulty) {
        unratedCount++;
        breakdown.push({ task, completedAt, bucket, daysLate, bonus: 0, difficulty: 0, points: 0, rated: false });
        return;
      }

      const share = RATING_CONFIG.SPLIT_POINTS_BY_ASSIGNEES
        ? Math.max(1, getTaskAssignees(task).length)
        : 1;

      const taskDifficulty = task.difficulty / share;
      const taskBonus = bonus / share;
      const taskPoints = taskDifficulty + taskBonus;

      points += taskPoints;
      difficultySum += taskDifficulty;
      timeBonusSum += taskBonus;
      ratedCount++;

      breakdown.push({
        task,
        completedAt,
        bucket,
        daysLate,
        bonus: roundTo(taskBonus),
        difficulty: roundTo(taskDifficulty),
        points: roundTo(taskPoints),
        rated: true
      });
    });

    // Biggest contributions first, unrated tasks last so they stand out as "needs a score".
    breakdown.sort((a, b) => Number(b.rated) - Number(a.rated) || b.points - a.points);

    const totalTasks = closedInMonth.length + openTasks.length;
    const closedRatio = totalTasks > 0 ? closedInMonth.length / totalTasks : 0;

    return {
      profile,
      score: roundTo(points),
      difficultySum: roundTo(difficultySum),
      timeBonusSum: roundTo(timeBonusSum),
      breakdown,
      openTasks,
      closedCount: closedInMonth.length,
      openCount: openTasks.length,
      totalTasks,
      closedPercent: Math.round(closedRatio * 100),
      ratedCount,
      unratedCount,
      inTimeCount: buckets.in_time,
      graceCount: buckets.grace,
      lateCount: buckets.late,
      noDeadlineCount: buckets.no_deadline
    };
  });

  rows.sort((a, b) => b.score - a.score || b.closedCount - a.closedCount);

  return rows.map((row, index) => ({ ...row, rank: index + 1 }));
}

/** Month labels for the period picker. */
export const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];
