const variants = {
  'on-time': {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
    label: 'Đúng giờ',
  },
  'late': {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    dot: 'bg-amber-500',
    label: 'Đi muộn',
  },
  'absent': {
    bg: 'bg-red-50',
    text: 'text-red-700',
    dot: 'bg-red-500',
    label: 'Vắng mặt',
  },
  'registered': {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
    label: 'Đã đăng ký',
  },
  'not_registered': {
    bg: 'bg-slate-100',
    text: 'text-slate-500',
    dot: 'bg-slate-400',
    label: 'Chưa đăng ký',
  },
  'online': {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
    label: 'Online',
  },
  'offline': {
    bg: 'bg-red-50',
    text: 'text-red-600',
    dot: 'bg-red-500',
    label: 'Offline',
  },
};

export default function StatusBadge({ status, customLabel }) {
  const v = variants[status] || variants['on-time'];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${v.bg} ${v.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${v.dot}`} />
      {customLabel || v.label}
    </span>
  );
}
