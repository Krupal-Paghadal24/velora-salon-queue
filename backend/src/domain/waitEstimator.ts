export interface BarberWorkState {
  barberId: string;
  isOnDuty: boolean;
  status: 'AVAILABLE' | 'BUSY' | 'ON_BREAK';
  activeServiceDurationMinutes?: number;
  activeServiceStartedAt?: Date | null;
}

export interface WaitingCustomer {
  id: string;
  preferredBarberId?: string | null; // null means "Any"
  totalDurationMinutes: number;
  joinedAt: Date;
}

/**
 * Calculates estimated wait time in whole minutes according to docs/03-flows-rules.md.
 * Returns null if wait time is unavailable (e.g., no eligible barbers on duty).
 */
export function calculateEstimatedWaitTime(params: {
  targetItem: {
    preferredBarberId?: string | null;
    joinedAt: Date;
  };
  barbers: BarberWorkState[];
  waitingQueue: WaitingCustomer[];
  now?: Date;
}): number | null {
  const { targetItem, barbers, waitingQueue, now = new Date() } = params;

  // 1. Specific Barber Preference
  if (targetItem.preferredBarberId) {
    const targetBarber = barbers.find((b) => b.barberId === targetItem.preferredBarberId);

    // If barber is not on duty, estimate cannot be computed
    if (!targetBarber || !targetBarber.isOnDuty || targetBarber.status === 'ON_BREAK') {
      return null;
    }

    // Remaining time for current customer being served by this barber
    let currentRemaining = 0;
    if (targetBarber.activeServiceDurationMinutes && targetBarber.activeServiceStartedAt) {
      const elapsedMinutes = Math.max(
        0,
        Math.floor((now.getTime() - targetBarber.activeServiceStartedAt.getTime()) / 60000)
      );
      currentRemaining = Math.max(0, targetBarber.activeServiceDurationMinutes - elapsedMinutes);
    }

    // Waiting customers ahead who are compatible with this barber
    // (either chose this barber explicitly or chose "Any")
    const customersAhead = waitingQueue.filter((item) => {
      const isAhead = item.joinedAt.getTime() < targetItem.joinedAt.getTime();
      const isCompatible =
        item.preferredBarberId === targetItem.preferredBarberId || !item.preferredBarberId;
      return isAhead && isCompatible;
    });

    const waitingWorkload = customersAhead.reduce(
      (sum, item) => sum + item.totalDurationMinutes,
      0
    );

    return Math.max(0, Math.ceil(currentRemaining + waitingWorkload));
  }

  // 2. "Any Available Barber" Preference
  // Eligible barbers are on-duty barbers
  const eligibleBarbers = barbers.filter(
    (b) => b.isOnDuty && (b.status === 'AVAILABLE' || b.status === 'BUSY')
  );
  if (eligibleBarbers.length === 0) {
    return null;
  }

  // Calculate current active remaining minutes across all eligible barbers
  let totalActiveRemaining = 0;
  for (const barber of eligibleBarbers) {
    if (barber.activeServiceDurationMinutes && barber.activeServiceStartedAt) {
      const elapsedMinutes = Math.max(
        0,
        Math.floor((now.getTime() - barber.activeServiceStartedAt.getTime()) / 60000)
      );
      totalActiveRemaining += Math.max(0, barber.activeServiceDurationMinutes - elapsedMinutes);
    }
  }

  // Waiting customers ahead of this target item
  const customersAhead = waitingQueue.filter(
    (item) => item.joinedAt.getTime() < targetItem.joinedAt.getTime()
  );

  const totalWaitingDuration = customersAhead.reduce(
    (sum, item) => sum + item.totalDurationMinutes,
    0
  );

  const totalWorkload = totalActiveRemaining + totalWaitingDuration;
  const estimatedWait = Math.ceil(totalWorkload / eligibleBarbers.length);

  return Math.max(0, estimatedWait);
}
