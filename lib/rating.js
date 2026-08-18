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
//   task points = difficulty + deadline bonus + quality
// A task rated 6, handed in on time and scored 5 for quality is worth 6 + 1 + 5 = 12.
export const RATING_CONFIG = {
  IN_TIME_BONUS: 1,      // handed in on or before the deadline
  NO_DEADLINE_BONUS: 0,  // task had no deadline — nothing to be late for

  // Lateness costs 1 point per FULL 10-day period: 1-9 days is free, 10 days = -1,
  // 20 = -2, 30 = -3. Partial periods never count.
  LATE_PENALTY_PER_PERIOD: -1,
  LATE_PERIOD_DAYS: 10,

  MAX_QUALITY: 5         // quality is 1-5; an unrated task simply adds nothing for quality
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
 * Fraction of a task's points that goes to one assignee (0..1).
 *
 * Managers can split team work explicitly via assignee_shares ({ userId: percent }); the
 * percentages are normalised, so 60/40 and 6/4 behave the same and a partial split still adds up.
 * Without a split the task is divided evenly between everyone on it.
 */
export function getAssigneeShare(task, userId) {
  const assignees = getTaskAssignees(task);
  if (assignees.length === 0) return 0;

  const shares = task?.assignee_shares;
  if (shares && typeof shares === 'object') {
    // Only percentages of people actually on the task count towards the total.
    const total = assignees.reduce((sum, id) => sum + (Number(shares[id]) || 0), 0);
    if (total > 0) return (Number(shares[userId]) || 0) / total;
  }

  return assignees.includes(userId) ? 1 / assignees.length : 0;
}

/**
 * The moment work was handed in. The deadline is judged by this, not by acceptance, so a slow
 * review never costs the assignee their on-time bonus. Older tasks only have completed_at.
 */
export function getEffectiveDate(task) {
  const raw = task?.submitted_at || task?.completed_at;
  if (!raw) return null;
  const date = new Date(raw);
  return isNaN(date) ? null : date;
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
  // Only whole 10-day periods are charged: 9 days costs nothing, 25 days costs 2 points.
  const periods = Math.floor(daysLate / RATING_CONFIG.LATE_PERIOD_DAYS);
  const bonus = periods * RATING_CONFIG.LATE_PENALTY_PER_PERIOD;

  return {
    bonus,
    bucket: periods > 0 ? 'late' : 'grace',
    daysLate,
    latePeriods: periods
  };
}

/**
 * Everyone who does the work is ranked, managers included — they carry tasks of their own.
 * Only the admin account is left out, matching the team stats on the analytics page.
 */
function isRatedEmployee(profile) {
  return profile
    && profile.username !== 'admin'
    && !profile.is_admin
    && profile.role !== 'admin';
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
      // Only accepted work scores. A task sitting in review counts as still open until a
      // manager accepts it — then its points land in the month it was handed in.
      const handedInAt = getEffectiveDate(task);
      const isAccepted = task.status === 'done' && handedInAt;
      const createdAt = task.created_at ? new Date(task.created_at).getTime() : 0;

      if (isAccepted) {
        const handedInTime = handedInAt.getTime();
        if (handedInTime >= monthStart && handedInTime < monthEnd) {
          closedInMonth.push({ task, completedAt: handedInAt });
          return;
        }
        // Handed in after this month ended, but already existed back then — it was hanging open.
        if (handedInTime >= monthEnd && createdAt < monthEnd) openTasks.push(task);
        return;
      }

      // Never accepted: counts against the month as long as it existed by then.
      if (createdAt < monthEnd) openTasks.push(task);
    });

    let points = 0;
    let difficultySum = 0;
    let timeBonusSum = 0;
    let qualitySum = 0;
    let ratedCount = 0;
    let unratedCount = 0;
    const buckets = { in_time: 0, grace: 0, late: 0, no_deadline: 0 };
    // Per-task detail so the UI can show exactly what each point came from.
    const breakdown = [];

    closedInMonth.forEach(({ task, completedAt }) => {
      const { bonus, bucket, daysLate } = getDeadlineBonus(task, completedAt);
      buckets[bucket]++;

      const share = getAssigneeShare(task, profile.id);
      const sharePercent = Math.round(share * 100);

      // No difficulty set yet — the task scores nothing until a manager rates it,
      // deadline bonus and quality included.
      if (!task.difficulty) {
        unratedCount++;
        breakdown.push({
          task, completedAt, bucket, daysLate, sharePercent,
          bonus: 0, difficulty: 0, quality: 0, points: 0, rated: false
        });
        return;
      }

      const taskDifficulty = task.difficulty * share;
      const taskBonus = bonus * share;
      const taskQuality = (task.quality || 0) * share;
      const taskPoints = taskDifficulty + taskBonus + taskQuality;

      points += taskPoints;
      difficultySum += taskDifficulty;
      timeBonusSum += taskBonus;
      qualitySum += taskQuality;
      ratedCount++;

      breakdown.push({
        task,
        completedAt,
        bucket,
        daysLate,
        sharePercent,
        bonus: roundTo(taskBonus),
        difficulty: roundTo(taskDifficulty),
        quality: roundTo(taskQuality),
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
      qualitySum: roundTo(qualitySum),
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
