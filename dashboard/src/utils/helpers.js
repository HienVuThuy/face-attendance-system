// ============================================================
// helpers.js — Các hàm tiện ích dùng chung cho Dashboard
// ============================================================

export const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

export function formatTime(ts) {
  if (!ts) return '--:--';
  return new Date(ts).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(ts) {
  if (!ts) return '--/--/----';
  return new Date(ts).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatDateTime(ts) {
  if (!ts) return '--';
  return new Date(ts).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getInitials(name) {
  if (!name) return 'SV';
  return name
    .trim()
    .split(/\s+/)
    .map(w => w[0])
    .slice(-2)
    .join('')
    .toUpperCase();
}
