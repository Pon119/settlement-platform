"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/firebase";
import {
  doc,
  updateDoc,
  onSnapshot,
  deleteDoc,
} from "firebase/firestore";
import { downloadGroupAsExcel, type ExcelGroup } from "@/lib/excel";
import { getMemberSession, saveMemberSession, clearMemberSession, type MemberSession } from "@/lib/session";
import { calculateSettlement, type Settlement } from "@/lib/settlement";

interface Member {
  id: number;
  name: string;
  phone: string;
  account: string;
  color: string;
  isProxy?: boolean;
}

interface Expense {
  id: number;
  title: string;
  amount: number;
  payerId: number;
  participants: number[];
  date: string;
  perPersonAmount: number;
}

interface Group {
  id: string;
  name: string;
  description: string;
  members: Member[];
  expenses: Expense[];
  createdAt: any;
  lastUpdated: any;
  inviteCode: string;
  inviteLink: string;
}

const MARQUEE_TEXT = '✦ 함께정산 — 실시간 정산 중 ✦ 지출을 입력하고 결과를 확인하세요 ✦ 계좌번호 클릭 한 번으로 복사 ✦ '

export default function GroupDashboard() {
  const params = useParams();
  const router = useRouter();
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"expenses" | "settlement">("expenses");
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [editForm, setEditForm] = useState({ name: "", phone: "", account: "" });
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [headerOpen, setHeaderOpen] = useState(false);

  // 세션 관련 state
  const [currentMember, setCurrentMember] = useState<Member | null>(null);
  const [showMemberSelectModal, setShowMemberSelectModal] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);

  // 멤버 삭제 관련 state
  const [showMemberDeleteModal, setShowMemberDeleteModal] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null);
  const [isDeletingMember, setIsDeletingMember] = useState(false);
  const [showPayerSelectModal, setShowPayerSelectModal] = useState(false);
  const [expensesNeedingNewPayer, setExpensesNeedingNewPayer] = useState<Expense[]>([]);
  const [payerSelections, setPayerSelections] = useState<{ [expenseId: number]: number }>({});

  // 지출 수정 관련 state
  const [showExpenseEditModal, setShowExpenseEditModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expenseEditForm, setExpenseEditForm] = useState({
    title: "", amount: "", payerId: "", participants: [] as number[], date: "",
  });
  const [isUpdatingExpense, setIsUpdatingExpense] = useState(false);

  // 지출 입력 폼 상태
  const [expenseForm, setExpenseForm] = useState({
    title: "", amount: "", payerId: "", participants: [] as number[],
    date: new Date().toISOString().split("T")[0],
  });

  // 임시 멤버 추가 관련 state
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberAccount, setNewMemberAccount] = useState('');
  const [addMemberLoading, setAddMemberLoading] = useState(false);

  const selectAndSaveMember = () => {
    if (!group || selectedMemberId === null) return;
    const member = group.members.find(m => m.id === selectedMemberId);
    if (!member) { alert('선택한 멤버를 찾을 수 없습니다.'); return; }
    saveMemberSession(group.id, member.id, member.name);
    setCurrentMember(member);
    setShowMemberSelectModal(false);
    setSelectedMemberId(null);
  };

  const handleLogout = () => {
    if (!group) return;
    const confirmLogout = window.confirm('다른 멤버로 전환하시겠습니까?');
    if (!confirmLogout) return;
    clearMemberSession(group.id);
    setCurrentMember(null);
    setShowMemberSelectModal(true);
  };

  useEffect(() => {
    if (!params.id) return;
    const unsubscribe = onSnapshot(
      doc(db, "groups", params.id as string),
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data();
          const groupData = { id: docSnapshot.id, ...data } as Group;
          setGroup(groupData);
          const session = getMemberSession(groupData.id);
          if (session) {
            const member = groupData.members.find(m => m.id === session.memberId);
            if (member) {
              setCurrentMember(member);
            } else {
              clearMemberSession(groupData.id);
              setCurrentMember(null);
              setShowMemberSelectModal(true);
            }
          } else {
            setShowMemberSelectModal(true);
          }
        } else {
          alert("그룹을 찾을 수 없습니다.");
          router.push("/");
        }
        setLoading(false);
      },
      (error) => {
        console.error("❌ Firebase 데이터 로딩 실패:", error);
        alert("데이터 로딩 중 오류가 발생했습니다.");
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [params.id, router]);

  const openMemberDeleteModal = (member: Member) => {
    setMemberToDelete(member);
    setShowMemberDeleteModal(true);
    setShowAccountModal(false);
  };

  const deleteMember = async () => {
    if (!group || !memberToDelete) return;
    if (group.members.length <= 1) { alert("❌ 그룹에는 최소 1명의 멤버가 있어야 합니다."); return; }
    const expensesWhereDeletedMemberIsPayer = group.expenses.filter(e => e.payerId === memberToDelete.id);
    if (expensesWhereDeletedMemberIsPayer.length > 0) {
      const validExpensesForPayerSelection = expensesWhereDeletedMemberIsPayer
        .map(e => ({ ...e, participants: e.participants.filter(id => id !== memberToDelete.id) }))
        .filter(e => e.participants.length > 0);
      if (validExpensesForPayerSelection.length > 0) {
        setExpensesNeedingNewPayer(validExpensesForPayerSelection);
        const defaultSelections: { [expenseId: number]: number } = {};
        validExpensesForPayerSelection.forEach(e => { defaultSelections[e.id] = e.participants[0]; });
        setPayerSelections(defaultSelections);
        setShowMemberDeleteModal(false);
        setShowPayerSelectModal(true);
        return;
      }
    }
    await proceedWithMemberDeletion();
  };

  const proceedWithMemberDeletion = async () => {
    if (!group || !memberToDelete) return;
    setIsDeletingMember(true);
    try {
      let updatedExpenses = [...group.expenses];
      if (expensesNeedingNewPayer.length > 0) {
        updatedExpenses = updatedExpenses.map(expense => {
          if (payerSelections[expense.id] !== undefined) {
            const remaining = expense.participants.filter(id => id !== memberToDelete.id);
            return { ...expense, payerId: payerSelections[expense.id], participants: remaining, perPersonAmount: Math.round(expense.amount / remaining.length) };
          }
          if (expense.participants.includes(memberToDelete.id)) {
            const remaining = expense.participants.filter(id => id !== memberToDelete.id);
            if (remaining.length === 0) return null as any;
            return { ...expense, participants: remaining, perPersonAmount: Math.round(expense.amount / remaining.length) };
          }
          return expense;
        }).filter(e => e !== null).map((e, i) => ({ ...e!, id: i }));
      } else {
        updatedExpenses = group.expenses.map(expense => {
          if (expense.participants.includes(memberToDelete.id)) {
            const remaining = expense.participants.filter(id => id !== memberToDelete.id);
            if (remaining.length === 0) return null as any;
            return { ...expense, participants: remaining, perPersonAmount: Math.round(expense.amount / remaining.length) };
          }
          return expense;
        }).filter(e => e !== null).map((e, i) => ({ ...e!, id: i }));
      }
      const updatedMembers = group.members.filter(m => m.id !== memberToDelete.id);
      const reindexedMembers = updatedMembers.map((m, i) => ({ ...m, id: i }));
      const finalExpenses = updatedExpenses.map(expense => ({
        ...expense,
        payerId: reindexedMembers.findIndex(m => updatedMembers.find(um => um.id === expense.payerId)?.name === m.name),
        participants: expense.participants.map(pid => reindexedMembers.findIndex(m => updatedMembers.find(um => um.id === pid)?.name === m.name)).filter(id => id !== -1),
      }));
      await updateDoc(doc(db, "groups", params.id as string), { members: reindexedMembers, expenses: finalExpenses, lastUpdated: new Date() });
      if (currentMember?.id === memberToDelete.id) { clearMemberSession(group.id); setCurrentMember(null); setShowMemberSelectModal(true); }
      alert(`🗑️ ${memberToDelete.name}님이 그룹에서 제외되었습니다.`);
      setShowMemberDeleteModal(false); setShowPayerSelectModal(false); setMemberToDelete(null); setExpensesNeedingNewPayer([]); setPayerSelections({});
    } catch (error) {
      alert("멤버 삭제 중 오류가 발생했습니다.");
    } finally { setIsDeletingMember(false); }
  };

  const addExpense = async () => {
    if (!group) return;
    const title = expenseForm.title, amount = parseInt(expenseForm.amount), payerId = parseInt(expenseForm.payerId), participants = expenseForm.participants, date = expenseForm.date;
    if (!title || !amount || isNaN(payerId) || participants.length === 0) { alert("모든 필드를 입력해주세요."); return; }
    setIsAddingExpense(true);
    try {
      const newExpense: Expense = { id: group.expenses.length, title, amount, payerId, participants, date, perPersonAmount: Math.round(amount / participants.length) };
      await updateDoc(doc(db, "groups", params.id as string), { expenses: [...group.expenses, newExpense], lastUpdated: new Date() });
      setExpenseForm({ title: "", amount: "", payerId: "", participants: [], date: new Date().toISOString().split("T")[0] });
    } catch (error) { alert("지출 추가 중 오류가 발생했습니다."); } finally { setIsAddingExpense(false); }
  };

  const toggleParticipant = (memberId: number) => {
    setExpenseForm(prev => ({ ...prev, participants: prev.participants.includes(memberId) ? prev.participants.filter(id => id !== memberId) : [...prev.participants, memberId] }));
  };

  const showMemberAccount = (member: Member) => { setSelectedMember(member); setShowAccountModal(true); };

  const openEditModal = (member: Member) => {
    setEditingMember(member); setEditForm({ name: member.name, phone: member.phone, account: member.account });
    setShowEditModal(true); setShowAccountModal(false);
  };

  const updateMemberInfo = async () => {
    if (!group || !editingMember) return;
    const { name, phone, account } = editForm;
    if (!name.trim() || !phone.trim() || !account.trim()) { alert("모든 필드를 입력해주세요."); return; }
    const dup = group.members.find(m => m.id !== editingMember.id && (m.name.toLowerCase() === name.toLowerCase().trim() || m.phone === phone.trim()));
    if (dup) { alert("이미 존재하는 이름 또는 전화번호입니다."); return; }
    setIsUpdating(true);
    try {
      const updatedMembers = group.members.map(m => m.id === editingMember.id ? { ...m, name: name.trim(), phone: phone.trim(), account: account.trim() } : m);
      await updateDoc(doc(db, "groups", params.id as string), { members: updatedMembers, lastUpdated: new Date() });
      if (currentMember?.id === editingMember.id) saveMemberSession(group.id, editingMember.id, name.trim());
      alert("💫 정보가 성공적으로 업데이트되었습니다!");
      setShowEditModal(false); setEditingMember(null);
    } catch (error) { alert("정보 업데이트 중 오류가 발생했습니다."); } finally { setIsUpdating(false); }
  };

  const downloadExcel = async () => {
    if (!group) return;
    setIsDownloading(true);
    try {
      const excelGroup: ExcelGroup = { id: group.id, name: group.name, description: group.description, members: group.members, expenses: group.expenses, createdAt: group.createdAt };
      const success = downloadGroupAsExcel(excelGroup);
      if (success) alert("📊 엑셀 파일로 다운로드되었습니다!"); else alert("엑셀 다운로드 중 오류가 발생했습니다.");
    } catch (error) { alert("엑셀 다운로드 중 오류가 발생했습니다."); } finally { setIsDownloading(false); }
  };

  const backupAndDelete = async () => {
    if (!group) return;
    setIsBackingUp(true);
    try {
      const excelGroup: ExcelGroup = { id: group.id, name: group.name, description: group.description, members: group.members, expenses: group.expenses, createdAt: group.createdAt };
      const backupSuccess = downloadGroupAsExcel(excelGroup);
      if (!backupSuccess) { alert("백업 실패로 삭제가 취소되었습니다."); return; }
      const confirmDelete = confirm(`⚠️ 정말로 "${group.name}" 그룹을 삭제하시겠습니까?\n\n✅ 엑셀 백업이 완료되었습니다.\n❌ 삭제 후에는 복구할 수 없습니다.`);
      if (!confirmDelete) return;
      await deleteDoc(doc(db, "groups", params.id as string));
      alert("🗑️ 그룹이 삭제되었습니다!");
      router.push("/");
    } catch (error) { alert("삭제 중 오류가 발생했습니다."); } finally { setIsBackingUp(false); }
  };

  const openExpenseEditModal = (expense: Expense) => {
    setEditingExpense(expense);
    setExpenseEditForm({ title: expense.title, amount: expense.amount.toString(), payerId: expense.payerId.toString(), participants: [...expense.participants], date: expense.date });
    setShowExpenseEditModal(true);
  };

  const updateExpenseInfo = async () => {
    if (!group || !editingExpense) return;
    const { title, amount, payerId, participants, date } = expenseEditForm;
    const numAmount = parseInt(amount), numPayerId = parseInt(payerId);
    if (!title.trim() || !numAmount || isNaN(numPayerId) || participants.length === 0) { alert("모든 필드를 올바르게 입력해주세요."); return; }
    setIsUpdatingExpense(true);
    try {
      const updatedExpenses = group.expenses.map(e => e.id === editingExpense.id ? { ...e, title: title.trim(), amount: numAmount, payerId: numPayerId, participants, date, perPersonAmount: Math.round(numAmount / participants.length) } : e);
      await updateDoc(doc(db, "groups", params.id as string), { expenses: updatedExpenses, lastUpdated: new Date() });
      alert("💫 지출 내역이 업데이트되었습니다!");
      setShowExpenseEditModal(false); setEditingExpense(null);
    } catch (error) { alert("지출 정보 업데이트 중 오류가 발생했습니다."); } finally { setIsUpdatingExpense(false); }
  };

  const deleteExpense = async (expenseId: number) => {
    if (!group) return;
    if (!confirm("⚠️ 정말로 이 지출 내역을 삭제하시겠습니까?")) return;
    try {
      const updated = group.expenses.filter(e => e.id !== expenseId).map((e, i) => ({ ...e, id: i }));
      await updateDoc(doc(db, "groups", params.id as string), { expenses: updated, lastUpdated: new Date() });
      alert("🗑️ 지출 내역이 삭제되었습니다.");
    } catch (error) { alert("지출 삭제 중 오류가 발생했습니다."); }
  };

  const MEMBER_COLORS = ['#ff9a9e', '#fecfef', '#ffecd2', '#fcb69f', '#ff8a80', '#f8bbd9', '#ffcccb', '#ffd1dc', '#ffe4e1', '#ffb3ba', '#ffdfba', '#ffffba'];

  const addProxyMember = async () => {
    if (!group || !newMemberName.trim()) { alert('이름을 입력해주세요.'); return; }
    if (group.members.some(m => m.name.trim().toLowerCase() === newMemberName.trim().toLowerCase())) { alert('이미 같은 이름의 멤버가 있습니다.'); return; }
    setAddMemberLoading(true);
    try {
      const newMember: Member = {
        id: group.members.length,
        name: newMemberName.trim(),
        phone: '',
        account: newMemberAccount.trim(),
        color: MEMBER_COLORS[group.members.length % MEMBER_COLORS.length],
        isProxy: true,
      };
      await updateDoc(doc(db, 'groups', params.id as string), { members: [...group.members, newMember], lastUpdated: new Date() });
      setNewMemberName('');
      setNewMemberAccount('');
      setShowAddMemberModal(false);
    } catch (error) { alert('멤버 추가 중 오류가 발생했습니다.'); } finally { setAddMemberLoading(false); }
  };

  const toggleExpenseParticipant = (memberId: number) => {
    setExpenseEditForm(prev => ({ ...prev, participants: prev.participants.includes(memberId) ? prev.participants.filter(id => id !== memberId) : [...prev.participants, memberId] }));
  };

  const copyInviteLink = async (inviteLink: string) => {
    const msg = `정산해bar에서 정산 초대 코드를 보냈어요! 🔥\n\n아래 링크에 참여해서 함께 정산해보세요!\n\n${inviteLink}\n\n📱 모바일에서도 쉽게 사용할 수 있어요!`;
    try { await navigator.clipboard.writeText(msg); alert("🎉 초대 메시지가 클립보드에 복사되었습니다!"); }
    catch { prompt("아래 메시지를 복사해서 친구들에게 공유하세요:", msg); }
  };

  const copyAccount = (account: string) => { navigator.clipboard.writeText(account).then(() => alert("계좌번호가 복사되었습니다!")); };

  const copySettlementMessage = (from: Member, to: Member, amount: number) => {
    const message = `${from.name}이 ${to.name}한테 ${amount.toLocaleString()}원을 보내줘야 합니다.\n\n${to.account}`;
    navigator.clipboard.writeText(message).then(() => alert("💸 정보가 복사되었습니다!")).catch(() => prompt("아래 메시지를 복사해서 보내세요:", message));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--y2k-cream)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--y2k-black)] mx-auto mb-4"></div>
          <p className="font-pixel text-[13px] text-[var(--y2k-t2)]">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--y2k-cream)' }}>
        <div className="text-center">
          <p className="font-pixel text-[16px] text-[var(--y2k-t1)] mb-4">❌ 그룹을 찾을 수 없습니다</p>
          <Link href="/" className="y2k-btn px-6 py-2 text-sm">홈으로</Link>
        </div>
      </div>
    );
  }

  const settlements = calculateSettlement(group.expenses, group.members);
  const myMemberId = currentMember?.id ?? -1;
  const toSend = currentMember ? settlements.filter(s => s.from === myMemberId) : [];
  const toReceive = currentMember ? settlements.filter(s => s.to === myMemberId) : [];
  const totalSend = toSend.reduce((sum, s) => sum + s.amount, 0);
  const totalReceive = toReceive.reduce((sum, s) => sum + s.amount, 0);

  return (
    <div className="min-h-screen y2k-noise" style={{ background: 'var(--y2k-cream)' }}>
      {/* 마키 */}
      <div className="y2k-marquee">
        <div className="y2k-marquee-inner">
          <span className="font-pixel text-[12px] text-[var(--y2k-yellow)] px-4">{MARQUEE_TEXT}</span>
          <span className="font-pixel text-[12px] text-[var(--y2k-yellow)] px-4">{MARQUEE_TEXT}</span>
        </div>
      </div>

      {/* 멤버 선택 모달 */}
      {showMemberSelectModal && (
        <div className="px-4" style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="y2k-win95 max-w-md w-full">
            <div className="y2k-win95-bar">
              <span className="font-pixel text-[11px] text-white">👤 멤버 선택.exe</span>
              <div className="flex gap-1">
                <div className="y2k-win95-btn">_</div><div className="y2k-win95-btn">□</div><div className="y2k-win95-btn">✕</div>
              </div>
            </div>
            <div className="bg-white p-5">
              <p className="font-pixel text-[13px] text-[var(--y2k-black)] mb-1">누구로 보시나요?</p>
              <p className="text-[10px] text-[var(--y2k-t2)] mb-4">그룹 멤버 중 본인을 선택해주세요</p>
              <div className="space-y-2 mb-4">
                {group.members.map(member => (
                  <label
                    key={member.id}
                    className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
                    style={{
                      border: selectedMemberId === member.id ? '2px solid var(--y2k-pink)' : '2px solid var(--y2k-muted)',
                      background: selectedMemberId === member.id ? 'var(--y2k-pink-l)' : 'var(--y2k-cream)',
                    }}
                  >
                    <input type="radio" name="member-select" value={member.id} checked={selectedMemberId === member.id} onChange={() => setSelectedMemberId(member.id)} className="w-4 h-4" />
                    <div className="w-10 h-10 rounded-full text-white text-sm font-bold flex items-center justify-center flex-shrink-0" style={{ backgroundColor: member.color, border: '2px solid var(--y2k-black)' }}>
                      {member.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-pixel text-[12px] text-[var(--y2k-black)]">{member.name}</p>
                      <p className="text-[9px] text-[var(--y2k-t3)]">{member.phone}</p>
                    </div>
                  </label>
                ))}
              </div>
              <button onClick={selectAndSaveMember} disabled={selectedMemberId === null} className="y2k-btn w-full py-2.5 text-sm disabled:opacity-50">
                ✦ 선택 완료
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 pb-10">
        {/* 그룹 헤더 */}
        <div className="bg-white y2k-noise" style={{ borderBottom: '2px solid var(--y2k-black)' }}>
          {/* 접힌 상태 헤더바 */}
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <Link href="/" className="text-[10px] text-[var(--y2k-t3)] hover:text-[var(--y2k-t1)]">← 홈</Link>
              <span className="text-[var(--y2k-muted)]">|</span>
              <span className="font-pixel text-[16px] text-[var(--y2k-black)]">{group.name}</span>
            </div>
            <button
              onClick={() => setHeaderOpen(v => !v)}
              className="px-3 py-1.5 text-[11px] font-bold rounded"
              style={{ background: 'var(--chrome)', border: '2px solid var(--y2k-black)', boxShadow: '2px 2px 0 var(--y2k-black)' }}
            >
              {headerOpen ? '▲' : '≡'}
            </button>
          </div>

          {/* 펼친 상태 확장 패널 */}
          {headerOpen && (
            <div className="px-4 pb-4 space-y-3" style={{ borderTop: '2px solid var(--y2k-black)', background: 'var(--y2k-cream)' }}>
              {/* 내 프로필 */}
              {currentMember && (
                <div className="flex items-center gap-3 pt-3">
                  <div className="w-9 h-9 rounded-full text-white font-bold flex items-center justify-center flex-shrink-0" style={{ backgroundColor: currentMember.color, border: '2px solid var(--y2k-black)' }}>
                    {currentMember.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-pixel text-[12px] text-[var(--y2k-black)]">{currentMember.name}</p>
                    <p className="text-[9px] text-[var(--y2k-t3)]">현재 접속 중</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="ml-auto px-3 py-1 text-[10px] font-bold rounded"
                    style={{ background: 'var(--chrome)', border: '1.5px solid var(--y2k-black)', boxShadow: '1px 1px 0 var(--y2k-black)' }}
                  >
                    전환
                  </button>
                </div>
              )}

              {/* 초대 코드 */}
              <div className="p-3 rounded-lg" style={{ background: 'var(--y2k-cream)', border: '2px solid var(--y2k-black)', boxShadow: '2px 2px 0 var(--y2k-black)' }}>
                <p className="font-pixel text-[11px] text-[var(--y2k-t3)] mb-2">🔗 초대 링크</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-2 py-1.5 rounded text-[10px] font-mono text-[var(--y2k-t1)]" style={{ background: 'white', border: '1px solid var(--y2k-muted)' }}>{group.inviteCode}</code>
                  <button onClick={() => copyInviteLink(group.inviteLink)} className="y2k-btn px-3 py-1.5 text-[11px]">복사</button>
                </div>
              </div>

              {/* 참여자 칩 */}
              <div>
                <p className="font-pixel text-[11px] text-[var(--y2k-t3)] mb-2">참여자 ({group.members.length}명)</p>
                <div className="flex flex-wrap gap-1.5">
                  {group.members.map(member => {
                    const isMe = currentMember?.id === member.id;
                    return (
                      <div
                        key={member.id}
                        className="group relative flex items-center gap-1.5 px-2.5 py-1 rounded-full cursor-pointer"
                        style={{
                          background: isMe ? 'var(--y2k-pink-l)' : 'white',
                          border: '2px solid var(--y2k-black)',
                          boxShadow: '1px 1px 0 var(--y2k-black)',
                        }}
                        onClick={() => showMemberAccount(member)}
                      >
                        <div className="w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center" style={{ backgroundColor: member.color }}>
                          {member.name.charAt(0)}
                        </div>
                        <span className="text-[10px] font-medium text-[var(--y2k-black)]">{member.name}</span>
                        {isMe && <span className="font-pixel text-[11px] y2k-glow-pink">나</span>}
                        {group.members.length > 1 && (
                          <button
                            onClick={e => { e.stopPropagation(); openMemberDeleteModal(member); }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity ml-0.5 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center"
                            style={{ background: 'var(--y2k-pink)', color: 'white', border: '1px solid var(--y2k-black)' }}
                          >×</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 탭 바 */}
        <div className="flex" style={{ background: 'var(--y2k-cream)', borderBottom: '2px solid var(--y2k-black)' }}>
          <button
            onClick={() => setActiveTab("expenses")}
            className="flex-1 py-3 px-4 text-sm font-semibold transition-all"
            style={activeTab === "expenses" ? {
              background: 'var(--y2k-yellow)', border: '2px solid var(--y2k-black)',
              fontFamily: 'Galmuri11, monospace', fontSize: '13px',
            } : {
              background: 'transparent', border: '1px solid var(--y2k-muted)',
              color: 'var(--y2k-t2)', fontSize: '13px',
            }}
          >
            지출 입력
          </button>
          <button
            onClick={() => setActiveTab("settlement")}
            className="flex-1 py-3 px-4 text-sm font-semibold transition-all flex items-center justify-center gap-2"
            style={activeTab === "settlement" ? {
              background: 'var(--y2k-yellow)', border: '2px solid var(--y2k-black)',
              fontFamily: 'Galmuri11, monospace', fontSize: '13px',
            } : {
              background: 'transparent', border: '1px solid var(--y2k-muted)',
              color: 'var(--y2k-t2)', fontSize: '13px',
            }}
          >
            정산 결과
            {settlements.length > 0 && (
              <span className="px-1.5 py-0.5 font-pixel text-[11px] text-white rounded" style={{ background: 'var(--y2k-pink)', border: '1px solid var(--y2k-black)' }}>
                {settlements.length}
              </span>
            )}
          </button>
        </div>

        {/* ============ 지출 탭 ============ */}
        {activeTab === "expenses" && (
          <div className="pt-4 space-y-4">
            {/* 1. 지출 추가 폼 */}
            <div className="y2k-card p-5">
              <p className="font-pixel text-[14px] text-[var(--y2k-black)] mb-4">✦ 새 지출 추가</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="font-pixel text-[11px] text-[var(--y2k-t2)] block mb-1">지출 내용</label>
                  <input type="text" value={expenseForm.title} onChange={e => setExpenseForm(prev => ({ ...prev, title: e.target.value }))} placeholder="예: 숙박비" disabled={isAddingExpense} className="y2k-input disabled:opacity-50" />
                </div>
                <div>
                  <label className="font-pixel text-[11px] text-[var(--y2k-t2)] block mb-1">지출 금액</label>
                  <input type="number" value={expenseForm.amount} onChange={e => setExpenseForm(prev => ({ ...prev, amount: e.target.value }))} placeholder="0" disabled={isAddingExpense} className="y2k-input disabled:opacity-50" />
                </div>
                <div>
                  <label className="font-pixel text-[11px] text-[var(--y2k-t2)] block mb-1">결제자</label>
                  <select value={expenseForm.payerId} onChange={e => setExpenseForm(prev => ({ ...prev, payerId: e.target.value }))} disabled={isAddingExpense} className="y2k-input disabled:opacity-50">
                    <option value="">결제자 선택</option>
                    {group.members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="font-pixel text-[11px] text-[var(--y2k-t2)] block mb-1">지출 날짜</label>
                  <input type="date" value={expenseForm.date} onChange={e => setExpenseForm(prev => ({ ...prev, date: e.target.value }))} disabled={isAddingExpense} className="y2k-input disabled:opacity-50" />
                </div>
              </div>
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="font-pixel text-[11px] text-[var(--y2k-t2)]">참여자 선택</label>
                  <button type="button" onClick={() => setShowAddMemberModal(true)} className="y2k-btn-out px-3 py-1 text-[10px]">+ 참여자 추가</button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {group.members.map(member => (
                    <label
                      key={member.id}
                      className="flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all"
                      style={{
                        border: expenseForm.participants.includes(member.id) ? '2px solid var(--y2k-pink)' : '2px solid var(--y2k-muted)',
                        background: expenseForm.participants.includes(member.id) ? 'var(--y2k-pink-l)' : 'var(--y2k-cream)',
                        boxShadow: expenseForm.participants.includes(member.id) ? '1px 1px 0 var(--y2k-black)' : 'none',
                      }}
                    >
                      <input type="checkbox" checked={expenseForm.participants.includes(member.id)} onChange={() => toggleParticipant(member.id)} disabled={isAddingExpense} className="w-4 h-4" />
                      <div className="w-6 h-6 rounded-full text-white text-[9px] font-bold flex items-center justify-center" style={{ backgroundColor: member.color }}>
                        {member.name.charAt(0)}
                      </div>
                      <span className="text-[10px] font-medium text-[var(--y2k-black)]">{member.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <button onClick={addExpense} disabled={isAddingExpense} className="y2k-btn w-full py-3 text-sm disabled:opacity-50">
                {isAddingExpense ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--y2k-black)]"></div>저장 중...
                  </span>
                ) : '✦ 지출 추가하기'}
              </button>
            </div>

            {/* 2. 지출 내역 */}
            <div>
              <p className="font-pixel text-[13px] text-[var(--y2k-t2)] mb-3">
                지출 내역 <span className="y2k-glow-pink">({group.expenses.length}건)</span>
              </p>
              {group.expenses.length === 0 ? (
                <div className="y2k-card-cream p-8 text-center">
                  <p className="font-pixel text-[13px] text-[var(--y2k-t3)]">아직 지출 내역이 없습니다</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {group.expenses.map(expense => {
                    const payer = group.members.find(m => m.id === expense.payerId);
                    const participantNames = expense.participants.map(id => group.members.find(m => m.id === id)?.name).join(", ");
                    return (
                      <div key={expense.id} className="y2k-card p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-pixel text-[13px] text-[var(--y2k-black)] mb-1">{expense.title}</p>
                            <p className="text-[10px] text-[var(--y2k-t2)]">결제자: {payer?.name}</p>
                            <p className="text-[10px] text-[var(--y2k-t2)]">참여자: {participantNames}</p>
                            <p className="text-[9px] text-[var(--y2k-t3)] mt-0.5">{expense.date}</p>
                          </div>
                          <div className="text-right ml-3">
                            <p className="text-base font-bold text-[var(--y2k-black)]">{expense.amount.toLocaleString()}원</p>
                            <p className="text-[10px] y2k-glow-pink">1인당 {expense.perPersonAmount.toLocaleString()}원</p>
                            <div className="flex gap-1 mt-2 justify-end">
                              <button onClick={() => openExpenseEditModal(expense)} className="px-2 py-1 text-[10px] font-bold rounded" style={{ background: 'var(--y2k-blue-l)', border: '1.5px solid var(--y2k-black)', boxShadow: '1px 1px 0 var(--y2k-black)' }}>✏️</button>
                              <button onClick={() => deleteExpense(expense.id)} className="px-2 py-1 text-[10px] font-bold rounded" style={{ background: '#FFE0CC', border: '1.5px solid var(--y2k-black)', boxShadow: '1px 1px 0 var(--y2k-black)' }}>🗑️</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 3. 안내 메시지 */}
            <div className="y2k-card-cream p-3 flex items-start gap-2">
              <span className="text-base flex-shrink-0">💡</span>
              <p className="text-[10px] text-[var(--y2k-t2)] leading-relaxed">
                잘못 입력해도 괜찮아요! <strong>수정·삭제 버튼</strong>으로 언제든 수정할 수 있어요.
              </p>
            </div>

            {/* 4. 구분선 + 5. 엑셀·삭제 버튼 */}
            <div>
              <div className="mb-3" style={{ borderTop: '2px dashed var(--y2k-muted)' }}></div>
              <div className="flex gap-2">
                <button
                  onClick={downloadExcel}
                  disabled={isDownloading}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold text-[11px] disabled:opacity-50 transition-all"
                  style={{ background: 'var(--y2k-lime-l)', border: '2px solid var(--y2k-black)', boxShadow: '2px 2px 0 var(--y2k-black)' }}
                >
                  <span className="y2k-glow-lime">{isDownloading ? '⏳' : '📊'}</span>
                  <span className="y2k-glow-lime">{isDownloading ? '다운로드 중...' : '엑셀 다운로드'}</span>
                </button>
                <button
                  onClick={backupAndDelete}
                  disabled={isBackingUp}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold text-[11px] disabled:opacity-50 transition-all"
                  style={{ background: '#FFE0CC', border: '2px solid var(--y2k-black)', boxShadow: '2px 2px 0 var(--y2k-black)' }}
                >
                  {isBackingUp ? '⏳ 백업 중...' : '🗃️ 백업 후 삭제'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 지출 수정 모달 */}
        {showExpenseEditModal && editingExpense && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="y2k-win95 max-w-2xl w-full max-h-[90vh] flex flex-col">
              <div className="y2k-win95-bar flex-shrink-0">
                <span className="font-pixel text-[11px] text-white">✏️ 지출 수정.exe</span>
                <div className="flex gap-1">
                  <div className="y2k-win95-btn">_</div><div className="y2k-win95-btn">□</div>
                  <div className="y2k-win95-btn" onClick={() => { setShowExpenseEditModal(false); setEditingExpense(null); }}>✕</div>
                </div>
              </div>
              <div className="bg-white overflow-y-auto p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-pixel text-[11px] text-[var(--y2k-t2)] block mb-1">지출 내용</label>
                    <input type="text" value={expenseEditForm.title} onChange={e => setExpenseEditForm(prev => ({ ...prev, title: e.target.value }))} disabled={isUpdatingExpense} className="y2k-input disabled:opacity-50" />
                  </div>
                  <div>
                    <label className="font-pixel text-[11px] text-[var(--y2k-t2)] block mb-1">지출 금액</label>
                    <input type="number" value={expenseEditForm.amount} onChange={e => setExpenseEditForm(prev => ({ ...prev, amount: e.target.value }))} disabled={isUpdatingExpense} className="y2k-input disabled:opacity-50" />
                  </div>
                  <div>
                    <label className="font-pixel text-[11px] text-[var(--y2k-t2)] block mb-1">결제자</label>
                    <select value={expenseEditForm.payerId} onChange={e => setExpenseEditForm(prev => ({ ...prev, payerId: e.target.value }))} disabled={isUpdatingExpense} className="y2k-input disabled:opacity-50">
                      {group?.members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="font-pixel text-[11px] text-[var(--y2k-t2)] block mb-1">지출 날짜</label>
                    <input type="date" value={expenseEditForm.date} onChange={e => setExpenseEditForm(prev => ({ ...prev, date: e.target.value }))} disabled={isUpdatingExpense} className="y2k-input disabled:opacity-50" />
                  </div>
                </div>
                <div>
                  <label className="font-pixel text-[11px] text-[var(--y2k-t2)] block mb-2">참여자 선택</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {group?.members.map(member => (
                      <label key={member.id} className="flex items-center gap-2 p-2 rounded-lg cursor-pointer" style={{ border: expenseEditForm.participants.includes(member.id) ? '2px solid var(--y2k-pink)' : '2px solid var(--y2k-muted)', background: expenseEditForm.participants.includes(member.id) ? 'var(--y2k-pink-l)' : 'var(--y2k-cream)' }}>
                        <input type="checkbox" checked={expenseEditForm.participants.includes(member.id)} onChange={() => toggleExpenseParticipant(member.id)} disabled={isUpdatingExpense} className="w-4 h-4" />
                        <div className="w-6 h-6 rounded-full text-white text-[9px] font-bold flex items-center justify-center" style={{ backgroundColor: member.color }}>{member.name.charAt(0)}</div>
                        <span className="text-[10px] font-medium text-[var(--y2k-black)]">{member.name}</span>
                      </label>
                    ))}
                  </div>
                  {expenseEditForm.participants.length > 0 && (
                    <p className="text-[10px] text-[var(--y2k-t2)] mt-2">1인당: {expenseEditForm.amount ? Math.round(parseInt(expenseEditForm.amount) / expenseEditForm.participants.length).toLocaleString() : 0}원</p>
                  )}
                </div>
                <div className="flex gap-3 pt-3" style={{ borderTop: '2px dashed var(--y2k-muted)' }}>
                  <button onClick={updateExpenseInfo} disabled={isUpdatingExpense} className="y2k-btn flex-1 py-2.5 text-sm disabled:opacity-50">
                    {isUpdatingExpense ? '업데이트 중...' : '✦ 업데이트'}
                  </button>
                  <button onClick={() => { setShowExpenseEditModal(false); setEditingExpense(null); }} disabled={isUpdatingExpense} className="y2k-btn-out flex-1 py-2.5 text-sm disabled:opacity-50">취소</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============ 정산 탭 ============ */}
        {activeTab === "settlement" && (
          <div className="pt-4 space-y-4">
            {/* 내 정산 요약 — Win95 스타일 */}
            {currentMember && (
              <div className="y2k-win95">
                <div className="y2k-win95-bar">
                  <span className="font-pixel text-[11px] text-white">🖥 내 정산 요약.exe</span>
                  <div className="flex gap-1">
                    <div className="y2k-win95-btn">_</div><div className="y2k-win95-btn">□</div><div className="y2k-win95-btn">✕</div>
                  </div>
                </div>
                <div className="bg-white p-4">
                  {/* 크롬 배지 + 이름 */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="y2k-chrome-badge px-3 py-1 text-[10px] font-bold text-[var(--y2k-black)]">MY BILL</span>
                    <span className="font-pixel text-[13px] text-[var(--y2k-black)]">{currentMember.name}</span>
                    <span className="text-sm">✨</span>
                  </div>
                  <div className="mb-3" style={{ borderTop: '2px dashed var(--y2k-muted)' }}></div>

                  {toSend.length === 0 && toReceive.length === 0 ? (
                    <p className="text-center py-3 font-pixel text-[13px] y2k-glow-lime">✅ 정산 완료!</p>
                  ) : (
                    <>
                      {toSend.length > 0 && (
                        <div className="mb-3">
                          <p className="font-pixel text-[11px] text-[var(--y2k-t3)] mb-2">💸 보내야 할 돈</p>
                          <div className="space-y-1.5">
                            {toSend.map((s, i) => {
                              const toMember = group.members.find(m => m.id === s.to);
                              return (
                                <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: 'var(--y2k-pink-l)', border: '1.5px solid var(--y2k-pink-b)' }}>
                                  <span className="text-[10px] text-[var(--y2k-t1)]"><strong>{toMember?.name}</strong>에게</span>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold y2k-glow-pink text-sm">{s.amount.toLocaleString()}원</span>
                                    {toMember?.account && (
                                      <button onClick={() => copyAccount(toMember.account)} className="y2k-chrome-badge px-2 py-0.5 text-[9px] font-bold cursor-pointer">계좌복사</button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {toReceive.length > 0 && (
                        <div className="mb-3">
                          <p className="font-pixel text-[11px] text-[var(--y2k-t3)] mb-2">💰 받아야 할 돈</p>
                          <div className="space-y-1.5">
                            {toReceive.map((s, i) => {
                              const fromMember = group.members.find(m => m.id === s.from);
                              return (
                                <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg y2k-card-cream">
                                  <span className="text-[10px] text-[var(--y2k-t1)]"><strong>{fromMember?.name}</strong>에게서</span>
                                  <span className="font-bold text-sm" style={{ color: '#22C55E' }}>{s.amount.toLocaleString()}원</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      <div className="flex justify-between text-[10px] pt-2" style={{ borderTop: '2px dashed var(--y2k-muted)' }}>
                        <span className="text-[var(--y2k-t2)]">보낼 돈 <strong className="y2k-glow-pink">{totalSend.toLocaleString()}원</strong></span>
                        <span className="text-[var(--y2k-t2)]">받을 돈 <strong style={{ color: '#22C55E' }}>{totalReceive.toLocaleString()}원</strong></span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* 전체 정산 목록 */}
            <div>
              <div className="flex items-center gap-2 py-2 mb-3" style={{ borderTop: '2px dashed var(--y2k-muted)' }}>
                <p className="font-pixel text-[13px] text-[var(--y2k-t2)]">전체 정산 결과</p>
                <p className="text-[9px] text-[var(--y2k-t3)]">💡 프로필 클릭 → 계좌번호 확인</p>
              </div>

              {settlements.length === 0 ? (
                <div className="y2k-card-cream p-8 text-center">
                  <p className="font-pixel text-[13px] text-[var(--y2k-t3)]">아직 정산할 내용이 없습니다</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {settlements.map((settlement, index) => {
                    const from = group.members.find(m => m.id === settlement.from);
                    const to = group.members.find(m => m.id === settlement.to);
                    const isMySettlement = currentMember && (settlement.from === myMemberId || settlement.to === myMemberId);
                    return (
                      <div key={index} className={isMySettlement ? "y2k-card-pink p-4" : "y2k-card p-4"}>
                        {isMySettlement && (
                          <div className="flex justify-end mb-2">
                            <span className="font-pixel text-[11px] text-white px-2 py-0.5 rounded" style={{ background: 'var(--y2k-pink)', border: '2px solid var(--y2k-black)', boxShadow: '2px 2px 0 var(--y2k-black)' }}>나포함</span>
                          </div>
                        )}
                        <div className="flex items-center justify-center gap-4 mb-3">
                          <div className="w-12 h-12 rounded-full text-white font-bold flex items-center justify-center cursor-pointer hover:scale-110 transition-transform" style={{ backgroundColor: from?.color, border: '2px solid var(--y2k-black)', boxShadow: '2px 2px 0 var(--y2k-black)' }} onClick={() => from && showMemberAccount(from)}>
                            <span className="text-base">{from?.name.charAt(0)}</span>
                          </div>
                          <span className="font-pixel text-[16px] y2k-glow-pink">→</span>
                          <div className="w-12 h-12 rounded-full text-white font-bold flex items-center justify-center cursor-pointer hover:scale-110 transition-transform" style={{ backgroundColor: to?.color, border: '2px solid var(--y2k-black)', boxShadow: '2px 2px 0 var(--y2k-black)' }} onClick={() => to && showMemberAccount(to)}>
                            <span className="text-base">{to?.name.charAt(0)}</span>
                          </div>
                        </div>
                        <div className="text-center mb-3">
                          <p className="text-[11px] text-[var(--y2k-t1)] mb-1"><strong>{from?.name}</strong>이 <strong>{to?.name}</strong>에게</p>
                          <p className="font-pixel text-[18px] y2k-glow-pink">{settlement.amount.toLocaleString()}원</p>
                        </div>
                        <button onClick={() => copySettlementMessage(from!, to!, settlement.amount)} className="y2k-btn w-full py-2 text-[11px]">
                          📋 송금 정보 복사
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 계좌 정보 모달 */}
        {showAccountModal && selectedMember && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
            <div className="y2k-card max-w-sm w-full p-5">
              <div className="text-center">
                <div className="w-14 h-14 rounded-full text-white text-xl font-bold flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: selectedMember.color, border: '2px solid var(--y2k-black)', boxShadow: '2px 2px 0 var(--y2k-black)' }}>
                  {selectedMember.name.charAt(0)}
                </div>
                <p className="font-pixel text-[16px] text-[var(--y2k-black)] mb-3">
                  {selectedMember.name}
                  {currentMember?.id === selectedMember.id && <span className="ml-2 y2k-glow-pink text-[10px]">(나)</span>}
                </p>
                <div className="y2k-card-cream p-3 mb-3 text-left">
                  <p className="font-pixel text-[11px] text-[var(--y2k-t3)] mb-1">전화번호</p>
                  <p className="text-[11px] text-[var(--y2k-t1)] mb-3">{selectedMember.phone}</p>
                  <p className="font-pixel text-[11px] text-[var(--y2k-t3)] mb-1">계좌번호</p>
                  <div className="overflow-x-auto rounded p-2" style={{ background: 'white', border: '1px solid var(--y2k-muted)' }}>
                    <p className="font-mono text-[11px] text-[var(--y2k-t1)] whitespace-nowrap">{selectedMember.account}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <button onClick={() => copyAccount(selectedMember.account)} className="y2k-btn w-full py-2 text-sm">계좌번호 복사</button>
                  <button onClick={() => openEditModal(selectedMember)} className="y2k-btn-out w-full py-2 text-sm">✏️ 정보 수정</button>
                  {group.members.length > 1 && (
                    <button onClick={() => openMemberDeleteModal(selectedMember)} className="w-full py-2 text-sm font-bold rounded-full" style={{ background: '#FFE0CC', border: '2px solid var(--y2k-black)', boxShadow: '2px 2px 0 var(--y2k-black)' }}>🗑️ 그룹에서 제외</button>
                  )}
                  <button onClick={() => setShowAccountModal(false)} className="y2k-btn-out w-full py-2 text-sm">닫기</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 멤버 편집 모달 */}
        {showEditModal && editingMember && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
            <div className="y2k-win95 max-w-md w-full">
              <div className="y2k-win95-bar">
                <span className="font-pixel text-[11px] text-white">✏️ 정보 수정.exe</span>
                <div className="flex gap-1">
                  <div className="y2k-win95-btn">_</div><div className="y2k-win95-btn">□</div>
                  <div className="y2k-win95-btn" onClick={() => { setShowEditModal(false); setEditingMember(null); }}>✕</div>
                </div>
              </div>
              <div className="bg-white p-5 space-y-3">
                <div className="text-center mb-2">
                  <div className="w-12 h-12 rounded-full text-white text-lg font-bold flex items-center justify-center mx-auto mb-2" style={{ backgroundColor: editingMember.color, border: '2px solid var(--y2k-black)' }}>{editingMember.name.charAt(0)}</div>
                  <p className="font-pixel text-[13px] text-[var(--y2k-black)]">{editingMember.name} 정보 수정</p>
                </div>
                <div>
                  <label className="font-pixel text-[11px] text-[var(--y2k-t2)] block mb-1">이름</label>
                  <input type="text" value={editForm.name} onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))} disabled={isUpdating} className="y2k-input disabled:opacity-50" />
                </div>
                <div>
                  <label className="font-pixel text-[11px] text-[var(--y2k-t2)] block mb-1">전화번호</label>
                  <input type="tel" value={editForm.phone} onChange={e => setEditForm(prev => ({ ...prev, phone: e.target.value }))} disabled={isUpdating} className="y2k-input disabled:opacity-50" />
                </div>
                <div>
                  <label className="font-pixel text-[11px] text-[var(--y2k-t2)] block mb-1">계좌번호</label>
                  <div className="relative">
                    <input type="text" value={editForm.account} onChange={e => setEditForm(prev => ({ ...prev, account: e.target.value }))} placeholder="은행명 계좌번호" disabled={isUpdating} className="y2k-input pr-10 disabled:opacity-50" />
                    <button type="button" onClick={() => { if (editForm.account) { navigator.clipboard.writeText(editForm.account); alert("계좌번호가 복사되었습니다!"); } }} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--y2k-t3)] hover:text-[var(--y2k-pink)]">📋</button>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={updateMemberInfo} disabled={isUpdating} className="y2k-btn flex-1 py-2.5 text-sm disabled:opacity-50">
                    {isUpdating ? (
                      <span className="flex items-center justify-center gap-2"><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--y2k-black)]"></div>업데이트 중...</span>
                    ) : '✦ 업데이트'}
                  </button>
                  <button onClick={() => { setShowEditModal(false); setEditingMember(null); }} disabled={isUpdating} className="y2k-btn-out flex-1 py-2.5 text-sm disabled:opacity-50">취소</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 멤버 삭제 모달 */}
        {showMemberDeleteModal && memberToDelete && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
            <div className="y2k-card max-w-md w-full p-5">
              <div className="text-center">
                <div className="text-5xl mb-3">⚠️</div>
                <p className="font-pixel text-[14px] text-[var(--y2k-black)] mb-4">멤버 제외 확인</p>
                <div className="w-14 h-14 rounded-full text-white text-xl font-bold flex items-center justify-center mx-auto mb-2" style={{ backgroundColor: memberToDelete.color, border: '2px solid var(--y2k-black)' }}>{memberToDelete.name.charAt(0)}</div>
                <p className="text-[11px] text-[var(--y2k-t2)] mb-4"><strong className="text-[var(--y2k-black)]">{memberToDelete.name}</strong>님을 그룹에서 제외하시겠습니까?</p>
                <div className="y2k-card-cream p-3 mb-4 text-left">
                  <p className="font-pixel text-[11px] text-[var(--y2k-pink)] mb-1">🚨 주의사항</p>
                  <p className="text-[9px] text-[var(--y2k-t2)] leading-relaxed">• 제외된 후에는 되돌릴 수 없습니다<br/>• 모든 지출 내역이 재계산됩니다</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => { setShowMemberDeleteModal(false); setMemberToDelete(null); }} disabled={isDeletingMember} className="y2k-btn-out flex-1 py-2.5 text-sm disabled:opacity-50">취소</button>
                  <button onClick={deleteMember} disabled={isDeletingMember} className="flex-1 py-2.5 text-sm font-bold rounded-full disabled:opacity-50" style={{ background: '#FF6B6B', border: '2px solid var(--y2k-black)', boxShadow: '2px 2px 0 var(--y2k-black)', color: 'white' }}>
                    {isDeletingMember ? (
                      <span className="flex items-center justify-center gap-2"><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>처리중...</span>
                    ) : '🗑️ 제외하기'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 임시 멤버 추가 모달 */}
        {showAddMemberModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
            <div className="y2k-win95 max-w-sm w-full">
              <div className="y2k-win95-bar">
                <span className="font-pixel text-[11px] text-white">👤 참여자 추가.exe</span>
                <div className="flex gap-1">
                  <div className="y2k-win95-btn">_</div><div className="y2k-win95-btn">□</div>
                  <div className="y2k-win95-btn" onClick={() => { setShowAddMemberModal(false); setNewMemberName(''); setNewMemberAccount(''); }}>✕</div>
                </div>
              </div>
              <div className="bg-white p-5 space-y-4">
                <p className="text-[10px] text-[var(--y2k-t2)] leading-relaxed">아직 초대 링크로 참여하지 않은 멤버를 임시로 추가합니다. 해당 멤버가 초대 링크로 입장하면 자동으로 연결됩니다.</p>
                <div>
                  <label className="font-pixel text-[11px] text-[var(--y2k-t2)] block mb-1">이름 *</label>
                  <input type="text" value={newMemberName} onChange={e => setNewMemberName(e.target.value)} placeholder="예: 홍길동" disabled={addMemberLoading} className="y2k-input disabled:opacity-50" />
                </div>
                <div>
                  <label className="font-pixel text-[11px] text-[var(--y2k-t2)] block mb-1">계좌번호 (선택)</label>
                  <input type="text" value={newMemberAccount} onChange={e => setNewMemberAccount(e.target.value)} placeholder="은행명 계좌번호" disabled={addMemberLoading} className="y2k-input disabled:opacity-50" />
                </div>
                <div className="flex gap-3 pt-1">
                  <button onClick={addProxyMember} disabled={addMemberLoading || !newMemberName.trim()} className="y2k-btn flex-1 py-2.5 text-sm disabled:opacity-50">
                    {addMemberLoading ? (
                      <span className="flex items-center justify-center gap-2"><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--y2k-black)]"></div>추가 중...</span>
                    ) : '✦ 추가하기'}
                  </button>
                  <button onClick={() => { setShowAddMemberModal(false); setNewMemberName(''); setNewMemberAccount(''); }} disabled={addMemberLoading} className="y2k-btn-out flex-1 py-2.5 text-sm disabled:opacity-50">취소</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 결제자 선택 모달 */}
        {showPayerSelectModal && memberToDelete && expensesNeedingNewPayer.length > 0 && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
            <div className="y2k-win95 max-w-2xl w-full max-h-[80vh] flex flex-col">
              <div className="y2k-win95-bar flex-shrink-0">
                <span className="font-pixel text-[11px] text-white">💳 새로운 결제자 선택.exe</span>
                <div className="flex gap-1"><div className="y2k-win95-btn">_</div><div className="y2k-win95-btn">□</div><div className="y2k-win95-btn">✕</div></div>
              </div>
              <div className="bg-white overflow-y-auto p-5">
                <p className="font-pixel text-[13px] text-[var(--y2k-black)] mb-1">새로운 결제자 선택</p>
                <p className="text-[10px] text-[var(--y2k-t2)] mb-4"><strong>{memberToDelete.name}</strong>님이 결제자였던 지출들의 새로운 결제자를 선택해주세요</p>
                <div className="space-y-4 mb-5">
                  {expensesNeedingNewPayer.map(expense => {
                    const available = group.members.filter(m => expense.participants.includes(m.id) && m.id !== memberToDelete.id);
                    return (
                      <div key={expense.id} className="y2k-card-cream p-4">
                        <div className="flex justify-between mb-3">
                          <div>
                            <p className="font-pixel text-[12px] text-[var(--y2k-black)]">{expense.title}</p>
                            <p className="text-[9px] text-[var(--y2k-t3)]">{expense.date}</p>
                          </div>
                          <p className="font-bold text-[var(--y2k-black)]">{expense.amount.toLocaleString()}원</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {available.map(member => (
                            <label key={member.id} className="flex items-center gap-2 p-2 rounded-lg cursor-pointer" style={{ border: payerSelections[expense.id] === member.id ? '2px solid var(--y2k-pink)' : '2px solid var(--y2k-muted)', background: payerSelections[expense.id] === member.id ? 'var(--y2k-pink-l)' : 'white' }}>
                              <input type="radio" name={`payer-${expense.id}`} value={member.id} checked={payerSelections[expense.id] === member.id} onChange={() => setPayerSelections(prev => ({ ...prev, [expense.id]: member.id }))} className="w-4 h-4" />
                              <div className="w-6 h-6 rounded-full text-white text-[9px] font-bold flex items-center justify-center" style={{ backgroundColor: member.color }}>{member.name.charAt(0)}</div>
                              <span className="text-[10px] font-medium text-[var(--y2k-black)]">{member.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => { setShowPayerSelectModal(false); setShowMemberDeleteModal(true); setExpensesNeedingNewPayer([]); setPayerSelections({}); }} disabled={isDeletingMember} className="y2k-btn-out flex-1 py-2.5 text-sm disabled:opacity-50">취소</button>
                  <button onClick={proceedWithMemberDeletion} disabled={isDeletingMember || Object.keys(payerSelections).length !== expensesNeedingNewPayer.length} className="y2k-btn flex-1 py-2.5 text-sm disabled:opacity-50">
                    {isDeletingMember ? (
                      <span className="flex items-center justify-center gap-2"><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--y2k-black)]"></div>처리중...</span>
                    ) : '✅ 확인 후 멤버 제외'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
