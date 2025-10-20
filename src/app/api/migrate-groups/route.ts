// app/api/migrate-groups/route.ts
import { db } from '@/lib/firebase'
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore'
import { NextResponse } from 'next/server'

// ✅ 직접 함수 정의 (import 의존성 제거)
function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

function createInviteLink(inviteCode: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://jeongsanheabar.vercel.app'
  return `${baseUrl}/invite/${inviteCode}`
}

export async function GET() {
  try {
    console.log('🔄 기존 그룹 마이그레이션 시작...')
    
    const groupsSnapshot = await getDocs(collection(db, 'groups'))
    
    let updatedCount = 0
    let skippedCount = 0
    const results = []
    
    for (const groupDoc of groupsSnapshot.docs) {
      const data = groupDoc.data()
      
      // 초대 코드가 없는 그룹만 업데이트
      if (!data.inviteCode) {
        const inviteCode = generateInviteCode()
        const inviteLink = createInviteLink(inviteCode)
        
        await updateDoc(doc(db, 'groups', groupDoc.id), {
          inviteCode,
          inviteLink,
          allowInvites: true,
          maxMembers: 20,
          lastUpdated: new Date()
        })
        
        console.log(`✅ 그룹 "${data.name}" (${groupDoc.id}) 업데이트 완료`)
        console.log(`   초대 링크: ${inviteLink}`)
        
        results.push({
          id: groupDoc.id,
          name: data.name,
          inviteCode,
          inviteLink,
          status: 'updated'
        })
        
        updatedCount++
      } else {
        console.log(`⏭️ 그룹 "${data.name}" (${groupDoc.id}) 이미 초대 코드 있음`)
        
        results.push({
          id: groupDoc.id,
          name: data.name,
          inviteCode: data.inviteCode,
          inviteLink: data.inviteLink,
          status: 'skipped'
        })
        
        skippedCount++
      }
    }
    
    console.log('✅ 마이그레이션 완료!')
    console.log(`   업데이트: ${updatedCount}개`)
    console.log(`   스킵: ${skippedCount}개`)
    
    return NextResponse.json({ 
      success: true, 
      message: '마이그레이션 완료',
      updated: updatedCount,
      skipped: skippedCount,
      total: groupsSnapshot.size,
      details: results
    })
  } catch (error: any) {
    console.error('❌ 마이그레이션 실패:', error)
    
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      stack: error.stack 
    }, { status: 500 })
  }
}