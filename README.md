# ScreenCapture

Windows용 화면 캡쳐 프로그램. Electron + TypeScript.

## 기능
- **영역 / 창 / 전체 화면 캡쳐**
- **전역 단축키** 캡쳐 (기본: 영역 `Ctrl+Shift+1`, 창 `Ctrl+Shift+2`, 전체 `Ctrl+Shift+3`, 녹화 `Ctrl+Shift+R`)
- **주석 편집기**: 펜 · 화살표 · 사각형 · 원 · 텍스트 · 모자이크, 색상/굵기, 실행취소
- **화면 녹화**: WebM 녹화 후 MP4 / GIF 변환 (ffmpeg 내장)
- **저장 + 클립보드 복사** 동시 지원, 날짜 기반 자동 파일명/폴더
- **트레이 상주**, 설정 화면(저장 폴더, 포맷, 단축키, 녹화 옵션)

## 개발
```bash
npm install
npm run dev        # 개발 실행 (트레이 상주)
npm run typecheck  # 타입 검사
npm run build      # out/ 빌드
```

트레이 아이콘 좌클릭 = 전체 캡쳐, 우클릭 = 메뉴. 결과물은 기본적으로
`사진\ScreenCapture\` 폴더에 저장됩니다.

## 패키징
```bash
npm run pack            # @electron/packager 로 실행본 생성 (권장, 서명 불필요)
                        # → dist-packager/ScreenCapture-win32-x64/ScreenCapture.exe
npm run pack:installer  # electron-builder NSIS 인스톨러 (아래 주의 참고)
```

> ⚠️ `pack:installer`(electron-builder)는 코드서명 도구(winCodeSign) 압축 해제 시
> **심볼릭 링크 생성 권한**이 필요합니다. 일반 사용자 환경에서는 실패하므로,
> Windows **개발자 모드**를 켜거나 **관리자 권한 터미널**에서 실행하세요.
> 그렇지 않으면 서명이 필요 없는 `npm run pack` 을 사용하면 됩니다.

## 구조
```
src/
  main/      메인 프로세스 (캡쳐·녹화·트레이·단축키·IPC·설정·저장)
  preload/   contextBridge 안전 API
  renderer/  overlay(영역선택) · picker(창선택) · editor(주석) · settings · recorder(숨김)
  shared/    IPC 채널·타입 정의
resources/   아이콘 및 생성 스크립트
scripts/     packager 빌드 스크립트
```

## 아이콘 재생성
```bash
npm run icon   # resources/icon.png 와 icon.ico 생성
```
