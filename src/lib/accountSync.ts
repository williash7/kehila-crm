import { ClientBackupState } from './clientBackup';

const ENABLED_KEY = 'google_account_sync_enabled_v1';
const BASELINE_KEY = 'google_account_sync_baseline_v1';
const LAST_HASH_KEY = 'google_account_sync_hash_v1';
const CONFLICT_KEY = 'google_account_sync_conflict_v1';

export function clientStateHash(state: ClientBackupState): string {
  return JSON.stringify(state);
}

export function isAccountSyncEnabled(storage: Storage = localStorage): boolean {
  return storage.getItem(ENABLED_KEY) === '1';
}

export function accountSyncBaseline(storage: Storage = localStorage): string {
  return storage.getItem(BASELINE_KEY) || '';
}

export function accountSyncLastHash(storage: Storage = localStorage): string {
  return storage.getItem(LAST_HASH_KEY) || '';
}

export function remoteChangedSinceBaseline(remoteUpdatedAt: string, storage: Storage = localStorage): boolean {
  return remoteUpdatedAt !== accountSyncBaseline(storage);
}

export function enableAccountSync(updatedAt: string, hash: string, storage: Storage = localStorage): void {
  storage.setItem(ENABLED_KEY, '1');
  storage.setItem(BASELINE_KEY, updatedAt);
  storage.setItem(LAST_HASH_KEY, hash);
  storage.removeItem(CONFLICT_KEY);
}

export function recordAccountSync(updatedAt: string, hash: string, storage: Storage = localStorage): void {
  storage.setItem(BASELINE_KEY, updatedAt);
  storage.setItem(LAST_HASH_KEY, hash);
  storage.removeItem(CONFLICT_KEY);
}

export function markAccountSyncConflict(storage: Storage = localStorage): void {
  storage.setItem(CONFLICT_KEY, '1');
}

export function hasAccountSyncConflict(storage: Storage = localStorage): boolean {
  return storage.getItem(CONFLICT_KEY) === '1';
}

export function disableAccountSync(storage: Storage = localStorage): void {
  storage.removeItem(ENABLED_KEY);
  storage.removeItem(BASELINE_KEY);
  storage.removeItem(LAST_HASH_KEY);
  storage.removeItem(CONFLICT_KEY);
}
