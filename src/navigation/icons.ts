/**
 * The app's icons in one place. hedgile.com's own icon set could not be read
 * from this environment, so these are Lucide icons; swap them here to match.
 */
import {
  Atom,
  BadgeCheck,
  Coins,
  Database,
  FlaskConical,
  LineChart,
  Settings,
  ShieldHalf,
  ShoppingCart,
  Truck,
  Workflow,
  type LucideIcon,
} from 'lucide-react';

export const icons = {
  marketData: LineChart,
  metals: Atom,
  currencies: Coins,
  process: Workflow,
  purchasing: ShoppingCart,
  sales: Truck,
  quality: FlaskConical,
  hedging: ShieldHalf,
  masterData: Database,
  settings: Settings,
  known: BadgeCheck,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof icons;
