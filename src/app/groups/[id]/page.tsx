"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/firebase";
import {
  doc,
  getDoc,
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
  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    account: "",
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);

  // ✅ 세션 관리 관련 state
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
    title: "",
    amount: "",
    payerId: "",
    participants: [] as number[],
    date: "",
  });
  const [isUpdatingExpense, setIsUpdatingExpense] = useState(false);

  // 지출 입력 폼 상태
  const [expenseForm, setExpenseForm] = useState({
    title: "",
    amount: "",
    payerId: "",
    participants: [] as number[],
    date: new Date().toISOString().split("T")[0],
  });

  // ✅ 멤버 선택 및 저장
  const selectAndSaveMember = () => {
    if (!group || selectedMemberId === null) return;
    
    const member = group.members.find(m => m.id === selectedMemberId);
    if (!member) {
      alert('선택한 멤버를 찾을 수 없습니다.');
      return;
    }
    
    saveMemberSession(group.id, member.id, member.name);
    setCurrentMember(member);
    setShowMemberSelectModal(false);
    setSelectedMemberId(null);
  };

  // ✅ 로그아웃 (멤버 전환)
  const handleLogout = () => {
    if (!group) return;
    
    const confirmLogout = window.confirm('다른 멤버로 전환하시겠습니까?');
    if (!confirmLogout) return;
    
    clearMemberSession(group.id);
    setCurrentMember(null);
    setShowMemberSelectModal(true);
  };

  // Firebase에서 그룹 데이터 실시간 구독
  useEffect(() => {
    if (!params.id) return;

    console.log("🔥 Firebase에서 그룹 데이터 로딩...", params.id);

    const unsubscribe = onSnapshot(
      doc(db, "groups", params.id as string),
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data();
          const groupData = {
            id: docSnapshot.id,
            ...data,
          } as Group;

          console.log("✅ 그룹 데이터 로딩 성공:", groupData);
          setGroup(groupData);

          // ✅ 세션 확인
          const session = getMemberSession(groupData.id);
          if (session) {
            const member = groupData.members.find(m => m.id === session.memberId);
            if (member) {
              setCurrentMember(member);
              console.log('✅ 기존 세션으로 자동 로그인:', member.name);
            } else {
              // 멤버가 그룹에서 제거됨
              clearMemberSession(groupData.id);
              setCurrentMember(null);
              setShowMemberSelectModal(true);
            }
          } else {
            // 세션이 없으면 멤버 선택 모달 표시
            setShowMemberSelectModal(true);
          }
        } else {
          console.error("❌ 그룹을 찾을 수 없습니다:", params.id);
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

    if (group.members.length <= 1) {
      alert("❌ 그룹에는 최소 1명의 멤버가 있어야 합니다.");
      return;
    }

    const expensesWhereDeletedMemberIsPayer = group.expenses.filter(
      (expense) => expense.payerId === memberToDelete.id
    );

    if (expensesWhereDeletedMemberIsPayer.length > 0) {
      const validExpensesForPayerSelection = expensesWhereDeletedMemberIsPayer
        .map((expense) => ({
          ...expense,
          participants: expense.participants.filter((id) => id !== memberToDelete.id),
        }))
        .filter((expense) => expense.participants.length > 0);

      if (validExpensesForPayerSelection.length > 0) {
        setExpensesNeedingNewPayer(validExpensesForPayerSelection);

        const defaultSelections: { [expenseId: number]: number } = {};
        validExpensesForPayerSelection.forEach((expense) => {
          defaultSelections[expense.id] = expense.participants[0];
        });
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
      console.log("🗑️ 멤버 삭제 시작:", memberToDelete.name);

      let updatedExpenses = [...group.expenses];

      if (expensesNeedingNewPayer.length > 0) {
        updatedExpenses = updatedExpenses
          .map((expense) => {
            if (payerSelections[expense.id] !== undefined) {
              const remainingParticipants = expense.participants.filter(
                (id) => id !== memberToDelete.id
              );

              return {
                ...expense,
                payerId: payerSelections[expense.id],
                participants: remainingParticipants,
                perPersonAmount: Math.round(expense.amount / remainingParticipants.length),
              };
            }

            if (expense.participants.includes(memberToDelete.id)) {
              const remainingParticipants = expense.participants.filter(
                (id) => id !== memberToDelete.id
              );

              if (remainingParticipants.length === 0) {
                return null;
              }

              return {
                ...expense,
                participants: remainingParticipants,
                perPersonAmount: Math.round(expense.amount / remainingParticipants.length),
              };
            }

            return expense;
          })
          .filter((expense) => expense !== null);

        updatedExpenses = updatedExpenses.map((expense, index) => ({
          ...expense!,
          id: index,
        }));
      } else {
        updatedExpenses = group.expenses
          .map((expense) => {
            if (expense.participants.includes(memberToDelete.id)) {
              const remainingParticipants = expense.participants.filter(
                (id) => id !== memberToDelete.id
              );

              if (remainingParticipants.length === 0) {
                return null;
              }

              return {
                ...expense,
                participants: remainingParticipants,
                perPersonAmount: Math.round(expense.amount / remainingParticipants.length),
              };
            }

            return expense;
          })
          .filter((expense) => expense !== null);

        updatedExpenses = updatedExpenses.map((expense, index) => ({
          ...expense!,
          id: index,
        }));
      }

      const updatedMembers = group.members.filter((member) => member.id !== memberToDelete.id);
      const reindexedMembers = updatedMembers.map((member, index) => ({
        ...member,
        id: index,
      }));

      const finalExpenses = updatedExpenses.map((expense) => {
        const newPayerId = reindexedMembers.findIndex(
          (m) =>
            updatedMembers.find((um) => um.id === expense.payerId)?.name === m.name
        );

        const newParticipants = expense.participants
          .map((participantId) =>
            reindexedMembers.findIndex(
              (m) =>
                updatedMembers.find((um) => um.id === participantId)?.name === m.name
            )
          )
          .filter((id) => id !== -1);

        return {
          ...expense,
          payerId: newPayerId,
          participants: newParticipants,
        };
      });

      console.log("🔥 Firebase에 업데이트된 데이터 저장 중...");

      await updateDoc(doc(db, "groups", params.id as string), {
        members: reindexedMembers,
        expenses: finalExpenses,
        lastUpdated: new Date(),
      });

      console.log("✅ 멤버 삭제 및 지출 재계산 완료!");

      // ✅ 삭제된 멤버가 현재 로그인한 멤버라면 세션 초기화
      if (currentMember?.id === memberToDelete.id) {
        clearMemberSession(group.id);
        setCurrentMember(null);
        setShowMemberSelectModal(true);
      }

      alert(
        `🗑️ ${memberToDelete.name}님이 그룹에서 제외되었습니다.\n관련된 지출 내역도 자동으로 재계산되었습니다.`
      );

      setShowMemberDeleteModal(false);
      setShowPayerSelectModal(false);
      setMemberToDelete(null);
      setExpensesNeedingNewPayer([]);
      setPayerSelections({});
    } catch (error) {
      console.error("❌ 멤버 삭제 실패:", error);
      alert("멤버 삭제 중 오류가 발생했습니다.");
    } finally {
      setIsDeletingMember(false);
    }
  };

  const addExpense = async () => {
    if (!group) return;

    const title = expenseForm.title;
    const amount = parseInt(expenseForm.amount);
    const payerId = parseInt(expenseForm.payerId);
    const participants = expenseForm.participants;
    const date = expenseForm.date;

    if (!title || !amount || isNaN(payerId) || participants.length === 0) {
      alert("모든 필드를 입력해주세요.");
      return;
    }

    setIsAddingExpense(true);

    try {
      const newExpense: Expense = {
        id: group.expenses.length,
        title,
        amount,
        payerId,
        participants,
        date,
        perPersonAmount: Math.round(amount / participants.length),
      };

      console.log("🔥 Firebase에 지출 추가 중...", newExpense);

      await updateDoc(doc(db, "groups", params.id as string), {
        expenses: [...group.expenses, newExpense],
        lastUpdated: new Date(),
      });

      console.log("✅ 지출 추가 성공!");

      setExpenseForm({
        title: "",
        amount: "",
        payerId: "",
        participants: [],
        date: new Date().toISOString().split("T")[0],
      });
    } catch (error) {
      console.error("❌ 지출 추가 실패:", error);
      alert("지출 추가 중 오류가 발생했습니다.");
    } finally {
      setIsAddingExpense(false);
    }
  };

  const toggleParticipant = (memberId: number) => {
    setExpenseForm((prev) => ({
      ...prev,
      participants: prev.participants.includes(memberId)
        ? prev.participants.filter((id) => id !== memberId)
        : [...prev.participants, memberId],
    }));
  };

  const showMemberAccount = (member: Member) => {
    setSelectedMember(member);
    setShowAccountModal(true);
  };

  const openEditModal = (member: Member) => {
    setEditingMember(member);
    setEditForm({
      name: member.name,
      phone: member.phone,
      account: member.account,
    });
    setShowEditModal(true);
    setShowAccountModal(false);
  };

  const updateMemberInfo = async () => {
    if (!group || !editingMember) return;

    const { name, phone, account } = editForm;

    if (!name.trim() || !phone.trim() || !account.trim()) {
      alert("모든 필드를 입력해주세요.");
      return;
    }

    const duplicateMember = group.members.find(
      (m) =>
        m.id !== editingMember.id &&
        (m.name.toLowerCase() === name.toLowerCase().trim() || m.phone === phone.trim())
    );

    if (duplicateMember) {
      alert("이미 존재하는 이름 또는 전화번호입니다.");
      return;
    }

    setIsUpdating(true);

    try {
      const updatedMembers = group.members.map((member) =>
        member.id === editingMember.id
          ? {
              ...member,
              name: name.trim(),
              phone: phone.trim(),
              account: account.trim(),
            }
          : member
      );

      console.log("🔥 Firebase에 멤버 정보 업데이트 중...", editForm);

      await updateDoc(doc(db, "groups", params.id as string), {
        members: updatedMembers,
        lastUpdated: new Date(),
      });

      console.log("✅ 멤버 정보 업데이트 성공!");

      // ✅ 현재 로그인한 멤버의 정보를 수정한 경우 세션도 업데이트
      if (currentMember?.id === editingMember.id) {
        saveMemberSession(group.id, editingMember.id, name.trim());
      }

      alert("💫 정보가 성공적으로 업데이트되었습니다!");

      setShowEditModal(false);
      setEditingMember(null);
    } catch (error) {
      console.error("❌ 멤버 정보 업데이트 실패:", error);
      alert("정보 업데이트 중 오류가 발생했습니다.");
    } finally {
      setIsUpdating(false);
    }
  };

  const downloadExcel = async () => {
    if (!group) return;

    setIsDownloading(true);
    try {
      console.log("📊 엑셀 다운로드 시작...");

      const excelGroup: ExcelGroup = {
        id: group.id,
        name: group.name,
        description: group.description,
        members: group.members,
        expenses: group.expenses,
        createdAt: group.createdAt,
      };

      const success = downloadGroupAsExcel(excelGroup);

      if (success) {
        alert("📊 정산 내역이 엑셀 파일로 다운로드되었습니다!");
      } else {
        alert("엑셀 다운로드 중 오류가 발생했습니다.");
      }
    } catch (error) {
      console.error("❌ 엑셀 다운로드 실패:", error);
      alert("엑셀 다운로드 중 오류가 발생했습니다.");
    } finally {
      setIsDownloading(false);
    }
  };

  const backupAndDelete = async () => {
    if (!group) return;

    setIsBackingUp(true);
    try {
      console.log("🗃️ 백업 후 삭제 시작...");

      const excelGroup: ExcelGroup = {
        id: group.id,
        name: group.name,
        description: group.description,
        members: group.members,
        expenses: group.expenses,
        createdAt: group.createdAt,
      };

      const backupSuccess = downloadGroupAsExcel(excelGroup);

      if (!backupSuccess) {
        alert("백업 실패로 삭제가 취소되었습니다.");
        return;
      }

      const confirmDelete = confirm(
        `⚠️ 정말로 "${group.name}" 그룹을 삭제하시겠습니까?\n\n` +
          `✅ 엑셀 백업이 완료되었습니다.\n` +
          `❌ 삭제 후에는 복구할 수 없습니다.\n\n` +
          `삭제하시려면 "확인"을 클릭하세요.`
      );

      if (!confirmDelete) {
        return;
      }

      await deleteDoc(doc(db, "groups", params.id as string));

      alert("🗑️ 그룹이 성공적으로 삭제되었습니다!\n엑셀 백업 파일을 확인해주세요.");

      router.push("/");
    } catch (error) {
      console.error("❌ 백업 후 삭제 실패:", error);
      alert("삭제 중 오류가 발생했습니다.");
    } finally {
      setIsBackingUp(false);
    }
  };

  const openExpenseEditModal = (expense: Expense) => {
    setEditingExpense(expense);
    setExpenseEditForm({
      title: expense.title,
      amount: expense.amount.toString(),
      payerId: expense.payerId.toString(),
      participants: [...expense.participants],
      date: expense.date,
    });
    setShowExpenseEditModal(true);
  };

  const updateExpenseInfo = async () => {
    if (!group || !editingExpense) return;

    const { title, amount, payerId, participants, date } = expenseEditForm;
    const numAmount = parseInt(amount);
    const numPayerId = parseInt(payerId);

    if (!title.trim() || !numAmount || isNaN(numPayerId) || participants.length === 0) {
      alert("모든 필드를 올바르게 입력해주세요.");
      return;
    }

    setIsUpdatingExpense(true);

    try {
      const updatedExpenses = group.expenses.map((expense) =>
        expense.id === editingExpense.id
          ? {
              ...expense,
              title: title.trim(),
              amount: numAmount,
              payerId: numPayerId,
              participants,
              date,
              perPersonAmount: Math.round(numAmount / participants.length),
            }
          : expense
      );

      console.log("🔥 Firebase에 지출 정보 업데이트 중...", expenseEditForm);

      await updateDoc(doc(db, "groups", params.id as string), {
        expenses: updatedExpenses,
        lastUpdated: new Date(),
      });

      console.log("✅ 지출 정보 업데이트 성공!");

      alert("💫 지출 내역이 성공적으로 업데이트되었습니다!");

      setShowExpenseEditModal(false);
      setEditingExpense(null);
    } catch (error) {
      console.error("❌ 지출 정보 업데이트 실패:", error);
      alert("지출 정보 업데이트 중 오류가 발생했습니다.");
    } finally {
      setIsUpdatingExpense(false);
    }
  };

  const deleteExpense = async (expenseId: number) => {
    if (!group) return;

    const confirmDelete = confirm(
      "⚠️ 정말로 이 지출 내역을 삭제하시겠습니까?\n삭제 후에는 복구할 수 없습니다."
    );

    if (!confirmDelete) return;

    try {
      const updatedExpenses = group.expenses.filter((expense) => expense.id !== expenseId);

      const reindexedExpenses = updatedExpenses.map((expense, index) => ({
        ...expense,
        id: index,
      }));

      console.log("🗑️ Firebase에서 지출 삭제 중...", expenseId);

      await updateDoc(doc(db, "groups", params.id as string), {
        expenses: reindexedExpenses,
        lastUpdated: new Date(),
      });

      console.log("✅ 지출 삭제 성공!");
      alert("🗑️ 지출 내역이 삭제되었습니다.");
    } catch (error) {
      console.error("❌ 지출 삭제 실패:", error);
      alert("지출 삭제 중 오류가 발생했습니다.");
    }
  };

  const toggleExpenseParticipant = (memberId: number) => {
    setExpenseEditForm((prev) => ({
      ...prev,
      participants: prev.participants.includes(memberId)
        ? prev.participants.filter((id) => id !== memberId)
        : [...prev.participants, memberId],
    }));
  };

  const copyInviteLink = async (inviteLink: string) => {
    try {
      const inviteMessage = `정산해bar에서 정산 초대 코드를 보냈어요! 🔥

아래 링크에 참여해서 함께 정산해보세요!

${inviteLink}

📱 모바일에서도 쉽게 사용할 수 있어요!`;

      await navigator.clipboard.writeText(inviteMessage);
      alert("🎉 초대 메시지가 클립보드에 복사되었습니다!\n친구들에게 공유해보세요!");
    } catch (error) {
      console.error("클립보드 복사 실패:", error);
      const inviteMessage = `정산해bar에서 정산 초대 코드를 보냈어요! 🔥

아래 링크에 참여해서 함께 정산해보세요!

${inviteLink}

📱 모바일에서도 쉽게 사용할 수 있어요!`;

      prompt("아래 메시지를 복사해서 친구들에게 공유하세요:", inviteMessage);
    }
  };

  const copyAccount = (account: string) => {
    navigator.clipboard.writeText(account).then(() => {
      alert("계좌번호가 복사되었습니다!");
    });
  };

  const copySettlementMessage = (from: Member, to: Member, amount: number) => {
    const message = `${from.name}이 ${to.name}한테 ${amount.toLocaleString()}원을 보내줘야 합니다.

${to.account}`;

    navigator.clipboard
      .writeText(message)
      .then(() => {
        alert("💸 정보가 복사되었습니다!\n정보를 확인해 보세요!");
      })
      .catch(() => {
        prompt("아래 메시지를 복사해서 보내세요:", message);
      });
  };

  // 로딩 중
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto mb-4"></div>
          <div className="text-warm-dark text-xl">🔥 Firebase에서 데이터 로딩 중...</div>
        </div>
      </div>
    );
  }

  // 그룹이 없는 경우
  if (!group) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-warm-dark text-xl mb-4">❌ 그룹을 찾을 수 없습니다</div>
          <Link href="/" className="text-pink-500 hover:text-pink-600">
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  const settlements = calculateSettlement(group.expenses, group.members);

  return (
    <div className="min-h-screen py-8 px-4">
      {/* ✅ 멤버 선택 모달 - 최우선 표시 */}
      {showMemberSelectModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] px-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="text-center mb-6">
              <div className="text-4xl mb-3">👤</div>
              <h3 className="text-xl font-bold text-warm-dark mb-2">누구로 보시나요?</h3>
              <p className="text-warm-gray text-sm">
                그룹 멤버 중 본인을 선택해주세요
              </p>
            </div>

            <div className="space-y-3 mb-6">
              {group.members.map((member) => (
                <label
                  key={member.id}
                  className={`flex items-center gap-4 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    selectedMemberId === member.id
                      ? "border-pink-400 bg-pink-50"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="member-select"
                    value={member.id}
                    checked={selectedMemberId === member.id}
                    onChange={() => setSelectedMemberId(member.id)}
                    className="w-5 h-5 text-pink-500"
                  />
                  <div
                    className="w-12 h-12 rounded-full text-white text-lg font-bold flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: member.color }}
                  >
                    {member.name.charAt(0)}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-semibold text-warm-dark">{member.name}</div>
                    <div className="text-sm text-warm-gray">{member.phone}</div>
                  </div>
                </label>
              ))}
            </div>

            <button
              onClick={selectAndSaveMember}
              disabled={selectedMemberId === null}
              className="w-full py-3 bg-gradient-to-r from-pink-400 to-pink-500 hover:from-pink-500 hover:to-pink-600 text-white rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              선택 완료
            </button>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <Link
            href="/"
            className="inline-flex items-center text-warm-gray hover:text-warm-dark mb-4 text-sm transition-colors"
          >
            ← 홈으로 돌아가기
          </Link>
          <h1 className="text-4xl font-bold text-warm-dark mb-2">🔥 {group.name}</h1>
          <p className="text-warm-gray mb-4">{group.description}</p>

          {/* ✅ 현재 사용자 표시 */}
          {currentMember && (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg mb-4">
              <div
                className="w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center"
                style={{ backgroundColor: currentMember.color }}
              >
                {currentMember.name.charAt(0)}
              </div>
              <span className="text-blue-800 font-medium">{currentMember.name}님</span>
              <button
                onClick={handleLogout}
                className="text-xs text-blue-600 hover:text-blue-800 underline ml-2"
              >
                전환
              </button>
            </div>
          )}

          {/* 초대 링크 섹션 */}
          <div className="bg-white/15 backdrop-blur-sm rounded-xl p-4 border border-white/30 mb-6 max-w-md mx-auto">
            <div className="text-sm text-warm-gray mb-2">🔗 초대 링크</div>
            <div className="flex items-center gap-3">
              <div className="flex-1 px-3 py-2 bg-white/20 rounded-lg text-warm-dark text-sm font-mono">
                {group.inviteCode}
              </div>
              <button
                onClick={() => copyInviteLink(group.inviteLink)}
                className="px-4 py-2 bg-gradient-to-r from-pink-400 to-pink-500 hover:from-pink-500 hover:to-pink-600 text-white rounded-lg font-semibold text-sm transition-all transform hover:scale-105"
              >
                복사
              </button>
            </div>
            <div className="text-xs text-warm-gray mt-2">
              친구들에게 이 링크를 공유해서 그룹에 초대하세요!
            </div>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {group.members.map((member) => (
            <div key={member.id} className="group relative">
              <div className="flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full border border-white/30">
                <div
                  className="w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center cursor-pointer"
                  style={{ backgroundColor: member.color }}
                  onClick={() => showMemberAccount(member)}
                >
                  {member.name.charAt(0)}
                </div>
                <span className="text-warm-dark text-sm">{member.name}</span>

                {group.members.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openMemberDeleteModal(member);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full text-xs font-bold flex items-center justify-center"
                    title={`${member.name} 제외하기`}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* 탭 네비게이션 */}
        <div className="mb-8">
          <div className="flex bg-white/20 rounded-xl p-1 border border-white/30">
            <button
              onClick={() => setActiveTab("expenses")}
              className={`flex-1 py-3 px-6 rounded-lg font-semibold transition-all ${
                activeTab === "expenses"
                  ? "bg-gradient-to-r from-pink-400 to-pink-500 text-white shadow-lg"
                  : "text-warm-dark hover:bg-white/20"
              }`}
            >
              지출 입력
            </button>
            <button
              onClick={() => setActiveTab("settlement")}
              className={`flex-1 py-3 px-6 rounded-lg font-semibold transition-all ${
                activeTab === "settlement"
                  ? "bg-gradient-to-r from-pink-400 to-pink-500 text-white shadow-lg"
                  : "text-warm-dark hover:bg-white/20"
              }`}
            >
              정산 결과 ({settlements.length})
            </button>
          </div>
        </div>

        {/* 액션 버튼들 */}
        <div className="mb-8 flex gap-3 justify-center flex-wrap">
          <button
            onClick={downloadExcel}
            disabled={isDownloading}
            className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center gap-2"
          >
            {isDownloading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                다운로드 중...
              </>
            ) : (
              <>📊 엑셀 다운로드</>
            )}
          </button>

          <button
            onClick={backupAndDelete}
            disabled={isBackingUp}
            className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center gap-2"
          >
            {isBackingUp ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                백업 중...
              </>
            ) : (
              <>🗃️ 백업 후 삭제</>
            )}
          </button>
        </div>

        {/* 탭 내용 */}
        {activeTab === "expenses" && (
          <div>
            {/* 지출 입력 폼 */}
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-6 border border-white/30 shadow-xl mb-8">
              <h3 className="text-xl font-bold text-warm-dark mb-6">
                🔥 새 지출 추가 (실시간 동기화)
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-warm-dark font-semibold mb-2">지출 내용</label>
                  <input
                    type="text"
                    value={expenseForm.title}
                    onChange={(e) =>
                      setExpenseForm((prev) => ({
                        ...prev,
                        title: e.target.value,
                      }))
                    }
                    placeholder="예: 숙박비"
                    disabled={isAddingExpense}
                    className="w-full px-4 py-3 border-2 border-white/30 rounded-lg bg-white/90 focus:border-pink-400 focus:outline-none transition-colors text-warm-dark disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-warm-dark font-semibold mb-2">지출 금액</label>
                  <input
                    type="number"
                    value={expenseForm.amount}
                    onChange={(e) =>
                      setExpenseForm((prev) => ({
                        ...prev,
                        amount: e.target.value,
                      }))
                    }
                    placeholder="0"
                    disabled={isAddingExpense}
                    className="w-full px-4 py-3 border-2 border-white/30 rounded-lg bg-white/90 focus:border-pink-400 focus:outline-none transition-colors text-warm-dark disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-warm-dark font-semibold mb-2">결제자</label>
                  <select
                    value={expenseForm.payerId}
                    onChange={(e) =>
                      setExpenseForm((prev) => ({
                        ...prev,
                        payerId: e.target.value,
                      }))
                    }
                    disabled={isAddingExpense}
                    className="w-full px-4 py-3 border-2 border-white/30 rounded-lg bg-white/90 focus:border-pink-400 focus:outline-none transition-colors text-warm-dark disabled:opacity-50"
                  >
                    <option value="">결제자를 선택하세요</option>
                    {group.members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-warm-dark font-semibold mb-2">지출 날짜</label>
                  <input
                    type="date"
                    value={expenseForm.date}
                    onChange={(e) =>
                      setExpenseForm((prev) => ({
                        ...prev,
                        date: e.target.value,
                      }))
                    }
                    disabled={isAddingExpense}
                    className="w-full px-4 py-3 border-2 border-white/30 rounded-lg bg-white/90 focus:border-pink-400 focus:outline-none transition-colors text-warm-dark disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-warm-dark font-semibold mb-4">참여자 선택</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {group.members.map((member) => (
                    <label
                      key={member.id}
                      className="flex items-center gap-3 p-3 bg-white/10 rounded-lg border border-white/20 cursor-pointer hover:bg-white/20 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={expenseForm.participants.includes(member.id)}
                        onChange={() => toggleParticipant(member.id)}
                        disabled={isAddingExpense}
                        className="w-5 h-5 text-pink-500"
                      />
                      <div
                        className="w-8 h-8 rounded-full text-white text-xs font-bold flex items-center justify-center"
                        style={{ backgroundColor: member.color }}
                      >
                        {member.name.charAt(0)}
                      </div>
                      <span className="text-warm-dark font-medium">{member.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                onClick={addExpense}
                disabled={isAddingExpense}
                className="w-full py-3 bg-gradient-to-r from-pink-400 to-pink-500 hover:from-pink-500 hover:to-pink-600 text-white rounded-xl font-bold text-lg transition-all transform hover:scale-[1.02] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isAddingExpense ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Firebase에 저장 중...
                  </span>
                ) : (
                  "🔥 지출 추가하기"
                )}
              </button>
            </div>

            {/* 지출 내역 */}
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-6 border border-white/30 shadow-xl">
              <h3 className="text-xl font-bold text-warm-dark mb-4">
                지출 내역 ({group.expenses.length}개)
              </h3>

              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-6">
                <div className="flex items-center gap-2 text-green-800 text-sm">
                  <span className="text-lg">💡</span>
                  <span>
                    지출 내역이 잘못되어도 괜찮아요!{" "}
                    <strong>정산 금액, 결제자와 참여자를 수정할 수 있어요!</strong>{" "}
                    수정/삭제 버튼을 통해서 수정해보세요!
                  </span>
                </div>
              </div>

              {group.expenses.length === 0 ? (
                <p className="text-warm-gray text-center py-8">
                  아직 지출 내역이 없습니다.
                </p>
              ) : (
                <div className="space-y-4">
                  {group.expenses.map((expense) => {
                    const payer = group.members.find((m) => m.id === expense.payerId);
                    const participantNames = expense.participants
                      .map((id) => group.members.find((m) => m.id === id)?.name)
                      .join(", ");

                    return (
                      <div
                        key={expense.id}
                        className="flex justify-between items-start p-4 bg-white/10 rounded-lg border border-white/20 group hover:bg-white/15 transition-all"
                      >
                        <div className="flex-1">
                          <h4 className="font-semibold text-warm-dark">{expense.title}</h4>
                          <p className="text-sm text-warm-gray">결제자: {payer?.name}</p>
                          <p className="text-sm text-warm-gray">참여자: {participantNames}</p>
                          <p className="text-sm text-warm-gray">{expense.date}</p>
                        </div>
                        <div className="text-right flex items-center gap-3">
                          <div>
                            <div className="text-lg font-bold text-warm-dark">
                              {expense.amount.toLocaleString()}원
                            </div>
                            <div className="text-sm text-warm-gray">
                              1인당 {expense.perPersonAmount.toLocaleString()}원
                            </div>
                          </div>
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => openExpenseEditModal(expense)}
                              className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs font-medium transition-all"
                              title="지출 수정"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => deleteExpense(expense.id)}
                              className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-xs font-medium transition-all"
                              title="지출 삭제"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 지출 수정 모달 */}
        {showExpenseEditModal && editingExpense && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b p-6 rounded-t-2xl">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold text-warm-dark">지출 내역 수정</h3>
                  <button
                    onClick={() => {
                      setShowExpenseEditModal(false);
                      setEditingExpense(null);
                    }}
                    disabled={isUpdatingExpense}
                    className="w-8 h-8 bg-gray-200 hover:bg-gray-300 rounded-full flex items-center justify-center font-bold text-gray-600 disabled:opacity-50"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-warm-dark font-semibold mb-2">
                      지출 내용
                    </label>
                    <input
                      type="text"
                      value={expenseEditForm.title}
                      onChange={(e) =>
                        setExpenseEditForm((prev) => ({
                          ...prev,
                          title: e.target.value,
                        }))
                      }
                      disabled={isUpdatingExpense}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-pink-400 focus:outline-none transition-colors text-warm-dark disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label className="block text-warm-dark font-semibold mb-2">
                      지출 금액
                    </label>
                    <input
                      type="number"
                      value={expenseEditForm.amount}
                      onChange={(e) =>
                        setExpenseEditForm((prev) => ({
                          ...prev,
                          amount: e.target.value,
                        }))
                      }
                      disabled={isUpdatingExpense}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-pink-400 focus:outline-none transition-colors text-warm-dark disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label className="block text-warm-dark font-semibold mb-2">
                      결제자
                    </label>
                    <select
                      value={expenseEditForm.payerId}
                      onChange={(e) =>
                        setExpenseEditForm((prev) => ({
                          ...prev,
                          payerId: e.target.value,
                        }))
                      }
                      disabled={isUpdatingExpense}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-pink-400 focus:outline-none transition-colors text-warm-dark disabled:opacity-50"
                    >
                      {group?.members.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-warm-dark font-semibold mb-2">
                      지출 날짜
                    </label>
                    <input
                      type="date"
                      value={expenseEditForm.date}
                      onChange={(e) =>
                        setExpenseEditForm((prev) => ({
                          ...prev,
                          date: e.target.value,
                        }))
                      }
                      disabled={isUpdatingExpense}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-pink-400 focus:outline-none transition-colors text-warm-dark disabled:opacity-50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-warm-dark font-semibold mb-4">
                    참여자 선택
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {group?.members.map((member) => (
                      <label
                        key={member.id}
                        className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={expenseEditForm.participants.includes(member.id)}
                          onChange={() => toggleExpenseParticipant(member.id)}
                          disabled={isUpdatingExpense}
                          className="w-5 h-5 text-pink-500"
                        />
                        <div
                          className="w-8 h-8 rounded-full text-white text-xs font-bold flex items-center justify-center"
                          style={{ backgroundColor: member.color }}
                        >
                          {member.name.charAt(0)}
                        </div>
                        <span className="text-warm-dark font-medium">{member.name}</span>
                      </label>
                    ))}
                  </div>
                  {expenseEditForm.participants.length > 0 && (
                    <p className="text-sm text-warm-gray mt-2">
                      1인당 금액:{" "}
                      {expenseEditForm.amount
                        ? Math.round(
                            parseInt(expenseEditForm.amount) /
                              expenseEditForm.participants.length
                          ).toLocaleString()
                        : 0}
                      원
                    </p>
                  )}
                </div>

                <div className="flex gap-3 pt-4 border-t">
                  <button
                    onClick={updateExpenseInfo}
                    disabled={isUpdatingExpense}
                    className="flex-1 py-3 bg-gradient-to-r from-pink-400 to-pink-500 hover:from-pink-500 hover:to-pink-600 text-white rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUpdatingExpense ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        업데이트 중...
                      </span>
                    ) : (
                      "💫 지출 정보 업데이트"
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setShowExpenseEditModal(false);
                      setEditingExpense(null);
                    }}
                    disabled={isUpdatingExpense}
                    className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-warm-dark rounded-lg font-semibold transition-all disabled:opacity-50"
                  >
                    취소
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "settlement" && (
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-6 border border-white/30 shadow-xl">
            <h3 className="text-xl font-bold text-warm-dark mb-4">🔥 실시간 정산 결과</h3>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
              <div className="flex items-center gap-2 text-blue-800 text-sm">
                <span className="text-lg">💡</span>
                <span>
                  <strong>프로필을 클릭</strong>하면 계좌번호를 확인할 수 있어요!
                </span>
              </div>
            </div>

            {settlements.length === 0 ? (
              <p className="text-warm-gray text-center py-8">
                아직 정산할 내용이 없습니다.
              </p>
            ) : (
              <div className="space-y-4">
                {settlements.map((settlement, index) => {
                  const from = group.members.find((m) => m.id === settlement.from);
                  const to = group.members.find((m) => m.id === settlement.to);

                  return (
                    <div
                      key={index}
                      className="p-4 bg-white/10 rounded-lg border border-white/20"
                    >
                      {/* 프로필 영역 */}
                      <div className="flex items-center justify-center gap-3 mb-4">
                        <div
                          className="w-14 h-14 rounded-full text-white font-bold flex items-center justify-center cursor-pointer hover:scale-110 transition-transform border-2 border-white/50 hover:border-white/90 shadow-lg hover:shadow-xl flex-shrink-0"
                          style={{ backgroundColor: from?.color }}
                          onClick={() => from && showMemberAccount(from)}
                          title="👆 클릭하면 계좌번호를 확인할 수 있어요!"
                        >
                          <span className="text-lg">{from?.name.charAt(0)}</span>
                        </div>
                        <span className="text-3xl text-pink-500">→</span>
                        <div
                          className="w-14 h-14 rounded-full text-white font-bold flex items-center justify-center cursor-pointer hover:scale-110 transition-transform border-2 border-white/50 hover:border-white/90 shadow-lg hover:shadow-xl flex-shrink-0"
                          style={{ backgroundColor: to?.color }}
                          onClick={() => to && showMemberAccount(to)}
                          title="👆 클릭하면 계좌번호를 확인할 수 있어요!"
                        >
                          <span className="text-lg">{to?.name.charAt(0)}</span>
                        </div>
                      </div>

                      {/* 텍스트 정보 - 명확한 설명 */}
                      <div className="text-center mb-4">
                        <div className="text-warm-dark font-medium text-base leading-relaxed mb-2">
                          <strong className="text-warm-dark">{from?.name}</strong>이{" "}
                          <strong className="text-warm-dark">{to?.name}</strong>에게
                          <br />
                          송금해야 합니다
                        </div>
                        <div className="text-3xl font-bold text-pink-600">
                          {settlement.amount.toLocaleString()}원
                        </div>
                      </div>

                      {/* 버튼 */}
                      <button
                        onClick={() =>
                          copySettlementMessage(from!, to!, settlement.amount)
                        }
                        className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold transition-all text-base"
                      >
                        📋 송금 정보 복사
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 계좌 정보 모달 */}
        {showAccountModal && selectedMember && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
              <div className="text-center">
                <div
                  className="w-16 h-16 rounded-full text-white text-2xl font-bold flex items-center justify-center mx-auto mb-4"
                  style={{ backgroundColor: selectedMember.color }}
                >
                  {selectedMember.name.charAt(0)}
                </div>
                <h3 className="text-xl font-bold text-warm-dark mb-4">
                  {selectedMember.name}
                  {/* ✅ 본인 표시 */}
                  {currentMember?.id === selectedMember.id && (
                    <span className="ml-2 text-sm text-blue-600 font-normal">(나)</span>
                  )}
                </h3>

                <div className="bg-gray-50 rounded-lg p-4 mb-4 text-left">
                  <div className="mb-3">
                    <span className="text-sm text-gray-600 block mb-1">📞 전화번호</span>
                    <span className="text-warm-dark font-medium block">
                      {selectedMember.phone}
                    </span>
                  </div>

                  <div>
                    <span className="text-sm text-gray-600 block mb-1">🏦 계좌번호</span>
                    <div className="bg-white rounded border p-3 overflow-x-auto">
                      <div className="text-warm-dark font-mono text-sm whitespace-nowrap min-w-0">
                        {selectedMember.account}
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      👆 좌우로 스크롤하며 전체 계좌번호 확인
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={() => copyAccount(selectedMember.account)}
                    className="w-full py-2 bg-gradient-to-r from-pink-400 to-pink-500 text-white rounded-lg font-semibold hover:from-pink-500 hover:to-pink-600 transition-all"
                  >
                    계좌번호 복사
                  </button>

                  <button
                    onClick={() => openEditModal(selectedMember)}
                    className="w-full py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition-all"
                  >
                    ✏️ 정보 수정
                  </button>

                  {group.members.length > 1 && (
                    <button
                      onClick={() => openMemberDeleteModal(selectedMember)}
                      className="w-full py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition-all"
                    >
                      🗑️ 그룹에서 제외
                    </button>
                  )}

                  <button
                    onClick={() => setShowAccountModal(false)}
                    className="w-full py-2 bg-gray-200 text-warm-dark rounded-lg font-semibold hover:bg-gray-300 transition-all"
                  >
                    닫기
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 정보 편집 모달 */}
        {showEditModal && editingMember && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full">
              <div className="text-center mb-6">
                <div
                  className="w-16 h-16 rounded-full text-white text-2xl font-bold flex items-center justify-center mx-auto mb-4"
                  style={{ backgroundColor: editingMember.color }}
                >
                  {editingMember.name.charAt(0)}
                </div>
                <h3 className="text-xl font-bold text-warm-dark">{editingMember.name} 정보 수정</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-warm-dark font-semibold mb-2">이름</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    disabled={isUpdating}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-pink-400 focus:outline-none transition-colors text-warm-dark disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-warm-dark font-semibold mb-2">
                    전화번호 (아무거나 적어도 됨.)
                  </label>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, phone: e.target.value }))
                    }
                    disabled={isUpdating}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-pink-400 focus:outline-none transition-colors text-warm-dark disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-warm-dark font-semibold mb-2">
                    계좌번호
                    <span className="text-sm text-gray-500 font-normal ml-2">
                      (한 줄로)
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={editForm.account}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          account: e.target.value,
                        }))
                      }
                      placeholder="은행명 계좌번호 (예: 카카오뱅크 3333-01-1234567890)"
                      disabled={isUpdating}
                      className="w-full px-4 py-3 pr-12 border-2 border-gray-300 rounded-lg focus:border-pink-400 focus:outline-none transition-colors text-warm-dark disabled:opacity-50 text-sm overflow-x-auto"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (editForm.account) {
                          navigator.clipboard.writeText(editForm.account);
                          alert("계좌번호가 복사되었습니다!");
                        }
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-pink-500 transition-colors"
                      title="계좌번호 복사"
                    >
                      📋
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    💡 긴 계좌번호는 입력창에서 좌우로 스크롤하며 확인 가능
                  </p>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={updateMemberInfo}
                    disabled={isUpdating}
                    className="flex-1 py-3 bg-gradient-to-r from-pink-400 to-pink-500 hover:from-pink-500 hover:to-pink-600 text-white rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUpdating ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        업데이트 중...
                      </span>
                    ) : (
                      "💫 정보 업데이트"
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingMember(null);
                    }}
                    disabled={isUpdating}
                    className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-warm-dark rounded-lg font-semibold transition-all disabled:opacity-50"
                  >
                    취소
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 멤버 삭제 확인 모달 */}
        {showMemberDeleteModal && memberToDelete && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full">
              <div className="text-center">
                <div className="text-6xl mb-4">⚠️</div>
                <h3 className="text-xl font-bold text-warm-dark mb-4">멤버 제외 확인</h3>

                <div className="mb-6">
                  <div
                    className="w-16 h-16 rounded-full text-white text-2xl font-bold flex items-center justify-center mx-auto mb-3"
                    style={{ backgroundColor: memberToDelete.color }}
                  >
                    {memberToDelete.name.charAt(0)}
                  </div>
                  <p className="text-warm-gray mb-4">
                    <strong className="text-warm-dark">{memberToDelete.name}</strong>님을
                    <br />
                    그룹에서 제외하시겠습니까?
                  </p>
                </div>

                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                  <div className="text-sm text-red-800">
                    <div className="font-semibold mb-1">🚨 주의사항</div>
                    <div className="text-xs">
                      • 제외된 후에는 되돌릴 수 없습니다
                      <br />
                      • 모든 지출 내역이 재계산됩니다
                      <br />• 정산 결과도 자동으로 업데이트됩니다
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowMemberDeleteModal(false);
                      setMemberToDelete(null);
                    }}
                    disabled={isDeletingMember}
                    className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-warm-dark rounded-lg font-semibold transition-all disabled:opacity-50"
                  >
                    취소
                  </button>
                  <button
                    onClick={deleteMember}
                    disabled={isDeletingMember}
                    className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDeletingMember ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        처리중...
                      </span>
                    ) : (
                      "🗑️ 제외하기"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 새로운 결제자 선택 모달 */}
        {showPayerSelectModal &&
          memberToDelete &&
          expensesNeedingNewPayer.length > 0 && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
              <div className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
                <div className="text-center mb-6">
                  <div className="text-4xl mb-3">💳</div>
                  <h3 className="text-xl font-bold text-warm-dark mb-2">
                    새로운 결제자 선택
                  </h3>
                  <p className="text-warm-gray">
                    <strong>{memberToDelete.name}</strong>님이 결제자였던 지출들의
                    <br />
                    새로운 결제자를 선택해주세요
                  </p>
                </div>

                <div className="space-y-6 mb-8">
                  {expensesNeedingNewPayer.map((expense) => {
                    const availableMembers = group.members.filter(
                      (member) =>
                        expense.participants.includes(member.id) &&
                        member.id !== memberToDelete.id
                    );

                    return (
                      <div
                        key={expense.id}
                        className="border border-gray-200 rounded-lg p-4"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h4 className="font-semibold text-warm-dark text-lg">
                              {expense.title}
                            </h4>
                            <p className="text-warm-gray text-sm">{expense.date}</p>
                          </div>
                          <div className="text-right">
                            <div className="text-xl font-bold text-warm-dark">
                              {expense.amount.toLocaleString()}원
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-warm-dark font-semibold mb-3">
                            새로운 결제자 선택:
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {availableMembers.map((member) => (
                              <label
                                key={member.id}
                                className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all ${
                                  payerSelections[expense.id] === member.id
                                    ? "border-pink-400 bg-pink-50"
                                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                                }`}
                              >
                                <input
                                  type="radio"
                                  name={`payer-${expense.id}`}
                                  value={member.id}
                                  checked={payerSelections[expense.id] === member.id}
                                  onChange={() =>
                                    setPayerSelections((prev) => ({
                                      ...prev,
                                      [expense.id]: member.id,
                                    }))
                                  }
                                  className="w-5 h-5 text-pink-500"
                                />
                                <div
                                  className="w-8 h-8 rounded-full text-white text-sm font-bold flex items-center justify-center"
                                  style={{ backgroundColor: member.color }}
                                >
                                  {member.name.charAt(0)}
                                </div>
                                <span className="text-warm-dark font-medium">
                                  {member.name}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowPayerSelectModal(false);
                      setShowMemberDeleteModal(true);
                      setExpensesNeedingNewPayer([]);
                      setPayerSelections({});
                    }}
                    disabled={isDeletingMember}
                    className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-warm-dark rounded-lg font-semibold transition-all disabled:opacity-50"
                  >
                    취소
                  </button>
                  <button
                    onClick={proceedWithMemberDeletion}
                    disabled={
                      isDeletingMember ||
                      Object.keys(payerSelections).length !==
                        expensesNeedingNewPayer.length
                    }
                    className="flex-1 py-3 bg-gradient-to-r from-pink-400 to-pink-500 hover:from-pink-500 hover:to-pink-600 text-white rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDeletingMember ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        처리중...
                      </span>
                    ) : (
                      "✅ 확인 후 멤버 제외"
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
      </div>
    </div>
  );
}