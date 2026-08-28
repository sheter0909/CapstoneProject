'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface AdminUser {
  email: string;
  name: string;
}

export default function ReportsPage() {
  const router = useRouter();
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const authToken = localStorage.getItem('authToken');
    const userStr = localStorage.getItem('adminUser');

    if (!authToken || !userStr) {
      router.push('/login');
    } else {
      try {
        const user = JSON.parse(userStr);
        setAdminUser(user);
      } catch {
        router.push('/login');
      }
    }

    setIsLoading(false);
  }, [router]);

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
          <h2 className="text-3xl font-bold text-gray-800 mb-2">Reports & Analysis</h2>
          <p className="text-gray-600">View comprehensive waste management analytics and reports</p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="text-3xl font-bold text-green-600 mb-2">156</div>
            <p className="text-gray-600 font-medium">Total Households</p>
            <p className="text-sm text-green-600">+12 this month</p>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="text-3xl font-bold text-green-600 mb-2">28</div>
            <p className="text-gray-600 font-medium">Active Collectors</p>
            <p className="text-sm text-green-600">+3 this month</p>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="text-3xl font-bold text-green-600 mb-2">2.4K</div>
            <p className="text-gray-600 font-medium">Waste Collected (kg)</p>
            <p className="text-sm text-green-600">+18% this month</p>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="text-3xl font-bold text-green-600 mb-2">94%</div>
            <p className="text-gray-600 font-medium">Recycled Rate</p>
            <p className="text-sm text-green-600">+2% this month</p>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Waste Collection Chart */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-6">Weekly Waste Collection</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-gray-600">Monday</span>
                  <span className="text-sm font-semibold text-gray-800">240 kg</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-green-600 h-2 rounded-full" style={{ width: '80%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-gray-600">Tuesday</span>
                  <span className="text-sm font-semibold text-gray-800">310 kg</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-green-600 h-2 rounded-full" style={{ width: '100%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-gray-600">Wednesday</span>
                  <span className="text-sm font-semibold text-gray-800">185 kg</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-green-600 h-2 rounded-full" style={{ width: '60%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-gray-600">Thursday</span>
                  <span className="text-sm font-semibold text-gray-800">275 kg</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-green-600 h-2 rounded-full" style={{ width: '89%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-gray-600">Friday</span>
                  <span className="text-sm font-semibold text-gray-800">225 kg</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-green-600 h-2 rounded-full" style={{ width: '73%' }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Waste Type Distribution */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-6">Waste Type Distribution</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-gray-600 font-medium">Recyclable</span>
                  <span className="text-sm font-semibold text-gray-800">45%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div className="bg-green-600 h-3 rounded-full" style={{ width: '45%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-gray-600 font-medium">Organic</span>
                  <span className="text-sm font-semibold text-gray-800">30%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div className="bg-green-500 h-3 rounded-full" style={{ width: '30%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-gray-600 font-medium">Plastic</span>
                  <span className="text-sm font-semibold text-gray-800">15%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div className="bg-green-400 h-3 rounded-full" style={{ width: '15%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-gray-600 font-medium">Other</span>
                  <span className="text-sm font-semibold text-gray-800">10%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div className="bg-gray-400 h-3 rounded-full" style={{ width: '10%' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Monthly Performance */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-6">Monthly Performance</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Month</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Total Collected (kg)</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Households Active</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Recycled Rate</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Trend</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-800">July 2024</td>
                  <td className="px-6 py-4 text-sm text-gray-800">2,240</td>
                  <td className="px-6 py-4 text-sm text-gray-800">144</td>
                  <td className="px-6 py-4 text-sm text-gray-800">92%</td>
                  <td className="px-6 py-4 text-sm">
                    <span className="text-green-600 font-semibold">↑ 8%</span>
                  </td>
                </tr>
                <tr className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-800">June 2024</td>
                  <td className="px-6 py-4 text-sm text-gray-800">2,075</td>
                  <td className="px-6 py-4 text-sm text-gray-800">138</td>
                  <td className="px-6 py-4 text-sm text-gray-800">88%</td>
                  <td className="px-6 py-4 text-sm">
                    <span className="text-green-600 font-semibold">↑ 5%</span>
                  </td>
                </tr>
                <tr className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-800">May 2024</td>
                  <td className="px-6 py-4 text-sm text-gray-800">1,976</td>
                  <td className="px-6 py-4 text-sm text-gray-800">132</td>
                  <td className="px-6 py-4 text-sm text-gray-800">85%</td>
                  <td className="px-6 py-4 text-sm">
                    <span className="text-green-600 font-semibold">↑ 12%</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
