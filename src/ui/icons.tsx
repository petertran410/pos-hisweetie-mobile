// Nhập từng biểu tượng riêng lẻ để app không kéo theo cả bộ ~1.600 icon.
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import ArrowRight from 'lucide-react-native/icons/arrow-right';
import ArrowUpDown from 'lucide-react-native/icons/arrow-up-down';
import Banknote from 'lucide-react-native/icons/banknote';
import BookOpen from 'lucide-react-native/icons/book-open';
import Boxes from 'lucide-react-native/icons/boxes';
import Building from 'lucide-react-native/icons/building';
import CalendarRange from 'lucide-react-native/icons/calendar-range';
import Camera from 'lucide-react-native/icons/camera';
import CarFront from 'lucide-react-native/icons/car-front';
import ChartColumn from 'lucide-react-native/icons/chart-column';
import ChartPie from 'lucide-react-native/icons/chart-pie';
import Check from 'lucide-react-native/icons/check';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import CircleCheck from 'lucide-react-native/icons/circle-check';
import CirclePlus from 'lucide-react-native/icons/circle-plus';
import CircleX from 'lucide-react-native/icons/circle-x';
import ClipboardList from 'lucide-react-native/icons/clipboard-list';
import Clock from 'lucide-react-native/icons/clock';
import Container from 'lucide-react-native/icons/container';
import QrCode from 'lucide-react-native/icons/qr-code';
import Paperclip from 'lucide-react-native/icons/paperclip';
import Send from 'lucide-react-native/icons/send';
import Images from 'lucide-react-native/icons/images';
import Coins from 'lucide-react-native/icons/coins';
import Copy from 'lucide-react-native/icons/copy';
import CreditCard from 'lucide-react-native/icons/credit-card';
import Download from 'lucide-react-native/icons/download';
import Ellipsis from 'lucide-react-native/icons/ellipsis';
import Eye from 'lucide-react-native/icons/eye';
import EyeOff from 'lucide-react-native/icons/eye-off';
import Factory from 'lucide-react-native/icons/factory';
import Fuel from 'lucide-react-native/icons/fuel';
import FileText from 'lucide-react-native/icons/file-text';
import Flashlight from 'lucide-react-native/icons/flashlight';
import Gift from 'lucide-react-native/icons/gift';
import Hammer from 'lucide-react-native/icons/hammer';
import HandCoins from 'lucide-react-native/icons/hand-coins';
import ImagePlus from 'lucide-react-native/icons/image-plus';
import Inbox from 'lucide-react-native/icons/inbox';
import Info from 'lucide-react-native/icons/info';
import KeyRound from 'lucide-react-native/icons/key-round';
import Landmark from 'lucide-react-native/icons/landmark';
import Layers from 'lucide-react-native/icons/layers';
import LayoutDashboard from 'lucide-react-native/icons/layout-dashboard';
import LayoutGrid from 'lucide-react-native/icons/layout-grid';
import Lock from 'lucide-react-native/icons/lock';
import LogOut from 'lucide-react-native/icons/log-out';
import Mail from 'lucide-react-native/icons/mail';
import MapPin from 'lucide-react-native/icons/map-pin';
import Minus from 'lucide-react-native/icons/minus';
import Package from 'lucide-react-native/icons/package';
import PackageSearch from 'lucide-react-native/icons/package-search';
import PackageX from 'lucide-react-native/icons/package-x';
import Pencil from 'lucide-react-native/icons/pencil';
import Percent from 'lucide-react-native/icons/percent';
import Phone from 'lucide-react-native/icons/phone';
import Plus from 'lucide-react-native/icons/plus';
import Power from 'lucide-react-native/icons/power';
import Printer from 'lucide-react-native/icons/printer';
import Receipt from 'lucide-react-native/icons/receipt';
import ReceiptText from 'lucide-react-native/icons/receipt-text';
import RefreshCw from 'lucide-react-native/icons/refresh-cw';
import ScanBarcode from 'lucide-react-native/icons/scan-barcode';
import Search from 'lucide-react-native/icons/search';
import Share2 from 'lucide-react-native/icons/share-2';
import ShieldCheck from 'lucide-react-native/icons/shield-check';
import ShoppingBag from 'lucide-react-native/icons/shopping-bag';
import ShoppingCart from 'lucide-react-native/icons/shopping-cart';
import SlidersHorizontal from 'lucide-react-native/icons/sliders-horizontal';
import Smartphone from 'lucide-react-native/icons/smartphone';
import Snowflake from 'lucide-react-native/icons/snowflake';
import Star from 'lucide-react-native/icons/star';
import StickyNote from 'lucide-react-native/icons/sticky-note';
import Store from 'lucide-react-native/icons/store';
import Tag from 'lucide-react-native/icons/tag';
import Trash from 'lucide-react-native/icons/trash';
import TrendingDown from 'lucide-react-native/icons/trending-down';
import TrendingUp from 'lucide-react-native/icons/trending-up';
import TriangleAlert from 'lucide-react-native/icons/triangle-alert';
import Truck from 'lucide-react-native/icons/truck';
import Undo2 from 'lucide-react-native/icons/undo-2';
import User from 'lucide-react-native/icons/user';
import UserPlus from 'lucide-react-native/icons/user-plus';
import Users from 'lucide-react-native/icons/users';
import Wallet from 'lucide-react-native/icons/wallet';
import Warehouse from 'lucide-react-native/icons/warehouse';
import WifiOff from 'lucide-react-native/icons/wifi-off';
import X from 'lucide-react-native/icons/x';
import type { ColorValue } from 'react-native';
import { C } from './theme';

