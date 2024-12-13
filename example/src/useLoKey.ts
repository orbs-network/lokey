import { useMemo } from 'react';
import { LoKey } from '../../dist';

export function useLoKey() {
  const loKey = useMemo(() => new LoKey('LoKey'), []);

  return loKey;
}
