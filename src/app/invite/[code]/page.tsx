'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore'
import { isValidInviteCode, addMemberToGroup, type NewMember } from '@/lib/invite'
import { getMemberSession, saveMemberSession, clearMemberSession, type MemberSession } from '@/lib/session'

interface Group {
  id: string
  name: string
  description: string
  members: any[]
  inviteCode: string
  allowInvites: boolean
  maxMembers: number
}

const MARQUEE_TEXT = '✦ 함께정산 — 그룹 초대 ✦ 친구가 초대했어요 ✦ 참여하고 함께 정산해요 ✦ '

export default function InvitePage() {
  const params = useParams()
  const router = useRouter()
  const [group, setGroup] = useState<Group | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')

  const [showJoinForm, setShowJoinForm] = useState(false)
  const [showMemberSelectModal, setShowMemberSelectModal] = useState(false)
  const [existingMembership, setExistingMembership] = useState<MemberSession | null>(null)
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null)

  const [memberInfo, setMemberInfo] = useState({
    name: '',
    phone: '',
    account: ''
  })

  const inviteCode = params.code as string

  useEffect(() => {
    const findGroupByInviteCode = async () => {
      if (!inviteCode) {
        setError('초대 코드가 없습니다.')
        setLoading(false)
        return
      }

      if (!isValidInviteCode(inviteCode)) {
        setError('유효하지 않은 초대 코드입니다.')
        setLoading(false)
        return
      }

      try {
        const q = query(
          collection(db, 'groups'),
          where('inviteCode', '==', inviteCode)
        )

        const querySnapshot = await getDocs(q)

        if (querySnapshot.empty) {
          setError('존재하지 않거나 만료된 초대 코드입니다.')
          setLoading(false)
          return
        }

        const groupDoc = querySnapshot.docs[0]
        const groupData = {
          id: groupDoc.id,
          ...groupDoc.data()
        } as Group

        if (!groupData.allowInvites) {
          setError('이 그룹은 현재 초대를 받지 않습니다.')
          setLoading(false)
          return
        }

        if (groupData.members.length >= groupData.maxMembers) {
          setError(`이 그룹은 이미 최대 인원(${groupData.maxMembers}명)에 도달했습니다.`)
          setLoading(false)
          return
        }

        setGroup(groupData)

        const existingSession = getMemberSession(groupData.id)
        if (existingSession) {
          const memberStillExists = groupData.members.some(
            m => m.id === existingSession.memberId
          )

          if (memberStillExists) {
            setExistingMembership(existingSession)
          } else {
            clearMemberSession(groupData.id)
            setExistingMembership(null)
          }
        }

      } catch (error) {
        console.error('❌ 그룹 검색 실패:', error)
        setError('그룹 정보를 불러오는 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }

    findGroupByInviteCode()
  }, [inviteCode])

  const enterAsExistingMember = () => {
    if (!group || !selectedMemberId === null) return

    const selectedMember = group.members.find(m => m.id === selectedMemberId)
    if (!selectedMember) {
      alert('선택한 멤버를 찾을 수 없습니다.')
      return
    }

    saveMemberSession(group.id, selectedMember.id, selectedMember.name)
    alert(`👋 ${selectedMember.name}님으로 입장합니다!`)
    router.push(`/groups/${group.id}`)
  }

  const quickEnter = () => {
    if (!group || !existingMembership) return

    const member = group.members.find(m => m.id === existingMembership.memberId)
    if (!member) {
      alert('이전에 사용한 멤버 정보를 찾을 수 없습니다.')
      clearMemberSession(group.id)
      setExistingMembership(null)
      return
    }

    alert(`👋 ${member.name}님으로 입장합니다!`)
    router.push(`/groups/${group.id}`)
  }

  const joinGroup = async () => {
    if (!group) return

    const { name, phone, account } = memberInfo

    if (!name.trim()) { alert('이름을 입력해주세요.'); return }
    if (!phone.trim()) { alert('전화번호를 입력해주세요.'); return }
    if (!account.trim()) { alert('계좌번호를 입력해주세요.'); return }

    const existingMember = group.members.find(m =>
      m.name.toLowerCase() === name.toLowerCase().trim() ||
      m.phone === phone.trim()
    )

    if (existingMember) {
      alert('이미 참여한 멤버입니다. (같은 이름 또는 전화번호)')
      return
    }

    setJoining(true)

    try {
      const newMember: NewMember = {
        name: name.trim(),
        phone: phone.trim(),
        account: account.trim()
      }

      const updatedMembers = addMemberToGroup(group.members, newMember)

      await updateDoc(doc(db, 'groups', group.id), {
        members: updatedMembers,
        lastUpdated: new Date()
      })

      const newMemberId = updatedMembers.length - 1
      saveMemberSession(group.id, newMemberId, name.trim())

      alert(`🎉 "${group.name}" 그룹에 성공적으로 참여했습니다!`)
      router.push(`/groups/${group.id}`)

    } catch (error) {
      console.error('❌ 그룹 참여 실패:', error)
      alert('그룹 참여 중 오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setJoining(false)
    }
  }

  // 로딩 중
  if (loading) {
    return (
      <>
        <div className="y2k-marquee">
          <div className="y2k-marquee-inner">
            <span className="font-pixel text-[10px] text-[var(--y2k-yellow)] px-4">{MARQUEE_TEXT}</span>
            <span className="font-pixel text-[10px] text-[var(--y2k-yellow)] px-4">{MARQUEE_TEXT}</span>
          </div>
        </div>
        <div className="min-h-screen y2k-noise flex items-center justify-center px-4" style={{ background: 'var(--y2k-cream)' }}>
          <div className="y2k-card p-8 text-center">
            <div className="text-4xl mb-3 animate-bounce">🔍</div>
            <p className="font-pixel text-[12px] text-[var(--y2k-black)]">초대 정보 확인 중...</p>
          </div>
        </div>
      </>
    )
  }

  // 에러 상태
  if (error) {
    return (
      <>
        <div className="y2k-marquee">
          <div className="y2k-marquee-inner">
            <span className="font-pixel text-[10px] text-[var(--y2k-yellow)] px-4">{MARQUEE_TEXT}</span>
            <span className="font-pixel text-[10px] text-[var(--y2k-yellow)] px-4">{MARQUEE_TEXT}</span>
          </div>
        </div>
        <div className="min-h-screen y2k-noise flex items-center justify-center px-4" style={{ background: 'var(--y2k-cream)' }}>
          <div className="y2k-card p-8 text-center max-w-sm w-full">
            <div className="text-5xl mb-3">😕</div>
            <h1 className="font-pixel text-[14px] text-[var(--y2k-black)] mb-3">초대 링크 오류</h1>
            <p className="text-[11px] text-[var(--y2k-t2)] mb-6">{error}</p>
            <Link href="/" className="y2k-btn px-8 py-3 inline-block">
              <span className="font-pixel text-[11px]">새 그룹 만들기</span>
            </Link>
          </div>
        </div>
      </>
    )
  }

  if (!group) return null

  return (
    <>
      {/* 마키 */}
      <div className="y2k-marquee">
        <div className="y2k-marquee-inner">
          <span className="font-pixel text-[10px] text-[var(--y2k-yellow)] px-4">{MARQUEE_TEXT}</span>
          <span className="font-pixel text-[10px] text-[var(--y2k-yellow)] px-4">{MARQUEE_TEXT}</span>
        </div>
      </div>

      <div className="min-h-screen y2k-noise" style={{ background: 'var(--y2k-cream)' }}>
        <div className="max-w-2xl mx-auto px-4 py-10">

          {/* 헤더 */}
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">🎉</div>
            <h1 className="font-pixel text-[18px] text-[var(--y2k-black)] mb-1">그룹 초대</h1>
            <p className="text-[11px] text-[var(--y2k-t2)]">친구가 정산 그룹에 초대했어요!</p>
          </div>

          {/* 그룹 정보 카드 */}
          <div className="y2k-card overflow-hidden mb-4">
            <div className="y2k-win95-bar">
              <span className="font-pixel text-[9px] text-white">📊 그룹 정보.exe</span>
              <div className="flex gap-1">
                <div className="y2k-win95-btn">_</div>
                <div className="y2k-win95-btn">□</div>
                <div className="y2k-win95-btn">✕</div>
              </div>
            </div>

            <div className="p-5">
              <div className="text-center mb-5">
                <h2 className="font-pixel text-[16px] text-[var(--y2k-black)] mb-1">📊 {group.name}</h2>
                {group.description && (
                  <p className="text-[11px] text-[var(--y2k-t2)] mb-3">{group.description}</p>
                )}

                {/* 멤버 칩 */}
                <div className="flex flex-wrap justify-center gap-2 mb-3">
                  {group.members.map((member, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 border-[var(--y2k-black)]"
                      style={{ background: 'white', boxShadow: '1px 1px 0 var(--y2k-black)' }}
                    >
                      <div
                        className="w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center border border-[var(--y2k-black)] text-[var(--y2k-black)]"
                        style={{ backgroundColor: member.color }}
                      >
                        {member.name.charAt(0)}
                      </div>
                      <span className="text-[11px] text-[var(--y2k-black)] font-medium">{member.name}</span>
                    </div>
                  ))}
                </div>

                <div
                  className="inline-block px-3 py-1 rounded-full border-2 border-[var(--y2k-black)]"
                  style={{ background: 'var(--y2k-yellow)', boxShadow: '1px 1px 0 var(--y2k-black)' }}
                >
                  <span className="font-pixel text-[9px] text-[var(--y2k-black)]">
                    현재 {group.members.length}명 · 최대 {group.maxMembers}명
                  </span>
                </div>
              </div>

              {/* 기존 멤버십 배너 */}
              {existingMembership && (
                <div
                  className="flex items-center justify-between p-3 rounded-xl border-2 border-[var(--y2k-black)]"
                  style={{ background: 'var(--y2k-pink-l)', boxShadow: '2px 2px 0 var(--y2k-black)' }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">👋</span>
                    <div>
                      <p className="text-[11px] font-semibold text-[var(--y2k-black)]">
                        이전에 <strong>{existingMembership.memberName}</strong>님으로 참여하셨어요
                      </p>
                      <p className="text-[9px] text-[var(--y2k-t3)]">
                        {new Date(existingMembership.timestamp).toLocaleDateString('ko-KR')}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => { clearMemberSession(group.id); setExistingMembership(null) }}
                    className="text-[10px] text-[var(--y2k-t3)] underline hover:text-[var(--y2k-black)]"
                  >
                    삭제
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 버튼 영역 */}
          {!showJoinForm && (
            <div className="space-y-3 mb-6">
              {existingMembership && (
                <>
                  <button
                    onClick={quickEnter}
                    className="y2k-btn w-full py-3.5"
                  >
                    <span className="font-pixel text-[12px]">👋 {existingMembership.memberName}님으로 빠른 입장</span>
                  </button>
                  <button
                    onClick={() => setShowMemberSelectModal(true)}
                    className="y2k-btn-out w-full py-3 text-sm font-semibold"
                  >
                    🔄 다른 멤버로 입장하기
                  </button>
                </>
              )}

              {!existingMembership && group.members.length > 0 && (
                <button
                  onClick={() => setShowMemberSelectModal(true)}
                  className="y2k-btn-out w-full py-3 text-sm font-semibold"
                >
                  🙋 이미 참여했어요
                </button>
              )}

              <button
                onClick={() => setShowJoinForm(true)}
                className="y2k-btn w-full py-3.5"
              >
                <span className="font-pixel text-[12px]">✨ 새로 참여하기</span>
              </button>

              <Link
                href="/"
                className="y2k-btn-out block w-full py-3 text-sm font-semibold text-center"
              >
                🏠 홈으로
              </Link>

              <p className="text-[10px] text-[var(--y2k-t3)] text-center">
                그룹을 먼저 확인해보세요. 필요할 때 참여하시면 돼요!
              </p>
            </div>
          )}

          {/* 참여 폼 */}
          {showJoinForm && (
            <div className="y2k-card overflow-hidden">
              <div className="y2k-win95-bar">
                <span className="font-pixel text-[9px] text-white">✨ 새 멤버 참여.exe</span>
                <div className="flex gap-1">
                  <div className="y2k-win95-btn">_</div>
                  <div className="y2k-win95-btn">□</div>
                  <div
                    className="y2k-win95-btn"
                    onClick={() => { setShowJoinForm(false); setMemberInfo({ name: '', phone: '', account: '' }) }}
                  >✕</div>
                </div>
              </div>

              <div className="p-5 space-y-4">
                <div>
                  <label className="block font-pixel text-[9px] text-[var(--y2k-t2)] mb-1.5">이름 *</label>
                  <input
                    type="text"
                    value={memberInfo.name}
                    onChange={(e) => setMemberInfo(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="이름을 입력해주세요"
                    disabled={joining}
                    className="y2k-input disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block font-pixel text-[9px] text-[var(--y2k-t2)] mb-1.5">전화번호 *</label>
                  <input
                    type="tel"
                    value={memberInfo.phone}
                    onChange={(e) => setMemberInfo(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="010-1234-5678"
                    disabled={joining}
                    className="y2k-input disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block font-pixel text-[9px] text-[var(--y2k-t2)] mb-1.5">
                    계좌번호 *
                    <span className="text-[var(--y2k-t3)] font-normal ml-2">(은행명 포함)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={memberInfo.account}
                      onChange={(e) => setMemberInfo(prev => ({ ...prev, account: e.target.value }))}
                      placeholder="카카오뱅크 3333-01-1234567890"
                      disabled={joining}
                      className="y2k-input disabled:opacity-50 text-sm overflow-x-auto pr-12"
                    />
                    <div
                      className="absolute right-3 top-1/2 -translate-y-1/2 font-pixel text-[9px] text-[var(--y2k-t3)] px-1 rounded"
                      style={{ background: 'var(--y2k-cream)' }}
                    >
                      {memberInfo.account.length}자
                    </div>
                  </div>
                  <p className="text-[9px] text-[var(--y2k-t3)] mt-1.5">
                    💡 정산 완료 후 송금받을 계좌번호를 입력하세요 (나중에 수정 가능)
                  </p>
                </div>

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={joinGroup}
                    disabled={joining}
                    className="y2k-btn flex-1 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {joining ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--y2k-black)]"></div>
                        <span className="font-pixel text-[10px]">참여 중...</span>
                      </span>
                    ) : (
                      <span className="font-pixel text-[11px]">🎉 그룹 참여하기</span>
                    )}
                  </button>
                  <button
                    onClick={() => { setShowJoinForm(false); setMemberInfo({ name: '', phone: '', account: '' }) }}
                    disabled={joining}
                    className="y2k-btn-out flex-1 py-3 text-sm font-semibold disabled:opacity-50"
                  >
                    취소
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 하단 링크 */}
          <div className="text-center mt-8">
            <Link href="/" className="font-pixel text-[10px] text-[var(--y2k-t3)] hover:text-[var(--y2k-black)]">
              또는 새로운 그룹 만들기 →
            </Link>
          </div>
        </div>
      </div>

      {/* 멤버 선택 모달 */}
      {showMemberSelectModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="y2k-win95 max-w-md w-full max-h-[80vh] flex flex-col bg-white">
            <div className="y2k-win95-bar flex-shrink-0">
              <span className="font-pixel text-[9px] text-white">🙋 멤버 선택.exe</span>
              <div className="flex gap-1">
                <div className="y2k-win95-btn">_</div>
                <div className="y2k-win95-btn">□</div>
                <div
                  className="y2k-win95-btn"
                  onClick={() => { setShowMemberSelectModal(false); setSelectedMemberId(null) }}
                >✕</div>
              </div>
            </div>

            <div className="overflow-y-auto p-5 flex-1">
              <div className="text-center mb-5">
                <div className="text-3xl mb-2">🙋</div>
                <h3 className="font-pixel text-[12px] text-[var(--y2k-black)] mb-1">누구로 입장하실래요?</h3>
                <p className="text-[10px] text-[var(--y2k-t2)]">그룹에 참여한 멤버 중 선택해주세요</p>
              </div>

              <div className="space-y-2 mb-5">
                {group.members.map((member) => (
                  <label
                    key={member.id}
                    className="flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all"
                    style={{
                      borderColor: selectedMemberId === member.id ? 'var(--y2k-pink)' : 'var(--y2k-muted)',
                      background: selectedMemberId === member.id ? 'var(--y2k-pink-l)' : 'var(--y2k-cream)',
                      boxShadow: selectedMemberId === member.id ? '2px 2px 0 var(--y2k-black)' : 'none',
                    }}
                  >
                    <input
                      type="radio"
                      name="member-select"
                      value={member.id}
                      checked={selectedMemberId === member.id}
                      onChange={() => setSelectedMemberId(member.id)}
                      className="w-4 h-4"
                    />
                    <div
                      className="w-10 h-10 rounded-full text-[var(--y2k-black)] text-sm font-bold flex items-center justify-center flex-shrink-0 border-2 border-[var(--y2k-black)]"
                      style={{ backgroundColor: member.color }}
                    >
                      {member.name.charAt(0)}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-semibold text-[12px] text-[var(--y2k-black)]">{member.name}</p>
                      <p className="text-[10px] text-[var(--y2k-t2)]">{member.phone}</p>
                      {existingMembership?.memberId === member.id && (
                        <p className="font-pixel text-[8px] text-[var(--y2k-pink)] mt-0.5">✓ 마지막으로 사용</p>
                      )}
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setShowMemberSelectModal(false); setSelectedMemberId(null) }}
                  className="y2k-btn-out flex-1 py-2.5 text-sm font-semibold"
                >
                  취소
                </button>
                <button
                  onClick={enterAsExistingMember}
                  disabled={selectedMemberId === null}
                  className="y2k-btn flex-1 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="font-pixel text-[11px]">입장하기</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
