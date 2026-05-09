const SESSION_KEY = 'groupMemberships';

export interface MemberSession {
  groupId: string;
  memberId: number;
  memberName: string;
  timestamp: number;
}

export function getMemberSession(groupId: string): MemberSession | null {
  if (typeof window === 'undefined') return null;

  try {
    const sessionsJson = localStorage.getItem(SESSION_KEY);
    if (!sessionsJson) return null;

    const sessions: { [key: string]: MemberSession } = JSON.parse(sessionsJson);
    return sessions[groupId] || null;
  } catch (error) {
    console.error('세션 정보 로드 실패:', error);
    return null;
  }
}

export function saveMemberSession(groupId: string, memberId: number, memberName: string): void {
  if (typeof window === 'undefined') return;

  try {
    const sessionsJson = localStorage.getItem(SESSION_KEY);
    const sessions: { [key: string]: MemberSession } = sessionsJson
      ? JSON.parse(sessionsJson)
      : {};

    sessions[groupId] = {
      groupId,
      memberId,
      memberName,
      timestamp: Date.now()
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(sessions));
    console.log('✅ 멤버 세션 저장 완료:', sessions[groupId]);
  } catch (error) {
    console.error('세션 정보 저장 실패:', error);
  }
}

export function clearMemberSession(groupId: string): void {
  if (typeof window === 'undefined') return;

  try {
    const sessionsJson = localStorage.getItem(SESSION_KEY);
    if (!sessionsJson) return;

    const sessions: { [key: string]: MemberSession } = JSON.parse(sessionsJson);
    delete sessions[groupId];

    localStorage.setItem(SESSION_KEY, JSON.stringify(sessions));
    console.log('✅ 멤버 세션 삭제 완료');
  } catch (error) {
    console.error('세션 정보 삭제 실패:', error);
  }
}
