import { useEffect, useState } from 'react';
import { blobStore } from '@/data/blobs';

/** Προσωρινή διεύθυνση (blob:) ενός αποθηκευμένου αρχείου, για <img>. Απελευθερώνεται όταν δεν χρειάζεται πια. */
export function useBlobUrl(blobId: string | undefined): string | null {
  const [made, setMade] = useState<{ id: string; url: string } | null>(null);
  useEffect(() => {
    if (!blobId) return;
    let alive = true, url: string | null = null;
    void blobStore.get(blobId).then((b) => {
      if (!alive || !b) return;
      url = URL.createObjectURL(b);
      setMade({ id: blobId, url });
    });
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [blobId]);
  // διεύθυνση που φτιάχτηκε για ΑΛΛΟ αρχείο (ή έχει ήδη απελευθερωθεί) δεν επιστρέφεται
  return made && made.id === blobId ? made.url : null;
}
