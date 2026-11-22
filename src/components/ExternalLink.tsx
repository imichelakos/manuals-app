/**
 * Σύνδεσμος προς εξωτερική σελίδα (αναζήτηση, QR του εντύπου). Πάντα πραγματικό <a> σε νέα καρτέλα, χωρίς παραπομπή·
 * στην εφαρμογή iOS ανοίγει σε φύλλο Safari μέσα στην εφαρμογή.
 */
import type { ReactNode } from 'react';
import { isNative, openInApp } from '@/services/platform';

export function ExternalLink({ href, className, children, label }: { href: string; className?: string; children: ReactNode; label?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className} aria-label={label}
      onClick={isNative ? (e) => { e.preventDefault(); void openInApp(href); } : undefined}>
      {children}
    </a>
  );
}
