import { useMemo } from 'react';
import { LoKey } from '../../lib';
import { useSignTypedData } from 'wagmi';

export function useLoKey() {
  const { signTypedDataAsync } = useSignTypedData();
  const loKey = useMemo(
    () =>
      new LoKey(async (payload) => {
        console.log('Signing typed data:', payload);

        const typedData = {
          ...payload,
          domain: {
            ...payload.domain,
            name: payload.domain.name ?? undefined,
            salt: (payload.domain.salt as `0x${string}`) ?? undefined,
            verifyingContract: (payload.domain.verifyingContract as `0x${string}`) ?? undefined,
            version: payload.domain.version ?? undefined,
          },
        };

        return await signTypedDataAsync(typedData);
      }),
    [signTypedDataAsync]
  );

  return loKey;
}
