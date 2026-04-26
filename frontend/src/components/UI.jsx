// src/components/UI.jsx — переиспользуемые компоненты
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

// ── Spinner ────────────────────────────────────────────────────
export function Spinner({ size = 'md' }) {
  const s = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-10 h-10' : 'w-6 h-6';
  return (
    <div className={`${s} border-2 border-primary-500 border-t-transparent rounded-full animate-spin`} />
  );
}

// ── Button ─────────────────────────────────────────────────────
export function Button({ children, variant = 'primary', size = 'md', className = '', loading = false, ...props }) {
  const base = 'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  const sizes = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2 text-sm', lg: 'px-6 py-3 text-base' };
  const variants = {
    primary: 'bg-primary-500 text-white hover:bg-primary-600 focus:ring-primary-500',
    secondary: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700 focus:ring-gray-400',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
    ghost: 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 focus:ring-gray-400',
  };

  return (
    <button
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
}

// ── Input ──────────────────────────────────────────────────────
export function Input({ label, error, required, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}{required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <input
        className={`w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-gray-800 dark:text-white
          border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500
          placeholder-gray-400 dark:placeholder-gray-500
          ${error ? 'border-red-500 focus:ring-red-400' : ''} ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ── Select ─────────────────────────────────────────────────────
export function Select({ label, error, required, children, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}{required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <select
        className={`w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-gray-800 dark:text-white
          border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500 ${className}`}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ── Textarea ───────────────────────────────────────────────────
export function Textarea({ label, error, required, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}{required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <textarea
        className={`w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-gray-800 dark:text-white
          border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500
          resize-none ${error ? 'border-red-500' : ''} ${className}`}
        rows={4}
        {...props}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ── Card ───────────────────────────────────────────────────────
export function Card({ children, className = '', onClick }) {
  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm
        ${onClick ? 'cursor-pointer hover:border-primary-500 hover:shadow-md transition-all' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

// ── Modal ──────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children }) {
  const { t } = useTranslation();
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ── BackButton ─────────────────────────────────────────────────
export function BackButton({ to }) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <button
      onClick={() => to ? navigate(to) : navigate(-1)}
      className="flex items-center gap-1 text-sm text-primary-500 hover:text-primary-700 font-medium mb-4 transition-colors"
    >
      {t('nav.back')}
    </button>
  );
}

// ── Avatar ─────────────────────────────────────────────────────
export function Avatar({ name, photoPath, size = 'md' }) {
  const s = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-16 h-16 text-xl' : 'w-10 h-10 text-sm';
  const initials = name
    ? name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  if (photoPath) {
    return (
      <img
        src={`/${photoPath}`}
        alt={name}
        className={`${s} rounded-full object-cover border-2 border-primary-200`}
      />
    );
  }

  return (
    <div className={`${s} rounded-full bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-300 font-semibold flex items-center justify-center flex-shrink-0`}>
      {initials}
    </div>
  );
}

// ── StatCard ───────────────────────────────────────────────────
export function StatCard({ label, value, icon }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-3xl font-semibold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

// ── EmptyState ─────────────────────────────────────────────────
export function EmptyState({ message, icon = '📋' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-4xl mb-3">{icon}</div>
      <p className="text-gray-500 dark:text-gray-400 text-sm">{message}</p>
    </div>
  );
}