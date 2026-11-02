// Nhập từng biểu tượng riêng lẻ để app không kéo theo cả bộ ~1.600 icon.
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import ArrowRight from 'lucide-react-native/icons/arrow-right';
import Banknote from 'lucide-react-native/icons/banknote';
import BookOpen from 'lucide-react-native/icons/book-open';
import Boxes from 'lucide-react-native/icons/boxes';
import Building from 'lucide-react-native/icons/building';
import Camera from 'lucide-react-native/icons/camera';
import ChartColumn from 'lucide-react-native/icons/chart-column';
import ChartPie from 'lucide-react-native/icons/chart-pie';
import Check from 'lucide-react-native/icons/check';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import CircleCheck from 'lucide-react-native/icons/circle-check';
import CirclePlus from 'lucide-react-native/icons/circle-plus';
import CircleX from 'lucide-react-native/icons/circle-x';
import ClipboardList from 'lucide-react-native/icons/clipboard-list';
import Clock from 'lucide-react-native/icons/clock';
import Coins from 'lucide-react-native/icons/coins';
import CreditCard from 'lucide-react-native/icons/credit-card';
import Eye from 'lucide-react-native/icons/eye';
import EyeOff from 'lucide-react-native/icons/eye-off';
import Flashlight from 'lucide-react-native/icons/flashlight';
import Gift from 'lucide-react-native/icons/gift';
import Hammer from 'lucide-react-native/icons/hammer';
import HandCoins from 'lucide-react-native/icons/hand-coins';
import Inbox from 'lucide-react-native/icons/inbox';
import Info from 'lucide-react-native/icons/info';
import KeyRound from 'lucide-react-native/icons/key-round';
import Landmark from 'lucide-react-native/icons/landmark';
import LayoutDashboard from 'lucide-react-native/icons/layout-dashboard';
import LayoutGrid from 'lucide-react-native/icons/layout-grid';
import Lock from 'lucide-react-native/icons/lock';
import LogOut from 'lucide-react-native/icons/log-out';
import Mail from 'lucide-react-native/icons/mail';
import MapPin from 'lucide-react-native/icons/map-pin';
import Minus from 'lucide-react-native/icons/minus';
import Package from 'lucide-react-native/icons/package';
import PackageSearch from 'lucide-react-native/icons/package-search';
import Pencil from 'lucide-react-native/icons/pencil';
import Percent from 'lucide-react-native/icons/percent';
import Phone from 'lucide-react-native/icons/phone';
import Plus from 'lucide-react-native/icons/plus';
import Printer from 'lucide-react-native/icons/printer';
import Receipt from 'lucide-react-native/icons/receipt';
import ReceiptText from 'lucide-react-native/icons/receipt-text';
import ScanBarcode from 'lucide-react-native/icons/scan-barcode';
import Search from 'lucide-react-native/icons/search';
import Share2 from 'lucide-react-native/icons/share-2';
import ShieldCheck from 'lucide-react-native/icons/shield-check';
import ShoppingBag from 'lucide-react-native/icons/shopping-bag';
import ShoppingCart from 'lucide-react-native/icons/shopping-cart';
import Smartphone from 'lucide-react-native/icons/smartphone';
import StickyNote from 'lucide-react-native/icons/sticky-note';
import Store from 'lucide-react-native/icons/store';
import Tag from 'lucide-react-native/icons/tag';
import Trash from 'lucide-react-native/icons/trash';
import TrendingDown from 'lucide-react-native/icons/trending-down';
import TrendingUp from 'lucide-react-native/icons/trending-up';
import TriangleAlert from 'lucide-react-native/icons/triangle-alert';
import Truck from 'lucide-react-native/icons/truck';
import User from 'lucide-react-native/icons/user';
import UserPlus from 'lucide-react-native/icons/user-plus';
import Users from 'lucide-react-native/icons/users';
import Wallet from 'lucide-react-native/icons/wallet';
import WifiOff from 'lucide-react-native/icons/wifi-off';
import X from 'lucide-react-native/icons/x';
import type { ColorValue } from 'react-native';
import { C } from './theme';

const ICONS = {
  'arrow-left': ArrowLeft,
  'arrow-right': ArrowRight,
  banknote: Banknote,
  'book-open': BookOpen,
  boxes: Boxes,
  building: Building,
  camera: Camera,
  'chart-column': ChartColumn,
  'chart-pie': ChartPie,
  check: Check,
  'chevron-down': ChevronDown,
  'chevron-right': ChevronRight,
  'circle-check': CircleCheck,
  'circle-plus': CirclePlus,
  'circle-x': CircleX,
  'clipboard-list': ClipboardList,
  clock: Clock,
  coins: Coins,
  'credit-card': CreditCard,
  eye: Eye,
  'eye-off': EyeOff,
  flashlight: Flashlight,
  gift: Gift,
  hammer: Hammer,
  'hand-coins': HandCoins,
  inbox: Inbox,
  info: Info,
  'key-round': KeyRound,
  landmark: Landmark,
  'layout-dashboard': LayoutDashboard,
  'layout-grid': LayoutGrid,
  lock: Lock,
  'log-out': LogOut,
  mail: Mail,
  'map-pin': MapPin,
  minus: Minus,
  package: Package,
  'package-search': PackageSearch,
  pencil: Pencil,
  percent: Percent,
  phone: Phone,
  plus: Plus,
  printer: Printer,
  receipt: Receipt,
  'receipt-text': ReceiptText,
  'scan-barcode': ScanBarcode,
  search: Search,
  'share-2': Share2,
  'shield-check': ShieldCheck,
  'shopping-bag': ShoppingBag,
  'shopping-cart': ShoppingCart,
  smartphone: Smartphone,
  'sticky-note': StickyNote,
  store: Store,
  tag: Tag,
  trash: Trash,
  'trending-down': TrendingDown,
  'trending-up': TrendingUp,
  'triangle-alert': TriangleAlert,
  truck: Truck,
  user: User,
  'user-plus': UserPlus,
  users: Users,
  wallet: Wallet,
  'wifi-off': WifiOff,
  x: X,
} as const;

export type IconName = keyof typeof ICONS;

/** Biểu tượng nét mảnh (lucide), cùng bộ với bản web. */
export function Icon({
  name,
  size = 22,
  color = C.text,
  strokeWidth = 1.9,
}: {
  name: IconName;
  size?: number;
  color?: ColorValue;
  strokeWidth?: number;
}) {
  const Cmp = ICONS[name];
  return <Cmp size={size} color={color as string} strokeWidth={strokeWidth} />;
}