const ICONS = {
  'arrow-left': ArrowLeft,
  'arrow-right': ArrowRight,
  'arrow-up-down': ArrowUpDown,
  banknote: Banknote,
  'book-open': BookOpen,
  boxes: Boxes,
  building: Building,
  'calendar-range': CalendarRange,
  camera: Camera,
  'car-front': CarFront,
  'chart-column': ChartColumn,
  'chart-pie': ChartPie,
  check: Check,
  'container': Container,
  'qr-code': QrCode,
  'paperclip': Paperclip,
  'send': Send,
  'images': Images,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'circle-check': CircleCheck,
  'circle-plus': CirclePlus,
  'circle-x': CircleX,
  'clipboard-list': ClipboardList,
  clock: Clock,
  coins: Coins,
  copy: Copy,
  'credit-card': CreditCard,
  download: Download,
  ellipsis: Ellipsis,
  eye: Eye,
  'eye-off': EyeOff,
  factory: Factory,
  fuel: Fuel,
  'file-text': FileText,
  flashlight: Flashlight,
  gift: Gift,
  hammer: Hammer,
  'hand-coins': HandCoins,
  'image-plus': ImagePlus,
  inbox: Inbox,
  info: Info,
  'key-round': KeyRound,
  landmark: Landmark,
  layers: Layers,
  'layout-dashboard': LayoutDashboard,
  'layout-grid': LayoutGrid,
  lock: Lock,
  'log-out': LogOut,
  mail: Mail,
  'map-pin': MapPin,
  minus: Minus,
  package: Package,
  'package-search': PackageSearch,
  'package-x': PackageX,
  pencil: Pencil,
  percent: Percent,
  phone: Phone,
  plus: Plus,
  power: Power,
  printer: Printer,
  receipt: Receipt,
  'receipt-text': ReceiptText,
  'refresh-cw': RefreshCw,
  'scan-barcode': ScanBarcode,
  search: Search,
  'share-2': Share2,
  'shield-check': ShieldCheck,
  'shopping-bag': ShoppingBag,
  'shopping-cart': ShoppingCart,
  'sliders-horizontal': SlidersHorizontal,
  smartphone: Smartphone,
  snowflake: Snowflake,
  star: Star,
  'sticky-note': StickyNote,
  store: Store,
  tag: Tag,
  trash: Trash,
  'trending-down': TrendingDown,
  'trending-up': TrendingUp,
  'triangle-alert': TriangleAlert,
  truck: Truck,
  'undo-2': Undo2,
  user: User,
  'user-plus': UserPlus,
  users: Users,
  wallet: Wallet,
  warehouse: Warehouse,
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
  fill,
}: {
  name: IconName;
  size?: number;
  color?: ColorValue;
  strokeWidth?: number;
  /** Tô nền bên trong nét (vd ⚠ vàng nhạt như web `fill-yellow-100`). */
  fill?: ColorValue;
}) {
  const Cmp = ICONS[name];
  return <Cmp size={size} color={color as string} strokeWidth={strokeWidth} fill={(fill as string | undefined) ?? 'none'} />;
}
