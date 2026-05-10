'use client'

import { useState } from 'react'
import Link from 'next/link'

const MARQUEE_TEXT = '✦ 함께정산 — 친구와 쉽게 더치페이 ✦ 새 그룹을 만들어보세요 ✦ 초대 링크로 친구 초대 ✦ 실시간 정산 결과 확인 ✦ 엑셀 다운로드 지원 ✦ '

export default function Home() {
  const [showGuide, setShowGuide] = useState(false)

  return (
    <>
      {/* 마키 띠 */}
      <div className="y2k-marquee">
        <div className="y2k-marquee-inner">
          <span className="font-pixel text-[10px] text-[var(--y2k-yellow)] px-4">{MARQUEE_TEXT}</span>
          <span className="font-pixel text-[10px] text-[var(--y2k-yellow)] px-4">{MARQUEE_TEXT}</span>
        </div>
      </div>

      <div className="min-h-screen y2k-noise" style={{ background: 'var(--y2k-cream)' }}>
        <div className="max-w-2xl mx-auto px-4 py-10">

          {/* 히어로 섹션 */}
          <div className="bg-white border-b-2 border-[var(--y2k-black)] mb-8 rounded-t-2xl overflow-hidden">
            {/* 윈95 타이틀바 */}
            <div className="y2k-win95-bar">
              <span className="font-pixel text-[9px] text-white">🖥 함께정산.exe</span>
              <div className="flex gap-1">
                <div className="y2k-win95-btn">_</div>
                <div className="y2k-win95-btn">□</div>
                <div className="y2k-win95-btn">✕</div>
              </div>
            </div>
            {/* 히어로 본문 */}
            <div className="p-6 flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-[10px] text-[var(--y2k-t3)] mb-1 font-pixel">2026.05.10 ✦ ver 2.0</p>
                <h1 className="font-pixel text-[22px] leading-tight text-[var(--y2k-black)] mb-2">
                  🧮 함께정산
                </h1>
                <p className="text-[11px] text-[var(--y2k-t2)] mb-5 leading-relaxed">
                  친구들과 쉽고 투명한 정산을<br/>경험해보세요!
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link
                    href="/groups/create"
                    className="y2k-btn px-6 py-2.5 text-sm text-center"
                  >
                    ✦ 새 그룹 만들기
                  </Link>
                  <button
                    onClick={() => setShowGuide(true)}
                    className="y2k-btn-out px-6 py-2.5 text-sm"
                  >
                    ? 사용법 보기
                  </button>
                </div>
              </div>
              {/* 앱 아이콘 */}
              <div
                className="flex-shrink-0 w-16 h-16 rounded-xl flex items-center justify-center text-3xl"
                style={{
                  background: 'linear-gradient(135deg, var(--y2k-pink-l), var(--y2k-pink-b))',
                  border: '2px solid var(--y2k-black)',
                  boxShadow: '2px 2px 0 var(--y2k-black)',
                }}
              >
                🧮
              </div>
            </div>
          </div>

          {/* 기능 카드 그리드 */}
          <div>
            <p className="font-pixel text-[11px] text-[var(--y2k-t2)] mb-4">✦ 주요 기능</p>
            <div className="grid grid-cols-2 gap-4 mb-4">
              {/* 스마트 정산 */}
              <div className="y2k-card p-4">
                <div
                  className="y2k-icon-box mb-3"
                  style={{ background: 'linear-gradient(135deg, var(--y2k-yellow), #FFD000)' }}
                >
                  <span className="text-sm">💰</span>
                </div>
                <h3 className="font-pixel text-[10px] text-[var(--y2k-black)] mb-1">스마트 정산</h3>
                <p className="text-[9px] text-[var(--y2k-t2)] leading-relaxed">복잡한 다자간 정산을 최소 송금으로 자동 계산</p>
              </div>

              {/* 실시간 협업 */}
              <div className="y2k-card p-4">
                <div
                  className="y2k-icon-box mb-3"
                  style={{ background: 'linear-gradient(135deg, var(--y2k-pink-l), var(--y2k-pink-b))' }}
                >
                  <span className="text-sm">👥</span>
                </div>
                <h3 className="font-pixel text-[10px] text-[var(--y2k-black)] mb-1">실시간 협업</h3>
                <p className="text-[9px] text-[var(--y2k-t2)] leading-relaxed">모든 참여자가 함께 지출을 입력하고 확인</p>
              </div>

              {/* 엑셀 다운로드 */}
              <div className="y2k-card p-4">
                <div
                  className="y2k-icon-box mb-3"
                  style={{ background: 'linear-gradient(135deg, var(--y2k-lime-l), #CCFF80)' }}
                >
                  <span className="text-sm">📊</span>
                </div>
                <h3 className="font-pixel text-[10px] text-[var(--y2k-black)] mb-1">엑셀 다운로드</h3>
                <p className="text-[9px] text-[var(--y2k-t2)] leading-relaxed">모든 정산 내역을 엑셀로 저장하고 백업</p>
              </div>

              {/* 초대 링크 */}
              <div className="y2k-card p-4">
                <div
                  className="y2k-icon-box mb-3"
                  style={{ background: 'linear-gradient(135deg, var(--y2k-blue-l), #80D8F8)' }}
                >
                  <span className="text-sm">🔗</span>
                </div>
                <h3 className="font-pixel text-[10px] text-[var(--y2k-black)] mb-1">초대 링크</h3>
                <p className="text-[9px] text-[var(--y2k-t2)] leading-relaxed">링크 하나로 친구들을 그룹에 쉽게 초대</p>
              </div>
            </div>

            {/* 계좌 연동 — 전체 폭 */}
            <div className="y2k-card p-4 flex items-center gap-4">
              <div
                className="y2k-icon-box flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, var(--y2k-pink-l), var(--y2k-pink-b))' }}
              >
                <span className="text-sm">🏦</span>
              </div>
              <div>
                <h3 className="font-pixel text-[10px] text-[var(--y2k-black)] mb-0.5">계좌 연동</h3>
                <p className="text-[9px] text-[var(--y2k-t2)]">클릭 한 번으로 계좌번호 확인 및 복사</p>
              </div>
              <div className="ml-auto">
                <Link href="/groups/create" className="y2k-btn px-4 py-1.5 text-[11px]">
                  시작 →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 사용법 가이드 모달 */}
      {showGuide && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="y2k-win95 max-w-lg w-full max-h-[85vh] flex flex-col bg-white">
            {/* 타이틀바 */}
            <div className="y2k-win95-bar flex-shrink-0">
              <span className="font-pixel text-[9px] text-white">📖 함께정산 사용법.txt</span>
              <div className="flex gap-1">
                <div className="y2k-win95-btn">_</div>
                <div className="y2k-win95-btn">□</div>
                <div className="y2k-win95-btn" onClick={() => setShowGuide(false)}>✕</div>
              </div>
            </div>

            {/* 본문 */}
            <div className="overflow-y-auto p-5 space-y-5">
              <div>
                <p className="font-pixel text-[11px] text-[var(--y2k-black)] mb-3">🚀 기본 사용법</p>
                <div className="space-y-2">
                  {[
                    { n: '1', color: 'var(--y2k-yellow)', title: '그룹 생성', desc: '"새 그룹 만들기"로 정산 그룹을 생성하고 친구들 정보를 입력하세요.' },
                    { n: '2', color: 'var(--y2k-blue)', title: '친구 초대', desc: '생성된 초대 링크를 친구들에게 공유해서 그룹에 참여시키세요.' },
                    { n: '3', color: 'var(--y2k-lime)', title: '지출 입력', desc: '누구든 지출 내역을 입력할 수 있어요. 실시간으로 모든 멤버에게 반영됩니다.' },
                    { n: '4', color: 'var(--y2k-pink)', title: '자동 정산', desc: '복잡한 계산은 자동으로! 누가 누구에게 얼마를 송금해야 하는지 확인하세요.' },
                  ].map(({ n, color, title, desc }) => (
                    <div key={n} className="flex items-start gap-3 p-3 y2k-card-cream">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center font-pixel text-[10px] flex-shrink-0"
                        style={{ background: color, border: '2px solid var(--y2k-black)' }}
                      >
                        {n}
                      </div>
                      <div>
                        <p className="font-pixel text-[10px] text-[var(--y2k-black)] mb-0.5">{title}</p>
                        <p className="text-[10px] text-[var(--y2k-t2)]">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="font-pixel text-[11px] text-[var(--y2k-black)] mb-3">💡 팁 & 주의사항</p>
                <div className="space-y-2">
                  <div className="p-3 y2k-card-cream border-l-4 border-[var(--y2k-yellow)]">
                    <p className="text-[10px] text-[var(--y2k-t1)]"><strong>💰 지출 입력 팁:</strong> 영수증을 보면서 정확한 금액과 참여자를 선택하세요.</p>
                  </div>
                  <div className="p-3 y2k-card-cream border-l-4 border-[var(--y2k-blue)]">
                    <p className="text-[10px] text-[var(--y2k-t1)]"><strong>🔗 초대 링크:</strong> 그룹 생성 후 바로 친구들에게 링크를 공유하면 실시간으로 함께 지출을 입력할 수 있어요.</p>
                  </div>
                  <div className="p-3 y2k-card-cream border-l-4 border-[var(--y2k-lime)]">
                    <p className="text-[10px] text-[var(--y2k-t1)]"><strong>📱 모바일 사용:</strong> 스마트폰에서도 모든 기능을 사용할 수 있어요.</p>
                  </div>
                  <div className="p-3 y2k-card-cream border-l-4 border-[var(--y2k-pink)]">
                    <p className="text-[10px] text-[var(--y2k-t1)]"><strong>⚠️ 삭제 주의:</strong> 그룹 삭제는 복구할 수 없어요. 꼭 엑셀로 백업 후 삭제하세요.</p>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t-2 border-dashed border-[var(--y2k-muted)] text-center">
                <Link
                  href="/groups/create"
                  onClick={() => setShowGuide(false)}
                  className="y2k-btn px-8 py-3 text-sm inline-block"
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
