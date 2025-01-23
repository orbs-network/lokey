import { useMemo } from 'react';
import { LoKey } from '../../dist/loKey.es';

export function useLoKey() {
  const loKey = useMemo(() => new LoKey(), []);

  return loKey;
}
