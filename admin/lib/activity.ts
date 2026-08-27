export type ActivityStatus = 'success' | 'pending' | 'failed';

export interface Activity {
  id: string;
  user: string;
  type: string;
  description: string;
  timestamp: string;
  status: ActivityStatus;
}

export const formatActivityTimestamp = (date = new Date()) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);

export const addActivity = (description: string, user = 'Admin User', type = 'Account Update') => {
  if (typeof window === 'undefined') return null;

  const existing = JSON.parse(localStorage.getItem('activities') || '[]') as Activity[];
  const entry: Activity = {
    id: `${Date.now()}`,
    user,
    type,
    description,
    timestamp: new Date().toISOString(),
    status: 'success',
  };

  const updated = [entry, ...existing];
  localStorage.setItem('activities', JSON.stringify(updated));
  return entry;
};
