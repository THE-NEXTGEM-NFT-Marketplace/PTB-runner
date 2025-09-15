import { suiClient } from './simple-sui-client';

const TRANSFER_POLICY_CAP_TYPE = '0x2::transfer_policy::TransferPolicyCap';

export interface TransferPolicyInfo {
  id: string;
  capId: string;
  balance: string;
  type: string;
}

export async function getUserTransferPolicies(walletAddress: string): Promise<TransferPolicyInfo[]> {
  const objects = await suiClient.getOwnedObjects({
    owner: walletAddress,
    filter: {
      StructType: TRANSFER_POLICY_CAP_TYPE,
    },
    options: {
      showContent: true,
      showType: true,
    },
  });

  const policyInfos: TransferPolicyInfo[] = [];

  for (const capObject of objects.data) {
    if (capObject.data?.content?.dataType === 'moveObject' && capObject.data.type) {
      const fields = capObject.data.content.fields as any;
      const policyId = fields.policy_id;

      if (policyId) {
        try {
          const policyObject = await suiClient.getObject({
            id: policyId,
            options: {
              showContent: true,
            },
          });
          
          if (policyObject.data?.content?.dataType === 'moveObject') {
            const policyFields = policyObject.data.content.fields as any;
            const balance = policyFields.balance || '0';
            
            policyInfos.push({
              id: policyId,
              capId: capObject.data.objectId,
              balance: balance,
              type: capObject.data.type,
            });
          }
        } catch (error) {
            console.error(`Failed to fetch policy object ${policyId}`, error);
        }
      }
    }
  }
  
  return policyInfos;
}
