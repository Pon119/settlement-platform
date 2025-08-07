'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function Home() {
  const [showGuide, setShowGuide] = useState(false)

  return (
    <>
      <div className="min-h-screen flex items-center justify-center px-4 py-8 relative">
        <div className="text-center max-w-4xl mx-auto w-full">
          {/* 가이드 버튼 - 우상단 고정 */}
          <button
            onClick={() => setShowGuide(true)}
            className="fixed top-4 right-4 z-40 w-12 h-12 bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/30 rounded-full flex items-center justify-center text-warm-dark text-xl font-bold transition-all hover:scale-110 shadow-lg"
            aria-label="사용법 가이드"
          >
            ?
          </button>

          {/* 메인 제목 */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-4 sm:mb-6 drop-shadow-lg">
            🧮 함께정산
          </h1>
          <p className="text-lg sm:text-xl text-white/90 mb-8 sm:mb-12 leading-relaxed px-4">
            친구들과 쉽고 투명한 정산을 경험해보세요<br className="hidden sm:block"/>
            <span className="sm:hidden"> </span>복잡한 계산은 자동으로, 송금은 간편하게!
          </p>
          
          {/* CTA 버튼들 - 모바일 최적화 */}
          <div className="space-y-4 sm:space-y-0 sm:space-x-6 sm:flex sm:justify-center mb-12 sm:mb-16 px-4">
            <Link 
              href="/groups/create" 
              className="block w-full sm:w-auto bg-gradient-to-r from-pink-400 to-pink-500 hover:from-pink-500 hover:to-pink-600 text-white px-6 sm:px-8 py-4 rounded-xl font-semibold text-lg transition-all transform hover:scale-105 shadow-lg hover:shadow-xl"
            >
              새 그룹 만들기
            </Link>
            <button 
              onClick={() => setShowGuide(true)}
              className="block w-full sm:w-auto bg-white/20 hover:bg-white/30 text-white px-6 sm:px-8 py-4 rounded-xl font-semibold text-lg backdrop-blur-sm transition-all transform hover:scale-105 border border-white/30"
            >
              사용법 보기
            </button>
          </div>

          {/* 기능 카드들 - 모바일 최적화 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 text-white/80 px-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-all">
              <div className="text-4xl mb-4">💰</div>
              <h3 className="font-semibold text-lg mb-2 text-warm-dark">스마트 정산</h3>
              <p className="text-sm text-warm-gray">복잡한 다자간 정산을 최소 송금으로 자동 계산</p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-all">
              <div className="text-4xl mb-4">👥</div>
              <h3 className="font-semibold text-lg mb-2 text-warm-dark">실시간 협업</h3>
              <p className="text-sm text-warm-gray">모든 참여자가 함께 지출을 입력하고 확인</p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-all sm:col-span-2 lg:col-span-1">
              <div className="text-4xl mb-4">🏦</div>
              <h3 className="font-semibent text-lg mb-2 text-warm-dark">계좌 연동</h3>
              <p className="text-sm text-warm-gray">클릭 한 번으로 계좌번호 확인 및 복사</p>
            </div>
          </div>

          {/* 추가 기능들 */}
          <div className="mt-12 sm:mt-16 grid grid-cols-1 sm:grid-cols-2 gap-6 px-4">
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
              <div className="text-3xl mb-3">📊</div>
              <h3 className="font-semibold text-lg mb-2 text-warm-dark">엑셀 다운로드</h3>
              <p className="text-sm text-warm-gray">모든 정산 내역을 엑셀로 저장하고 백업</p>
            </div>
            
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
              <div className="text-3xl mb-3">🔗</div>
              <h3 className="font-semibold text-lg mb-2 text-warm-dark">초대 링크</h3>
              <p className="text-sm text-warm-gray">링크 하나로 친구들을 그룹에 쉽게 초대</p>
            </div>
          </div>
        </div>
      </div>

      {/* 사용법 가이드 모달 */}
      {showGuide && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* 모달 헤더 */}
            <div className="sticky top-0 bg-white border-b p-6 rounded-t-2xl">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-warm-dark flex items-center gap-2">
                  📖 함께정산 사용법
                </h2>
                <button
                  onClick={() => setShowGuide(false)}
                  className="w-8 h-8 bg-gray-200 hover:bg-gray-300 rounded-full flex items-center justify-center font-bold text-gray-600"
                >
                  ×
                </button>
              </div>
            </div>

            {/* 모달 내용 */}
            <div className="p-6 space-y-8">
              {/* 기본 사용법 */}
              <div>
                <h3 className="text-xl font-bold text-warm-dark mb-4 flex items-center gap-2">
                  🚀 기본 사용법
                </h3>
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-4 bg-pink-50 rounded-lg">
                    <div className="w-8 h-8 bg-pink-500 text-white rounded-full flex items-center justify-center font-bold text-sm">1</div>
                    <div>
                      <h4 className="font-semibold text-warm-dark">그룹 생성</h4>
                      <p className="text-warm-gray text-sm">"새 그룹 만들기"로 정산 그룹을 생성하고 친구들 정보를 입력하세요.</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg">
                    <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold text-sm">2</div>
                    <div>
                      <h4 className="font-semibold text-warm-dark">친구 초대</h4>
                      <p className="text-warm-gray text-sm">생성된 초대 링크를 친구들에게 공유해서 그룹에 참여시키세요.</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 p-4 bg-green-50 rounded-lg">
                    <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-bold text-sm">3</div>
                    <div>
                      <h4 className="font-semibold text-warm-dark">지출 입력</h4>
                      <p className="text-warm-gray text-sm">누구든 지출 내역을 입력할 수 있어요. 실시간으로 모든 멤버에게 반영됩니다.</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 p-4 bg-purple-50 rounded-lg">
                    <div className="w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center font-bold text-sm">4</div>
                    <div>
                      <h4 className="font-semibold text-warm-dark">자동 정산</h4>
                      <p className="text-warm-gray text-sm">복잡한 계산은 자동으로! 누가 누구에게 얼마를 송금해야 하는지 한눈에 확인하세요.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 주요 기능들 */}
              <div>
                <h3 className="text-xl font-bold text-warm-dark mb-4 flex items-center gap-2">
                  ⭐ 주요 기능들
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 border border-gray-200 rounded-lg">
                    <h4 className="font-semibold text-warm-dark mb-2 flex items-center gap-2">
                      🔗 초대 링크
                    </h4>
                    <p className="text-warm-gray text-sm">그룹 대시보드에서 초대 코드를 복사해서 친구들에게 공유하세요. 링크를 통해 쉽게 그룹에 참여할 수 있어요.</p>
                  </div>
                  
                  <div className="p-4 border border-gray-200 rounded-lg">
                    <h4 className="font-semibold text-warm-dark mb-2 flex items-center gap-2">
                      ✏️ 정보 수정
                    </h4>
                    <p className="text-warm-gray text-sm">프로필을 클릭해서 언제든 자신의 이름, 전화번호, 계좌번호를 수정할 수 있어요.</p>
                  </div>
                  
                  <div className="p-4 border border-gray-200 rounded-lg">
                    <h4 className="font-semibold text-warm-dark mb-2 flex items-center gap-2">
                      📊 엑셀 다운로드
                    </h4>
                    <p className="text-warm-gray text-sm">모든 정산 내역을 엑셀 파일로 다운로드해서 오프라인에서도 확인하고 보관할 수 있어요.</p>
                  </div>
                  
                  <div className="p-4 border border-gray-200 rounded-lg">
                    <h4 className="font-semibold text-warm-dark mb-2 flex items-center gap-2">
                      🗃️ 백업 & 삭제
                    </h4>
                    <p className="text-warm-gray text-sm">정산이 끝나면 데이터를 엑셀로 백업한 후 그룹을 삭제해서 깔끔하게 정리하세요.</p>
                  </div>
                </div>
              </div>

              {/* 팁 & 주의사항 */}
              <div>
                <h3 className="text-xl font-bold text-warm-dark mb-4 flex items-center gap-2">
                  💡 팁 & 주의사항
                </h3>
                <div className="space-y-3">
                  <div className="p-3 bg-yellow-50 border-l-4 border-yellow-400">
                    <p className="text-sm text-warm-dark">
                      <strong>💰 지출 입력 팁:</strong> 영수증을 보면서 정확한 금액과 참여자를 선택하세요.
                    </p>
                  </div>
                  
                  <div className="p-3 bg-blue-50 border-l-4 border-blue-400">
                    <p className="text-sm text-warm-dark">
                      <strong>🔗 초대 링크:</strong> 그룹 생성 후 바로 친구들에게 링크를 공유하면 실시간으로 함께 지출을 입력할 수 있어요.
                    </p>
                  </div>
                  
                  <div className="p-3 bg-green-50 border-l-4 border-green-400">
                    <p className="text-sm text-warm-dark">
                      <strong>📱 모바일 사용:</strong> 스마트폰에서도 모든 기능을 사용할 수 있어요. 외출 중에도 바로바로 지출을 입력하세요.
                    </p>
                  </div>
                  
                  <div className="p-3 bg-red-50 border-l-4 border-red-400">
                    <p className="text-sm text-warm-dark">
                      <strong>⚠️ 삭제 주의:</strong> 그룹 삭제는 복구할 수 없어요. 꼭 엑셀 다운로드로 백업한 후에 삭제하세요.
                    </p>
                  </div>
                </div>
              </div>

              {/* 시작하기 버튼 */}
              <div className="text-center pt-4 border-t">
                <Link
                  href="/groups/create"
                  onClick={() => setShowGuide(false)}
                  className="inline-block bg-gradient-to-r from-pink-400 to-pink-500 hover:from-pink-500 hover:to-pink-600 text-white px-8 py-3 rounded-xl font-semibold text-lg transition-all transform hover:scale-105 shadow-lg"
                >
                  🚀 지금 시작하기
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}