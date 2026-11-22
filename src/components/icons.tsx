/** Εικονίδια γραμμής (24×24, stroke = χρώμα κειμένου). Δικά μας, ενσωματωμένα — καμία εξωτερική βιβλιοθήκη/γραμματοσειρά. */
import type { ReactNode, SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
const I = ({ children, ...p }: P & { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
    width="1em" height="1em" aria-hidden="true" {...p}>{children}</svg>
);

export const IconLibrary = (p: P) => <I {...p}><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H8v16H5.5A1.5 1.5 0 0 1 4 18.5z" /><path d="M8 4h4v16H8z" /><path d="m13.5 6.2 3.4-.9 3.6 13.5-3.4.9z" /></I>;
export const IconScan = (p: P) => <I {...p}><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" /><path d="M4 12h16" /></I>;
export const IconSettings = (p: P) => <I {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 13.5a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V20a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.9-2.9l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.9-2.9l.1.1a1.7 1.7 0 0 0 2.9-1.2V4a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.9 2.9l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></I>;
export const IconSearch = (p: P) => <I {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></I>;
export const IconClose = (p: P) => <I {...p}><path d="M6 6l12 12M18 6 6 18" /></I>;
export const IconBack = (p: P) => <I {...p}><path d="m14 6-6 6 6 6" /></I>;
export const IconChevron = (p: P) => <I {...p}><path d="m9 6 6 6-6 6" /></I>;
export const IconPlus = (p: P) => <I {...p}><path d="M12 5v14M5 12h14" /></I>;
export const IconCamera = (p: P) => <I {...p}><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.2-2h6.6l1.2 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" /><circle cx="12" cy="13" r="3.5" /></I>;
export const IconImage = (p: P) => <I {...p}><rect x="4" y="5" width="16" height="14" rx="2" /><circle cx="9" cy="10" r="1.5" /><path d="m5 17 4.5-4.5 3 3 2.5-2.5L19 17" /></I>;
export const IconFile = (p: P) => <I {...p}><path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></I>;
export const IconLink = (p: P) => <I {...p}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></I>;
export const IconVideo = (p: P) => <I {...p}><rect x="3" y="6" width="18" height="12" rx="3" /><path d="m10.5 9.5 4 2.5-4 2.5z" fill="currentColor" /></I>;
export const IconQr = (p: P) => <I {...p}><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><path d="M14 14h2v2h-2zM18 14h2M14 18v2M18 18h2v2h-2z" /></I>;
export const IconShield = (p: P) => <I {...p}><path d="M12 3 5 6v5.5c0 4.3 2.9 7.8 7 9.5 4.1-1.7 7-5.2 7-9.5V6z" /><path d="m9 12 2.2 2.2L15.2 10" /></I>;
export const IconReceipt = (p: P) => <I {...p}><path d="M6 3h12v18l-2.5-1.6L13 21l-2.5-1.6L8 21l-2-1.5z" /><path d="M9 8h6M9 12h6" /></I>;
export const IconRecycle = (p: P) => <I {...p}><path d="m7.5 9.5 2-3.5a2.9 2.9 0 0 1 5 0l1.2 2.1" /><path d="m13.5 7.6 2.4.7.7-2.4" /><path d="M17.8 12.2 19.6 15a2.9 2.9 0 0 1-2.5 4.4H14" /><path d="m15.7 17.3-1.8 2.1 1.8 2.1" /><path d="M10 19.4H6.9A2.9 2.9 0 0 1 4.4 15l1.4-2.3" /><path d="m3.6 14.1 2.3-1.3 1.3 2.3" /></I>;
export const IconCheck = (p: P) => <I {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></I>;
export const IconTrash = (p: P) => <I {...p}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></I>;
export const IconFilter = (p: P) => <I {...p}><path d="M4 6h16M7 12h10M10 18h4" /></I>;
export const IconExternal = (p: P) => <I {...p}><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" /></I>;
export const IconNote = (p: P) => <I {...p}><path d="M5 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v9l-5 5H7a2 2 0 0 1-2-2z" /><path d="M14 19v-3a2 2 0 0 1 2-2h3M9 8h6M9 12h3" /></I>;
export const IconDownload = (p: P) => <I {...p}><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14" /></I>;
export const IconUpload = (p: P) => <I {...p}><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 19h14" /></I>;
export const IconWarn = (p: P) => <I {...p}><path d="M12 4 3 19h18z" /><path d="M12 10v4M12 16.5v.5" /></I>;
export const IconSpark = (p: P) => <I {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" /></I>;
export const IconApp = (p: P) => <I {...p}><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M9 15l3-6 3 6M10 13h4" /></I>;
export const IconBox = (p: P) => <I {...p}><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z" /><path d="m4 7.5 8 4.5 8-4.5M12 12v9" /></I>;
export const IconTag = (p: P) => <I {...p}><path d="M4 12V5a1 1 0 0 1 1-1h7l8 8-8 8z" /><circle cx="8.5" cy="8.5" r="1.2" /></I>;
export const IconBell = (p: P) => <I {...p}><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></I>;
