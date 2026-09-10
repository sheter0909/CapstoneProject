'use client';

import type { ReactNode } from 'react';

type Tone = 'green' | 'emerald' | 'amber' | 'rose' | 'blue' | 'gray';

const toneStyles: Record<Tone, { ring: string; icon: string; value: string }> = {
  green: {
    ring: 'border-green-100',
    icon: 'bg-green-50 text-green-700',
    value: 'text-gray-900',
  },
  emerald: {
    ring: 'border-emerald-100',
    icon: 'bg-emerald-50 text-emerald-700',
    value: 'text-emerald-700',
  },
  amber: {
    ring: 'border-amber-100',
    icon: 'bg-amber-50 text-amber-700',
    value: 'text-amber-700',
  },
  rose: {
    ring: 'border-rose-100',
    icon: 'bg-rose-50 text-rose-700',
    value: 'text-rose-700',
  },
  blue: {
    ring: 'border-blue-100',
    icon: 'bg-blue-50 text-blue-700',
    value: 'text-blue-700',
  },
  gray: {
    ring: 'border-gray-200',
    icon: 'bg-gray-100 text-gray-600',
    value: 'text-gray-900',
  },
};

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="mb-2 text-3xl font-bold text-gray-800">{title}</h2>
        {subtitle ? <p className="text-base text-gray-600">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = 'green',
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
  icon?: ReactNode;
}) {
  const styles = toneStyles[tone];
  return (
    <div className={`rounded-[24px] border ${styles.ring} bg-white p-5 shadow-sm`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-medium text-gray-500">{label}</p>
          <p className={`mt-3 text-4xl font-semibold ${styles.value}`}>{value}</p>
        </div>
        {icon ? (
          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${styles.icon}`}>{icon}</div>
        ) : null}
      </div>
      {hint ? <p className="mt-4 text-sm text-gray-500">{hint}</p> : null}
    </div>
  );
}

const badgeTones: Record<Tone, string> = {
  green: 'bg-green-100 text-green-800',
  emerald: 'bg-emerald-100 text-emerald-800',
  amber: 'bg-amber-100 text-amber-800',
  rose: 'bg-rose-100 text-rose-700',
  blue: 'bg-blue-100 text-blue-800',
  gray: 'bg-gray-200 text-gray-700',
};

export function StatusBadge({ tone = 'gray', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${badgeTones[tone]}`}>
      {children}
    </span>
  );
}

export function EmptyState({ icon, title, hint }: { icon?: string; title: string; hint?: string }) {
  return (
    <div className="py-10 text-center">
      {icon ? (
        <p className="text-4xl" aria-hidden="true">
          {icon}
        </p>
      ) : null}
      <p className="mt-3 text-base font-semibold text-gray-700">{title}</p>
      {hint ? <p className="mt-1 text-sm text-gray-500">{hint}</p> : null}
    </div>
  );
}

export function LoadingState({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10" role="status" aria-live="polite">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-green-200 border-t-green-600" aria-hidden="true" />
      <p className="text-base text-gray-600">{label}</p>
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-[28px] border border-green-100 bg-white p-6 shadow-sm ${className}`}>{children}</div>
  );
}
