export { ResidentsList } from './components/residents-list';
export { ResidentDetail } from './components/resident-detail';
export { ResidentForm } from './components/resident-form';
export { WaitlistList } from './components/waitlist-list';
export { DoNotRentPanel } from './components/do-not-rent-panel';

export {
  useResidents,
  useResident,
  useCreateResident,
  usePatchResident,
  residentsQueryKey,
  residentQueryKey,
} from './hooks/use-residents';
export {
  useWaitlist,
  useCreateWaitlistEntry,
  usePatchWaitlistEntry,
  useRemoveWaitlistEntry,
  waitlistQueryKey,
} from './hooks/use-waitlist';
export { useSetDoNotRent, useClearDoNotRent } from './hooks/use-do-not-rent';
export { useDuplicateCheck } from './hooks/use-duplicate-check';

export { RESIDENT_PERMISSIONS, hasPermission, canMutate } from './utils/permissions';
