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

export default function CreateGroupPage() {
  const router = useRouter()
  const [groupName, setGroupName] = useState('')
  const [groupDesc, setGroupDesc] = useState('')
  const [members, setMembers] = useState<Member[]>([
    { name: '', phone: '', account: '' }
  ])
  const [isCreating, setIsCreating] = useState(false)
  
  // 성공 모달 관련 state
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
    
    if (validMembers.length < 2) {
      alert('최소 2명 이상의 참여자가 필요합니다.')
      return
    }

    setIsCreating(true)

    try {
      // 초대 코드 및 링크 생성
      const inviteCode = generateInviteCode()
      const inviteLink = createInviteLink(inviteCode)

      // Firebase Firestore에 그룹 데이터 저장
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
        // 🔗 초대 링크 정보 추가
        inviteCode: inviteCode,
        inviteLink: inviteLink,
        allowInvites: true,
        maxMembers: 20, // 최대 20명까지 참여 가능
        createdAt: new Date(),
        lastUpdated: new Date()
      }

      console.log('🔥 Firebase에 그룹 생성 중...', groupData)
      console.log('🔗 초대 링크:', inviteLink)
      
      // Firestore에 문서 추가
      const docRef = await addDoc(collection(db, 'groups'), groupData)
      
      console.log('✅ 그룹 생성 성공! Document ID:', docRef.id)
      
      // 로컬스토리지에 저장
      localStorage.setItem('currentGroupId', docRef.id)

      // 🎉 모달 표시
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

  // URL 복사 및 그룹 이동 함수
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
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center text-warm-gray hover:text-warm-dark mb-4 text-sm transition-colors">
            ← 홈으로 돌아가기
          </Link>
          <h1 className="text-4xl font-bold text-warm-dark mb-2 drop-shadow-lg">
            새 정산 그룹 만들기
          </h1>
          <p className="text-warm-gray">
            친구들과 함께할 정산 그룹을 생성하고 초대 링크를 공유해보세요
          </p>
        </div>

        {/* 메인 폼 */}
        <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-8 border border-white/30 shadow-xl">
          {/* 그룹 정보 */}
          <div className="mb-8">
            <div className="mb-6">
              <label className="block text-warm-dark font-semibold mb-2">
                그룹 이름 *
              </label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="예: 제주도 여행"
                disabled={isCreating}
                className="w-full px-4 py-3 border-2 border-white/30 rounded-lg bg-white/90 backdrop-blur-sm focus:border-pink-400 focus:outline-none transition-colors text-warm-dark placeholder-warm-gray disabled:opacity-50"
              />
            </div>
            
            <div className="mb-6">
              <label className="block text-warm-dark font-semibold mb-2">
                그룹 설명
              </label>
              <textarea
                value={groupDesc}
                onChange={(e) => setGroupDesc(e.target.value)}
                placeholder="정산 목적을 간단히 설명해주세요"
                rows={3}
                disabled={isCreating}
                className="w-full px-4 py-3 border-2 border-white/30 rounded-lg bg-white/90 backdrop-blur-sm focus:border-pink-400 focus:outline-none transition-colors resize-none text-warm-dark placeholder-warm-gray disabled:opacity-50"
              />
            </div>
          </div>

          {/* 참여자 추가 */}
          <div className="mb-8">
            <label className="block text-warm-dark font-semibold mb-2">
              초기 참여자 추가 *
            </label>
            <p className="text-sm text-warm-gray mb-4">
              💡 그룹 생성 후 초대 링크로 더 많은 친구들을 초대할 수 있어요!
            </p>
            
            <div className="space-y-6">
              {members.map((member, index) => (
                <div key={index} className="p-4 bg-white/10 rounded-lg border border-white/20">
                  {/* 이름과 전화번호는 모바일에서 세로, 데스크톱에서 가로 배치 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    <input
                      type="text"
                      value={member.name}
                      onChange={(e) => updateMember(index, 'name', e.target.value)}
                      placeholder="이름"
                      disabled={isCreating}
                      className="w-full px-4 py-3 border-2 border-white/30 rounded-lg bg-white/90 backdrop-blur-sm focus:border-pink-400 focus:outline-none transition-colors text-warm-dark placeholder-warm-gray disabled:opacity-50"
                    />
                    <input
                      type="tel"
                      value={member.phone}
                      onChange={(e) => updateMember(index, 'phone', e.target.value)}
                      placeholder="전화번호"
                      disabled={isCreating}
                      className="w-full px-4 py-3 border-2 border-white/30 rounded-lg bg-white/90 backdrop-blur-sm focus:border-pink-400 focus:outline-none transition-colors text-warm-dark placeholder-warm-gray disabled:opacity-50"
                    />
                  </div>
                  
                  {/* 계좌번호는 전체 너비 사용 - 핵심 개선 부분! */}
                  <div className="mb-3">
                    <input
                      type="text"
                      value={member.account}
                      onChange={(e) => updateMember(index, 'account', e.target.value)}
                      placeholder="은행명 계좌번호 (예: 카카오뱅크 3333-01-1234567)"
                      disabled={isCreating}
                      className="w-full px-4 py-3 border-2 border-white/30 rounded-lg bg-white/90 backdrop-blur-sm focus:border-pink-400 focus:outline-none transition-colors text-warm-dark placeholder-warm-gray disabled:opacity-50 text-sm sm:text-base overflow-x-auto"
                    />
                    <p className="text-xs text-warm-gray mt-1 px-1">
                      💡 긴 계좌번호는 좌우 스크롤하며 확인 가능해요
                    </p>
                  </div>
                  
                  {/* 삭제 버튼 */}
                  {members.length > 1 && !isCreating && (
                    <div className="pt-3 border-t border-white/20">
                      <button
                        onClick={() => removeMember(index)}
                        className="w-full sm:w-auto px-4 py-2 bg-red-400 hover:bg-red-500 text-white rounded-lg transition-colors font-medium text-sm"
                      >
                        🗑️ 이 참여자 제거
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            {!isCreating && (
              <button
                onClick={addMemberInput}
                className="mt-6 w-full sm:w-auto px-6 py-3 bg-white/30 hover:bg-white/40 text-warm-dark rounded-lg border border-white/40 transition-all font-semibold"
              >
                + 참여자 추가
              </button>
            )}
          </div>

          {/* 생성 버튼 */}
          <button
            onClick={createGroup}
            disabled={isCreating}
            className="w-full py-4 bg-gradient-to-r from-pink-400 to-pink-500 hover:from-pink-500 hover:to-pink-600 text-white rounded-xl font-bold text-lg transition-all transform hover:scale-[1.02] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {isCreating ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Firebase에 그룹 생성 중...
              </span>
            ) : (
              '🔗 그룹 생성 & 초대 링크 만들기'
            )}
          </button>
        </div>

        {/* 그룹 생성 성공 모달 */}
        {showSuccessModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-8 text-center">
              {/* 성공 아이콘 */}
              <div className="text-6xl mb-4">🎉</div>
              
              {/* 제목 */}
              <h2 className="text-2xl font-bold text-warm-dark mb-3">
                그룹 생성 완료!
              </h2>
              
              {/* 그룹명 */}
              <p className="text-warm-gray mb-6">
                <strong>"{createdGroupInfo.name}"</strong> 그룹이<br/>
                성공적으로 생성되었습니다
              </p>
              
              {/* 초대 링크 표시 */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="text-sm text-gray-600 mb-2">🔗 초대 링크</div>
                <div className="bg-white rounded border p-3 overflow-x-auto">
                  <div className="text-warm-dark font-mono text-sm whitespace-nowrap">
                    {createdGroupInfo.inviteLink}
                  </div>
                </div>
              </div>
              
              {/* 안내 텍스트 */}
              <p className="text-sm text-warm-gray mb-6">
                확인 버튼을 누르면 초대 링크가 자동으로 복사되어<br/>
                친구들에게 바로 공유할 수 있어요!
              </p>
              
              {/* 확인 버튼 (복사 + 이동) */}
              <button
                onClick={copyInviteLinkAndProceed}
                className="w-full py-4 bg-gradient-to-r from-pink-400 to-pink-500 hover:from-pink-500 hover:to-pink-600 text-white rounded-xl font-bold text-lg transition-all transform hover:scale-[1.02] shadow-lg"
              >
                📋 링크 복사하고 그룹으로 이동
              </button>
              
              {/* 나중에 복사하기 버튼 */}
              <button
                onClick={() => {
                  setShowSuccessModal(false)
                  router.push(`/groups/${createdGroupInfo.groupId}`)
                }}
                className="w-full mt-3 py-3 bg-gray-200 hover:bg-gray-300 text-warm-dark rounded-lg font-semibold transition-all"
              >
                나중에 복사하기
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}