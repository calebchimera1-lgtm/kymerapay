import type { Role } from '@app/shared';
import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Bell,
  LayoutDashboard,
  QrCode,
  ReceiptText,
  ScanLine,
  ScrollText,
  Settings,
  Split,
  Store,
  User,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Items light up as their build phase lands; disabled items are not rendered. */
  enabled: boolean;
}

type AppRole = Exclude<Role, 'SYSTEM'>;

export const HOME_PATH: Record<AppRole, string> = {
  USER: '/app',
  BUSINESS: '/business',
  ADMIN: '/admin',
};

export function homePathFor(role: Role): string {
  return role === 'SYSTEM' ? '/' : HOME_PATH[role];
}

const SIDEBAR: Record<AppRole, NavItem[]> = {
  USER: [
    { label: 'Dashboard', to: '/app', icon: LayoutDashboard, enabled: true },
    { label: 'Wallet', to: '/app/wallet', icon: Wallet, enabled: true },
    { label: 'Send', to: '/app/send', icon: ArrowUpRight, enabled: false },
    { label: 'Request', to: '/app/request', icon: ArrowDownLeft, enabled: false },
    { label: 'Split Bills', to: '/app/split', icon: Split, enabled: false },
    { label: 'Scan & Pay', to: '/app/scan', icon: ScanLine, enabled: false },
    { label: 'Transactions', to: '/app/transactions', icon: ReceiptText, enabled: false },
    { label: 'Contacts', to: '/app/contacts', icon: Users, enabled: false },
    { label: 'Notifications', to: '/app/notifications', icon: Bell, enabled: false },
    { label: 'Profile', to: '/profile', icon: User, enabled: true },
    { label: 'Settings', to: '/settings', icon: Settings, enabled: false },
  ],
  BUSINESS: [
    { label: 'Dashboard', to: '/business', icon: LayoutDashboard, enabled: true },
    { label: 'Payments', to: '/business/payments', icon: Wallet, enabled: false },
    { label: 'Transactions', to: '/business/transactions', icon: ReceiptText, enabled: false },
    { label: 'Customers', to: '/business/customers', icon: Users, enabled: false },
    { label: 'QR Code', to: '/business/qr', icon: QrCode, enabled: false },
    { label: 'Receipts', to: '/business/receipts', icon: ScrollText, enabled: false },
    { label: 'Analytics', to: '/business/analytics', icon: BarChart3, enabled: false },
    { label: 'Business Profile', to: '/profile', icon: Store, enabled: true },
    { label: 'Settings', to: '/settings', icon: Settings, enabled: false },
  ],
  ADMIN: [
    { label: 'Overview', to: '/admin', icon: LayoutDashboard, enabled: true },
    { label: 'Users', to: '/admin/users', icon: Users, enabled: false },
    { label: 'Businesses', to: '/admin/businesses', icon: Store, enabled: false },
    { label: 'Transactions', to: '/admin/transactions', icon: ReceiptText, enabled: false },
    { label: 'Audit Log', to: '/admin/audit', icon: ScrollText, enabled: false },
    { label: 'Profile', to: '/profile', icon: User, enabled: true },
  ],
};

/** Bottom tab bar on phones: Home · Pay · Activity · Profile. */
const MOBILE: Record<AppRole, NavItem[]> = {
  USER: [
    { label: 'Home', to: '/app', icon: LayoutDashboard, enabled: true },
    { label: 'Pay', to: '/app/send', icon: ArrowUpRight, enabled: false },
    // Points at the wallet statement until the full transaction history lands.
    { label: 'Activity', to: '/app/wallet', icon: ReceiptText, enabled: true },
    { label: 'Profile', to: '/profile', icon: User, enabled: true },
  ],
  BUSINESS: [
    { label: 'Home', to: '/business', icon: LayoutDashboard, enabled: true },
    { label: 'QR Code', to: '/business/qr', icon: QrCode, enabled: false },
    { label: 'Activity', to: '/business/transactions', icon: ReceiptText, enabled: false },
    { label: 'Profile', to: '/profile', icon: Store, enabled: true },
  ],
  ADMIN: [
    { label: 'Overview', to: '/admin', icon: LayoutDashboard, enabled: true },
    { label: 'Users', to: '/admin/users', icon: Users, enabled: false },
    { label: 'Profile', to: '/profile', icon: User, enabled: true },
  ],
};

export function sidebarFor(role: Role): NavItem[] {
  return role === 'SYSTEM' ? [] : SIDEBAR[role].filter((item) => item.enabled);
}

export function mobileNavFor(role: Role): NavItem[] {
  return role === 'SYSTEM' ? [] : MOBILE[role].filter((item) => item.enabled);
}
