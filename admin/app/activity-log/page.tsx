'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Activity {
  id: string;
  user: string;
  type: string;
  description: string;
  timestamp: string;
  status: 'success' | 'pending' | 'failed';
}

interface AdminUser {
  email: string;
  name: string;
}

const defaultActivities: Activity[] = [
  {
    id: '1',
    user: 'John Doe',
    type: 'Login',
    description: 'User logged in from Web',
    timestamp: new Date(Date.now() - 2 * 60000).toISOString(),
    status: 'success',
  },
  {
    id: '2',
    user: 'Jane Smith',
    type: 'Waste Logged',
    description: 'Reported 5kg of recyclable waste',
    timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
    status: 'success',
  },
  {
    id: '3',
    user: 'Collector - Zone A',
    type: 'Collection',
    description: 'Collected waste from Apt 101-110',
    timestamp: new Date(Date.now() - 45 * 60000).toISOString(),
    status: 'success',
  },
  {
    id: '4',
    user: 'Bob Johnson',
    type: 'Waste Logged',
    description: 'Reported 3kg of organic waste',
    timestamp: new Date(Date.now() - 90 * 60000).toISOString(),
    status: 'success',
  },
  {
    id: '5',
    user: 'Admin User',
    type: 'Account Created',
    description: 'New household account created',
    timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
    status: 'success',
  },
];

export default function ActivityLogPage() {
  const router = useRouter();
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activities, setActivities] = useState<Activity[]>(defaultActivities);
  const [filter, setFilter] = useState<'all' | 'success' | 'failed' | 'pending'>('all');

  useEffect(() => {
    const authToken = localStorage.getItem('authToken');
    const userStr = localStorage.getItem('adminUser');
    const savedActivities = localStorage.getItem('activities');

    if (!authToken || !userStr) {
      router.push('/login');
    } else {
      try {
        const user = JSON.parse(userStr);
        setAdminUser(user);
        if (savedActivities) {
          setActivities(JSON.parse(savedActivities));
        }
      } catch {
        router.push('/login');
      }
    }

    setIsLoading(false);
  }, [router]);

  const filteredActivities =
    filter === 'all' ? activities : activities.filter((a) => a.status === filter);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <main className="flex items-center justify-center min-h-screen bg-gradient-to-br from-green-50 to-green-100">
        <div className="text-center">
          <p className="text-gray-600 text-lg">Loading...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 to-green-100">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Title */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">Activity Log</h2>
          <p className="text-gray-600">Monitor all system activities and user actions</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="flex gap-4 flex-wrap">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                filter === 'all'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
              }`}
            >
              All Activities
            </button>
            <button
              onClick={() => setFilter('success')}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                filter === 'success'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
              }`}
            >
              Success
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                filter === 'pending'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
              }`}
            >
              Pending
            </button>
            <button
              onClick={() => setFilter('failed')}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                filter === 'failed'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
              }`}
            >
              Failed
            </button>
          </div>
        </div>

        {/* Activities List */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-xl font-bold text-gray-800">
              Recent Activities ({filteredActivities.length})
            </h3>
          </div>

          {filteredActivities.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              <p>No activities found for this filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">User</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Activity Type</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Description</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Time</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredActivities.map((activity) => (
                    <tr key={activity.id} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-800 font-medium">{activity.user}</td>
                      <td className="px-6 py-4 text-sm text-gray-800">{activity.type}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{activity.description}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{formatTime(activity.timestamp)}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(activity.status)}`}>
                          {activity.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
