import { TypedDataDomain, TypedDataField } from 'ethers';

export type TypedData = {
  domain: TypedDataDomain & { chainId?: number | bigint | undefined };
  primaryType: string;
  message: Record<string, any>;
  types: Record<string, Array<TypedDataField>>;
};
