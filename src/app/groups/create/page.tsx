'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/firebase'
import { collection, addDoc } from 'firebase/firestore'
import { generateInviteCode, createInviteLink } from '@/lib/invite'

interface Member {
  name: string
  phone: string
  account: string
}

const MARQUEE_TEXT = '✦ 함께정산 — 그룹 생성 ✦ 멤버를 추가하고 초대 링크를 공유하세요 ✦ '

export default function CreateGroupPage() {
  const router = useRouter()
  const [groupName, setGroupName] = useState('')
  const [groupDesc, setGroupDesc] = useState('')
  const [members, setMembers] = useState<Member[]>([
    { name: '', phone: '', account: '' }
  ])
  const [isCreating, setIsCreating] = useState(false)

  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [createdGroupInfo, setCreatedGroupInfo] = useState({
    name: '',
    inviteLink: '',
    groupId: ''
  })

  const addMemberInput = () => {
    setMembers([...members, { name: '', phone: '', account: '' }])
  }

  const removeMember = (index: number) => {
    setMembers(members.filter((_, i) => i !== index))
  }

  const updateMember = (index: number, field: keyof Member, value: string) => {
    const updatedMembers = [...members]
    updatedMembers[index][field] = value
    setMembers(updatedMembers)
  }

  const createGroup = async () => {
    if (!groupName) {
      alert('그룹 이름을 입력해주세요.')
      return
    }

    const validMembers = members.filter(member => member.name.trim() !== '')

    setIsCreating(true)

    try {
      const inviteCode = generateInviteCode()
      const inviteLink = createInviteLink(inviteCode)

      const groupData = {
        name: groupName,
        description: groupDesc,
        members: validMembers.map((member, index) => ({
          ...member,
          id: index,
          color: getMemberColor(index),
          joinedAt: new Date()
        })),
        expenses: [],
        inviteCode: inviteCode,
        inviteLink: inviteLink,
        allowInvites: true,
        maxMembers: 20,
        createdAt: new Date(),
        lastUpdated: new Date()
      }

      const docRef = await addDoc(collection(db, 'groups'), groupData)

      localStorage.setItem('currentGroupId', docRef.id)

      setCreatedGroupInfo({
        name: groupName,
        inviteLink: inviteLink,
        groupId: docRef.id
      })
      setShowSuccessModal(true)

    } catch (error) {
      console.error('❌ 그룹 생성 실패:', error)
      alert('그룹 생성 중 오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setIsCreating(false)
    }
  }

  const copyInviteLinkAndProceed = async () => {
    try {
      await navigator.clipboard.writeText(createdGroupInfo.inviteLink)
      alert('🎉 초대 링크가 복사되었습니다!\n친구들에게 공유해보세요!')
      setShowSuccessModal(false)
      router.push(`/groups/${createdGroupInfo.groupId}`)
    } catch (error) {
      console.error('클립보드 복사 실패:', error)
      prompt('복사에 실패했습니다. 아래 링크를 수동으로 복사해주세요:', createdGroupInfo.inviteLink)
      setShowSuccessModal(false)
      router.push(`/groups/${createdGroupInfo.groupId}`)
    }
  }

  const getMemberColor = (index: number) => {
    const colors = [
      '#ff9a9e', '#fecfef', '#ffecd2', '#fcb69f', '#ff8a80', '#f8bbd9',
      '#ffcccb', '#ffd1dc', '#ffe4e1', '#ffb3ba', '#ffdfba', '#ffffba'
    ]
    return colors[index % colors.length]
  }

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
          <div className="mb-6">
            <Link href="/" className="font-pixel text-[10px] text-[var(--y2k-t2)] hover:text-[var(--y2k-black)] mb-4 inline-block">
              ← 홈으로
            </Link>
            <h1 className="font-pixel text-[20px] text-[var(--y2k-black)] mb-1">🗂 새 그룹 만들기</h1>
            <p className="text-[11px] text-[var(--y2k-t2)]">멤버를 추가하고 초대 링크를 친구들에게 공유하세요</p>
          </div>

          {/* 폼 카드 */}
          <div className="y2k-card overflow-hidden mb-6">
            {/* 타이틀바 */}
            <div className="y2k-win95-bar">
              <span className="font-pixel text-[9px] text-white">📝 그룹 생성.exe</span>
              <div className="flex gap-1">
                <div className="y2k-win95-btn">_</div>
                <div className="y2k-win95-btn">□</div>
                <div className="y2k-win95-btn">✕</div>
              </div>
            </div>

            <div className="p-6">
              {/* 그룹 정보 */}
              <div className="mb-7">
                <p className="font-pixel text-[10px] text-[var(--y2k-black)] mb-4">✦ 그룹 정보</p>

                <div className="mb-4">
                  <label className="block font-pixel text-[9px] text-[var(--y2k-t2)] mb-1.5">
                    그룹 이름 *
                  </label>
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="예: 제주도 여행"
                    disabled={isCreating}
                    className="y2k-input disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block font-pixel text-[9px] text-[var(--y2k-t2)] mb-1.5">
                    그룹 설명
                  </label>
                  <textarea
                    value={groupDesc}
                    onChange={(e) => setGroupDesc(e.target.value)}
                    placeholder="정산 목적을 간단히 설명해주세요"
                    rows={3}
                    disabled={isCreating}
                    className="y2k-input resize-none disabled:opacity-50"
                  />
                </div>
              </div>

              {/* 참여자 추가 */}
              <div className="mb-7">
                <p className="font-pixel text-[10px] text-[var(--y2k-black)] mb-1">✦ 초기 참여자</p>
                <p className="text-[10px] text-[var(--y2k-t3)] mb-4">
                  💡 참여자 추가 안해도 됨. 초대 링크로 입장 시 자동 추가됨.
                </p>

                <div className="space-y-3">
                  {members.map((member, index) => (
                    <div key={index} className="y2k-card-cream p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div
                          className="font-pixel text-[9px] px-2 py-0.5 rounded-full border-2 border-[var(--y2k-black)]"
                          style={{ background: 'var(--y2k-yellow)' }}
                        >
                          #{index + 1}
                        </div>
                        <span className="font-pixel text-[9px] text-[var(--y2k-t2)]">멤버</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                        <input
                          type="text"
                          value={member.name}
                          onChange={(e) => updateMember(index, 'name', e.target.value)}
                          placeholder="이름"
                          disabled={isCreating}
                          className="y2k-input disabled:opacity-50"
                        />
                        <input
                          type="tel"
                          value={member.phone}
                          onChange={(e) => updateMember(index, 'phone', e.target.value)}
                          placeholder="전화번호 (아무거나 가능)"
                          disabled={isCreating}
                          className="y2k-input disabled:opacity-50"
                        />
                      </div>

                      <input
                        type="text"
                        value={member.account}
                        onChange={(e) => updateMember(index, 'account', e.target.value)}
                        placeholder="은행명 계좌번호 (예: 카카오뱅크 3333-01-1234567)"
                        disabled={isCreating}
                        className="y2k-input disabled:opacity-50 text-sm overflow-x-auto"
                      />
                      <p className="text-[9px] text-[var(--y2k-t3)] mt-1 px-1">
                        💡 긴 계좌번호는 좌우 스크롤로 확인 가능
                      </p>

                      {members.length > 1 && !isCreating && (
                        <div className="mt-3 pt-3 border-t-2 border-dashed border-[var(--y2k-muted)]">
                          <button
                            onClick={() => removeMember(index)}
                            className="px-4 py-1.5 text-[11px] font-semibold text-white rounded-full border-2 border-[var(--y2k-black)]"
                            style={{
                              background: '#FF6B6B',
                              boxShadow: '0 2px 0 #CC3333, 0 3px 0 var(--y2k-black)',
                            }}
                          >
                            🗑 이 멤버 제거
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {!isCreating && (
                  <button
                    onClick={addMemberInput}
                    className="y2k-btn-out mt-3 px-6 py-2.5 text-sm"
                  >
                    + 멤버 추가
                  </button>
                )}
              </div>

              {/* 생성 버튼 */}
              <button
                onClick={createGroup}
                disabled={isCreating}
                className="y2k-btn w-full py-3.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreating ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--y2k-black)]"></div>
                    <span className="font-pixel text-[11px]">그룹 생성 중...</span>
                  </span>
                ) : (
                  <span className="font-pixel text-[12px]">🔗 그룹 생성 & 초대 링크 만들기</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 성공 모달 */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="y2k-win95 max-w-md w-full bg-white">
            <div className="y2k-win95-bar">
              <span className="font-pixel text-[9px] text-white">🎉 그룹 생성 완료.exe</span>
              <div className="flex gap-1">
                <div className="y2k-win95-btn">_</div>
                <div className="y2k-win95-btn">□</div>
                <div className="y2k-win95-btn">✕</div>
              </div>
            </div>

            <div className="p-6 text-center">
              <div className="text-5xl mb-3">🎉</div>
              <h2 className="font-pixel text-[14px] text-[var(--y2k-black)] mb-2">그룹 생성 완료!</h2>
              <p className="text-[11px] text-[var(--y2k-t2)] mb-5">
                <strong>"{createdGroupInfo.name}"</strong> 그룹이<br/>성공적으로 생성되었습니다
              </p>

              {/* 초대 링크 */}
              <div className="y2k-card-cream p-3 mb-5">
                <p className="font-pixel text-[9px] text-[var(--y2k-t2)] mb-2">🔗 초대 링크</p>
                <div
                  className="p-2 rounded-lg border-2 border-[var(--y2k-black)] overflow-x-auto text-left"
                  style={{ background: 'var(--y2k-cream)' }}
                >
                  <span className="font-mono text-[10px] text-[var(--y2k-t1)] whitespace-nowrap">
                    {createdGroupInfo.inviteLink}
                  </span>
                </div>
              </div>

              <p className="text-[10px] text-[var(--y2k-t3)] mb-5">
                확인 버튼을 누르면 초대 링크가 자동으로 복사됩니다
              </p>

              <button
                onClick={copyInviteLinkAndProceed}
                className="y2k-btn w-full py-3 mb-2"
              >
                <span className="font-pixel text-[11px]">📋 링크 복사 & 그룹으로 이동</span>
              </button>
              <button
                onClick={() => {
                  setShowSuccessModal(false)
                  router.push(`/groups/${createdGroupInfo.groupId}`)
                }}
                className="y2k-btn-out w-full py-2.5 text-sm"
              >
                나중에 복사하기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
