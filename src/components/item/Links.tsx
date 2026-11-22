/** Σύνδεσμοι του προϊόντος (από QR του εντύπου ή με επικόλληση): βίντεο, PDF, εφαρμογές, σελίδες υποστήριξης. */
import { useState } from 'react';
import { newId, type Item, type LinkKind, type LinkRef } from '@/domain/model';
import { linkKind, parseHttpUrl } from '@/domain/codes';
import { updateItem } from '@/data/library';
import { ExternalLink } from '@/components/ExternalLink';
import { t } from '@/i18n';
import { AutoField, ConfirmDelete } from '@/components/controls';
import { toast } from '@/components/Toast';
import { IconApp, IconExternal, IconFile, IconLink, IconPlus, IconVideo, IconWarn } from '@/components/icons';

export const linkLabel = (kind: LinkKind): string =>
  kind === 'video' ? t('Βίντεο') : kind === 'pdf' ? t('Έγγραφο PDF') : kind === 'app' ? t('Εφαρμογή') : t('Ιστοσελίδα');

export function LinkIcon({ kind }: { kind: LinkKind }) {
  return kind === 'video' ? <IconVideo /> : kind === 'pdf' ? <IconFile /> : kind === 'app' ? <IconApp /> : <IconLink />;
}

const hostOf = (url: string) => parseHttpUrl(url)?.hostname ?? url;

export function LinksSection({ item }: { item: Item }) {
  const [adding, setAdding] = useState(false);
  const [url, setUrl] = useState('');

  const add = async () => {
    const u = parseHttpUrl(url);
    if (!u) { toast(t('Αυτή δεν μοιάζει με διεύθυνση ιστοσελίδας.'), 'error'); return; }
    if (item.links.some((l) => l.url === u.href)) { toast(t('Ο σύνδεσμος υπάρχει ήδη.'), 'error'); return; }
    const kind = linkKind(u);
    const link: LinkRef = { id: newId(), url: u.href, title: linkLabel(kind), kind, origin: 'manual', addedAt: Date.now() };
    await updateItem(item.id, (c) => ({ ...c, links: [...c.links, link] }));
    setUrl('');
    setAdding(false);
  };

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="section-title">{t('Σύνδεσμοι και QR')}</h2>
        {!adding && <button type="button" className="btn btn-ghost -my-2 -mr-3 min-h-9 px-3 text-sm" onClick={() => setAdding(true)}><IconPlus className="text-base" />{t('Προσθήκη')}</button>}
      </div>
      {item.links.length === 0 && !adding && <p className="mt-2 text-[15px] text-ink-2">{t('Βίντεο και σελίδες από τα QR του εντύπου αποθηκεύονται εδώ.')}</p>}
      <ul className="mt-3 space-y-2.5">
        {item.links.map((l) => (
          <li key={l.id} className="flex items-center gap-3 rounded-2xl bg-surface-2 p-2 pl-3.5">
            <span className="text-2xl text-accent"><LinkIcon kind={l.kind} /></span>
            <div className="min-w-0 flex-1">
              <AutoField value={l.title} aria-label={t('Τίτλος συνδέσμου')} className="w-full bg-transparent text-[15px] font-semibold outline-hidden"
                onCommit={(title) => void updateItem(item.id, (c) => ({ ...c, links: c.links.map((x) => (x.id === l.id ? { ...x, title: title.trim() || linkLabel(l.kind) } : x)) }))} />
              <p className="mono flex items-center gap-1.5 truncate text-[13px] text-ink-2">
                {l.url.startsWith('http://') && <IconWarn className="shrink-0 text-sm text-warn" aria-label={t('Μη ασφαλής σύνδεση (http)')} />}
                {hostOf(l.url)}
              </p>
            </div>
            <ExternalLink href={l.url} className="icon-btn" label={t('Άνοιγμα {host}', { host: hostOf(l.url) })}><IconExternal className="text-xl" /></ExternalLink>
            <ConfirmDelete label={t('Διαγραφή συνδέσμου')} onConfirm={() => void updateItem(item.id, (c) => ({ ...c, links: c.links.filter((x) => x.id !== l.id) }))} />
          </li>
        ))}
      </ul>
      {adding && (
        <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); void add(); }}>
          <input className="input" type="url" inputMode="url" autoFocus placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} aria-label={t('Διεύθυνση συνδέσμου')} />
          <button type="submit" className="btn btn-primary shrink-0">{t('Προσθήκη')}</button>
        </form>
      )}
    </section>
  );
}
