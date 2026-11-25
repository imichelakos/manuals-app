/** Σύνδεσμοι του προϊόντος (από QR του εντύπου ή με επικόλληση): βίντεο, PDF, εφαρμογές, σελίδες υποστήριξης. */
import { useState } from 'react';
import { newId, type Item, type LinkKind, type LinkRef } from '@/domain/model';
import { linkKind, parseHttpUrl, type CodePayload } from '@/domain/codes';
import { QrButton, noLinkMessage } from '@/components/QrButton';
import { updateItem } from '@/data/library';
import { enrichLinks } from '@/data/linkEnrich';
import { ExternalLink } from '@/components/ExternalLink';
import { t, tn } from '@/i18n';
import { AutoField, ConfirmDelete } from '@/components/controls';
import { Sheet } from '@/components/Sheet';
import { toast } from '@/components/Toast';
import { IconApp, IconFile, IconLink, IconPencil, IconPlus, IconVideo, IconWarn } from '@/components/icons';

export const linkLabel = (kind: LinkKind): string =>
  kind === 'video' ? t('Βίντεο') : kind === 'pdf' ? t('Έγγραφο PDF') : kind === 'app' ? t('Εφαρμογή') : t('Ιστοσελίδα');

export function LinkIcon({ kind }: { kind: LinkKind }) {
  return kind === 'video' ? <IconVideo /> : kind === 'pdf' ? <IconFile /> : kind === 'app' ? <IconApp /> : <IconLink />;
}

const hostOf = (url: string) => parseHttpUrl(url)?.hostname ?? url;

export function LinksSection({ item }: { item: Item }) {
  const [adding, setAdding] = useState(false);
  const [url, setUrl] = useState('');

  /** νέοι σύνδεσμοι (από επικόλληση ή QR)· όσοι υπάρχουν ήδη παραλείπονται. Επιστρέφει πόσοι μπήκαν. */
  const addUrls = async (urls: URL[], origin: LinkRef['origin']): Promise<number> => {
    const fresh = urls.filter((u, i) => !item.links.some((l) => l.url === u.href) && urls.findIndex((x) => x.href === u.href) === i);
    if (!fresh.length) return 0;
    const links = fresh.map((u): LinkRef => { const kind = linkKind(u); return { id: newId(), url: u.href, title: linkLabel(kind), kind, origin, addedAt: Date.now() }; });
    await updateItem(item.id, (c) => ({ ...c, links: [...c.links, ...links] }));
    void enrichLinks(item.id, linkLabel);   // τελικός σύνδεσμος, τίτλος και εικονίδιο, στο παρασκήνιο
    return fresh.length;
  };

  const add = async () => {
    const u = parseHttpUrl(url);
    if (!u) { toast(t('Αυτή δεν μοιάζει με διεύθυνση ιστοσελίδας.'), 'error'); return; }
    if (!(await addUrls([u], 'manual'))) { toast(t('Ο σύνδεσμος υπάρχει ήδη.'), 'error'); return; }
    setUrl('');
    setAdding(false);
  };

  /** αποτέλεσμα σάρωσης QR: σύνδεσμοι → προστίθενται· αλλιώς μήνυμα με αυτό που διαβάστηκε */
  const onCodes = async (codes: CodePayload[] | null) => {
    if (!codes) return;
    const urls = codes.flatMap((c) => (c.type === 'link' ? [new URL(c.url)] : []));
    if (urls.length) {
      const n = await addUrls(urls, 'qr');
      toast(n ? tn(n, 'Προστέθηκε {n} σύνδεσμος', 'Προστέθηκαν {n} σύνδεσμοι') : t('Ο σύνδεσμος υπάρχει ήδη.'), n ? 'ok' : 'error');
      return;
    }
    toast(noLinkMessage(codes), 'error');
  };

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="section-title">{t('Σύνδεσμοι και QR')}</h2>

      </div>
      {item.links.length === 0 && !adding && <p className="mt-2 text-[15px] text-ink-2">{t('Βίντεο και σελίδες από τα QR του εντύπου αποθηκεύονται εδώ.')}</p>}
      <ul className="mt-3 space-y-2.5">
        {item.links.map((l) => <LinkRow key={l.id} item={item} l={l} />)}
      </ul>
      {!adding && (
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <QrButton onCodes={(c) => void onCodes(c)} />
          <button type="button" className="btn btn-plain" onClick={() => setAdding(true)}><IconPlus className="text-xl" />{t('Προσθήκη')}</button>
        </div>
      )}
      {adding && (
        <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); void add(); }}>
          <input className="input" type="url" inputMode="url" autoFocus placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} aria-label={t('Διεύθυνση συνδέσμου')} />
          <button type="submit" className="btn btn-primary shrink-0">{t('Προσθήκη')}</button>
        </form>
      )}
    </section>
  );
}

/**
 * Γραμμή συνδέσμου: πάτημα οπουδήποτε → άνοιγμα (φύλλο Safari στην εφαρμογή)· το μολύβι αλλάζει τον τίτλο — ίδιος
 * κανόνας με τα έγγραφα (απόφαση 24/11/2026).
 */
function LinkRow({ item, l }: { item: Item; l: LinkRef }) {
  const [editing, setEditing] = useState(false);
  const setTitle = (title: string) => void updateItem(item.id, (c) => ({ ...c, links: c.links.map((x) => (x.id === l.id ? { ...x, title: title.trim() || linkLabel(l.kind) } : x)) }));
  return (
    <li className="flex items-center gap-1 rounded-2xl bg-surface-2 p-2 pl-3.5">
      <ExternalLink href={l.url} className="flex min-w-0 flex-1 items-center gap-3" label={t('Άνοιγμα {title}', { title: l.title })}>
        {l.icon
          ? <img src={l.icon} alt="" className="size-9 shrink-0 rounded-lg bg-surface object-cover" />
          : <span className="text-2xl text-accent"><LinkIcon kind={l.kind} /></span>}
        <span className="min-w-0">
          <span className="line-clamp-2 break-words text-[15px] font-semibold leading-snug">{l.title}</span>
          <span className="flex items-center gap-1.5 truncate text-[13px] text-ink-2">
            {l.url.startsWith('http://') && <IconWarn className="shrink-0 text-sm text-warn" aria-label={t('Μη ασφαλής σύνδεση (http)')} />}
            {hostOf(l.url)}
          </span>
        </span>
      </ExternalLink>
      <button type="button" className="icon-btn" onClick={() => setEditing(true)} aria-label={t('Αλλαγή τίτλου: {title}', { title: l.title })}>
        <IconPencil className="text-xl" />
      </button>
      <ConfirmDelete label={t('Διαγραφή συνδέσμου')} onConfirm={() => void updateItem(item.id, (c) => ({ ...c, links: c.links.filter((x) => x.id !== l.id) }))} />
      {editing && (
        <Sheet title={t('Τίτλος συνδέσμου')} onClose={() => setEditing(false)}
          footer={<button type="button" className="btn btn-primary w-full" onClick={() => setEditing(false)}>{t('Τέλος')}</button>}>
          <AutoField value={l.title} autoFocus aria-label={t('Τίτλος συνδέσμου')} className="input" onCommit={setTitle}
            onKeyDown={(e) => { if (e.key === 'Enter') setEditing(false); }} />
          <p className="mt-2 truncate text-[13px] text-ink-2">{l.url}</p>
        </Sheet>
      )}
    </li>
  );
}
