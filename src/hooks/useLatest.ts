import { useEffect, useRef } from 'react';

/** Ref με την πιο πρόσφατη τιμή — για callbacks/χρονόμετρα που δεν πρέπει να ξαναστήνονται σε κάθε render. */
export function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => { ref.current = value; });
  return ref;
}
