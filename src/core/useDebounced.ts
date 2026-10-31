import { useEffect, useState } from 'react';

/** Giá trị trễ `ms` sau lần đổi cuối (dùng cho ô tìm kiếm). */
export function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}
