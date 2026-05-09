import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { calculateSettlement, type Settlement } from './settlement';

export type { Settlement };

export interface ExcelGroup {
  id: string;
  name: string;
  description: string;
  members: any[];
  expenses: any[];
  createdAt: any;
}

// 그룹 데이터를 엑셀로 다운로드
export function downloadGroupAsExcel(group: ExcelGroup) {
  try {
    // 새 워크북 생성
    const workbook = XLSX.utils.book_new();

    // 1. 그룹 정보 시트
    const groupInfoData = [
      ['그룹 정보', ''],
      ['그룹명', group.name],
      ['설명', group.description],
      ['생성일', new Date(group.createdAt?.toDate?.() || group.createdAt).toLocaleDateString('ko-KR')],
      ['총 멤버수', group.members.length],
      ['총 지출 건수', group.expenses.length],
      ['총 지출 금액', group.expenses.reduce((sum, expense) => sum + expense.amount, 0).toLocaleString() + '원'],
      [],
    ];

    const groupInfoSheet = XLSX.utils.aoa_to_sheet(groupInfoData);
    XLSX.utils.book_append_sheet(workbook, groupInfoSheet, '그룹정보');

    // 2. 멤버 정보 시트
    const memberData = [
      ['번호', '이름', '전화번호', '계좌번호', '참여일'],
      ...group.members.map((member, index) => [
        index + 1,
        member.name,
        member.phone,
        member.account,
        member.joinedAt ? new Date(member.joinedAt?.toDate?.() || member.joinedAt).toLocaleDateString('ko-KR') : '그룹 생성시'
      ])
    ];

    const memberSheet = XLSX.utils.aoa_to_sheet(memberData);
    XLSX.utils.book_append_sheet(workbook, memberSheet, '참여자목록');

    // 3. 지출 내역 시트
    if (group.expenses.length > 0) {
      const expenseData = [
        ['번호', '날짜', '내용', '금액', '결제자', '참여자', '1인당 금액'],
        ...group.expenses.map((expense, index) => {
          const payer = group.members.find(m => m.id === expense.payerId);
          const participants = expense.participants
            .map((id: number) => group.members.find(m => m.id === id)?.name)
            .filter(Boolean)
            .join(', ');

          return [
            index + 1,
            expense.date,
            expense.title,
            expense.amount.toLocaleString() + '원',
            payer?.name || '알 수 없음',
            participants,
            expense.perPersonAmount.toLocaleString() + '원'
          ];
        })
      ];

      const expenseSheet = XLSX.utils.aoa_to_sheet(expenseData);
      XLSX.utils.book_append_sheet(workbook, expenseSheet, '지출내역');
    }

    // 4. 정산 결과 시트
    const settlements = calculateSettlement(group.expenses, group.members);
    
    if (settlements.length > 0) {
      const settlementData = [
        ['번호', '보내는 사람', '받는 사람', '송금 금액', '연락처(보내는 사람)', '계좌번호(받는 사람)'],
        ...settlements.map((settlement, index) => {
          const fromMember = group.members.find(m => m.id === settlement.from);
          const toMember = group.members.find(m => m.id === settlement.to);

          return [
            index + 1,
            fromMember?.name || '알 수 없음',
            toMember?.name || '알 수 없음',
            settlement.amount.toLocaleString() + '원',
            fromMember?.phone || '',
            toMember?.account || ''
          ];
        })
      ];

      const settlementSheet = XLSX.utils.aoa_to_sheet(settlementData);
      XLSX.utils.book_append_sheet(workbook, settlementSheet, '정산결과');
    } else {
      // 정산할 내용이 없는 경우
      const emptySettlementData = [
        ['정산 결과'],
        ['아직 정산할 지출 내역이 없습니다.']
      ];
      const emptySettlementSheet = XLSX.utils.aoa_to_sheet(emptySettlementData);
      XLSX.utils.book_append_sheet(workbook, emptySettlementSheet, '정산결과');
    }

    // 5. 요약 시트
    const totalExpense = group.expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const totalSettlement = settlements.reduce((sum, settlement) => sum + settlement.amount, 0);
    
    const summaryData = [
      ['📊 정산 요약', ''],
      [],
      ['항목', '값'],
      ['그룹명', group.name],
      ['총 참여자', group.members.length + '명'],
      ['총 지출 건수', group.expenses.length + '건'],
      ['총 지출 금액', totalExpense.toLocaleString() + '원'],
      ['총 정산 금액', totalSettlement.toLocaleString() + '원'],
      ['1인당 평균 지출', group.members.length > 0 ? Math.round(totalExpense / group.members.length).toLocaleString() + '원' : '0원'],
      [],
      ['🔄 송금 현황'],
      ['총 송금 건수', settlements.length + '건'],
      ...settlements.map(settlement => {
        const fromMember = group.members.find(m => m.id === settlement.from);
        const toMember = group.members.find(m => m.id === settlement.to);
        return [`${fromMember?.name} → ${toMember?.name}`, settlement.amount.toLocaleString() + '원'];
      })
    ];

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, '요약');

    // 파일명 생성 (특수문자 제거)
    const safeGroupName = group.name.replace(/[^\w\s-]/g, '').trim();
    const currentDate = new Date().toISOString().split('T')[0];
    const filename = `함께정산_${safeGroupName}_${currentDate}.xlsx`;

    // 엑셀 파일 생성 및 다운로드
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });

    saveAs(blob, filename);

    console.log('✅ 엑셀 다운로드 성공:', filename);
    return true;

  } catch (error) {
    console.error('❌ 엑셀 다운로드 실패:', error);
    return false;
  }
}