import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { gradeLoadState, loadGradeContent, subscribeGradeContent } from '../content';

export function useGradeContent(grade: number) {
  const snapshot = useCallback(() => gradeLoadState(grade), [grade]);
  const status = useSyncExternalStore(subscribeGradeContent, snapshot, snapshot);
  const retry = useCallback(() => { void loadGradeContent(grade).catch(() => undefined); }, [grade]);
  useEffect(retry, [retry]);
  return { status, retry };
}
