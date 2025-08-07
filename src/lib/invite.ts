// 초대 코드 생성 함수
export function generateInviteCode(): string {
  // 8자리 랜덤 코드 생성 (예: "ABC123XY")
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// 초대 링크 생성 함수
export function createInviteLink(code: string): string {
  // 개발 환경에서는 localhost, 배포시에는 실제 도메인 사용
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${baseUrl}/invite/${code}`;
}

// 초대 코드 유효성 검사
export function isValidInviteCode(code: string): boolean {
  return /^[A-Z0-9]{8}$/.test(code);
}

// 그룹에 새 멤버 추가 함수
export interface NewMember {
  name: string;
  phone: string;
  account: string;
}

export function addMemberToGroup(existingMembers: any[], newMember: NewMember) {
  const memberColors = [
    '#ff9a9e', '#fecfef', '#ffecd2', '#fcb69f', '#ff8a80', '#f8bbd9',
    '#ffcccb', '#ffd1dc', '#ffe4e1', '#ffb3ba', '#ffdfba', '#ffffba'
  ];

  const newId = existingMembers.length;
  const newMemberWithId = {
    id: newId,
    name: newMember.name,
    phone: newMember.phone,
    account: newMember.account,
    color: memberColors[newId % memberColors.length],
    joinedAt: new Date()
  };

  return [...existingMembers, newMemberWithId];
}