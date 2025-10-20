// app/api/migrate-groups/route.ts
import { db } from '@/lib/firebase'
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore'
import { generateInviteCode, createInviteLink } from '@/lib/invite'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    console.log('🔄 기존 그룹 마이그레이션 시작...')
    
    const groupsSnapshot = await getDocs(collection(db, 'groups'))
    
    let updatedCount = 0
    let skippedCount = 0
    
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
        updatedCount++
      } else {
        console.log(`⏭️ 그룹 "${data.name}" (${groupDoc.id}) 이미 초대 코드 있음`)
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
      total: groupsSnapshot.size
    })
  } catch (error: any) {
    console.error('❌ 마이그레이션 실패:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 })
  }
}