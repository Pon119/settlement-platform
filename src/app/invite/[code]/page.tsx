'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore'
import { isValidInviteCode, addMemberToGroup, type NewMember } from '@/lib/invite'

interface Group {
  id: string
  name: string
  description: string
  members: any[]
  inviteCode: string
  allowInvites: boolean
  maxMembers: number
}

interface MemberSession {
  groupId: string
  memberId: number
  memberName: string
  timestamp: number
}

export default function InvitePage() {
  const params = useParams()
  const router = useRouter()
  const [group, setGroup] = useState<Group | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')
  
  // 참여 폼 표시 여부
  const [showJoinForm, setShowJoinForm] = useState(false)
  
  // ✅ 새로운 state: 멤버 선택 모달
  const [showMemberSelectModal, setShowMemberSelectModal] = useState(false)
  const [existingMembership, setExistingMembership] = useState<MemberSession | null>(null)
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null)

  // 참여자 정보 입력 폼
  const [memberInfo, setMemberInfo] = useState({
    name: '',
    phone: '',
    account: ''
  })

  const inviteCode = params.code as string

  // ✅ localStorage에서 멤버십 정보 가져오기
  const getMemberSession = (groupId: string): MemberSession | null => {
    if (typeof window === 'undefined') return null
    
    try {
      const sessionsJson = localStorage.getItem('groupMemberships')
      if (!sessionsJson) return null
      
      const sessions: { [key: string]: MemberSession } = JSON.parse(sessionsJson)
      return sessions[groupId] || null
    } catch (error) {
      console.error('세션 정보 로드 실패:', error)
      return null
    }
  }

  // ✅ localStorage에 멤버십 정보 저장
  const saveMemberSession = (groupId: string, memberId: number, memberName: string) => {
    if (typeof window === 'undefined') return
    
    try {
      const sessionsJson = localStorage.getItem('groupMemberships')
      const sessions: { [key: string]: MemberSession } = sessionsJson 
        ? JSON.parse(sessionsJson) 
        : {}
      
      sessions[groupId] = {
        groupId,
        memberId,
        memberName,
        timestamp: Date.now()
      }
      
      localStorage.setItem('groupMemberships', JSON.stringify(sessions))
      console.log('✅ 멤버 세션 저장 완료:', sessions[groupId])
    } catch (error) {
      console.error('세션 정보 저장 실패:', error)
    }
  }

  // ✅ 멤버십 정보 삭제 (로그아웃)
  const clearMemberSession = (groupId: string) => {
    if (typeof window === 'undefined') return
    
    try {
      const sessionsJson = localStorage.getItem('groupMemberships')
      if (!sessionsJson) return
      
      const sessions: { [key: string]: MemberSession } = JSON.parse(sessionsJson)
      delete sessions[groupId]
      
      localStorage.setItem('groupMemberships', JSON.stringify(sessions))
      setExistingMembership(null)
      console.log('✅ 멤버 세션 삭제 완료')
    } catch (error) {
      console.error('세션 정보 삭제 실패:', error)
    }
  }

  // 초대 코드로 그룹 찾기
  useEffect(() => {
    const findGroupByInviteCode = async () => {
      if (!inviteCode) {
        setError('초대 코드가 없습니다.')
        setLoading(false)
        return
      }

      // 초대 코드 유효성 검사
      if (!isValidInviteCode(inviteCode)) {
        setError('유효하지 않은 초대 코드입니다.')
        setLoading(false)
        return
      }

      try {
        console.log('🔍 초대 코드로 그룹 검색:', inviteCode)

        // Firestore에서 초대 코드로 그룹 찾기
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

        console.log('✅ 그룹 찾기 성공:', groupData)

        // 초대가 허용되는지 확인
        if (!groupData.allowInvites) {
          setError('이 그룹은 현재 초대를 받지 않습니다.')
          setLoading(false)
          return
        }

        // 최대 인원 확인
        if (groupData.members.length >= groupData.maxMembers) {
          setError(`이 그룹은 이미 최대 인원(${groupData.maxMembers}명)에 도달했습니다.`)
          setLoading(false)
          return
        }

        setGroup(groupData)
        
        // ✅ 기존 멤버십 확인
        const existingSession = getMemberSession(groupData.id)
        if (existingSession) {
          // 해당 멤버가 아직 그룹에 존재하는지 확인
          const memberStillExists = groupData.members.some(
            m => m.id === existingSession.memberId
          )
          
          if (memberStillExists) {
            setExistingMembership(existingSession)
            console.log('✅ 기존 멤버십 발견:', existingSession)
          } else {
            // 멤버가 그룹에서 제거되었으면 세션 정보 삭제
            clearMemberSession(groupData.id)
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

  // ✅ 기존 멤버로 입장하기
  const enterAsExistingMember = () => {
    if (!group || !selectedMemberId === null) return
    
    const selectedMember = group.members.find(m => m.id === selectedMemberId)
    if (!selectedMember) {
      alert('선택한 멤버를 찾을 수 없습니다.')
      return
    }
    
    // 세션 정보 저장
    saveMemberSession(group.id, selectedMember.id, selectedMember.name)
    
    alert(`👋 ${selectedMember.name}님으로 입장합니다!`)
    
    // 그룹 대시보드로 이동
    router.push(`/groups/${group.id}`)
  }

  // ✅ 빠른 재입장 (마지막으로 사용한 멤버로)
  const quickEnter = () => {
    if (!group || !existingMembership) return
    
    const member = group.members.find(m => m.id === existingMembership.memberId)
    if (!member) {
      alert('이전에 사용한 멤버 정보를 찾을 수 없습니다.')
      clearMemberSession(group.id)
      return
    }
    
    alert(`👋 ${member.name}님으로 입장합니다!`)
    router.push(`/groups/${group.id}`)
  }

  // 그룹 참여하기 (새 멤버)
  const joinGroup = async () => {
    if (!group) return

    const { name, phone, account } = memberInfo

    if (!name.trim()) {
      alert('이름을 입력해주세요.')
      return
    }

    if (!phone.trim()) {
      alert('전화번호를 입력해주세요.')
      return
    }

    if (!account.trim()) {
      alert('계좌번호를 입력해주세요.')
      return
    }

    // 이미 참여한 멤버인지 확인
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
      // 새 멤버 추가
      const newMember: NewMember = {
        name: name.trim(),
        phone: phone.trim(),
        account: account.trim()
      }

      const updatedMembers = addMemberToGroup(group.members, newMember)

      console.log('🔥 Firebase에 새 멤버 추가 중...', newMember)

      // Firebase 업데이트
      await updateDoc(doc(db, 'groups', group.id), {
        members: updatedMembers,
        lastUpdated: new Date()
      })

      console.log('✅ 그룹 참여 성공!')

      // ✅ 새로 추가된 멤버의 ID 찾기 (마지막 멤버)
      const newMemberId = updatedMembers.length - 1
      
      // ✅ 세션 정보 저장
      saveMemberSession(group.id, newMemberId, name.trim())

      alert(`🎉 "${group.name}" 그룹에 성공적으로 참여했습니다!`)

      // 그룹 대시보드로 이동
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
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto mb-4"></div>
          <div className="text-warm-dark text-xl">초대 정보를 확인하는 중...</div>
        </div>
      </div>
    )
  }

  // 에러 상태
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">😕</div>
          <h1 className="text-2xl font-bold text-warm-dark mb-4">초대 링크 오류</h1>
          <p className="text-warm-gray mb-6">{error}</p>
          <Link 
            href="/" 
            className="inline-block px-6 py-3 bg-gradient-to-r from-pink-400 to-pink-500 text-white rounded-lg font-semibold hover:from-pink-500 hover:to-pink-600 transition-all"
          >
            새 그룹 만들기
          </Link>
        </div>
      </div>
    )
  }

  // 그룹이 없는 경우
  if (!group) {
    return null
  }

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-4xl font-bold text-warm-dark mb-2">
            그룹 초대
          </h1>
          <p className="text-warm-gray">
            친구가 정산 그룹에 초대했어요!
          </p>
        </div>

        {/* 그룹 정보 - 항상 표시 */}
        <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-8 border border-white/30 shadow-xl mb-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-warm-dark mb-2">
              📊 {group.name}
            </h2>
            <p className="text-warm-gray mb-4">{group.description}</p>
            
            {/* 현재 멤버 표시 */}
            <div className="flex flex-wrap justify-center gap-2 mb-4">
              {group.members.map((member, index) => (
                <div key={index} className="flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full border border-white/30">
                  <div 
                    className="w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center"
                    style={{ backgroundColor: member.color }}
                  >
                    {member.name.charAt(0)}
                  </div>
                  <span className="text-warm-dark text-sm">{member.name}</span>
                </div>
              ))}
            </div>
            
            <p className="text-sm text-warm-gray">
              현재 {group.members.length}명 참여 중 (최대 {group.maxMembers}명)
            </p>
          </div>

          {/* ✅ 기존 멤버십 표시 */}
          {existingMembership && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">👋</div>
                  <div>
                    <div className="text-sm text-blue-800 font-semibold">
                      이전에 <strong>{existingMembership.memberName}</strong>님으로 참여하셨어요
                    </div>
                    <div className="text-xs text-blue-600">
                      {new Date(existingMembership.timestamp).toLocaleDateString('ko-KR')}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => clearMemberSession(group.id)}
                  className="text-xs text-blue-600 hover:text-blue-800 underline"
                >
                  삭제
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ✅ 버튼 영역 개선 */}
        {!showJoinForm && (
          <div className="space-y-4 mb-8">
            {/* 기존 멤버십이 있는 경우 */}
            {existingMembership && (
              <div className="space-y-3">
                {/* 빠른 입장 버튼 */}
                <button
                  onClick={quickEnter}
                  className="w-full px-8 py-4 bg-gradient-to-r from-blue-400 to-blue-500 hover:from-blue-500 hover:to-blue-600 text-white rounded-xl font-bold text-lg transition-all transform hover:scale-[1.02] shadow-lg"
                >
                  👋 {existingMembership.memberName}님으로 빠른 입장
                </button>
                
                {/* 다른 멤버로 입장 버튼 */}
                <button
                  onClick={() => setShowMemberSelectModal(true)}
                  className="w-full px-8 py-4 bg-purple-500 hover:bg-purple-600 text-white rounded-xl font-bold text-lg transition-all transform hover:scale-[1.02] shadow-lg"
                >
                  🔄 다른 멤버로 입장하기
                </button>
              </div>
            )}

            {/* 기존 멤버십이 없는 경우 */}
            {!existingMembership && group.members.length > 0 && (
              <button
                onClick={() => setShowMemberSelectModal(true)}
                className="w-full px-8 py-4 bg-purple-500 hover:bg-purple-600 text-white rounded-xl font-bold text-lg transition-all transform hover:scale-[1.02] shadow-lg"
              >
                🙋 이미 참여했어요
              </button>
            )}

            {/* 새로 참여하기 버튼 */}
            <button
              onClick={() => setShowJoinForm(true)}
              className="w-full px-8 py-4 bg-pink-500 hover:bg-pink-600 text-white rounded-xl font-bold text-lg transition-all transform hover:scale-[1.02] shadow-lg"
            >
              ✨ 새로 참여하기
            </button>

            {/* 홈으로 버튼 */}
            <Link 
              href="/"
              className="block w-full px-8 py-4 bg-gray-500 hover:bg-gray-600 text-white rounded-xl font-bold text-lg transition-all transform hover:scale-[1.02] shadow-lg text-center"
            >
              🏠 홈으로
            </Link>

            <p className="text-warm-gray text-sm text-center mt-4">
              그룹을 먼저 확인해보세요. 필요할 때 참여하시면 돼요!
            </p>
          </div>
        )}

        {/* ✅ 멤버 선택 모달 */}
        {showMemberSelectModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
              <div className="text-center mb-6">
                <div className="text-4xl mb-3">🙋</div>
                <h3 className="text-xl font-bold text-warm-dark mb-2">
                  누구로 입장하실래요?
                </h3>
                <p className="text-warm-gray text-sm">
                  그룹에 참여한 멤버 중 선택해주세요
                </p>
              </div>

              <div className="space-y-3 mb-6">
                {group.members.map((member) => (
                  <label
                    key={member.id}
                    className={`flex items-center gap-4 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      selectedMemberId === member.id
                        ? 'border-pink-400 bg-pink-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
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
                      <div className="font-semibold text-warm-dark">
                        {member.name}
                      </div>
                      <div className="text-sm text-warm-gray">
                        {member.phone}
                      </div>
                      {existingMembership?.memberId === member.id && (
                        <div className="text-xs text-blue-600 font-medium mt-1">
                          ✓ 마지막으로 사용
                        </div>
                      )}
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowMemberSelectModal(false)
                    setSelectedMemberId(null)
                  }}
                  className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-warm-dark rounded-lg font-semibold transition-all"
                >
                  취소
                </button>
                <button
                  onClick={enterAsExistingMember}
                  disabled={selectedMemberId === null}
                  className="flex-1 py-3 bg-gradient-to-r from-pink-400 to-pink-500 hover:from-pink-500 hover:to-pink-600 text-white rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  입장하기
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 참여 폼 - 토글로 표시/숨김 */}
        {showJoinForm && (
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-8 border border-white/30 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-warm-dark">
                새 멤버로 참여하기
              </h3>
              <button
                onClick={() => {
                  setShowJoinForm(false)
                  setMemberInfo({ name: '', phone: '', account: '' })
                }}
                className="text-gray-400 hover:text-gray-600 text-2xl"
                title="닫기"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-warm-dark font-semibold mb-2">
                  이름 *
                </label>
                <input
                  type="text"
                  value={memberInfo.name}
                  onChange={(e) => setMemberInfo(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="이름을 입력해주세요"
                  disabled={joining}
                  className="w-full px-4 py-3 border-2 border-white/30 rounded-lg bg-white/90 backdrop-blur-sm focus:border-pink-400 focus:outline-none transition-colors text-warm-dark placeholder-warm-gray disabled:opacity-50"
                />
              </div>
              
              <div>
                <label className="block text-warm-dark font-semibold mb-2">
                  전화번호 *
                </label>
                <input
                  type="tel"
                  value={memberInfo.phone}
                  onChange={(e) => setMemberInfo(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="010-1234-5678"
                  disabled={joining}
                  className="w-full px-4 py-3 border-2 border-white/30 rounded-lg bg-white/90 backdrop-blur-sm focus:border-pink-400 focus:outline-none transition-colors text-warm-dark placeholder-warm-gray disabled:opacity-50"
                />
              </div>
              
              <div>
                <label className="block text-warm-dark font-semibold mb-2">
                  계좌번호 *
                  <span className="text-sm text-warm-gray font-normal ml-2">(은행명 포함)</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={memberInfo.account}
                    onChange={(e) => setMemberInfo(prev => ({ ...prev, account: e.target.value }))}
                    placeholder="카카오뱅크 3333-01-1234567890"
                    disabled={joining}
                    className="w-full px-4 py-3 pr-16 border-2 border-white/30 rounded-lg bg-white/90 backdrop-blur-sm focus:border-pink-400 focus:outline-none transition-colors text-warm-dark placeholder-warm-gray disabled:opacity-50 text-sm sm:text-base overflow-x-auto"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 bg-white/80 px-1 rounded">
                    {memberInfo.account.length}자
                  </div>
                </div>
                <p className="text-xs text-warm-gray mt-2">
                  💡 정산 완료 후 송금받을 계좌번호를 한 줄로 입력해주세요<br/>
                  긴 계좌번호는 입력창에서 좌우 스크롤로 확인 가능 (나중에 수정 가능)
                </p>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={joinGroup}
                  disabled={joining}
                  className="flex-1 py-4 bg-gradient-to-r from-pink-400 to-pink-500 hover:from-pink-500 hover:to-pink-600 text-white rounded-xl font-bold text-lg transition-all transform hover:scale-[1.02] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {joining ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      그룹 참여 중...
                    </span>
                  ) : (
                    '🎉 그룹 참여하기'
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowJoinForm(false)
                    setMemberInfo({ name: '', phone: '', account: '' })
                  }}
                  disabled={joining}
                  className="flex-1 py-4 bg-gray-200 hover:bg-gray-300 text-warm-dark rounded-xl font-semibold transition-all disabled:opacity-50"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 하단 링크 */}
        <div className="text-center mt-8">
          <Link 
            href="/" 
            className="text-warm-gray hover:text-warm-dark text-sm transition-colors"
          >
            또는 새로운 그룹 만들기 →
          </Link>
        </div>
      </div>
    </div>
  )
}