import { supabase } from '../supabase';
import Constants from 'expo-constants';

// Access environment variables
const powersyncUrl = process.env.POWERSYNC_URL || Constants.expoConfig?.extra?.POWERSYNC_URL;

// Create fallback implementations
class PowerSyncBackendConnector {
  async fetchCredentials() {
    throw new Error('PowerSync not available');
  }
  async uploadData() {
    throw new Error('PowerSync not available');
  }
}

class AbstractPowerSyncDatabase {}

const UpdateType = {
  PUT: 'PUT',
  PATCH: 'PATCH',
  DELETE: 'DELETE'
};

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
};

// Exponential backoff retry function
const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  retries: number = RETRY_CONFIG.maxRetries
): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) {
      throw error;
    }
    
    const delay = Math.min(
      RETRY_CONFIG.baseDelay * Math.pow(2, RETRY_CONFIG.maxRetries - retries),
      RETRY_CONFIG.maxDelay
    );
    
    console.log(`🔄 PowerSync: Retrying in ${delay}ms... (${retries} retries left)`);
    await new Promise(resolve => setTimeout(resolve, delay));
    
    return retryWithBackoff(fn, retries - 1);
  }
};

export class PowerSyncConnector {
  /**
   * Implement fetchCredentials to obtain a JWT from your authentication service.
   * See https://docs.powersync.com/installation/authentication-setup
   * If you're using Supabase or Firebase, you can re-use the JWT from those clients, see:
   * https://docs.powersync.com/installation/authentication-setup/supabase-auth
   * https://docs.powersync.com/installation/authentication-setup/firebase-auth
   */
  async fetchCredentials() {
    return retryWithBackoff(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.access_token) {
          throw new Error('No authentication token available');
        }

        if (!powersyncUrl) {
          throw new Error('PowerSync URL not configured');
        }

        console.log('🔍 PowerSync: Credentials fetched successfully');
        return {
          endpoint: powersyncUrl,
          token: session.access_token
        };
      } catch (error) {
        console.error('❌ PowerSync: Failed to fetch credentials:', error);
        throw error;
      }
    });
  }

  /**
   * Implement uploadData to send local changes to your backend service.
   * You can omit this method if you only want to sync data from the database to the client
   * See example implementation here:https://docs.powersync.com/client-sdk-references/react-native-and-expo#3-integrate-with-your-backend
   */
  async uploadData(database: any) {
    return retryWithBackoff(async () => {
      try {
        /**
         * For batched crud transactions, use data.getCrudBatch(n);
         * https://powersync-ja.github.io/powersync-js/react-native-sdk/classes/SqliteBucketStorage#getcrudbatch
         */
        const transaction = await database.getNextCrudTransaction();

        if (!transaction) {
          return;
        }

        console.log(`🔄 PowerSync: Processing ${transaction.crud.length} operations`);

        for (const op of transaction.crud) {
          // The data that needs to be changed in the remote db
          const record = { ...op.opData, id: op.id };
          
          switch (op.op) {
            case UpdateType.PUT:
              // TODO: Instruct your backend API to CREATE a record
              console.log('🔄 PowerSync: PUT operation:', { table: op.table, id: op.id });
              break;
            case UpdateType.PATCH:
              // TODO: Instruct your backend API to PATCH a record
              console.log('🔄 PowerSync: PATCH operation:', { table: op.table, id: op.id });
              break;
            case UpdateType.DELETE:
              // TODO: Instruct your backend API to DELETE a record
              console.log('🔄 PowerSync: DELETE operation:', { table: op.table, id: op.id });
              break;
          }
        }

        // Completes the transaction and moves onto the next one
        await transaction.complete();
        console.log('✅ PowerSync: Transaction completed successfully');
      } catch (error) {
        console.error('❌ PowerSync: Failed to upload data:', error);
        throw error;
      }
    });
  }
} 