import { useMemo } from 'react';
import { LoKey } from '@orbs-network/lokey';

export function useLoKey() {
  const loKey = useMemo(() => new LoKey('LoKey'), []);

  return loKey;
}
