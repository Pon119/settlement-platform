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

export default function InvitePage() {
  const params = useParams()
  const router = useRouter()
  const [group, setGroup] = useState<Group | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')

  // 참여자 정보 입력 폼
  const [memberInfo, setMemberInfo] = useState({
    name: '',
    phone: '',
    account: ''
  })

  const inviteCode = params.code as string

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
        
      } catch (error) {
        console.error('❌ 그룹 검색 실패:', error)
        setError('그룹 정보를 불러오는 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }

    findGroupByInviteCode()
  }, [inviteCode])

  // 그룹 참여하기
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

        {/* 그룹 정보 */}
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
        </div>

        {/* 참여 폼 */}
        <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-8 border border-white/30 shadow-xl">
          <h3 className="text-xl font-bold text-warm-dark mb-6 text-center">
            참여 정보 입력
          </h3>
          
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
                {/* 글자수 표시 */}
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 bg-white/80 px-1 rounded">
                  {memberInfo.account.length}자
                </div>
              </div>
              <p className="text-xs text-warm-gray mt-2">
                💡 정산 완료 후 송금받을 계좌번호를 한 줄로 입력해주세요<br/>
                긴 계좌번호는 입력창에서 좌우 스크롤로 확인 가능 (나중에 수정 가능)
              </p>
            </div>
            
            <button
              onClick={joinGroup}
              disabled={joining}
              className="w-full py-4 bg-gradient-to-r from-pink-400 to-pink-500 hover:from-pink-500 hover:to-pink-600 text-white rounded-xl font-bold text-lg transition-all transform hover:scale-[1.02] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
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
          </div>
        </div>

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